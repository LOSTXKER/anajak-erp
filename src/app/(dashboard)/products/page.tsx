"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { Package, RefreshCw, Cloud, Database, Settings } from "lucide-react";
import { permAllows } from "@/lib/permissions";

import { SyncDialog } from "@/components/sync-dialog";
import { FilterChip } from "@/components/ui/filter-chip";
import { DataTable } from "@/components/ui/data-table";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { Badge } from "@/components/ui/badge";
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

/** ราคาขาย: มีหลายตัวเลือกให้บอกเป็นช่วง ไม่มีก็ใช้ราคาตั้งต้น */
function priceLabel(product: { variants?: { sellingPrice: number }[] | null; basePrice: number }) {
  const prices = (product.variants ?? []).map((v) => v.sellingPrice).filter((price) => price > 0);
  if (prices.length === 0) return formatCurrency(product.basePrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

// ─── Product Group Tabs ─────────────────────────────────────
const itemTypes = [
  { value: "", label: "ทั้งหมด" },
  { value: "FINISHED_GOOD", label: "สินค้าสำเร็จรูป" },
  { value: "RAW_MATERIAL", label: "วัตถุดิบ" },
  { value: "CONSUMABLE", label: "วัสดุสิ้นเปลือง" },
] as const;

// ─── Product Type Config ────────────────────────────────────
const productTypes = [
  { value: "", label: "ทั้งหมด" },
  { value: "T_SHIRT", label: "เสื้อยืด" },
  { value: "POLO", label: "โปโล" },
  { value: "HOODIE", label: "ฮู้ดดี้" },
  { value: "JACKET", label: "แจ็คเก็ต" },
  { value: "TOTE_BAG", label: "ถุงผ้า" },
  { value: "OTHER", label: "อื่นๆ" },
] as const;

const typeConfig: Record<string, { label: string }> = {
  T_SHIRT: { label: "เสื้อยืด" },
  POLO: { label: "โปโล" },
  HOODIE: { label: "ฮู้ดดี้" },
  JACKET: { label: "แจ็คเก็ต" },
  TOTE_BAG: { label: "ถุงผ้า" },
  OTHER: { label: "อื่นๆ" },
};

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

  return (
    <PageShell
      title="สินค้า"
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
                <RefreshCw />
                Sync
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {demoMode ? (
        <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          <span>สต๊อกทดสอบในเครื่อง · ไม่เชื่อม Anajak Stock</span>
        </div>
      ) : syncStatus?.lastSyncAt ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Cloud className="h-3.5 w-3.5" />
          <span>Sync ล่าสุด: {formatDateTime(syncStatus.lastSyncAt)}</span>
          <span className="text-muted">·</span>
          <span>ทั้งหมด {syncStatus.totalProducts} รายการ</span>
        </div>
      ) : null}

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
              placeholder="ค้นหาชื่อสินค้า, SKU..."
              aria-label="ค้นหาสินค้าจากชื่อหรือ SKU"
              ref={searchInputRef}
              defaultValue={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <ToolbarGroup className="flex-wrap">
              {/* ≤5 ตัวเลือก → ชิป (กติกาเดียวกับ /quotations, /notifications · ดู tokens.ts) */}
              {itemTypes.map((g) => (
                <FilterChip
                  key={g.value}
                  surface="raised"
                  selected={itemType === g.value}
                  onClick={() => handleItemTypeChange(g.value)}
                >
                  {g.label}
                </FilterChip>
              ))}
              <Select
                shape="pill"
                surface="raised"
                aria-label="กรองประเภทสินค้า"
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
                      <RefreshCw />
                      Sync ตอนนี้
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
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {products.map((product) => {
                const typ = typeConfig[product.productType] ?? { label: product.productType };
                const stock = product.totalStock ?? 0;
                return (
                  <DataTable.Row
                    key={product.id}
                    href={`/products/${product.id}`}
                    tone={product.isActive && stock === 0 ? "danger" : null}
                  >
                    <DataTable.Td>
                      <div className="flex items-center gap-3">
                        <ProductThumb url={product.imageUrl} name={product.name} />
                        <Link href={`/products/${product.id}`} className="min-w-0 font-medium text-strong">
                          {product.name}
                        </Link>
                      </div>
                    </DataTable.Td>
                    <DataTable.Td className="whitespace-nowrap tabular-nums text-muted">{product.sku}</DataTable.Td>
                    <DataTable.Td className="whitespace-nowrap text-secondary">{typ.label}</DataTable.Td>
                    <DataTable.Td align="right" className="whitespace-nowrap tabular-nums">
                      {stock === 0 ? (
                        <span className="font-medium text-red-700 dark:text-red-400">ของหมด</span>
                      ) : (
                        <span className="font-medium text-strong">{stock.toLocaleString("th-TH")}</span>
                      )}
                    </DataTable.Td>
                    <DataTable.Td align="right" className="whitespace-nowrap tabular-nums text-strong">
                      {priceLabel(product)}
                    </DataTable.Td>
                    <DataTable.Td>
                      <Badge variant={product.isActive ? "success" : "default"} size="sm">
                        {product.isActive ? "ใช้งาน" : "ปิดอยู่"}
                      </Badge>
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
              const typ = typeConfig[product.productType] ?? { label: product.productType };
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
                      <p className="truncate text-xs text-muted">{product.sku} · {typ.label}</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-strong">{priceLabel(product)}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      สต็อก {(product.totalStock ?? 0).toLocaleString("th-TH")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        pagination={
          data && data.total > 0 && totalPages <= 1 ? (
            <p className="px-4.5 py-3 text-xs tabular-nums text-muted">ทั้งหมด {data.total} รายการ</p>
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
