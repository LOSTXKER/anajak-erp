"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Package, Cloud, Trash2 } from "lucide-react";
import { permAllows } from "@/lib/permissions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { RecordNotFound } from "@/components/ui/record-not-found";

// ============================================================
// CONSTANTS
// ============================================================

const typeConfig: Record<string, { label: string; variant: "default" | "secondary" | "accent" | "warning" }> = {
  T_SHIRT: { label: "เสื้อยืด", variant: "default" },
  POLO: { label: "โปโล", variant: "accent" },
  HOODIE: { label: "ฮู้ดดี้", variant: "accent" },
  JACKET: { label: "แจ็คเก็ต", variant: "default" },
  TOTE_BAG: { label: "ถุงผ้า", variant: "warning" },
  OTHER: { label: "อื่นๆ", variant: "secondary" },
};

const itemTypeLabels: Record<string, string> = {
  FINISHED_GOOD: "สินค้าสำเร็จรูป",
  RAW_MATERIAL: "วัตถุดิบ",
  CONSUMABLE: "วัสดุสิ้นเปลือง",
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
  const router = useRouter();
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [priceError, setPriceError] = useState<string | null>(null);

  const { data: product, isLoading, isError, refetch } = trpc.product.getById.useQuery({ id });
  const { data: me } = trpc.user.me.useQuery();
  const canManage = permAllows(me?.permissions, "manage_settings");
  const canSeeCost = permAllows(me?.permissions, "see_finance");
  // server จงใจคง ownerOnly สำหรับลบสินค้า — override ไม่ขยายสิทธิ์นี้
  const canDelete = me?.role === "OWNER";

  // -- Mutations (ERP-specific overrides only) --
  const updateProduct = trpc.product.update.useMutation({
    onSuccess: () => {
      utils.product.getById.invalidate({ id });
    },
  });

  const updateVariant = trpc.product.updateVariant.useMutation({
    onSuccess: (_data, variables) => {
      utils.product.getById.invalidate({ id });
      setPriceDrafts((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      setPriceError(null);
    },
  });

  const deleteProduct = trpc.product.delete.useMutation({
    onSuccess: () => {
      utils.product.list.invalidate();
      router.push("/products");
    },
    onError: (error) => toast.error(error.message ?? "ลบสินค้าไม่สำเร็จ"),
  });

  // ---- handlers ----
  const handleToggleProductActive = () => {
    if (!product) return;
    updateProduct.mutate({ id, isActive: !product.isActive });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "ลบสินค้า?",
      description: `สินค้า “${product?.name ?? ""}” จะถูกปิดออกจาก ERP และ Anajak Stock การทำงานนี้ย้อนกลับไม่ได้`,
      confirmText: "ยืนยันลบ",
      destructive: true,
    });
    if (ok) deleteProduct.mutate({ id });
  };

  const handleToggleVariantActive = (variantId: string, isActive: boolean) => {
    updateVariant.mutate({ id: variantId, isActive: !isActive });
  };

  const commitVariantPriceAdj = (variantId: string, currentPriceAdj: number) => {
    const draft = priceDrafts[variantId];
    if (draft === undefined) return;
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setPriceError("ราคาปรับต้องเป็นตัวเลข");
      return;
    }
    if (parsed === currentPriceAdj) {
      setPriceDrafts((current) => {
        const next = { ...current };
        delete next[variantId];
        return next;
      });
      return;
    }
    updateVariant.mutate({ id: variantId, priceAdj: parsed });
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

  // query พัง ≠ ไม่พบสินค้า — ต้องเช็คก่อน branch not found
  // && !product: refetch เบื้องหลังล้มทั้งที่มี cache ห้ามถอนหน้า (modal ลบเปิดค้างได้)
  if (isError && !product) return <QueryError onRetry={() => refetch()} />;

  if (!product)
    return <RecordNotFound what="สินค้าชิ้นนี้" backHref="/products" backLabel="กลับไปรายการสินค้า" />;

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
      <PageHeader
        back={{ href: "/products", label: "กลับไปหน้าสินค้า" }}
        title={product.name}
        titleBadge={
          <>
            <Badge variant={typ.variant}>{typ.label}</Badge>
            <span
              aria-hidden="true"
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                product.isActive ? "bg-green-400 dot-glow" : "bg-slate-400",
              )}
            />
            <span className="sr-only">
              {product.isActive ? "เปิดใช้งานอยู่" : "ปิดใช้งานอยู่"}
            </span>
          </>
        }
        description={product.sku}
        action={
          (canManage || canDelete) && (
            <>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleProductActive}
                  disabled={updateProduct.isPending}
                >
                  {product.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDelete()}
                  aria-label={`ลบสินค้า ${product.name}`}
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                >
                  <Trash2 />
                </Button>
              )}
            </>
          )
        }
      />

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
                {(() => {
                  const variantPrices = product.variants
                    .map((v) => v.sellingPrice)
                    .filter((p) => p > 0);
                  const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
                  const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : 0;
                  const displayPrice = minPrice > 0
                    ? minPrice === maxPrice
                      ? formatCurrency(minPrice)
                      : `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`
                    : formatCurrency(product.basePrice);
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">ราคาขาย</span>
                      <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                        {displayPrice}
                      </span>
                    </div>
                  );
                })()}
                {canSeeCost && product.costPrice && product.costPrice > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">ราคาทุน</span>
                    <span className="tabular-nums">
                      {formatCurrency(product.costPrice)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted">สต็อกรวม</span>
                  <span className="font-semibold tabular-nums">
                    {product.totalStock || totalStock} ชิ้น
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">ตัวเลือก</span>
                  <span>{product.variants.length} รายการ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">กลุ่มสินค้า</span>
                  <Badge variant="secondary">
                    {itemTypeLabels[product.itemType] || product.itemType}
                  </Badge>
                </div>
                {product.category && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">หมวดหมู่</span>
                    <span>{product.category}</span>
                  </div>
                )}
                {product.barcode && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Barcode</span>
                    <span className="font-mono text-xs">{product.barcode}</span>
                  </div>
                )}
                {product.unit && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">หน่วย</span>
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
                <DataTable.Root bordered={false}>
                  <DataTable.Head>
                    <tr>
                      <DataTable.Th>สี</DataTable.Th>
                      <DataTable.Th>ไซส์</DataTable.Th>
                      <DataTable.Th>SKU</DataTable.Th>
                      <DataTable.Th align="right">ราคา</DataTable.Th>
                      <DataTable.Th align="right">ปรับราคา (ERP)</DataTable.Th>
                      <DataTable.Th align="right">สต็อก</DataTable.Th>
                      <DataTable.Th align="center">สถานะ</DataTable.Th>
                    </tr>
                  </DataTable.Head>
                  <DataTable.Body>
                    {product.variants.map((variant) => (
                      <DataTable.Row
                        key={variant.id}
                        className={!variant.isActive ? "opacity-50" : undefined}
                      >
                        <DataTable.Td className="text-slate-600 dark:text-slate-400">
                          {variant.color}
                        </DataTable.Td>
                        <DataTable.Td className="font-medium text-slate-900 dark:text-white">
                          {variant.size}
                        </DataTable.Td>
                        <DataTable.Td className="font-mono text-xs text-muted">
                          {variant.sku}
                        </DataTable.Td>
                        <DataTable.Td align="right" className="tabular-nums">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {formatCurrency(
                              (variant.sellingPrice > 0 ? variant.sellingPrice : product.basePrice) + variant.priceAdj
                            )}
                          </span>
                        </DataTable.Td>
                        <DataTable.Td align="right">
                          {canManage ? (
                            <div className="ml-auto w-28">
                              <Input
                                type="number"
                                step={0.01}
                                value={priceDrafts[variant.id] ?? String(variant.priceAdj || 0)}
                                onChange={(event) => {
                                  setPriceError(null);
                                  setPriceDrafts((current) => ({
                                    ...current,
                                    [variant.id]: event.target.value,
                                  }));
                                }}
                                onBlur={() => commitVariantPriceAdj(variant.id, variant.priceAdj)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") event.currentTarget.blur();
                                  if (event.key === "Escape") {
                                    setPriceDrafts((current) => {
                                      const next = { ...current };
                                      delete next[variant.id];
                                      return next;
                                    });
                                    event.currentTarget.blur();
                                  }
                                }}
                                aria-label={`ปรับราคาของ ${variant.color} ${variant.size}`}
                                className="text-right tabular-nums"
                              />
                              {priceDrafts[variant.id] !== undefined && (
                                <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                                  ออกจากช่องเพื่อบันทึก
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                              {formatCurrency(variant.priceAdj)}
                            </span>
                          )}
                        </DataTable.Td>
                        <DataTable.Td align="right" className="tabular-nums text-slate-600 dark:text-slate-400">
                          {variant.totalStock || variant.stock}
                        </DataTable.Td>
                        <DataTable.Td align="center">
                          {canManage ? <Switch
                            checked={variant.isActive}
                            onCheckedChange={() =>
                              handleToggleVariantActive(
                                variant.id,
                                variant.isActive
                              )
                            }
                            aria-label={`${variant.isActive ? "ปิด" : "เปิด"}ตัวเลือก ${variant.color} ${variant.size}`}
                          /> : (
                            <Badge variant={variant.isActive ? "success" : "secondary"} size="sm">
                              {variant.isActive ? "ใช้งาน" : "ปิด"}
                            </Badge>
                          )}
                        </DataTable.Td>
                      </DataTable.Row>
                    ))}
                  </DataTable.Body>
                </DataTable.Root>
              )}
            </CardContent>
          </Card>

          {/* Error display */}
          {(updateProduct.isError || updateVariant.isError || priceError) && (
            <Alert variant="error">
              {priceError || updateProduct.error?.message || updateVariant.error?.message}
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
