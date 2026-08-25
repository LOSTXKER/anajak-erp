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
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Package, RefreshCw, Cloud, Database, Settings } from "lucide-react";
import { permAllows } from "@/lib/permissions";

import { SyncDialog } from "@/components/sync-dialog";
import { FilterChip } from "@/components/ui/filter-chip";
import { FOCUS_BUTTON } from "@/components/ui/tokens";

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
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
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
  } = useListPageState();
  const productType = searchParams.get("type") ?? "";
  const itemType = searchParams.get("itemType") ?? "";
  const limit = 24;
  const { data: me } = trpc.user.me.useQuery();
  const canManageStock = permAllows(me?.permissions, "manage_settings");

  // ─── Queries ──────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = trpc.product.list.useQuery({
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="สินค้า"
        action={
          canManageStock ? (
          <>
            <Button asChild variant="ghost" size="icon-sm">
                <Link
                  href="/settings/stock"
                  aria-label={
                    demoMode ? "ดูสต๊อกทดสอบ" : "ตั้งค่าการเชื่อมต่อ Stock"
                  }
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
      />

      {demoMode ? (
        <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          <span>สต๊อกทดสอบในเครื่อง · ไม่เชื่อม Anajak Stock</span>
        </div>
      ) : syncStatus?.lastSyncAt ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Cloud className="h-3.5 w-3.5" />
          <span>Sync ล่าสุด: {formatDateTime(syncStatus.lastSyncAt)}</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span>ทั้งหมด {syncStatus.totalProducts} รายการ</span>
        </div>
      ) : null}

      {/* ≤5 ตัวเลือก → ชิป (กติกาเดียวกับ /quotations, /notifications · ดู tokens.ts) */}
      <div className="flex flex-wrap gap-2">
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
      </div>

      {/* แถบเครื่องมือของกลาง — จุดตัดวัดจากความกว้างพื้นที่เนื้อหาจริง (@container)
          ไม่ใช่ความกว้างหน้าต่าง เลยใช้ @2xl: แทน sm: ที่เขียนไว้เดิม */}
      <Toolbar>
        <SearchInput
          surface="raised"
          containerClassName="@2xl:max-w-sm @2xl:flex-1"
          placeholder="ค้นหาชื่อสินค้า, SKU..."
          ref={searchInputRef}
          defaultValue={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <ToolbarGroup>
          <Select
            shape="pill"
            surface="raised"
            aria-label="กรองประเภทสินค้า"
            value={productType}
            onChange={(e) =>
              replaceListState({ type: e.target.value || null, page: null })
            }
            className="@2xl:w-44"
          >
            {productTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </ToolbarGroup>
      </Toolbar>

      {/* ─── Product Grid ────────────────────────────────────── */}
      {isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card-surface overflow-hidden rounded-lg">
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.products?.length === 0 ? (
        <div className="card-surface rounded-lg">
          <EmptyState
            icon={Package}
            title="ไม่พบสินค้า"
            description={
              demoMode
                ? "รีเซ็ต demo seed เพื่อสร้างสินค้าสต๊อกทดสอบ"
                : "สินค้าจะถูกดึงมาจาก Anajak Stock อัตโนมัติ"
            }
            action={
              canManageStock ? (
              <div className="flex gap-2">
                  {!syncStatusLoading && !demoMode ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSyncDialogOpen(true)}
                    >
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
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data?.products?.map((product) => {
            const typ = typeConfig[product.productType] ?? {
              label: product.productType,
            };

            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className={cn("block rounded-lg", FOCUS_BUTTON)}
              >
                <div className="card-surface card-surface-hover group h-full overflow-hidden rounded-lg">
                  <div className="relative flex h-44 items-center justify-center bg-slate-100 dark:bg-slate-800">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package
                        className="h-10 w-10 text-slate-300 dark:text-slate-600"
                        strokeWidth={1.25}
                      />
                    )}

                    <span
                      className={`absolute right-2 top-2 h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                        product.isActive
                          ? "bg-green-500"
                          : "bg-slate-300 dark:bg-slate-600"
                      }`}
                      title={product.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                    />
                  </div>

                  <div className="space-y-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium text-strong">
                          {product.name}
                        </h3>
                        <p className="truncate text-2xs text-muted">
                          {product.sku} · {typ.label}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-sm font-semibold tabular-nums text-strong">
                        {(() => {
                          const prices = product.variants
                            ?.map((v) => v.sellingPrice)
                            .filter((p) => p > 0);
                          if (prices && prices.length > 0) {
                            const min = Math.min(...prices);
                            const max = Math.max(...prices);
                            return min === max
                              ? formatCurrency(min)
                              : `${formatCurrency(min)} - ${formatCurrency(max)}`;
                          }
                          return formatCurrency(product.basePrice);
                        })()}
                      </span>
                      <span className="text-2xs text-muted">
                        สต็อก{" "}
                        <span className="tabular-nums font-medium text-secondary">
                          {product.totalStock ?? 0}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ─── Sync Dialog ─────────────────────────────────────── */}
      {canManageStock && !demoMode && (
        <SyncDialog
          open={syncDialogOpen}
          onClose={() => setSyncDialogOpen(false)}
        />
      )}

      {/* ─── Pagination ──────────────────────────────────────── */}
      {data && data.total > 0 && (
        <div className="flex flex-col items-center gap-3">
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  replaceListState({ page: String(Math.max(1, page - 1)) })
                }
              >
                ก่อนหน้า
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2,
                )
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-2 text-sm text-slate-400"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={page === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => replaceListState({ page: String(p) })}
                      className="min-w-[2rem]"
                    >
                      {p}
                    </Button>
                  ),
                )}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() =>
                  replaceListState({
                    page: String(Math.min(totalPages, page + 1)),
                  })
                }
              >
                ถัดไป
              </Button>
            </div>
          )}
          <p className="text-center text-xs text-slate-400">
            แสดง {data.products.length} จาก {data.total} รายการ
          </p>
        </div>
      )}
    </div>
  );
}
