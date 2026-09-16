"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import {
  Barcode,
  Boxes,
  Box,
  CircleCheck,
  Cloud,
  Database,
  Layers,
  Package,
  Palette,
  Ruler,
  Scale,
  Shirt,
  ShoppingCart,
  Tag,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { formatBaht, formatDateTime } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { c, CardHead, Empty, Prop } from "@/components/kit/kit";
import { permAllows } from "@/lib/permissions";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { RecordNotFound } from "@/components/ui/record-not-found";

// ============================================================
// CONSTANTS
// ============================================================

const typeLabels: Record<string, string> = {
  T_SHIRT: "เสื้อยืด",
  POLO: "โปโล",
  HOODIE: "ฮู้ดดี้",
  JACKET: "แจ็คเก็ต",
  TOTE_BAG: "ถุงผ้า",
  OTHER: "อื่นๆ",
};

const itemTypeLabels: Record<string, string> = {
  FINISHED_GOOD: "สินค้าสำเร็จรูป",
  RAW_MATERIAL: "วัตถุดิบ",
  CONSUMABLE: "วัสดุสิ้นเปลือง",
};

/** ค่าที่ไม่ซ้ำ เรียงตามลำดับที่เจอใน variants (variants มาจาก server เรียงตาม SKU แล้ว) */
function distinct(values: string[]): string[] {
  return values.filter((value, index) => value.trim() !== "" && values.indexOf(value) === index);
}

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

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = trpc.product.getById.useQuery({ id });
  const { data: me } = trpc.user.me.useQuery();
  const canManage = permAllows(me?.permissions, "manage_settings");
  const canSeeCost = permAllows(me?.permissions, "see_finance");
  // ปุ่ม "ใช้ในออเดอร์" ใช้ด่านเดียวกับหน้าลูกค้า ไม่สร้างกฎสิทธิ์ชุดใหม่
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);
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
    updateVariant.mutate({ id: variantId, isActive: !isActive });
  };

  const commitVariantPriceAdj = (
    variantId: string,
    currentPriceAdj: number,
  ) => {
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
  // ค่าที่ใช้ซ้ำ (คำนวณได้เฉพาะเมื่อมีข้อมูลแล้ว)
  // ============================================================

  const typeLabel = product ? (typeLabels[product.productType] ?? product.productType) : "";
  const groupLabel = product ? (itemTypeLabels[product.itemType] ?? product.itemType) : "";
  const variantStock = product ? product.variants.reduce((sum, v) => sum + v.stock, 0) : 0;
  const totalStock = product ? product.totalStock || variantStock : 0;
  const unitLabel = product?.unitName || product?.unit || "ชิ้น";
  const sizes = product ? distinct(product.variants.map((v) => v.size)) : [];
  const colors = product ? distinct(product.variants.map((v) => v.color)) : [];
  const priceValues = product
    ? product.variants.map((v) => v.sellingPrice).filter((price) => price > 0)
    : [];
  const priceLabel = product
    ? priceValues.length === 0
      ? formatBaht(product.basePrice)
      : Math.min(...priceValues) === Math.max(...priceValues)
        ? formatBaht(Math.min(...priceValues))
        : `${formatBaht(Math.min(...priceValues))} - ${formatBaht(Math.max(...priceValues))}`
    : "";
  // ป้ายแหล่งข้อมูลตามเจ้าของข้อมูลจริง — ไม่เหมารวมว่า sync มาจาก Stock ทุกตัว
  const sourceLabel = product
    ? product.sku.startsWith("DEMO-")
      ? "สต๊อกทดสอบ"
      : product.source === "LOCAL"
        ? "เพิ่มในระบบ"
        : "จาก Anajak Stock"
    : "";
  const SourceIcon = product?.source === "LOCAL" ? Database : Cloud;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <PageShell
      title={product?.name ?? "สินค้า"}
      meta={product ? `${groupLabel} · ${typeLabel} · SKU ${product.sku}` : undefined}
      back={{ href: "/products", label: "สินค้าทั้งหมด" }}
      loading={isLoading}
      skeleton={
        <div className="grid gap-3.5">
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <div className={c("two")}>
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
      }
      // query พัง ≠ ไม่พบสินค้า — refetch เบื้องหลังล้มทั้งที่มี cache ห้ามถอนหน้า
      error={isError && !product ? { message: "โหลดข้อมูลสินค้าไม่สำเร็จ", onRetry: () => refetch() } : null}
      action={
        product ? (
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
                className="border-red-200 text-red-600 dark:border-red-800 dark:text-red-400"
              >
                <Trash2 />
              </Button>
            )}
            {canCreateOrder && (
              <Button asChild size="sm">
                <Link href="/orders/new">
                  <ShoppingCart />
                  ใช้ในออเดอร์
                </Link>
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {!product ? (
        <RecordNotFound
          what="สินค้าชิ้นนี้"
          backHref="/products"
          backLabel="กลับไปรายการสินค้า"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
            <StatCard
              moduleTone="product"
              title="คงเหลือรวม"
              value={totalStock.toLocaleString("th-TH")}
              icon={Boxes}
              caption={unitLabel}
              tone={totalStock === 0 ? "danger" : "default"}
            />
            <StatCard
              moduleTone="finance"
              title="ราคาขาย"
              value={priceLabel}
              icon={Tag}
              caption={`ต่อ${unitLabel}`}
            />
            <StatCard
              moduleTone="product"
              title="ตัวเลือกสินค้า"
              value={product.variants.length}
              icon={Layers}
              caption="สี/ไซซ์"
            />
          </div>

          <div className={c("two")}>
            {/* ซ้าย (กว้าง) — ตัวเลือกสินค้าและคงเหลือ */}
            <div className={c("stack")}>
              <section className={c("card")} aria-labelledby="pd-variants-h">
                <CardHead
                  icon={Shirt}
                  tone="blue"
                  id="pd-variants-h"
                  title="ตัวเลือกสินค้า"
                  /* ต้นแบบมีชิป "อัปเดต 09:30 น." ที่หัวการ์ด — ของจริงมีเวลาดึงสต๊อกอยู่ในการ์ดข้อมูล
                     และจำนวนตัวเลือกอยู่ในช่องตัวเลขด้านบนแล้ว จึงไม่ซ้ำอีกที่นี่ */
                />
                {product.variants.length === 0 ? (
                  <Empty
                    icon={Package}
                    title="ยังไม่มีตัวเลือกสินค้า"
                    hint={product.source === "LOCAL" ? undefined : "ดึงสต๊อกจาก Anajak Stock เพื่อได้ตัวเลือกสินค้า"}
                  />
                ) : (
                  <>
                    <DataTable.Root bordered={false} cellPadding="compact">
                      <DataTable.Head>
                        <tr>
                          <DataTable.Th>สี</DataTable.Th>
                          <DataTable.Th>ไซซ์</DataTable.Th>
                          <DataTable.Th>SKU</DataTable.Th>
                          <DataTable.Th align="right">ราคา</DataTable.Th>
                          <DataTable.Th align="right">ปรับราคา (ERP)</DataTable.Th>
                          <DataTable.Th align="right">คงเหลือ</DataTable.Th>
                          <DataTable.Th align="center">สถานะ</DataTable.Th>
                        </tr>
                      </DataTable.Head>
                      <DataTable.Body>
                        {product.variants.map((variant) => (
                          <DataTable.Row
                            key={variant.id}
                            className={!variant.isActive ? "opacity-50" : undefined}
                          >
                            <DataTable.Td className="text-secondary">
                              {variant.color}
                            </DataTable.Td>
                            <DataTable.Td className="font-medium text-strong">
                              {variant.size}
                            </DataTable.Td>
                            <DataTable.Td className="font-mono text-xs text-muted">
                              {variant.sku}
                            </DataTable.Td>
                            <DataTable.Td align="right" className="tabular-nums">
                              <span className="font-medium text-strong">
                                {formatBaht(
                                  (variant.sellingPrice > 0
                                    ? variant.sellingPrice
                                    : product.basePrice) + variant.priceAdj,
                                )}
                              </span>
                            </DataTable.Td>
                            <DataTable.Td align="right">
                              {canManage ? (
                                <div className="ml-auto w-28">
                                  <Input
                                    type="number"
                                    step={0.01}
                                    value={
                                      priceDrafts[variant.id] ??
                                      String(variant.priceAdj || 0)
                                    }
                                    onChange={(event) => {
                                      setPriceError(null);
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
                                      if (event.key === "Enter")
                                        event.currentTarget.blur();
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
                                <span className="text-sm tabular-nums text-secondary">
                                  {formatBaht(variant.priceAdj)}
                                </span>
                              )}
                            </DataTable.Td>
                            <DataTable.Td
                              align="right"
                              className="tabular-nums text-secondary"
                            >
                              {(variant.totalStock || variant.stock).toLocaleString("th-TH")}
                            </DataTable.Td>
                            <DataTable.Td align="center">
                              {canManage ? (
                                <Switch
                                  checked={variant.isActive}
                                  onCheckedChange={() =>
                                    handleToggleVariantActive(
                                      variant.id,
                                      variant.isActive,
                                    )
                                  }
                                  aria-label={`${variant.isActive ? "ปิด" : "เปิด"}ตัวเลือก ${variant.color} ${variant.size}`}
                                />
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
                        ))}
                      </DataTable.Body>
                    </DataTable.Root>
                    {/* แถบสรุปท้ายตาราง — เฉพาะตัวเลขที่ระบบมีจริง
                        (ยอดจอง/ว่างจริงอยู่ฝั่ง Anajak Stock ERP ไม่เก็บรายสินค้า) */}
                    <div className={c("tfoot")}>
                      <span>
                        รวมทุกไซซ์ <b>{totalStock.toLocaleString("th-TH")} {unitLabel}</b> ·{" "}
                        <b>{product.variants.length.toLocaleString("th-TH")} ตัวเลือก</b>
                      </span>
                    </div>
                  </>
                )}
              </section>

              {/* แจ้งเมื่อบันทึกไม่ผ่าน — ยืนใต้ตารางที่เป็นต้นเหตุ */}
              {(updateProduct.isError || updateVariant.isError || priceError) && (
                <Alert variant="error">
                  {priceError ||
                    updateProduct.error?.message ||
                    updateVariant.error?.message}
                </Alert>
              )}
            </div>

            {/* ขวา (แคบ) — รูปสินค้า + ข้อมูลสินค้า */}
            <div className={c("stack")}>
              <section className={c("card")}>
                <div className="flex h-56 items-center justify-center bg-surface-muted">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Package className="h-16 w-16 text-muted" aria-hidden="true" />
                  )}
                </div>
              </section>

              <section className={c("card")} aria-labelledby="pd-info-h">
                <CardHead icon={Tag} id="pd-info-h" title="ข้อมูลสินค้า" />
                <div className={c("cb")}>
                  <dl className={c("props one")}>
                    <Prop icon={Box} label="กลุ่มสินค้า">
                      {groupLabel}
                    </Prop>
                    <Prop icon={Ruler} label="ไซซ์ที่มี" none={sizes.length === 0}>
                      {sizes.length > 0 ? `${sizes.join(" · ")} (${sizes.length} ไซซ์)` : "—"}
                    </Prop>
                    <Prop icon={Palette} label="สีที่มี" none={colors.length === 0}>
                      {colors.length > 0 ? `${colors.join(" · ")} (${colors.length} สี)` : "—"}
                    </Prop>
                    <Prop icon={SourceIcon} label="แหล่งสต๊อก">
                      {sourceLabel}
                      {product.lastSyncAt ? (
                        <span className="block text-xs font-normal text-muted">
                          ดึงล่าสุด {formatDateTime(product.lastSyncAt)}
                        </span>
                      ) : null}
                    </Prop>
                    <Prop icon={CircleCheck} label="สถานะ">
                      <Badge variant={product.isActive ? "success" : "default"} size="sm">
                        {product.isActive ? "เปิดใช้งาน" : "ปิดอยู่"}
                      </Badge>
                    </Prop>
                    {canSeeCost && product.costPrice != null && product.costPrice > 0 ? (
                      <Prop icon={Tag} label="ราคาทุน">
                        <span className="tabular-nums">{formatBaht(product.costPrice)}</span>
                      </Prop>
                    ) : null}
                    {product.category ? (
                      <Prop icon={Layers} label="หมวดหมู่">
                        {product.category}
                      </Prop>
                    ) : null}
                    {product.barcode ? (
                      <Prop icon={Barcode} label="Barcode">
                        <span className={c("mono")}>{product.barcode}</span>
                      </Prop>
                    ) : null}
                    {product.unit ? (
                      <Prop icon={Scale} label="หน่วย">
                        {product.unitName || product.unit}
                      </Prop>
                    ) : null}
                    {product.description ? (
                      <Prop icon={Package} label="คำอธิบาย">
                        <span className="font-normal text-secondary">{product.description}</span>
                      </Prop>
                    ) : null}
                  </dl>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
