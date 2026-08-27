"use client";

import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import { Package, Plus, Minus, Check, AlertCircle, Search, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_STOCK_LOCATION } from "@/lib/stock-constants";
import { Spinner } from "@/components/ui/spinner";
import { TINT } from "@/components/ui/tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaterialUsageProps {
  productionId: string;
  orderNumber: string;
  // เงิน (ต้นทุน/หน่วย+รวม) โชว์เฉพาะหัวหน้าขึ้นไป — ช่างเบิกของได้แต่ไม่เห็นเงิน
  // (ต้นทุนยังไหลเข้า mutation จาก costPrice ของแค็ตตาล็อกตามเดิม)
  showCosts?: boolean;
  readOnly?: boolean;
  embedded?: boolean;
}

interface LocalMaterial {
  id: string; // temp client-side id
  productId: string;
  productVariantId?: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number;
  currentStock: number;
}

// รายการเบิกแล้ว = ผลจาก trpc.stockSync.listMaterials (infer type ตรงจาก endpoint)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MaterialUsage({
  productionId,
  orderNumber,
  showCosts = true,
  readOnly = false,
  embedded = false,
}: MaterialUsageProps) {
  // ---- state for material picker ----
  const [showPicker, setShowPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // ---- local (not-yet-submitted) materials ----
  const [localMaterials, setLocalMaterials] = useState<LocalMaterial[]>([]);

  // ---- search products query ----
  const searchQuery = trpc.product.searchForOrder.useQuery(
    { search: searchTerm || undefined, itemType: "RAW_MATERIAL", limit: 15 },
    { enabled: !readOnly && showPicker && searchTerm.length >= 1 }
  );
  const searchResults = searchQuery.data ?? [];

  // B11: โหลดประวัติเบิกจริงจาก DB (เดิมจำเฉพาะ local state — reload แล้วหาย)
  const utils = trpc.useUtils();
  const materialsQuery = trpc.stockSync.listMaterials.useQuery(
    { productionId },
    { enabled: !!productionId }
  );
  const deductedMaterials = materialsQuery.data ?? [];

  // idempotencyKey "คงที่ต่อ batch" — retry หลัง error ต้องส่ง key เดิม เพื่อให้ Stock คืน
  // เอกสารเดิม (ไม่ตัดสต๊อคจริงซ้ำ) แล้ว server เขียนฝั่ง ERP ให้ครบ · เกิด key ใหม่เฉพาะ
  // batch ถัดไป (หลังสำเร็จ) — ใช้ UUID ใหม่ทุกคลิกคือตัดสต๊อคจริงซ้ำตอน retry (review B11 จับ)
  const pendingKeyRef = useRef<string | null>(null);

  // ---- issue materials mutation ----
  const issueMutation = trpc.stockSync.issueMaterials.useMutation({
    onSuccess: (data) => {
      toast.success("เบิกวัตถุดิบสำเร็จ", {
        description: `เอกสาร: ${data.movementDocNumber} (${data.materialsIssued} รายการ)`,
      });
      pendingKeyRef.current = null; // batch นี้จบ — คลิกครั้งหน้าเป็น batch ใหม่ key ใหม่
      setLocalMaterials([]);
      // โหลดประวัติใหม่จาก server (แหล่งเดียว — ไม่ปั้น optimistic ให้ drift กับ DB)
      utils.stockSync.listMaterials.invalidate({ productionId });
    },
    onError: (err) => {
      // ไม่ล้าง pendingKeyRef — คลิก "เบิก" ซ้ำ = retry batch เดิมด้วย key เดิม
      toast.error("เกิดข้อผิดพลาด", { description: err.message });
    },
  });

  // ---- handlers ----

  const addMaterial = useCallback(
    (product: {
      id: string;
      name: string;
      sku: string;
      unit?: string | null;
      unitName?: string | null;
      costPrice?: number | null;
      totalStock?: number;
      variants?: { id: string; sku: string; stock: number; costPrice?: number | null }[];
    }) => {
      // Prevent duplicates
      if (localMaterials.some((m) => m.productId === product.id)) {
        toast.info("วัตถุดิบนี้อยู่ในรายการแล้ว");
        return;
      }

      const variant = product.variants?.[0];
      setLocalMaterials((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          productId: product.id,
          productVariantId: variant?.id,
          name: product.name,
          sku: variant?.sku || product.sku,
          quantity: 1,
          unit: product.unit || "PCS",
          unitCost: variant?.costPrice ?? product.costPrice ?? 0,
          currentStock: product.totalStock ?? variant?.stock ?? 0,
        },
      ]);
      setShowPicker(false);
      setSearchTerm("");
    },
    [localMaterials]
  );

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setLocalMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, quantity: Math.max(0.01, quantity) } : m))
    );
  }, []);

  const updateUnitCost = useCallback((id: string, unitCost: number) => {
    setLocalMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, unitCost: Math.max(0, unitCost) } : m))
    );
  }, []);

  const removeMaterial = useCallback((id: string) => {
    setLocalMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleIssueMaterials = () => {
    if (localMaterials.length === 0) return;
    // key คงที่ต่อ batch — ตั้งครั้งแรกที่กด reuse ตอน retry จนกว่าจะสำเร็จ (เคลียร์ใน onSuccess)
    if (!pendingKeyRef.current) pendingKeyRef.current = crypto.randomUUID();

    issueMutation.mutate({
      productionId,
      orderNumber,
      materials: localMaterials.map((m) => ({
        productId: m.productId,
        productVariantId: m.productVariantId,
        sku: m.sku,
        quantity: m.quantity,
        unit: m.unit,
        unitCost: m.unitCost,
      })),
      fromLocation: DEFAULT_STOCK_LOCATION,
      idempotencyKey: pendingKeyRef.current,
    });
  };

  const totalCost = localMaterials.reduce((sum, m) => sum + m.quantity * m.unitCost, 0);
  const Surface = embedded ? "div" : Card;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Surface>
      <CardHeader className={cn("pb-3", embedded && "p-0 pb-2")}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-strong">
            <Package className="h-4 w-4 text-secondary" />
            วัตถุดิบ
          </CardTitle>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPicker(!showPicker)}
              className="gap-1.5"
            >
              <Plus />
              เพิ่มวัตถุดิบ
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-3", embedded && "p-0")}>
        {/* ---- Material Picker ---- */}
        {!readOnly && showPicker && (
          <div className={cn(TINT.info, "rounded-lg border p-3 text-sm leading-relaxed")}>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
              <Input size="sm"
                placeholder="ค้นหาวัตถุดิบ (ชื่อ / SKU / บาร์โค้ด)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="ค้นหาวัตถุดิบ"
                className="pl-8"
              />
            </div>

            {searchTerm.length >= 1 && searchQuery.isLoading && (
              <div
                role="status"
                aria-busy="true"
                className="flex items-center justify-center gap-2 py-4 text-xs text-muted"
              >
                <Spinner size="sm" />
                กำลังค้นหา...
              </div>
            )}

            {searchTerm.length >= 1 && searchQuery.isError && !searchQuery.data && (
              <div className={cn(TINT.error, "mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2")}>
                <p role="alert" className="flex items-center gap-1.5 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ค้นหาวัตถุดิบไม่สำเร็จ
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void searchQuery.refetch()}
                  className="gap-1.5"
                >
                  <RefreshCw aria-hidden="true" />
                  ลองใหม่
                </Button>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {searchResults.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => addMaterial(product as never)}
                    className="group flex min-h-11 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-interactive-hover active:bg-interactive-pressed dark:hover:bg-interactive-hover dark:active:bg-interactive-pressed"
                  >
                    <div>
                      <span className="font-medium text-strong">
                        {product.name}
                      </span>
                      <span className="ml-2 text-muted group-hover:text-secondary group-active:text-secondary">{product.sku}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "tabular-nums",
                          (product.totalStock ?? 0) <= 0
                            ? "text-red-700 dark:text-red-300"
                            : "text-muted group-hover:text-secondary group-active:text-secondary"
                        )}
                      >
                        คงเหลือ: {product.totalStock ?? 0}
                      </span>
                      <Plus className="h-3 w-3 text-blue-500" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.data !== undefined && searchResults.length === 0 && searchTerm.length >= 1 && (
              <p className="py-3 text-center text-xs text-muted">ไม่พบวัตถุดิบ</p>
            )}
          </div>
        )}

        {materialsQuery.isLoading && (
          <div
            role="status"
            aria-busy="true"
            className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted"
          >
            <Spinner size="sm" />
            กำลังโหลดประวัติเบิกวัตถุดิบ...
          </div>
        )}

        {materialsQuery.isError && !materialsQuery.data && (
          <div className={cn(TINT.error, "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2")}>
            <p role="alert" className="flex items-center gap-1.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              โหลดประวัติเบิกวัตถุดิบไม่สำเร็จ
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void materialsQuery.refetch()}
              className="gap-1.5"
            >
              <RefreshCw aria-hidden="true" />
              ลองใหม่
            </Button>
          </div>
        )}

        {/* ---- Already-deducted materials ---- */}
        {deductedMaterials.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted">เบิกแล้ว</p>
            {deductedMaterials.map((m) => (
              <div
                key={m.id}
                className={cn(
                  TINT.success,
                  "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  <div>
                    <span className="text-xs font-medium text-strong">
                      {m.name}
                    </span>
                    <span className="ml-1.5 text-xs text-muted">{m.sku}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-xs tabular-nums text-secondary">
                    {m.quantity} {m.unit}
                  </span>
                  {showCosts && (
                    <span className="text-xs tabular-nums text-muted">
                      {formatCurrency(m.totalCost)}
                    </span>
                  )}
                  <Badge variant="success" size="sm">
                    เบิกแล้ว
                  </Badge>
                  {m.stockMovementRef && (
                    <span className="text-xs text-muted">{m.stockMovementRef}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---- Local (pending) materials ---- */}
        {!readOnly && localMaterials.length > 0 && (
          <div className="space-y-1.5">
            {deductedMaterials.length > 0 && (
              <p className="text-xs font-medium text-muted">รอเบิก</p>
            )}
            {localMaterials.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-divider px-3 py-2"
              >
                {/* Material info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-strong">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{m.sku}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "tabular-nums",
                        m.currentStock <= 0
                          ? "text-red-500"
                          : m.currentStock < m.quantity
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-muted"
                      )}
                    >
                      คงเหลือ: {m.currentStock}
                    </span>
                    {m.currentStock < m.quantity && m.currentStock > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                        <AlertCircle className="h-2.5 w-2.5" />
                        สต็อกไม่พอ
                      </span>
                    )}
                    {m.currentStock <= 0 && (
                      <span className="flex items-center gap-0.5 text-red-500">
                        <AlertCircle className="h-2.5 w-2.5" />
                        หมดสต็อก
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => updateQuantity(m.id, m.quantity - 1)}
                    aria-label={`ลดจำนวน ${m.name}`}
                  >
                    <Minus />
                  </Button>
                  <Input
                    type="number"
                    value={m.quantity}
                    onChange={(e) => updateQuantity(m.id, parseFloat(e.target.value) || 0)}
                    aria-label={`จำนวน ${m.name}`}
                    size="sm"
                    className="w-16 text-center tabular-nums"
                    min={0.01}
                    step={0.01}
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => updateQuantity(m.id, m.quantity + 1)}
                    aria-label={`เพิ่มจำนวน ${m.name}`}
                  >
                    <Plus />
                  </Button>
                </div>

                {/* Unit */}
                <span className="w-8 text-center text-xs text-muted">{m.unit}</span>

                {/* Unit cost + row total — เงินโชว์/แก้ได้เฉพาะหัวหน้า */}
                {showCosts && (
                  <>
                    <div className="w-20">
                      <Input
                        type="number"
                        value={m.unitCost}
                        onChange={(e) => updateUnitCost(m.id, parseFloat(e.target.value) || 0)}
                        aria-label={`ต้นทุนต่อหน่วย ${m.name}`}
                        size="sm"
                        className="text-right tabular-nums"
                        min={0}
                        step={0.01}
                        placeholder="ต้นทุน/หน่วย"
                      />
                    </div>
                    <span className="w-16 text-right text-xs tabular-nums text-secondary">
                      {formatCurrency(m.quantity * m.unitCost)}
                    </span>
                  </>
                )}

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeMaterial(m.id)}
                  aria-label={`ลบ ${m.name} ออกจากรายการ`}
                  className="ml-1 text-muted hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
                >
                  <X />
                </Button>
              </div>
            ))}

            {/* Total + Issue button */}
            <div className="flex items-center justify-between border-t border-divider pt-2">
              <div className="text-xs text-muted">
                รวม {localMaterials.length} รายการ
                {showCosts && (
                  <>
                    {" · "}
                    <span className="font-medium text-strong">
                      {formatCurrency(totalCost)}
                    </span>
                  </>
                )}
              </div>
              <Button
                size="sm"
                onClick={handleIssueMaterials}
                disabled={localMaterials.length === 0 || issueMutation.isPending}
                aria-busy={issueMutation.isPending || undefined}
                className="gap-1.5"
              >
                {issueMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Package aria-hidden="true" />
                )}
                {issueMutation.isPending ? "กำลังเบิก..." : "เบิกวัตถุดิบ"}
              </Button>
            </div>
          </div>
        )}

        {/* ---- Empty state ---- */}
        {materialsQuery.data !== undefined &&
          deductedMaterials.length === 0 &&
          (readOnly || (localMaterials.length === 0 && !showPicker)) && (
          embedded ? (
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-surface-muted px-3 py-2">
              <p className="text-xs font-medium text-secondary">ยังไม่มีวัตถุดิบ</p>
              {!readOnly && (
                <p className="text-xs text-muted">ใช้ปุ่ม &quot;เพิ่มวัตถุดิบ&quot; ด้านบน</p>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <Package className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-1.5 text-xs text-muted">ยังไม่มีวัตถุดิบ</p>
              {!readOnly && (
                <p className="text-xs text-muted">
                  กดปุ่ม &quot;เพิ่มวัตถุดิบ&quot; เพื่อเริ่มเพิ่มรายการ
                </p>
              )}
            </div>
          )
        )}
      </CardContent>
    </Surface>
  );
}
