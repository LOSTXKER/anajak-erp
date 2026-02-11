"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Package, RefreshCw, Search, Cloud, Settings } from "lucide-react";
import { toast } from "sonner";

// ─── Product Group Tabs ─────────────────────────────────────
const productGroups = [
  { value: "", label: "ทั้งหมด" },
  { value: "GARMENT", label: "เสื้อสำเร็จ" },
  { value: "MATERIAL", label: "วัตถุดิบ" },
  { value: "SUPPLY", label: "อุปกรณ์" },
  { value: "FINISHED_GOOD", label: "สินค้าผลิตเสร็จ" },
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

const typeConfig: Record<
  string,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "success"
      | "warning"
      | "purple"
      | "indigo"
      | "teal"
      | "orange";
  }
> = {
  T_SHIRT: { label: "เสื้อยืด", variant: "default" },
  POLO: { label: "โปโล", variant: "indigo" },
  HOODIE: { label: "ฮู้ดดี้", variant: "purple" },
  JACKET: { label: "แจ็คเก็ต", variant: "teal" },
  TOTE_BAG: { label: "ถุงผ้า", variant: "orange" },
  OTHER: { label: "อื่นๆ", variant: "secondary" },
};

const selectClass =
  "flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState("");
  const [productGroup, setProductGroup] = useState("");
  const [page, setPage] = useState(1);
  const limit = 24;

  // ─── Queries ──────────────────────────────────────────────
  const { data, isLoading } = trpc.product.list.useQuery({
    search: search || undefined,
    productType: productType || undefined,
    productGroup: productGroup || undefined,
    page,
    limit,
  });

  const { data: syncStatus } = trpc.stockSync.status.useQuery();

  // ─── Mutations ────────────────────────────────────────────
  const utils = trpc.useUtils();
  const syncAll = trpc.stockSync.syncAll.useMutation({
    onSuccess: (result) => {
      toast.success("Sync สำเร็จ", {
        description: `สร้างใหม่ ${result.productsCreated} รายการ, อัพเดท ${result.productsUpdated} รายการ`,
      });
      utils.product.list.invalidate();
      utils.stockSync.status.invalidate();
    },
    onError: (error) => {
      toast.error("Sync ล้มเหลว", { description: error.message });
    },
  });

  // Reset page when filters change
  const handleGroupChange = (value: string) => {
    setProductGroup(value);
    setPage(1);
  };

  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            สินค้า
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            จัดการแคตตาล็อกสินค้าและตัวเลือก
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Stock settings */}
          <Link href="/settings/stock">
            <Button variant="ghost" size="icon" title="ตั้งค่าการเชื่อมต่อ Stock">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>

          {/* Sync button */}
          <Button
            onClick={() => syncAll.mutate()}
            disabled={syncAll.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 ${syncAll.isPending ? "animate-spin" : ""}`}
            />
            {syncAll.isPending ? "กำลัง Sync..." : "Sync จาก Anajak Stock"}
          </Button>
        </div>
      </div>

      {/* ─── Sync Status ─────────────────────────────────────── */}
      {syncStatus?.lastSyncAt && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Cloud className="h-3.5 w-3.5" />
          <span>Sync ล่าสุด: {formatDateTime(syncStatus.lastSyncAt)}</span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span>ทั้งหมด {syncStatus.totalProducts} รายการ</span>
        </div>
      )}

      {/* ─── Group Tabs ──────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        {productGroups.map((g) => (
          <button
            key={g.value}
            onClick={() => handleGroupChange(g.value)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              productGroup === g.value
                ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* ─── Search & Filter ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="ค้นหาชื่อสินค้า, SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <select
          value={productType}
          onChange={(e) => {
            setProductType(e.target.value);
            setPage(1);
          }}
          className={`${selectClass} sm:w-44`}
        >
          {productTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* ─── Product Grid ────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full rounded-t-xl rounded-b-none" />
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.products?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Cloud className="h-12 w-12 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">ไม่พบสินค้า</p>
            <p className="mt-1 text-xs text-slate-400">สินค้าจะถูกดึงมาจาก Anajak Stock อัตโนมัติ</p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncAll.mutate()}
                disabled={syncAll.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${syncAll.isPending ? "animate-spin" : ""}`} />
                {syncAll.isPending ? "กำลัง Sync..." : "Sync ตอนนี้"}
              </Button>
              <Link href="/settings/stock">
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                  ตั้งค่าการเชื่อมต่อ
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.products?.map((product) => {
            const typ = typeConfig[product.productType] ?? {
              label: product.productType,
              variant: "secondary" as const,
            };

            return (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card className="group overflow-hidden transition-shadow hover:shadow-md">
                  {/* Image placeholder */}
                  <div className="relative flex h-48 items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-16 w-16 text-white/40" />
                    )}

                    {/* Product group badge */}
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-black/50 text-white backdrop-blur-sm">
                        {product.productGroup === "MATERIAL"
                          ? "วัตถุดิบ"
                          : product.productGroup === "SUPPLY"
                            ? "อุปกรณ์"
                            : product.productGroup === "FINISHED_GOOD"
                              ? "สินค้าผลิตเสร็จ"
                              : "เสื้อสำเร็จ"}
                      </Badge>
                    </div>

                    {/* Status indicator */}
                    <div className="absolute top-3 right-3">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          product.isActive
                            ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]"
                            : "bg-slate-400"
                        }`}
                      />
                    </div>

                    {/* Stock quantity overlay */}
                    <div className="absolute right-3 bottom-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-sm">
                      สต็อก {product.totalStock ?? 0} ชิ้น
                    </div>
                  </div>

                  {/* Card body */}
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                          {product.name}
                        </h3>
                        <p className="text-xs text-slate-400">{product.sku}</p>
                      </div>
                      <Badge variant={typ.variant}>{typ.label}</Badge>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
                        {formatCurrency(product.basePrice)}
                      </span>
                      <span className="text-xs text-slate-500">
                        สต็อก{" "}
                        <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                          {product.totalStock ?? 0}
                        </span>{" "}
                        ชิ้น
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

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
