/**
 * Anajak Stock ERP API Client
 *
 * Wraps the Stock system's ERP endpoints at /api/erp/*
 * Auth: X-API-Key header
 */

// ============================================================
// TYPES -- matching Stock API response shapes
// ============================================================

export interface StockLocation {
  locationCode: string;
  locationName: string;
  qty: number;
}

export interface StockVariant {
  id: string;
  sku: string;
  barcode: string | null;
  name: string | null;
  costPrice: number;
  sellingPrice: number;
  totalStock: number;
  stockByLocation: StockLocation[];
}

export interface StockProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  barcode: string | null;
  category: string | null;
  unit: string | null;
  unitName: string | null;
  standardCost: number;
  lastCost: number;
  reorderPoint: number;
  hasVariants: boolean;
  totalStock: number;
  stockByLocation: StockLocation[];
  variants: StockVariant[];
  updatedAt: string;
}

export interface StockProductsResponse {
  success: boolean;
  data: {
    items: StockProduct[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface StockBalanceItem {
  productId: string;
  productSku: string;
  productName: string;
  productBarcode: string | null;
  variantId: string | null;
  variantSku: string | null;
  variantName: string | null;
  locationCode: string;
  locationName: string;
  warehouseCode: string;
  warehouseName: string;
  qty: number;
  reorderPoint: number;
  minQty: number;
  maxQty: number;
  isLowStock: boolean;
}

export interface StockBalancesResponse {
  success: boolean;
  data: {
    items: StockBalanceItem[];
    summary: {
      totalItems: number;
      lowStockCount: number;
      totalQty: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface StockMovementLine {
  sku: string;
  fromLocation?: string;
  toLocation?: string;
  qty: number;
  unitCost?: number;
  note?: string;
}

export interface CreateMovementInput {
  type: "RECEIVE" | "ISSUE" | "TRANSFER" | "ADJUST";
  refNo?: string;
  note?: string;
  reason?: string;
  lines: StockMovementLine[];
}

export interface CreateMovementResponse {
  success: boolean;
  data: {
    id: string;
    docNumber: string;
    type: string;
    status: string;
    linesCount: number;
    createdAt: string;
  };
}

// ============================================================
// CLIENT
// ============================================================

export class StockApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = (baseUrl || process.env.ANAJAK_STOCK_API_URL || "").replace(/\/+$/, "");
    this.apiKey = apiKey || process.env.ANAJAK_STOCK_API_KEY || "";
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Stock API error ${res.status}: ${res.statusText}. ${text}`
      );
    }

    return res.json() as Promise<T>;
  }

  // ============================================================
  // PRODUCTS
  // ============================================================

  async getProducts(params?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    updated_after?: string;
  }): Promise<StockProductsResponse> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.updated_after) qs.set("updated_after", params.updated_after);

    const query = qs.toString();
    return this.request<StockProductsResponse>(
      `/erp/products${query ? `?${query}` : ""}`
    );
  }

  async getProductBySku(sku: string): Promise<StockProduct | null> {
    const res = await this.getProducts({ search: sku, limit: 1 });
    return res.data.items.find((p) => p.sku === sku) ?? null;
  }

  // ============================================================
  // STOCK BALANCES
  // ============================================================

  async getStock(params?: {
    location?: string;
    warehouse?: string;
    low_stock?: boolean;
    page?: number;
    limit?: number;
  }): Promise<StockBalancesResponse> {
    const qs = new URLSearchParams();
    if (params?.location) qs.set("location", params.location);
    if (params?.warehouse) qs.set("warehouse", params.warehouse);
    if (params?.low_stock) qs.set("low_stock", "true");
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));

    const query = qs.toString();
    return this.request<StockBalancesResponse>(
      `/erp/stock${query ? `?${query}` : ""}`
    );
  }

  // ============================================================
  // MOVEMENTS
  // ============================================================

  async createMovement(
    data: CreateMovementInput
  ): Promise<CreateMovementResponse> {
    return this.request<CreateMovementResponse>("/erp/movements", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================

  async testConnection(): Promise<{
    connected: boolean;
    name?: string;
    error?: string;
  }> {
    try {
      const res = await this.request<{
        success: boolean;
        data: { name: string; version: string };
      }>("/erp");
      return { connected: true, name: res.data?.name };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}

/**
 * Singleton client using env vars.
 * Returns null if not configured.
 */
export function getStockClient(): StockApiClient | null {
  const url = process.env.ANAJAK_STOCK_API_URL;
  const key = process.env.ANAJAK_STOCK_API_KEY;
  if (!url || !key || key === "your-api-key") return null;
  return new StockApiClient(url, key);
}
