"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import { Package, Plus, Minus, Check, AlertCircle, Search, Loader2, X } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaterialUsageProps {
  productionId: string;
  orderNumber: string;
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

interface DeductedMaterial {
  id: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  stockMovementRef: string | null;
  deductedAt: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MaterialUsage({ productionId, orderNumber }: MaterialUsageProps) {
  // ---- state for material picker ----
  const [showPicker, setShowPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // ---- local (not-yet-submitted) materials ----
  const [localMaterials, setLocalMaterials] = useState<LocalMaterial[]>([]);

  // ---- search products query ----
  const { data: searchResults, isLoading: isSearching } =
    trpc.product.searchForOrder.useQuery(
      { search: searchTerm || undefined, productGroup: "MATERIAL", limit: 15 },
      { enabled: showPicker && searchTerm.length >= 1 }
    );

  // Since there is no dedicated endpoint for listing MaterialUsage records,
  // we track deducted materials in local state after a successful issue call.
  const [deductedMaterials, setDeductedMaterials] = useState<DeductedMaterial[]>([]);

  // ---- issue materials mutation ----
  const issueMutation = trpc.stockSync.issueMaterials.useMutation({
    onSuccess: (data) => {
      toast.success("เบิกวัตถุดิบสำเร็จ", {
        description: `เอกสาร: ${data.movementDocNumber} (${data.materialsIssued} รายการ)`,
      });

      // Move local materials to deducted list
      const now = new Date().toISOString();
      const newDeducted: DeductedMaterial[] = localMaterials.map((m) => ({
        id: m.id,
        productId: m.productId,
        name: m.name,
        sku: m.sku,
        quantity: m.quantity,
        unit: m.unit,
        unitCost: m.unitCost,
        totalCost: m.quantity * m.unitCost,
        stockMovementRef: data.movementDocNumber,
        deductedAt: now,
      }));
      setDeductedMaterials((prev) => [...prev, ...newDeducted]);
      setLocalMaterials([]);
    },
    onError: (err) => {
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
      fromLocation: "WH-MAIN",
    });
  };

  const totalCost = localMaterials.reduce((sum, m) => sum + m.quantity * m.unitCost, 0);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <Package className="h-4 w-4" />
            วัตถุดิบ / Materials
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPicker(!showPicker)}
            className="h-7 gap-1 border-blue-200 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
          >
            <Plus className="h-3 w-3" />
            เพิ่มวัตถุดิบ
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ---- Material Picker ---- */}
        {showPicker && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="ค้นหาวัตถุดิบ (ชื่อ / SKU / บาร์โค้ด)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
                autoFocus
              />
            </div>

            {isSearching && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                กำลังค้นหา...
              </div>
            )}

            {searchResults && searchResults.length > 0 && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addMaterial(product as never)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    <div>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {product.name}
                      </span>
                      <span className="ml-2 text-slate-400">{product.sku}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "tabular-nums",
                          (product.totalStock ?? 0) <= 0
                            ? "text-red-500"
                            : "text-slate-500 dark:text-slate-400"
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

            {searchResults && searchResults.length === 0 && searchTerm.length >= 1 && (
              <p className="py-3 text-center text-xs text-slate-400">ไม่พบวัตถุดิบ</p>
            )}
          </div>
        )}

        {/* ---- Already-deducted materials ---- */}
        {deductedMaterials.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500">เบิกแล้ว</p>
            {deductedMaterials.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border border-green-100 bg-green-50/50 px-3 py-2 dark:border-green-900 dark:bg-green-950/30"
              >
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  <div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white">
                      {m.name}
                    </span>
                    <span className="ml-1.5 text-xs text-slate-400">{m.sku}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
                    {m.quantity} {m.unit}
                  </span>
                  <span className="text-xs tabular-nums text-slate-400">
                    {formatCurrency(m.totalCost)}
                  </span>
                  <Badge variant="success" className="h-5 text-[10px]">
                    เบิกแล้ว
                  </Badge>
                  {m.stockMovementRef && (
                    <span className="text-[10px] text-slate-400">{m.stockMovementRef}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---- Local (pending) materials ---- */}
        {localMaterials.length > 0 && (
          <div className="space-y-1.5">
            {deductedMaterials.length > 0 && (
              <p className="text-xs font-medium text-slate-500">รอเบิก</p>
            )}
            {localMaterials.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800"
              >
                {/* Material info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-slate-900 dark:text-white">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{m.sku}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                    <span
                      className={cn(
                        "tabular-nums",
                        m.currentStock <= 0
                          ? "text-red-500"
                          : m.currentStock < m.quantity
                            ? "text-amber-500"
                            : "text-slate-400"
                      )}
                    >
                      คงเหลือ: {m.currentStock}
                    </span>
                    {m.currentStock < m.quantity && m.currentStock > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-500">
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(m.id, m.quantity - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <Input
                    type="number"
                    value={m.quantity}
                    onChange={(e) => updateQuantity(m.id, parseFloat(e.target.value) || 0)}
                    className="h-6 w-16 text-center text-xs tabular-nums"
                    min={0.01}
                    step={0.01}
                  />
                  <button
                    onClick={() => updateQuantity(m.id, m.quantity + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {/* Unit */}
                <span className="w-8 text-center text-[10px] text-slate-400">{m.unit}</span>

                {/* Unit cost */}
                <div className="w-20">
                  <Input
                    type="number"
                    value={m.unitCost}
                    onChange={(e) => updateUnitCost(m.id, parseFloat(e.target.value) || 0)}
                    className="h-6 text-right text-xs tabular-nums"
                    min={0}
                    step={0.01}
                    placeholder="ต้นทุน/หน่วย"
                  />
                </div>

                {/* Row total */}
                <span className="w-16 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  {formatCurrency(m.quantity * m.unitCost)}
                </span>

                {/* Remove button */}
                <button
                  onClick={() => removeMaterial(m.id)}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Total + Issue button */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
              <div className="text-xs text-slate-500">
                รวม {localMaterials.length} รายการ ·{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatCurrency(totalCost)}
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleIssueMaterials}
                disabled={localMaterials.length === 0 || issueMutation.isPending}
                className="h-7 gap-1 text-xs"
              >
                {issueMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Package className="h-3 w-3" />
                )}
                เบิกวัตถุดิบ
              </Button>
            </div>
          </div>
        )}

        {/* ---- Empty state ---- */}
        {localMaterials.length === 0 && deductedMaterials.length === 0 && !showPicker && (
          <div className="py-4 text-center">
            <Package className="mx-auto h-8 w-8 text-slate-200 dark:text-slate-700" />
            <p className="mt-1.5 text-xs text-slate-400">ยังไม่มีวัตถุดิบ</p>
            <p className="text-[10px] text-slate-300 dark:text-slate-600">
              กดปุ่ม &quot;เพิ่มวัตถุดิบ&quot; เพื่อเริ่มเพิ่มรายการ
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
