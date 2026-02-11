"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ArrowLeft, Package, Cloud } from "lucide-react";

// ============================================================
// CONSTANTS
// ============================================================

const typeConfig: Record<string, { label: string; variant: "default" | "secondary" | "indigo" | "purple" | "teal" | "orange" }> = {
  T_SHIRT: { label: "เสื้อยืด", variant: "default" },
  POLO: { label: "โปโล", variant: "indigo" },
  HOODIE: { label: "ฮู้ดดี้", variant: "purple" },
  JACKET: { label: "แจ็คเก็ต", variant: "teal" },
  TOTE_BAG: { label: "ถุงผ้า", variant: "orange" },
  OTHER: { label: "อื่นๆ", variant: "secondary" },
};

const groupLabels: Record<string, string> = {
  GARMENT: "เสื้อสำเร็จ",
  MATERIAL: "วัตถุดิบ",
  SUPPLY: "อุปกรณ์",
  FINISHED_GOOD: "สินค้าผลิตเสร็จ",
};

// ============================================================
// COMPONENT
// ============================================================

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();

  const { data: product, isLoading } = trpc.product.getById.useQuery({ id });

  // -- Mutations (ERP-specific overrides only) --
  const updateProduct = trpc.product.update.useMutation({
    onSuccess: () => {
      utils.product.getById.invalidate({ id });
    },
  });

  const updateVariant = trpc.product.updateVariant.useMutation({
    onSuccess: () => {
      utils.product.getById.invalidate({ id });
    },
  });

  // ---- handlers ----
  const handleToggleProductActive = () => {
    if (!product) return;
    updateProduct.mutate({ id, isActive: !product.isActive });
  };

  const handleToggleVariantActive = (variantId: string, isActive: boolean) => {
    updateVariant.mutate({ id: variantId, isActive: !isActive });
  };

  const handleUpdateVariantPriceAdj = (variantId: string, priceAdj: number) => {
    updateVariant.mutate({ id: variantId, priceAdj });
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  const typ = typeConfig[product.productType] ?? {
    label: product.productType,
    variant: "secondary" as const,
  };

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {product.name}
              </h1>
              <Badge variant={typ.variant}>{typ.label}</Badge>
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  product.isActive
                    ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]"
                    : "bg-slate-400"
                }`}
              />
            </div>
            <p className="text-sm text-slate-500">{product.sku}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleProductActive}
          disabled={updateProduct.isPending}
        >
          {product.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Product image + info */}
        <div className="space-y-6">
          {/* Image */}
          <Card className="overflow-hidden">
            <div className="flex h-56 items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-20 w-20 text-white/40" />
              )}
            </div>
          </Card>

          {/* Info card (read-only, synced from Stock) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                ข้อมูลสินค้า
                <Badge variant="secondary" className="text-xs font-normal">
                  <Cloud className="mr-1 h-3 w-3" />
                  จาก Anajak Stock
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ราคาขาย</span>
                  <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
                    {formatCurrency(product.basePrice)}
                  </span>
                </div>
                {product.costPrice && product.costPrice > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">ราคาทุน</span>
                    <span className="tabular-nums">
                      {formatCurrency(product.costPrice)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">สต็อกรวม</span>
                  <span className="font-semibold tabular-nums">
                    {product.totalStock || totalStock} ชิ้น
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ตัวเลือก</span>
                  <span>{product.variants.length} รายการ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">กลุ่มสินค้า</span>
                  <Badge variant="secondary">
                    {groupLabels[product.productGroup] || product.productGroup}
                  </Badge>
                </div>
                {product.category && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">หมวดหมู่</span>
                    <span>{product.category}</span>
                  </div>
                )}
                {product.barcode && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Barcode</span>
                    <span className="font-mono text-xs">{product.barcode}</span>
                  </div>
                )}
                {product.unit && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">หน่วย</span>
                    <span>{product.unitName || product.unit}</span>
                  </div>
                )}
                {product.lastSyncAt && (
                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Cloud className="h-3 w-3" />
                      Sync ล่าสุด: {formatDateTime(product.lastSyncAt)}
                    </div>
                  </div>
                )}
                {product.description && (
                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <p className="text-slate-600 dark:text-slate-400">
                      {product.description}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Variants */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                ตัวเลือกสินค้า ({product.variants.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Variants table */}
              {product.variants.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <p className="text-sm text-slate-400">
                    ยังไม่มีตัวเลือก — Sync จาก Anajak Stock เพื่อดึงข้อมูล
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                          ไซส์
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                          สี
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                          SKU
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">
                          ราคา
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">
                          ปรับราคา (ERP)
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">
                          สต็อก
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">
                          สถานะ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {product.variants.map((variant) => (
                        <tr
                          key={variant.id}
                          className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            !variant.isActive ? "opacity-50" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-white">
                            {variant.size}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">
                            {variant.color}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                            {variant.sku}
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {formatCurrency(product.basePrice + variant.priceAdj)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Input
                              type="number"
                              step={0.01}
                              value={variant.priceAdj || 0}
                              onChange={(e) =>
                                handleUpdateVariantPriceAdj(
                                  variant.id,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="ml-auto h-7 w-24 text-right text-xs"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400">
                            {variant.totalStock || variant.stock}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleVariantActive(
                                  variant.id,
                                  variant.isActive
                                )
                              }
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                                variant.isActive
                                  ? "bg-blue-600"
                                  : "bg-slate-300 dark:bg-slate-600"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                  variant.isActive
                                    ? "translate-x-4"
                                    : "translate-x-0.5"
                                } mt-0.5`}
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error display */}
          {(updateProduct.isError || updateVariant.isError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {updateProduct.error?.message || updateVariant.error?.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
