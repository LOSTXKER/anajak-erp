/**
 * Stock Sync Service
 *
 * Syncs products and stock levels from Anajak Stock API
 * into the local ERP Product/ProductVariant tables.
 *
 * Uses page-at-a-time sync to stay within Vercel's serverless timeout.
 */

import { prisma } from "@/lib/prisma";
import { StockApiClient, type StockProduct, type StockVariant } from "@/lib/stock-api";

// ============================================================
// ITEM TYPE + PRODUCT TYPE MAPPING
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

// ============================================================
// PAGE RESULT TYPE
// ============================================================

export interface SyncPageResult {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
  // Pagination
  page: number;
  totalPages: number;
  totalProducts: number;
  hasMore: boolean;
  // Products synced this page
  syncedProducts: string[];
}

// ============================================================
// SYNC ONE PAGE OF PRODUCTS (serverless-safe, <10s)
// ============================================================

export async function syncProductPage(
  client: StockApiClient,
  page: number
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
  };

  // 1. Fetch one page from Stock API
  const res = await client.getProducts({ page, limit: 100 });
  result.totalPages = res.data.pagination.totalPages;
  result.totalProducts = res.data.pagination.total;
  result.hasMore = page < res.data.pagination.totalPages;

  const stockProducts = res.data.items;
  if (stockProducts.length === 0) return result;

  // 2. Pre-fetch existing records in bulk (2 parallel queries)
  const productSkus = stockProducts.map((p) => p.sku);
  const productStockIds = stockProducts.map((p) => p.id);
  const variantSkus = stockProducts.flatMap((p) => p.variants.map((v) => v.sku));
  const variantStockIds = stockProducts.flatMap((p) => p.variants.map((v) => v.id));

  const [existingProducts, existingVariants] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { sku: { in: productSkus } },
          { stockProductId: { in: productStockIds } },
        ],
      },
      select: { id: true, sku: true, stockProductId: true },
    }),
    variantSkus.length > 0
      ? prisma.productVariant.findMany({
          where: {
            OR: [
              { sku: { in: variantSkus } },
              { stockVariantId: { in: variantStockIds } },
            ],
          },
          select: { id: true, sku: true, stockVariantId: true },
        })
      : Promise.resolve([]),
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

  // 3. Batch upsert all products in a single transaction
  const productOps: ReturnType<typeof prisma.product.update>[] = [];

  for (const sp of stockProducts) {
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
      productOps.push(prisma.product.update({ where: { id: existing.id }, data: productData }));
      result.productsUpdated++;
    } else {
      productOps.push(
        prisma.product.create({ data: productData }) as unknown as ReturnType<typeof prisma.product.update>
      );
      result.productsCreated++;
    }

    result.syncedProducts.push(`${sp.sku} — ${sp.name}`);
  }

  try {
    const upsertedProducts = await prisma.$transaction(productOps);

    // Build sku -> id map from upserted results
    const productIdMap = new Map<string, string>();
    for (const p of upsertedProducts) {
      productIdMap.set(p.sku, p.id);
    }

    // 4. Batch upsert all variants in a single transaction
    const variantOps: ReturnType<typeof prisma.productVariant.update>[] = [];

    for (const sp of stockProducts) {
      const productId = productIdMap.get(sp.sku);
      if (!productId || !sp.hasVariants || sp.variants.length === 0) continue;

      for (const sv of sp.variants) {
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
          variantOps.push(
            prisma.productVariant.update({ where: { id: existingVar.id }, data: variantData })
          );
          result.variantsUpdated++;
        } else {
          variantOps.push(
            prisma.productVariant.create({
              data: { ...variantData, productId },
            }) as unknown as ReturnType<typeof prisma.productVariant.update>
          );
          result.variantsCreated++;
        }
      }
    }

    if (variantOps.length > 0) {
      await prisma.$transaction(variantOps);
    }
  } catch (err) {
    result.errors.push(
      `Batch error page ${page}: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  return result;
}

// ============================================================
// HELPERS
// ============================================================

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

function parseVariantName(name: string | null): { size: string; color: string } {
  if (!name) return { size: "FREE", color: "-" };

  const parts = name
    .split(/\s*[\/\-,]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sizePatterns = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL|FREE|\d+)$/i;

  if (parts.length === 2) {
    if (sizePatterns.test(parts[0])) return { size: parts[0].toUpperCase(), color: parts[1] };
    if (sizePatterns.test(parts[1])) return { size: parts[1].toUpperCase(), color: parts[0] };
    return { size: parts[1], color: parts[0] };
  }

  if (parts.length === 1) {
    if (sizePatterns.test(parts[0])) return { size: parts[0].toUpperCase(), color: "-" };
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
