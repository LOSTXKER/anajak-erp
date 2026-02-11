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

  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    try {
      const res = await client.getProducts({ page, limit: 100 });
      totalPages = res.data.pagination.totalPages;

      for (const stockProduct of res.data.items) {
        try {
          await upsertProduct(stockProduct, result);
        } catch (err) {
          result.errors.push(
            `Product ${stockProduct.sku}: ${err instanceof Error ? err.message : "Unknown error"}`
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

async function upsertProduct(
  sp: StockProduct,
  result: SyncResult
): Promise<void> {
  const existing = await prisma.product.findFirst({
    where: {
      OR: [
        { stockProductId: sp.id },
        { sku: sp.sku },
      ],
    },
  });

  const data = {
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
    await prisma.product.update({
      where: { id: existing.id },
      data,
    });
    result.productsUpdated++;
  } else {
    await prisma.product.create({ data });
    result.productsCreated++;
  }

  // Sync variants
  if (sp.hasVariants && sp.variants.length > 0) {
    const product = await prisma.product.findUnique({
      where: { sku: sp.sku },
    });
    if (!product) return;

    for (const sv of sp.variants) {
      try {
        await upsertVariant(product.id, sv, result);
      } catch (err) {
        result.errors.push(
          `Variant ${sv.sku}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }
  }
}

async function upsertVariant(
  productId: string,
  sv: StockVariant,
  result: SyncResult
): Promise<void> {
  // 1. Try structured options from API (preferred)
  let size = "FREE";
  let color = "-";

  const sizeOption = sv.options?.find((o) =>
    /ไซส์|size/i.test(o.type)
  );
  const colorOption = sv.options?.find((o) =>
    /สี|color/i.test(o.type)
  );

  if (sizeOption || colorOption) {
    size = sizeOption?.value?.toUpperCase() || "FREE";
    color = colorOption?.value || "-";
  } else {
    // 2. Fallback: parse variant name string
    ({ size, color } = parseVariantName(sv.name));
  }

  const existing = await prisma.productVariant.findFirst({
    where: {
      OR: [
        { stockVariantId: sv.id },
        { sku: sv.sku },
      ],
    },
  });

  const data = {
    productId,
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

  if (existing) {
    await prisma.productVariant.update({
      where: { id: existing.id },
      data: {
        ...data,
        // Don't update productId on existing variants to avoid unique constraint issues
        productId: undefined,
      },
    });
    result.variantsUpdated++;
  } else {
    await prisma.productVariant.create({ data });
    result.variantsCreated++;
  }
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
