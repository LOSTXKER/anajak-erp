/**
 * Stock Sync Service
 *
 * Syncs products and stock levels from Anajak Stock API
 * into the local ERP Product/ProductVariant tables.
 *
 * Architecture: Client-driven page-by-page sync.
 * Each syncProductPage() call handles one page (~20 products)
 * and uses batch operations (createMany) to stay within
 * Vercel's serverless timeout (<10s).
 */

import { prisma } from "@/lib/prisma";
import {
  StockApiClient,
  type StockProduct,
  type StockVariant,
} from "@/lib/stock-api";
import { COST_RATES_KEY, parseCostRates } from "@/lib/cost-rates";
import { createNotification } from "@/server/helpers";

// ============================================================
// MAPPING HELPERS
// ============================================================

const CATEGORY_TO_ITEM_TYPE: Record<string, string> = {
  วัตถุดิบ: "RAW_MATERIAL",
  อุปกรณ์: "CONSUMABLE",
};

function resolveItemType(sp: StockProduct): string {
  if (sp.itemType) return sp.itemType;
  if (sp.category && CATEGORY_TO_ITEM_TYPE[sp.category]) {
    return CATEGORY_TO_ITEM_TYPE[sp.category];
  }
  return "FINISHED_GOOD";
}

function mapProductType(stockCategory: string | null): string {
  switch (stockCategory) {
    case "เสื้อ":
      return "T_SHIRT";
    case "กางเกง":
      return "PANTS";
    case "เสื้อแจ็คเก็ต":
      return "JACKET";
    default:
      return "OTHER";
  }
}

function resolveVariantOptions(sv: StockVariant): {
  size: string;
  color: string;
} {
  const sizeOpt = sv.options?.find((o) => /ไซส์|size/i.test(o.type));
  const colorOpt = sv.options?.find((o) => /สี|color/i.test(o.type));

  if (sizeOpt || colorOpt) {
    return {
      size: sizeOpt?.value?.toUpperCase() || "FREE",
      color: colorOpt?.value || "-",
    };
  }
  return parseVariantName(sv.name);
}

function parseVariantName(name: string | null): {
  size: string;
  color: string;
} {
  if (!name) return { size: "FREE", color: "-" };

  const parts = name
    .split(/\s*[\/\-,]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sizeRe = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL|FREE|\d+)$/i;

  if (parts.length === 2) {
    if (sizeRe.test(parts[0]))
      return { size: parts[0].toUpperCase(), color: parts[1] };
    if (sizeRe.test(parts[1]))
      return { size: parts[1].toUpperCase(), color: parts[0] };
    return { size: parts[1], color: parts[0] };
  }
  if (parts.length === 1) {
    if (sizeRe.test(parts[0]))
      return { size: parts[0].toUpperCase(), color: "-" };
    return { size: "FREE", color: parts[0] };
  }
  return { size: "FREE", color: name };
}

// ============================================================
// TYPES
// ============================================================

export type SyncMode = "full" | "incremental";

export interface SyncProductEntry {
  sku: string;
  name: string;
  status: "created" | "updated" | "error";
  variantCount: number;
  error?: string;
}

export interface SyncPageResult {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
  // ทุนซื้อล็อตใหม่เบี่ยงจากที่เก็บไว้เกินเกณฑ์ (เรตต้นทุนกลาง ก้อน 2) — แจ้งกระดิ่งแล้ว
  costDeviations: Array<{ sku: string; name: string; oldCost: number; newCost: number }>;
  // Pagination
  page: number;
  totalPages: number;
  totalProducts: number;
  hasMore: boolean;
  // Per-product detail
  syncedProducts: SyncProductEntry[];
}

// ============================================================
// SYNC ONE PAGE (serverless-safe, <10s per call)
// ============================================================

export async function syncProductPage(
  client: StockApiClient,
  page: number,
  mode: SyncMode = "full",
  updatedAfter?: string | null
): Promise<SyncPageResult> {
  const result: SyncPageResult = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    errors: [],
    page,
    totalPages: 1,
    totalProducts: 0,
    hasMore: false,
    syncedProducts: [],
    costDeviations: [],
  };

  // เกณฑ์เตือนทุนซื้อเบี่ยง (เรตต้นทุนกลาง — default 10%) อ่านครั้งเดียวต่อหน้า
  const ratesSetting = await prisma.setting.findUnique({ where: { key: COST_RATES_KEY } });
  const deviationPct = parseCostRates(ratesSetting?.value).costDeviationAlertPct;

  // ── 1. Fetch one page from Stock API ────────────────────────
  // Keep page size small to fit within Vercel serverless timeout
  const apiParams: Parameters<StockApiClient["getProducts"]>[0] = {
    page,
    limit: 20,
  };
  if (mode === "incremental" && updatedAfter) {
    apiParams.updated_after = updatedAfter;
  }

  const res = await client.getProducts(apiParams);
  result.totalPages = res.data.pagination.totalPages;
  result.totalProducts = res.data.pagination.total;
  result.hasMore = page < res.data.pagination.totalPages;

  const stockProducts = res.data.items;
  if (stockProducts.length === 0) return result;

  // ── 2. Bulk pre-fetch existing records (2 parallel queries) ─
  const productSkus = stockProducts.map((p) => p.sku);
  const productStockIds = stockProducts.map((p) => p.id);
  const variantSkus = stockProducts.flatMap((p) =>
    p.variants.map((v) => v.sku)
  );
  const variantStockIds = stockProducts.flatMap((p) =>
    p.variants.map((v) => v.id)
  );

  const [existingProducts, existingVariants] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { sku: { in: productSkus } },
          { stockProductId: { in: productStockIds } },
        ],
      },
      select: { id: true, sku: true, stockProductId: true, costPrice: true },
    }),
    variantSkus.length > 0
      ? prisma.productVariant.findMany({
          where: {
            OR: [
              { sku: { in: variantSkus } },
              { stockVariantId: { in: variantStockIds } },
            ],
          },
          select: { id: true, sku: true, stockVariantId: true, costPrice: true },
        })
      : Promise.resolve([]),
  ]);

  // Build O(1) lookup maps
  const productBySku = new Map(existingProducts.map((p) => [p.sku, p]));
  const productByStockId = new Map(
    existingProducts
      .filter((p) => p.stockProductId)
      .map((p) => [p.stockProductId!, p])
  );
  const variantBySku = new Map(existingVariants.map((v) => [v.sku, v]));
  const variantByStockId = new Map(
    existingVariants
      .filter((v) => v.stockVariantId)
      .map((v) => [v.stockVariantId!, v])
  );

  // ── 3. Upsert each product individually (error-isolated) ───
  for (const sp of stockProducts) {
    const entry: SyncProductEntry = {
      sku: sp.sku,
      name: sp.name,
      status: "updated",
      variantCount: sp.variants.length,
    };

    try {
      const existing =
        productByStockId.get(sp.id) || productBySku.get(sp.sku);

      const productData = {
        sku: sp.sku,
        name: sp.name,
        description: sp.description,
        productType: mapProductType(sp.category),
        category: sp.category,
        basePrice: sp.lastCost || sp.standardCost || 0,
        costPrice: sp.lastCost || sp.standardCost || 0,
        stockProductId: sp.id,
        source: "STOCK",
        itemType: resolveItemType(sp),
        barcode: sp.barcode,
        unit: sp.unit,
        unitName: sp.unitName,
        reorderPoint: sp.reorderPoint || 0,
        totalStock: sp.totalStock || 0,
        lastSyncAt: new Date(),
        isActive: true,
      };

      let productId: string;

      if (existing) {
        // ทุนซื้อเบี่ยงเกินเกณฑ์ → เก็บไว้แจ้งกระดิ่งท้ายหน้า (เทียบเฉพาะสินค้าไม่มี
        // variant — ตัวมี variant เทียบรายไซส์/สีข้างล่างแทน กันแจ้งซ้ำสองชั้น)
        // หลังอัปเดตค่าใหม่ทับแล้ว รอบ sync ถัดไปจะไม่เตือนซ้ำเอง
        if (!sp.hasVariants) {
          const oldCost = Number(existing.costPrice ?? 0);
          const newCost = productData.costPrice;
          if (oldCost > 0 && newCost > 0 && (Math.abs(newCost - oldCost) / oldCost) * 100 > deviationPct) {
            result.costDeviations.push({ sku: sp.sku, name: sp.name, oldCost, newCost });
          }
        }
        const updated = await prisma.product.update({
          where: { id: existing.id },
          data: productData,
        });
        productId = updated.id;
        result.productsUpdated++;
        entry.status = "updated";
      } else {
        const created = await prisma.product.create({ data: productData });
        productId = created.id;
        result.productsCreated++;
        entry.status = "created";
      }

      // ── 3b. Upsert variants for this product ───────────────
      // Uses createMany for new variants (single query) to stay
      // within Vercel serverless timeout.
      if (sp.hasVariants && sp.variants.length > 0) {
        const newVariants: Array<{
          productId: string;
          size: string;
          color: string;
          sku: string;
          stockVariantId: string;
          barcode: string | null;
          costPrice: number;
          sellingPrice: number;
          stock: number;
          totalStock: number;
          isActive: boolean;
        }> = [];
        const updateOps: Array<Promise<unknown>> = [];

        for (const sv of sp.variants) {
          try {
            const { size, color } = resolveVariantOptions(sv);
            const existingVar =
              variantByStockId.get(sv.id) || variantBySku.get(sv.sku);

            const variantData = {
              size,
              color,
              sku: sv.sku,
              stockVariantId: sv.id,
              barcode: sv.barcode,
              // ทุนซื้อจริงล่าสุด (lastCost) มาก่อนราคาทุนที่ตั้งมือ — ฐานเดียวกับระดับ product
              costPrice: sv.lastCost || sv.costPrice || 0,
              sellingPrice: sv.sellingPrice || 0,
              stock: sv.totalStock || 0,
              totalStock: sv.totalStock || 0,
              isActive: true,
            };

            if (existingVar) {
              const oldCost = Number(existingVar.costPrice ?? 0);
              const newCost = variantData.costPrice;
              if (oldCost > 0 && newCost > 0 && (Math.abs(newCost - oldCost) / oldCost) * 100 > deviationPct) {
                result.costDeviations.push({ sku: sv.sku, name: `${sp.name} (${sv.sku})`, oldCost, newCost });
              }
            }

            if (existingVar) {
              // Queue update for parallel execution
              updateOps.push(
                prisma.productVariant
                  .update({
                    where: { id: existingVar.id },
                    data: variantData,
                  })
                  .then(() => {
                    result.variantsUpdated++;
                  })
                  .catch((vErr) => {
                    result.errors.push(
                      `Variant ${sv.sku}: ${vErr instanceof Error ? vErr.message : "Unknown error"}`
                    );
                  })
              );
            } else {
              // Collect for batch create
              newVariants.push({ ...variantData, productId });
            }
          } catch (vErr) {
            result.errors.push(
              `Variant ${sv.sku}: ${vErr instanceof Error ? vErr.message : "Unknown error"}`
            );
          }
        }

        // Execute batch create (single query, much faster)
        if (newVariants.length > 0) {
          try {
            const created = await prisma.productVariant.createMany({
              data: newVariants,
              skipDuplicates: true,
            });
            result.variantsCreated += created.count;
          } catch (bErr) {
            // If batch fails, fall back to individual creates
            for (const nv of newVariants) {
              try {
                await prisma.productVariant.create({ data: nv });
                result.variantsCreated++;
              } catch (vErr) {
                result.errors.push(
                  `Variant ${nv.sku}: ${vErr instanceof Error ? vErr.message : "Unknown error"}`
                );
              }
            }
          }
        }

        // Execute all updates in parallel
        if (updateOps.length > 0) {
          await Promise.allSettled(updateOps);
        }
      }
    } catch (pErr) {
      entry.status = "error";
      entry.error =
        pErr instanceof Error ? pErr.message : "Unknown error";
      result.errors.push(`Product ${sp.sku}: ${entry.error}`);
    }

    result.syncedProducts.push(entry);
  }

  // ทุนซื้อเบี่ยงเกินเกณฑ์ → กระดิ่ง OWNER/MANAGER "อยากปรับเรต/ราคาขายไหม"
  // แจ้งครั้งเดียวต่อการเปลี่ยน: หลัง sync ทับค่าใหม่แล้ว รอบถัดไปไม่เข้าเงื่อนไขซ้ำ
  if (result.costDeviations.length > 0) {
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["OWNER", "MANAGER"] }, isActive: true },
        select: { id: true },
      });
      // sync เต็มรอบวิ่งทีละหน้า (และ sync รอบแรกหลังเปลี่ยนฐานเป็น lastCost จะเบี่ยงเยอะ)
      // — กันกระดิ่งรัว: เตือนซ้ำชนิดเดียวกันไม่ถี่กว่า 1 ชม./คน
      const recentAlert = await prisma.notification.findFirst({
        where: {
          type: "COST_DEVIATION",
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recentAlert) return result;
      const top = result.costDeviations
        .slice(0, 5)
        .map((d) => `${d.sku}: ${d.oldCost.toLocaleString()}→${d.newCost.toLocaleString()} บ.`)
        .join(" · ");
      const more =
        result.costDeviations.length > 5 ? ` และอีก ${result.costDeviations.length - 5} รายการ` : "";
      for (const admin of admins) {
        await createNotification(prisma, {
          userId: admin.id,
          type: "COST_DEVIATION",
          title: `ทุนซื้อจาก Stock เปลี่ยนเกิน ${deviationPct}%`,
          message: `${top}${more} — ทบทวนเรตต้นทุน/ราคาขายของงานที่ใช้ตัวนี้`,
          link: "/settings/cost-rates",
        });
      }
    } catch (nErr) {
      // กระดิ่งพังต้องไม่ล้ม sync ที่สำเร็จแล้ว
      console.error("cost deviation notification error:", nErr);
    }
  }

  return result;
}

// ============================================================
// SYNC STOCK LEVELS ONLY (lightweight)
// ============================================================

export async function syncStockLevels(
  client: StockApiClient
): Promise<{ updated: number; errors: string[] }> {
  const result = { updated: 0, errors: [] as string[] };
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    try {
      const res = await client.getStock({ page, limit: 100 });
      totalPages = res.data.pagination.totalPages;

      for (const item of res.data.items) {
        try {
          if (item.variantSku) {
            const up = await prisma.productVariant.updateMany({
              where: { sku: item.variantSku },
              data: {
                stock: Math.floor(item.qty),
                totalStock: Math.floor(item.qty),
              },
            });
            if (up.count > 0) result.updated++;
          } else if (item.productSku) {
            const up = await prisma.product.updateMany({
              where: { sku: item.productSku },
              data: {
                totalStock: Math.floor(item.qty),
                lastSyncAt: new Date(),
              },
            });
            if (up.count > 0) result.updated++;
          }
        } catch (err) {
          result.errors.push(
            `Stock ${item.productSku}: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }
      page++;
    } catch (err) {
      result.errors.push(
        `Page ${page}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      break;
    }
  }

  return result;
}

// ============================================================
// SYNC STATUS
// ============================================================

export async function getSyncStatus(): Promise<{
  lastSyncAt: Date | null;
  totalStockProducts: number;
  totalLocalProducts: number;
  totalProducts: number;
}> {
  const [stockCount, localCount, totalCount, lastSync] = await Promise.all([
    prisma.product.count({ where: { source: "STOCK" } }),
    prisma.product.count({ where: { source: "LOCAL" } }),
    prisma.product.count(),
    prisma.product.findFirst({
      where: { source: "STOCK", lastSyncAt: { not: null } },
      orderBy: { lastSyncAt: "desc" },
      select: { lastSyncAt: true },
    }),
  ]);

  return {
    lastSyncAt: lastSync?.lastSyncAt ?? null,
    totalStockProducts: stockCount,
    totalLocalProducts: localCount,
    totalProducts: totalCount,
  };
}
