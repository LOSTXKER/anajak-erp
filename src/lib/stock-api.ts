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

export interface StockVariantOption {
  type: string;   // e.g. "สี", "ไซส์"
  value: string;  // e.g. "แดง", "S"
}

export interface StockVariant {
  id: string;
  sku: string;
  barcode: string | null;
  name: string | null;
  costPrice: number;
  lastCost: number; // ทุนซื้อจริงล่าสุด (Stock ส่งมาตั้งแต่ 2026-06-12)
  sellingPrice: number;
  totalStock: number;
  stockByLocation: StockLocation[];
  options?: StockVariantOption[];
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
  itemType?: string; // FINISHED_GOOD | RAW_MATERIAL | CONSUMABLE
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
  // ยอดระดับสินค้า (รวมทุก location): จองค้างจาก ERP + หยิบได้จริง (qty รวม − จอง)
  reservedQty: number;
  availableQty: number;
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
  // รับทั้ง variant SKU และ product SKU — ฝั่ง Stock resolve variant ก่อนเสมอ
  sku: string;
  fromLocation?: string;
  toLocation?: string;
  qty: number;
  unitCost?: number;
  note?: string;
  // เลขออเดอร์ ERP — ISSUE ที่มี orderRef จะตัดยอดจองของออเดอร์นั้นอัตโนมัติฝั่ง Stock
  orderRef?: string;
}

export interface CreateMovementInput {
  type: "RECEIVE" | "ISSUE" | "TRANSFER" | "ADJUST" | "RETURN";
  refNo?: string;
  // กันยิงซ้ำ (retry/กดเบิ้ล) — key เดิมได้ใบเดิมกลับมา ไม่ตัดสต๊อคซ้ำ
  idempotencyKey?: string;
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
    duplicated?: boolean; // true = idempotencyKey ซ้ำ คืนใบเดิม ไม่ได้ตัดสต๊อคใหม่
    createdAt: string;
  };
}

// ============================================================
// RESERVATIONS — จองสต๊อคตามออเดอร์ (ยืนยันออเดอร์แล้วกันของ)
// ============================================================

export interface ReserveLine {
  sku: string; // variant SKU (รายไซส์-สี) หรือ product SKU
  qty: number;
  locationCode?: string;
  note?: string;
}

export interface ReserveResponse {
  success: boolean;
  data: {
    orderRef: string;
    reservations: Array<{ id: string; qty: number; status: string }>;
  };
}

export interface StockReservationItem {
  id: string;
  productSku: string;
  productName: string;
  variantSku: string | null;
  variantName: string | null;
  locationCode: string | null;
  qty: number;
  qtyConsumed: number;
  status: string; // ACTIVE | CONSUMED | RELEASED
  createdAt: string;
}

// ============================================================
// CLIENT
// ============================================================

// error จาก Stock API — เก็บ status + ข้อความจริงจาก server (เช่น "สต๊อคไม่พอจอง — ...")
// caller ใช้แยกเคสธุรกิจ (409 ของไม่พอ) ออกจากเคสระบบ (เน็ตล่ม/key ผิด)
export class StockApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "StockApiError";
  }
}

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
      let message = "";
      try {
        message = (JSON.parse(text) as { error?: string }).error ?? "";
      } catch {
        // body ไม่ใช่ JSON — ใช้ text ดิบ
      }
      throw new StockApiError(
        message || `Stock API error ${res.status}: ${res.statusText}. ${text}`,
        res.status
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

  async deleteProduct(
    stockProductId: string
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/erp/products/${stockProductId}`,
      { method: "DELETE" }
    );
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
  // RESERVATIONS
  // ============================================================

  /**
   * จองสต๊อคตามออเดอร์ — default แทนที่ยอดจองเดิมของออเดอร์ทั้งก้อน (idempotent
   * ยิงซ้ำ/แก้รายการแล้วจองใหม่ได้เลย) · สต๊อคไม่พอ = StockApiError status 409
   */
  async reserveForOrder(input: {
    orderRef: string;
    lines: ReserveLine[];
    replace?: boolean;
  }): Promise<ReserveResponse> {
    return this.request<ReserveResponse>("/erp/reservations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getReservations(orderRef: string): Promise<StockReservationItem[]> {
    const res = await this.request<{
      success: boolean;
      data: StockReservationItem[];
    }>(`/erp/reservations?orderRef=${encodeURIComponent(orderRef)}`);
    return res.data;
  }

  /** ปลดจองทั้งออเดอร์ (ยกเลิกออเดอร์/เบิกครบแล้ว) — คืนจำนวนรายการที่ปลด */
  async releaseReservations(orderRef: string): Promise<number> {
    const res = await this.request<{
      success: boolean;
      data: { orderRef: string; released: number };
    }>(`/erp/reservations?orderRef=${encodeURIComponent(orderRef)}`, {
      method: "DELETE",
    });
    return res.data.released;
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

/**
 * Get stock client from DB settings first, then fall back to env vars.
 * This is the preferred method — settings are saved via the web UI.
 */
export async function getStockClientFromSettings(): Promise<StockApiClient | null> {
  try {
    // Dynamic import to avoid circular deps at module level
    const { prisma } = await import("@/lib/prisma");

    const settings = await prisma.setting.findMany({
      where: { key: { in: ["stock_api_url", "stock_api_key"] } },
    });

    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    const url = map["stock_api_url"] || process.env.ANAJAK_STOCK_API_URL;
    const key = map["stock_api_key"] || process.env.ANAJAK_STOCK_API_KEY;

    if (!url || !key || key === "your-api-key") return null;
    return new StockApiClient(url, key);
  } catch {
    // Fallback to env-only if DB is unreachable
    return getStockClient();
  }
}
