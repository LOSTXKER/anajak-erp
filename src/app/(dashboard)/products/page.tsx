"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Package, RefreshCw, Cloud, Settings } from "lucide-react";

import { SyncDialog } from "@/components/sync-dialog";

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
  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState("");
  const [itemType, setItemType] = useState("");
  const [page, setPage] = useState(1);
  const limit = 24;

  // ─── Queries ──────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = trpc.product.list.useQuery({
    search: search || undefined,
    productType: productType || undefined,
    itemType: itemType || undefined,
    page,
    limit,
  });

  const { data: syncStatus } = trpc.stockSync.status.useQuery();

  // ─── Sync Dialog State ───────────────────────────────────
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  // Reset page when filters change
  const handleItemTypeChange = (value: string) => {
    setItemType(value);
    setPage(1);
  };

  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="สินค้า"
        description="แคตตาล็อกสินค้าและตัวเลือก"
        action={
          <>
            <Link href="/settings/stock">
              <Button variant="ghost" size="icon-sm" title="ตั้งค่าการเชื่อมต่อ Stock">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="sm" onClick={() => setSyncDialogOpen(true)}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </Button>
          </>
        }
      />

      {syncStatus?.lastSyncAt && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Cloud className="h-3.5 w-3.5" />
          <span>Sync ล่าสุด: {formatDateTime(syncStatus.lastSyncAt)}</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span>ทั้งหมด {syncStatus.totalProducts} รายการ</span>
        </div>
      )}

      <SegmentedControl
        value={itemType}
        onChange={handleItemTypeChange}
        options={itemTypes.map((g) => ({ value: g.value, label: g.label }))}
      />

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <SearchInput
          containerClassName="flex-1"
          placeholder="ค้นหาชื่อสินค้า, SKU..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <NativeSelect
          value={productType}
          onChange={(e) => {
            setProductType(e.target.value);
            setPage(1);
          }}
          className="sm:w-44"
        >
          {productTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* ─── Product Grid ────────────────────────────────────── */}
      {isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="card-surface overflow-hidden rounded-2xl"
            >
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
        <div className="card-surface rounded-2xl">
          <EmptyState
            icon={Package}
            title="ไม่พบสินค้า"
            description="สินค้าจะถูกดึงมาจาก Anajak Stock อัตโนมัติ"
            action={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSyncDialogOpen(true)}>
                  <RefreshCw className="h-4 w-4" />
                  Sync ตอนนี้
                </Button>
                <Link href="/settings/stock">
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                    ตั้งค่า
                  </Button>
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data?.products?.map((product) => {
            const typ = typeConfig[product.productType] ?? {
              label: product.productType,
            };

            return (
              <Link key={product.id} href={`/products/${product.id}`}>
                <div className="card-surface card-surface-hover group h-full overflow-hidden rounded-2xl transition-all">
                  <div className="relative flex h-44 items-center justify-center bg-slate-100 dark:bg-slate-800">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" strokeWidth={1.25} />
                    )}

                    <span
                      className={`absolute right-2 top-2 h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                        product.isActive ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                      }`}
                      title={product.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                    />
                  </div>

                  <div className="space-y-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                          {product.name}
                        </h3>
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {product.sku} · {typ.label}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
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
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        สต็อก{" "}
                        <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">
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
      <SyncDialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
      />

      {/* ─── Pagination ──────────────────────────────────────── */}
      {data && data.total > 0 && (
        <div className="flex flex-col items-center gap-3">
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ก่อนหน้า
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - page) <= 2
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
                      onClick={() => setPage(p as number)}
                      className="min-w-[2rem]"
                    >
                      {p}
                    </Button>
                  )
                )}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
