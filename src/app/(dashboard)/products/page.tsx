"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatBaht, formatDateTime } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { Package, Cloud, Database, Settings, ChevronRight } from "lucide-react";
import { permAllows } from "@/lib/permissions";

import { SyncDialog } from "@/components/sync-dialog";
import { SegmentedControl } from "@/components/ui/segmented";
import { DataTable } from "@/components/ui/data-table";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { Badge } from "@/components/ui/badge";
import { c } from "@/components/kit/kit";
import { ITEM_TYPES, PRODUCT_TYPE_DISPLAY_LABELS } from "@/types/order-form";
import { FOCUS_BUTTON } from "@/components/ui/tokens";


/** รูปสินค้าในตาราง — ไม่มีรูปใช้ไอคอนกล่อง ให้แถวสูงเท่ากันทุกแถว */
function ProductThumb({ url, name, size = "sm" }: { url?: string | null; name: string; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "size-14" : "size-9";
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-muted", box)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <Package className="h-4 w-4 text-muted" strokeWidth={1.5} aria-hidden="true" />
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** ราคาขาย: มีหลายตัวเลือกให้บอกเป็นช่วง ไม่มีก็ใช้ราคาตั้งต้น
 *  ทศนิยม 2 ตำแหน่งเสมอ เพื่อให้หลักของคอลัมน์ตัวเงินเรียงตรงแบบต้นแบบ */
function priceLabel(product: { variants?: { sellingPrice: number }[] | null; basePrice: number }) {
  const prices = (product.variants ?? []).map((v) => v.sellingPrice).filter((price) => price > 0);
  if (prices.length === 0) return formatBaht(product.basePrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatBaht(min) : `${formatBaht(min)} - ${formatBaht(max)}`;
}

/** ระดับของคงเหลือ — จุดสั่งซื้อ (reorderPoint) ของสินค้าแต่ละตัวเป็นเกณฑ์ "ใกล้หมด" */
function stockLevel(product: { totalStock?: number | null; reorderPoint?: number | null }) {
  const stock = product.totalStock ?? 0;
  const reorder = product.reorderPoint ?? 0;
  if (stock === 0) return "out" as const;
  if (reorder > 0 && stock <= reorder) return "low" as const;
  return "ok" as const;
}

/** ช่องคงเหลือแบบต้นแบบ: หมด = ป้ายแดง · ใกล้หมด = ป้ายเหลืองพร้อมตัวเลข · ปกติ = ตัวเลขหนา */
function StockCell({ level, stock }: { level: "out" | "low" | "ok"; stock: number }) {
  if (level === "out") return <span className={c("due bad")}>หมด</span>;
  if (level === "low")
    return (
      <span className={c("due warn")}>
        {stock.toLocaleString("th-TH")}
        <span className="sr-only"> · ใกล้หมด ถึงจุดสั่งซื้อแล้ว</span>
      </span>
    );
  return <span className="font-medium text-strong">{stock.toLocaleString("th-TH")}</span>;
}

/* คำของกลุ่มและชนิดสินค้ามาจากชุดกลางใน types/order-form.ts ทั้งหมด
   (เดิมหน้านี้เขียนคำเอง 3 ก้อน หน้ารายการจึงเรียกของชิ้นเดียวกันคนละคำกับหน้ารายละเอียด
   เช่น "เสื้อยืด" กับ "เสื้อยืดคอกลม" · ชนิดที่ไม่ได้เขียนไว้ก็ตกเป็นรหัสดิบให้ผู้ใช้อ่าน) */
const itemTypes = [{ value: "", label: "ทั้งหมด" }, ...Object.entries(ITEM_TYPES).map(([value, label]) => ({ value, label }))];

/* ตัวกรองชนิด: คงไว้เฉพาะชนิดที่ลูกค้าสั่งบ่อย ไม่กางทั้งชุด ไม่งั้นช่องเลือกยาวจนหาไม่เจอ
   ("อื่นๆ" ครอบชนิดที่เหลือให้อยู่แล้ว) */
const FILTERABLE_TYPES = ["T_SHIRT", "POLO", "HOODIE", "JACKET", "TOTE_BAG", "OTHER"] as const;
const productTypes = [
  { value: "", label: "ทุกประเภท" },
  ...FILTERABLE_TYPES.map((value) => ({ value, label: PRODUCT_TYPE_DISPLAY_LABELS[value] ?? value })),
];

export default function ProductsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ProductsPageContent />
    </Suspense>
  );
}

function ProductsPageContent() {
  const {
    search,
    page,
    searchParams,
    replaceListState,
    onSearchChange,
    searchInputRef,
    clearSearch,
  } = useListPageState();
  const productType = searchParams.get("type") ?? "";
  const itemType = searchParams.get("itemType") ?? "";
  const limit = 24;
  const { data: me } = trpc.user.me.useQuery();
  const canManageStock = permAllows(me?.permissions, "manage_settings");

  // ─── Queries ──────────────────────────────────────────────
  const { data, isLoading, isFetching, isError, refetch } = trpc.product.list.useQuery({
    search: search.trim() || undefined,
    productType: productType || undefined,
    itemType: itemType || undefined,
    page,
    limit,
  });

  usePageClamp(page, data?.pages, replaceListState);

  const { data: syncStatus, isLoading: syncStatusLoading } =
    trpc.stockSync.status.useQuery(undefined, {
    enabled: canManageStock,
  });
  const demoMode = syncStatus?.demoMode === true;

  // ─── Sync Dialog State ───────────────────────────────────
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  // Reset page when filters change
  const handleItemTypeChange = (value: string) => {
    replaceListState({ itemType: value || null, page: null });
  };

  const totalPages = data?.pages ?? 1;
  const filtered = Boolean(search || productType || itemType);
  const clearFilters = () => clearSearch({ type: null, itemType: null });

  /* บรรทัดรองใต้ชื่อหน้า (ตำแหน่ง .date ของต้นแบบ) — บอกว่าสต๊อกมาจากไหน
     ไม่เติมคำโปรยลอย: ข้อความมาจากสถานะเชื่อมต่อจริงเท่านั้น */
  const sourceMeta = demoMode ? (
    <span className="inline-flex items-center gap-2">
      <Database className="h-3.5 w-3.5" aria-hidden="true" />
      สต๊อกทดสอบในเครื่อง · ไม่เชื่อม Anajak Stock
    </span>
  ) : syncStatus?.lastSyncAt ? (
    <span className="inline-flex items-center gap-2">
      <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
      เชื่อมสต๊อกกับ Anajak Stock · ดึงล่าสุด {formatDateTime(syncStatus.lastSyncAt)}
    </span>
  ) : undefined;

  return (
    <PageShell
      title="สินค้า"
      meta={sourceMeta}
      action={
        canManageStock ? (
          <>
            <Button asChild variant="ghost" size="icon-sm">
              <Link
                href="/settings/stock"
                aria-label={demoMode ? "ดูสต๊อกทดสอบ" : "ตั้งค่าการเชื่อมต่อ Stock"}
              >
                <Settings />
              </Link>
            </Button>
            {!syncStatusLoading && !demoMode ? (
              <Button size="sm" onClick={() => setSyncDialogOpen(true)}>
                <Cloud />
                ดึงสต๊อก
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      <ResponsiveList
        items={data?.products}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายการสินค้าไม่สำเร็จ"
        onRetry={() => refetch()}
        label="สินค้า"
        toolbar={
          <Toolbar>
            <SearchInput
              surface="raised"
              containerClassName="@2xl:max-w-sm @2xl:flex-1"
              placeholder="ค้นชื่อสินค้า หรือ SKU"
              aria-label="ค้นหาสินค้าจากชื่อหรือ SKU"
              ref={searchInputRef}
              defaultValue={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <ToolbarGroup className="flex-wrap">
              {/* แถบเลื่อนกลุ่มสินค้า — ชุดเดียวกับหน้าลูกค้า/ใบเสนอราคา (ต้นแบบ segbar) */}
              <SegmentedControl
                value={itemType}
                onChange={handleItemTypeChange}
                options={itemTypes.map((g) => ({ value: g.value as string, label: g.label }))}
                aria-label="กรองกลุ่มสินค้า"
              />
              <Select
                shape="pill"
                surface="raised"
                aria-label="ประเภทเสื้อ"
                value={productType}
                onChange={(e) => replaceListState({ type: e.target.value || null, page: null })}
                className="@2xl:w-44"
              >
                {productTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              {filtered ? <Button variant="ghost" size="sm" onClick={clearFilters}>ล้างตัวกรอง</Button> : null}
            </ToolbarGroup>
            {data ? (
              <ToolbarGroup align="end">
                <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                  {data.total.toLocaleString("th-TH")} รายการ
                </span>
              </ToolbarGroup>
            ) : null}
          </Toolbar>
        }
        emptyState={
          <EmptyState
            icon={Package}
            title={filtered ? "ไม่พบสินค้าตรงตัวกรอง" : "ยังไม่มีสินค้า"}
            description={
              filtered
                ? "ลองเปลี่ยนคำค้นหรือดูสินค้าทั้งหมด"
                : demoMode
                  ? "ยังไม่มีสินค้าในสต๊อกทดสอบ"
                  : "สินค้าจะถูกดึงมาจาก Anajak Stock อัตโนมัติ"
            }
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>ล้างตัวกรองและคำค้น</Button>
              ) : canManageStock ? (
                <div className="flex gap-2">
                  {!syncStatusLoading && !demoMode ? (
                    <Button variant="outline" size="sm" onClick={() => setSyncDialogOpen(true)}>
                      <Cloud />
                      ดึงสต๊อกตอนนี้
                    </Button>
                  ) : null}
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/settings/stock">
                      <Settings />
                      ตั้งค่า
                    </Link>
                  </Button>
                </div>
              ) : undefined
            }
          />
        }
        renderDesktop={(products) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>สินค้า</DataTable.Th>
                <DataTable.Th>SKU</DataTable.Th>
                <DataTable.Th>ประเภท</DataTable.Th>
                <DataTable.Th align="right">คงเหลือ</DataTable.Th>
                <DataTable.Th align="right">ราคาขาย</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                <DataTable.Th align="right"><span className="sr-only">เปิดสินค้า</span></DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {products.map((product) => {
                const typeLabel = PRODUCT_TYPE_DISPLAY_LABELS[product.productType] ?? product.productType;
                const stock = product.totalStock ?? 0;
                const level = stockLevel(product);
                return (
                  <DataTable.Row
                    key={product.id}
                    href={`/products/${product.id}`}
                    tone={
                      !product.isActive
                        ? null
                        : level === "out"
                          ? "danger"
                          : level === "low"
                            ? "warning"
                            : null
                    }
                  >
                    <DataTable.Td>
                      <div className="flex items-center gap-3">
                        <ProductThumb url={product.imageUrl} name={product.name} />
                        <div className="min-w-0">
                          <Link href={`/products/${product.id}`} className="font-medium text-strong">
                            {product.name}
                          </Link>
                          <p className="truncate text-xs text-muted">
                            {product._count.variants > 0
                              ? `${product._count.variants.toLocaleString("th-TH")} ตัวเลือก`
                              : "ยังไม่มีตัวเลือก"}
                          </p>
                        </div>
                      </div>
                    </DataTable.Td>
                    <DataTable.Td className="whitespace-nowrap tabular-nums text-muted">{product.sku}</DataTable.Td>
                    <DataTable.Td className="whitespace-nowrap text-secondary">{typeLabel}</DataTable.Td>
                    <DataTable.Td align="right" className="whitespace-nowrap tabular-nums">
                      <StockCell level={level} stock={stock} />
                    </DataTable.Td>
                    <DataTable.Td align="right" className="whitespace-nowrap tabular-nums text-strong">
                      {priceLabel(product)}
                    </DataTable.Td>
                    <DataTable.Td>
                      <Badge variant={product.isActive ? "success" : "default"} size="sm">
                        {product.isActive ? "ใช้งาน" : "ปิดอยู่"}
                      </Badge>
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted" aria-hidden="true" />
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(products) => (
          <div className="grid grid-cols-1 gap-3 px-4.5 pb-4.5 sm:grid-cols-2">
            {products.map((product) => {
              const typeLabel = PRODUCT_TYPE_DISPLAY_LABELS[product.productType] ?? product.productType;
              const stock = product.totalStock ?? 0;
              const level = stockLevel(product);
              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className={cn("card-surface block overflow-hidden rounded-2xl", FOCUS_BUTTON)}
                >
                  <div className="flex items-center gap-3 p-3">
                    <ProductThumb url={product.imageUrl} name={product.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-strong">{product.name}</p>
                      <p className="truncate text-xs text-muted">{product.sku} · {typeLabel}</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-strong">{priceLabel(product)}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap tabular-nums">
                      <StockCell level={level} stock={stock} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        pagination={
          data && data.total > 0 && totalPages <= 1 ? (
            /* หน้าเดียวก็ยังใช้แถบเดียวกับตอนหลายหน้า — ผิวและตำแหน่งไม่กระโดด */
            <div className={c("pager")}>
              <span>
                ทั้งหมด <b>{data.total.toLocaleString("th-TH")}</b> รายการ
              </span>
            </div>
          ) : data && data.total > 0 ? (
            <TablePagination
              page={page}
              totalPages={totalPages}
              total={data.total}
              limit={limit}
              onPageChange={(nextPage) => replaceListState({ page: String(nextPage) })}
              label="รายการ"
            />
          ) : null
        }
      />

      {/* ─── Sync Dialog ─────────────────────────────────────── */}
      {canManageStock && !demoMode && (
        <SyncDialog
          open={syncDialogOpen}
          onClose={() => setSyncDialogOpen(false)}
        />
      )}

    </PageShell>
  );
}
