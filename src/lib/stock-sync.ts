/**
 * Stock Sync Service
 *
 * Syncs products and stock levels from Anajak Stock API
 * into the local ERP Product/ProductVariant tables.
 */

import { prisma } from "@/lib/prisma";
import { StockApiClient, type StockProduct, type StockVariant } from "@/lib/stock-api";

// ============================================================
// ITEM TYPE + PRODUCT TYPE MAPPING
// ============================================================

/** Fallback: derive itemType from category name (for Stock instances without itemType) */
const CATEGORY_TO_ITEM_TYPE: Record<string, string> = {
  วัตถุดิบ: "RAW_MATERIAL",
  อุปกรณ์: "CONSUMABLE",
};

function resolveItemType(sp: StockProduct): string {
  // Prefer explicit itemType from Stock API
  if (sp.itemType) return sp.itemType;
  // Fallback: map from category name
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

// ============================================================
// SYNC PROGRESS TRACKING
// ============================================================

export interface SyncProgress {
  phase: "connecting" | "fetching" | "syncing" | "done" | "error";
  currentProduct: string | null;
  currentPage: number;
  totalPages: number;
  processedCount: number;
  totalCount: number;
  recentProducts: string[]; // last ~20 product names synced
}

const RECENT_PRODUCTS_LIMIT = 20;

// Module-level progress store (shared across requests in same process)
let _syncProgress: SyncProgress | null = null;

export function getSyncProgress(): SyncProgress | null {
  return _syncProgress;
}

export function resetSyncProgress(): void {
  _syncProgress = null;
}

function updateProgress(update: Partial<SyncProgress>): void {
  if (!_syncProgress) {
    _syncProgress = {
      phase: "connecting",
      currentProduct: null,
      currentPage: 0,
      totalPages: 0,
      processedCount: 0,
      totalCount: 0,
      recentProducts: [],
    };
  }
  Object.assign(_syncProgress, update);
}

// ============================================================
// SYNC ALL PRODUCTS
// ============================================================

export interface SyncResult {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
}

export async function syncAllProducts(
  client: StockApiClient
): Promise<SyncResult> {
  const result: SyncResult = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    errors: [],
  };

  updateProgress({ phase: "connecting", currentProduct: null });

  // ── Phase 1: Fetch ALL products from Stock API ──────────────
  const allStockProducts: StockProduct[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    updateProgress({
      phase: page === 1 ? "fetching" : "fetching",
      currentPage: page,
      totalPages,
      currentProduct: `กำลังดึงหน้า ${page}...`,
    });

    try {
      const res = await client.getProducts({ page, limit: 100 });
      totalPages = res.data.pagination.totalPages;
      allStockProducts.push(...res.data.items);
      updateProgress({ totalPages, totalCount: res.data.pagination.total });
      page++;
    } catch (err) {
      result.errors.push(
        `Page ${page}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      break;
    }
  }

  if (allStockProducts.length === 0) {
    updateProgress({ phase: "done", currentProduct: null });
    return result;
  }

  // ── Phase 2: Pre-fetch existing records in bulk (2 queries) ─
  updateProgress({
    phase: "syncing",
    currentProduct: "กำลังเตรียมข้อมูล...",
    totalCount: allStockProducts.length,
  });

  const allProductSkus = allStockProducts.map((p) => p.sku);
  const allProductStockIds = allStockProducts.map((p) => p.id);
  const allVariantSkus = allStockProducts.flatMap((p) => p.variants.map((v) => v.sku));
  const allVariantStockIds = allStockProducts.flatMap((p) => p.variants.map((v) => v.id));

  const [existingProducts, existingVariants] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { sku: { in: allProductSkus } },
          { stockProductId: { in: allProductStockIds } },
        ],
      },
      select: { id: true, sku: true, stockProductId: true },
    }),
    prisma.productVariant.findMany({
      where: {
        OR: [
          { sku: { in: allVariantSkus } },
          { stockVariantId: { in: allVariantStockIds } },
        ],
      },
      select: { id: true, sku: true, stockVariantId: true },
    }),
  ]);

  // Build O(1) lookup maps
  const productBySku = new Map(existingProducts.map((p) => [p.sku, p]));
  const productByStockId = new Map(
    existingProducts.filter((p) => p.stockProductId).map((p) => [p.stockProductId!, p])
  );
  const variantBySku = new Map(existingVariants.map((v) => [v.sku, v]));
  const variantByStockId = new Map(
    existingVariants.filter((v) => v.stockVariantId).map((v) => [v.stockVariantId!, v])
  );

  // ── Phase 3: Batch upsert products ─────────────────────────
  let processedCount = 0;

  // Process in batches of ~5 products at a time using $transaction
  const BATCH_SIZE = 5;

  for (let i = 0; i < allStockProducts.length; i += BATCH_SIZE) {
    const batch = allStockProducts.slice(i, i + BATCH_SIZE);
    const txOps: ReturnType<typeof prisma.product.upsert>[] = [];

    for (const sp of batch) {
      const existing = productByStockId.get(sp.id) || productBySku.get(sp.sku);
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

      if (existing) {
        txOps.push(
          prisma.product.update({ where: { id: existing.id }, data: productData })
        );
        result.productsUpdated++;
      } else {
        txOps.push(
          prisma.product.create({ data: productData }) as ReturnType<typeof prisma.product.upsert>
        );
        result.productsCreated++;
      }
    }

    // Execute product batch
    try {
      const upsertedProducts = await prisma.$transaction(txOps);

      // Build a map of sku -> id for the just-upserted products
      const upsertedMap = new Map<string, string>();
      for (const p of upsertedProducts) {
        upsertedMap.set(p.sku, p.id);
      }

      // Now batch upsert variants for these products
      const variantTxOps: ReturnType<typeof prisma.productVariant.update>[] = [];

      for (const sp of batch) {
        const productId = upsertedMap.get(sp.sku);
        if (!productId || !sp.hasVariants || sp.variants.length === 0) continue;

        for (const sv of sp.variants) {
          try {
            const { size, color } = resolveVariantOptions(sv);
            const existingVar = variantByStockId.get(sv.id) || variantBySku.get(sv.sku);

            const variantData = {
              size,
              color,
              sku: sv.sku,
              stockVariantId: sv.id,
              barcode: sv.barcode,
              costPrice: sv.costPrice || 0,
              sellingPrice: sv.sellingPrice || 0,
              stock: sv.totalStock || 0,
              totalStock: sv.totalStock || 0,
              isActive: true,
            };

            if (existingVar) {
              variantTxOps.push(
                prisma.productVariant.update({
                  where: { id: existingVar.id },
                  data: variantData,
                })
              );
              result.variantsUpdated++;
            } else {
              variantTxOps.push(
                prisma.productVariant.create({
                  data: { ...variantData, productId },
                }) as ReturnType<typeof prisma.productVariant.update>
              );
              result.variantsCreated++;
            }
          } catch (err) {
            result.errors.push(
              `Variant ${sv.sku}: ${err instanceof Error ? err.message : "Unknown error"}`
            );
          }
        }
      }

      if (variantTxOps.length > 0) {
        await prisma.$transaction(variantTxOps);
      }
    } catch (err) {
      // If batch fails, report errors for each product in the batch
      for (const sp of batch) {
        result.errors.push(
          `Product ${sp.sku}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    // Update progress after each batch
    processedCount += batch.length;
    const recent = _syncProgress?.recentProducts ?? [];
    const newNames = batch.map((sp) => `${sp.sku} — ${sp.name}`);
    updateProgress({
      processedCount,
      currentProduct: batch[batch.length - 1]
        ? `${batch[batch.length - 1].sku} — ${batch[batch.length - 1].name}`
        : null,
      recentProducts: [...recent, ...newNames].slice(-RECENT_PRODUCTS_LIMIT),
    });
  }

  updateProgress({ phase: "done", currentProduct: null });

  return result;
}

/** Extract size/color from variant options or name */
function resolveVariantOptions(sv: StockVariant): { size: string; color: string } {
  const sizeOption = sv.options?.find((o) => /ไซส์|size/i.test(o.type));
  const colorOption = sv.options?.find((o) => /สี|color/i.test(o.type));

  if (sizeOption || colorOption) {
    return {
      size: sizeOption?.value?.toUpperCase() || "FREE",
      color: colorOption?.value || "-",
    };
  }

  return parseVariantName(sv.name);
}

function parseVariantName(name: string | null): {
  size: string;
  color: string;
} {
  if (!name) return { size: "FREE", color: "-" };

  // Common patterns: "แดง / M", "M / แดง", "M-แดง", "แดง-M", "แดง, S"
  const parts = name
    .split(/\s*[\/\-,]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sizePatterns = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL|FREE|\d+)$/i;

  if (parts.length === 2) {
    if (sizePatterns.test(parts[0])) {
      return { size: parts[0].toUpperCase(), color: parts[1] };
    }
    if (sizePatterns.test(parts[1])) {
      return { size: parts[1].toUpperCase(), color: parts[0] };
    }
    // Default: first = color, second = size
    return { size: parts[1], color: parts[0] };
  }

  if (parts.length === 1) {
    if (sizePatterns.test(parts[0])) {
      return { size: parts[0].toUpperCase(), color: "-" };
    }
    return { size: "FREE", color: parts[0] };
  }

  return { size: "FREE", color: name };
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
            const updated = await prisma.productVariant.updateMany({
              where: { sku: item.variantSku },
              data: {
                stock: Math.floor(item.qty),
                totalStock: Math.floor(item.qty),
              },
            });
            if (updated.count > 0) result.updated++;
          } else if (item.productSku) {
            const updated = await prisma.product.updateMany({
              where: { sku: item.productSku },
              data: {
                totalStock: Math.floor(item.qty),
                lastSyncAt: new Date(),
              },
            });
            if (updated.count > 0) result.updated++;
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
