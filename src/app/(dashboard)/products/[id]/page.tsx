"use client";

import { use, useRef, useState } from "react";
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
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Package, Cloud, Database, Trash2 } from "lucide-react";
import { permAllows } from "@/lib/permissions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusLabel } from "@/components/ui/status-label";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

// ============================================================
// CONSTANTS
// ============================================================

const typeConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "accent" | "warning" }
> = {
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
  const [variantFeedback, setVariantFeedback] = useState<Record<string, {
    kind: "price" | "status";
    message: string;
    error?: boolean;
  }>>({});
  const variantWritePending = useRef(false);
  const discardPriceOnBlur = useRef<string | null>(null);

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = trpc.product.getById.useQuery({ id });
  const { data: me } = trpc.user.me.useQuery();
  const canManage = permAllows(me?.permissions, "manage_settings");
  const canSeeCost = permAllows(me?.permissions, "see_finance");
  // server จงใจคง ownerOnly สำหรับลบสินค้า — override ไม่ขยายสิทธิ์นี้
  const canDelete = me?.role === "OWNER";

  // -- Mutations (ERP-specific overrides only) --
  const updateProduct = trpc.product.update.useMutation({
    onSuccess: () => {
      utils.product.getById.invalidate({ id });
      utils.product.list.invalidate();
    },
  });

  const updateVariant = trpc.product.updateVariant.useMutation({
    onSuccess: (savedVariant, variables) => {
      utils.product.getById.setData({ id }, (current) => current ? {
        ...current,
        variants: current.variants.map((variant) => variant.id === savedVariant.id ? { ...variant, ...savedVariant } : variant),
      } : current);
      utils.product.getById.invalidate({ id });
      utils.product.list.invalidate();
      if (variables.priceAdj !== undefined) {
        setPriceDrafts((current) => {
          const draft = current[variables.id];
          if (draft === undefined || draft.trim() === "" || Number(draft) !== variables.priceAdj) return current;
          const next = { ...current };
          delete next[variables.id];
          return next;
        });
      }
      setVariantFeedback((current) => ({
        ...current,
        [variables.id]: {
          kind: variables.priceAdj !== undefined ? "price" : "status",
          message: "บันทึกแล้ว",
        },
      }));
    },
    onError: (error, variables) => setVariantFeedback((current) => ({
      ...current,
      [variables.id]: {
        kind: variables.priceAdj !== undefined ? "price" : "status",
        message: error.message || "บันทึกไม่สำเร็จ ลองอีกครั้ง",
        error: true,
      },
    })),
    onSettled: () => { variantWritePending.current = false; },
  });
  useUnsavedChanges(Object.keys(priceDrafts).length > 0 || updateVariant.isPending, {
    title: "ออกจากหน้าสินค้า?",
    description: "ราคาที่ส่งบันทึกแล้วจะดำเนินการต่อ ค่าที่ยังบันทึกไม่สำเร็จจะหายเมื่อออกจากหน้านี้",
    confirmText: "ออกจากหน้านี้",
    cancelText: "อยู่หน้านี้",
  });

  const clearVariantFeedback = (variantId: string) => setVariantFeedback((current) => {
    const next = { ...current };
    delete next[variantId];
    return next;
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
      description:
        product?.source === "LOCAL"
          ? `สินค้า “${product.name}” จะถูกปิดออกจาก ERP การทำงานนี้ย้อนกลับไม่ได้`
          : `สินค้า “${product?.name ?? ""}” จะถูกปิดออกจาก ERP และ Anajak Stock การทำงานนี้ย้อนกลับไม่ได้`,
      confirmText: "ยืนยันลบ",
      destructive: true,
    });
    if (ok) deleteProduct.mutate({ id });
  };

  const handleToggleVariantActive = (variantId: string, isActive: boolean) => {
    if (!canManage || variantWritePending.current) return;
    clearVariantFeedback(variantId);
    variantWritePending.current = true;
    updateVariant.mutate({ id: variantId, isActive: !isActive });
  };

  const commitVariantPriceAdj = (
    variantId: string,
    currentPriceAdj: number,
  ) => {
    if (discardPriceOnBlur.current === variantId) {
      discardPriceOnBlur.current = null;
      return;
    }
    if (!canManage || variantWritePending.current) return;
    const draft = priceDrafts[variantId];
    if (draft === undefined) return;
    if (draft.trim() === "") {
      setVariantFeedback((current) => ({
        ...current,
        [variantId]: { kind: "price", error: true, message: "กรอกราคาปรับ หรือใส่ 0 หากไม่ปรับราคา" },
      }));
      return;
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setVariantFeedback((current) => ({
        ...current,
        [variantId]: { kind: "price", error: true, message: "ราคาปรับต้องเป็นตัวเลข" },
      }));
      return;
    }
    if (parsed === currentPriceAdj) {
      setPriceDrafts((current) => {
        const next = { ...current };
        delete next[variantId];
        return next;
      });
      clearVariantFeedback(variantId);
      return;
    }
    clearVariantFeedback(variantId);
    variantWritePending.current = true;
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
    return (
      <RecordNotFound
        what="สินค้าชิ้นนี้"
        backHref="/products"
        backLabel="กลับไปรายการสินค้า"
      />
    );

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
        icon={Package}
        back={{ href: "/products", label: "กลับไปหน้าสินค้า" }}
        title={product.name}
        titleBadge={
          <>
            <Badge variant={typ.variant}>{typ.label}</Badge>
            <StatusLabel
              label={product.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
              tone={product.isActive ? "success" : "neutral"}
            />
          </>
        }
        meta={product.sku}
        action={
          (canManage || canDelete) && (
            <>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleProductActive}
                  disabled={updateProduct.isPending}
                  aria-busy={updateProduct.isPending}
                >
                  {updateProduct.isPending ? "กำลังบันทึก..." : product.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDelete()}
                  disabled={deleteProduct.isPending}
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
      {updateProduct.isError && (
        <Alert variant="error">{updateProduct.error.message}</Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* รูปและข้อมูลสินค้าอ่านต่อกันในกล่องเดียว */}
        <div>
          <Card className="overflow-hidden">
            <div className="flex h-56 items-center justify-center bg-surface-muted">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Package className="h-16 w-16 text-muted" aria-hidden="true" />
              )}
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                ข้อมูลสินค้า
                <Badge variant="secondary" className="text-xs font-normal">
                  {product.source === "LOCAL" ? (
                    <Database className="mr-1 h-3 w-3" />
                  ) : (
                  <Cloud className="mr-1 h-3 w-3" />
                  )}
                  {product.sku.startsWith("DEMO-")
                    ? "สต๊อกทดสอบ"
                    : product.source === "LOCAL"
                      ? "เพิ่มในระบบ"
                      : "จาก Anajak Stock"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {(() => {
                  const variantPrices = product.variants
                    .map((v) => v.sellingPrice)
                    .filter((p) => p > 0);
                  const minPrice =
                    variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
                  const maxPrice =
                    variantPrices.length > 0 ? Math.max(...variantPrices) : 0;
                  const displayPrice =
                    minPrice > 0
                    ? minPrice === maxPrice
                      ? formatCurrency(minPrice)
                      : `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`
                    : formatCurrency(product.basePrice);
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">ราคาก่อนปรับ</span>
                      <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                        {displayPrice}
                      </span>
                    </div>
                  );
                })()}
                {canSeeCost && product.costPrice != null && product.costPrice > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">ราคาทุน</span>
                    <span className="tabular-nums">
                      {formatCurrency(product.costPrice)}
                    </span>
                  </div>
                )}
                <div className="flex items-end justify-between border-y border-divider py-3">
                  <span className="text-secondary">สต๊อกทั้งหมด</span>
                  <span className="text-2xl font-semibold tabular-nums text-strong">
                    {(product.totalStock || totalStock).toLocaleString()} <span className="text-sm font-normal text-secondary">ชิ้น</span>
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
                  <div className="border-t border-divider pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Cloud className="h-3 w-3" />
                      Sync ล่าสุด: {formatDateTime(product.lastSyncAt)}
                    </div>
                  </div>
                )}
                {product.description && (
                  <div className="border-t border-divider pt-3">
                    <p className="text-secondary">
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
              <CardTitle className="text-lg">
                สีและไซซ์ <span className="text-sm font-normal text-muted">{product.variants.length} ตัวเลือก</span>
              </CardTitle>
              {canManage && (
                <p id="variant-price-help" className="text-sm text-secondary">
                  ราคาขายรวมยอดปรับแล้ว · ใส่ 0 หากไม่ปรับราคา
                </p>
              )}
              {product.variants.length > 0 && (
                <p className="text-xs text-muted md:hidden">เลื่อนตารางเพื่อดูราคาและสต๊อก</p>
              )}
            </CardHeader>
            <CardContent>
              {/* Variants table */}
              {product.variants.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="ยังไม่มีตัวเลือกสินค้า"
                  description={product.source === "LOCAL" ? undefined : "อัปเดตจาก Anajak Stock เพื่อดึงตัวเลือกสินค้า"}
                />
              ) : (
                <DataTable.Root bordered={false} cellPadding="compact">
                  <DataTable.Head>
                    <tr>
                      <DataTable.Th>สี / ไซซ์</DataTable.Th>
                      <DataTable.Th align="right">ราคาขาย</DataTable.Th>
                      <DataTable.Th align="right">ปรับเพิ่ม/ลด</DataTable.Th>
                      <DataTable.Th align="right">สต๊อก</DataTable.Th>
                      <DataTable.Th align="center">สถานะ</DataTable.Th>
                    </tr>
                  </DataTable.Head>
                  <DataTable.Body>
                    {product.variants.map((variant) => {
                      const feedback = variantFeedback[variant.id];
                      const priceFeedback = feedback?.kind === "price" ? feedback : undefined;
                      const statusFeedback = feedback?.kind === "status" ? feedback : undefined;
                      const saving = updateVariant.isPending && updateVariant.variables?.id === variant.id;
                      const savingPrice = saving && updateVariant.variables?.priceAdj !== undefined;
                      const savingStatus = saving && updateVariant.variables?.isActive !== undefined;
                      const priceMessage = savingPrice ? "กำลังบันทึก..." : priceFeedback?.message;
                      return (
                        <DataTable.Row
                          key={variant.id}
                          aria-busy={saving}
                        >
                          <DataTable.Td>
                            <p className="font-medium text-strong">{variant.color} / {variant.size}</p>
                            <p className="font-mono text-xs text-muted">{variant.sku}</p>
                          </DataTable.Td>
                          <DataTable.Td align="right" className="tabular-nums">
                            <span className="font-medium text-strong">
                              {formatCurrency(
                                (variant.sellingPrice > 0
                                  ? variant.sellingPrice
                                  : product.basePrice) + variant.priceAdj,
                              )}
                            </span>
                          </DataTable.Td>
                          <DataTable.Td align="right">
                            {canManage ? (
                              <div className="ml-auto w-36">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  step={0.01}
                                  disabled={updateVariant.isPending}
                                  aria-busy={savingPrice}
                                  aria-invalid={priceFeedback?.error || undefined}
                                  aria-describedby={`variant-price-help${priceMessage ? ` variant-price-feedback-${variant.id}` : ""}`}
                                  value={
                                    priceDrafts[variant.id] ??
                                    String(variant.priceAdj || 0)
                                  }
                                  onChange={(event) => {
                                    clearVariantFeedback(variant.id);
                                    setPriceDrafts((current) => ({
                                      ...current,
                                      [variant.id]: event.target.value,
                                    }));
                                  }}
                                  onBlur={() =>
                                    commitVariantPriceAdj(
                                      variant.id,
                                      variant.priceAdj,
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      discardPriceOnBlur.current = variant.id;
                                      setPriceDrafts((current) => {
                                        const next = { ...current };
                                        delete next[variant.id];
                                        return next;
                                      });
                                      clearVariantFeedback(variant.id);
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  aria-label={`ปรับราคาของ ${variant.color} ${variant.size}`}
                                  className="text-right tabular-nums"
                                />
                                {priceMessage ? (
                                  <p
                                    id={`variant-price-feedback-${variant.id}`}
                                    role={priceFeedback?.error ? "alert" : "status"}
                                    aria-live="polite"
                                    className={`mt-1 text-sm ${priceFeedback?.error ? "text-red-700 dark:text-red-300" : "text-secondary"}`}
                                  >
                                    {priceMessage}
                                  </p>
                                ) : priceDrafts[variant.id] !== undefined ? (
                                  <p className="mt-1 text-xs text-secondary">ออกจากช่องเพื่อบันทึก · Esc ยกเลิก</p>
                                ) : null}
                                {priceFeedback?.error && priceDrafts[variant.id]?.trim() && (
                                  <Button variant="ghost" size="sm" onClick={() => commitVariantPriceAdj(variant.id, variant.priceAdj)}>
                                    ลองบันทึกอีกครั้ง
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm tabular-nums text-secondary">
                                {formatCurrency(variant.priceAdj)}
                              </span>
                            )}
                          </DataTable.Td>
                          <DataTable.Td
                            align="right"
                            className="tabular-nums text-secondary"
                          >
                            <span className="font-semibold text-strong">{(variant.totalStock || variant.stock).toLocaleString()}</span>
                          </DataTable.Td>
                          <DataTable.Td align="center">
                            {canManage ? (
                              <div className="flex flex-col items-center gap-1">
                                <Switch
                                  checked={variant.isActive}
                                  disabled={updateVariant.isPending}
                                  onCheckedChange={() => handleToggleVariantActive(variant.id, variant.isActive)}
                                  aria-label={`${variant.isActive ? "ปิด" : "เปิด"}ตัวเลือก ${variant.color} ${variant.size}`}
                                />
                                <span className="text-xs text-secondary">{variant.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
                                {(savingStatus || statusFeedback) && (
                                  <p role={statusFeedback?.error ? "alert" : "status"} className={`text-sm ${statusFeedback?.error ? "text-red-700 dark:text-red-300" : "text-secondary"}`}>
                                    {savingStatus ? "กำลังบันทึก..." : statusFeedback?.message}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <Badge
                                variant={
                                  variant.isActive ? "success" : "secondary"
                                }
                                size="sm"
                              >
                                {variant.isActive ? "ใช้งาน" : "ปิด"}
                              </Badge>
                            )}
                          </DataTable.Td>
                        </DataTable.Row>
                      );
                    })}
                  </DataTable.Body>
                </DataTable.Root>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
