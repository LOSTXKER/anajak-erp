"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate, cn } from "@/lib/utils";
import { Film, Printer, Loader2, Hand } from "lucide-react";

// คลังฟิล์มพร้อมรีด (FLOW-REDESIGN ก้อน 2) — ฟิล์มพิมพ์เผื่อจากรอบพิมพ์
// "ลายไหน ของลูกค้าไหน เหลือกี่ชิ้น" — ลูกค้าสั่งซ้ำเช็คที่นี่ก่อน รีดได้เลยไม่ต้องพิมพ์ใหม่
// หยิบใช้ = ตัดจำนวนคงเหลือ (server กันติดลบ) · ไม่มีเงินบนหน้านี้ (มติเลิกคิดต้นทุนต่องาน)

type FilmStockItem = RouterOutput["filmStock"]["list"][number];

export default function FilmStockPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [consuming, setConsuming] = useState<FilmStockItem | null>(null);

  // debounce 300ms — pattern เดียวกับ ProductPicker
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const listQuery = trpc.filmStock.list.useQuery({
    search: debouncedSearch.trim() || undefined,
    includeEmpty,
  });

  const items = listQuery.data ?? [];
  const hasSearch = debouncedSearch.trim().length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="คลังฟิล์มพร้อมรีด"
        description="ฟิล์มพิมพ์เผื่อ — เช็คก่อนพิมพ์ใหม่ทุกครั้งที่ลูกค้าสั่งซ้ำ"
        action={
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/production/print-runs">
              <Printer className="h-4 w-4" />
              รอบพิมพ์ฟิล์ม
            </Link>
          </Button>
        }
      />

      {/* ── ค้นหา + toggle แสดงที่หมดแล้ว — อยู่นอก list area กัน focus หลุดตอนโหลด ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="ค้นหาลาย / ชื่อลูกค้า / เลขออเดอร์..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="flex-1"
          className="h-11"
        />
        <div className="flex min-h-[44px] shrink-0 items-center gap-2">
          <Switch checked={includeEmpty} onCheckedChange={setIncludeEmpty} />
          <button
            type="button"
            onClick={() => setIncludeEmpty(!includeEmpty)}
            className="text-sm text-slate-600 dark:text-slate-300"
          >
            แสดงที่หมดแล้ว
          </button>
        </div>
      </div>

      {listQuery.isError ? (
        <QueryError onRetry={() => listQuery.refetch()} />
      ) : listQuery.isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/80">
          {hasSearch ? (
            <EmptyState
              icon={Film}
              title="ไม่พบฟิล์มที่ค้นหา"
              description="ลองคำค้นอื่น — ค้นได้ด้วยลาย ชื่อลูกค้า หรือเลขออเดอร์"
            />
          ) : (
            <EmptyState
              icon={Film}
              title="ยังไม่มีฟิล์มในคลัง"
              description="ฟิล์มพิมพ์เผื่อจากรอบพิมพ์จะมาอยู่ที่นี่"
            />
          )}
        </div>
      ) : (
        <>
          {/* ── จอใหญ่ = ตาราง ── */}
          <DataTable.Root className="hidden md:block">
            <DataTable.Head>
              <tr>
                <DataTable.Th>ป้ายลาย</DataTable.Th>
                <DataTable.Th>ลูกค้า</DataTable.Th>
                <DataTable.Th>ออเดอร์ต้นทาง</DataTable.Th>
                <DataTable.Th>รอบพิมพ์</DataTable.Th>
                <DataTable.Th align="right">คงเหลือ</DataTable.Th>
                <DataTable.Th>เข้าคลัง</DataTable.Th>
                <DataTable.Th align="right">
                  <span className="sr-only">หยิบใช้</span>
                </DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {items.map((item) => (
                <DataTable.Row key={item.id}>
                  <DataTable.Td>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {item.label}
                    </p>
                    {item.note && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.note}</p>
                    )}
                  </DataTable.Td>
                  <DataTable.Td>
                    <Link
                      href={`/customers/${item.customer.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {item.customer.name}
                    </Link>
                  </DataTable.Td>
                  <DataTable.Td>
                    {item.order ? (
                      <Link
                        href={`/orders/${item.order.id}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {item.order.orderNumber}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </DataTable.Td>
                  <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                    {item.printRun?.runNumber ?? "—"}
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    {item.qty > 0 ? (
                      <span className="tabular-nums font-medium text-slate-900 dark:text-white">
                        {item.qty}
                        <span className="font-normal text-slate-400">
                          /{item.initialQty} ชิ้น
                        </span>
                      </span>
                    ) : (
                      <Badge size="sm" className="opacity-60">
                        หมดแล้ว
                      </Badge>
                    )}
                  </DataTable.Td>
                  <DataTable.Td className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatDate(item.createdAt)}
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    {item.qty > 0 && (
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => setConsuming(item)}
                        className="gap-1.5"
                      >
                        <Hand className="h-4 w-4" />
                        หยิบใช้
                      </Button>
                    )}
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>

          {/* ── มือถือ = การ์ด ── */}
          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-slate-900 dark:text-white">
                    {item.label}
                  </span>
                  {item.qty === 0 && (
                    <Badge size="sm" className="opacity-60">
                      หมดแล้ว
                    </Badge>
                  )}
                </div>
                {item.note && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.note}</p>
                )}
                <p className="mt-1.5 text-sm">
                  <Link
                    href={`/customers/${item.customer.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {item.customer.name}
                  </Link>
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {item.order ? (
                    <Link
                      href={`/orders/${item.order.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {item.order.orderNumber}
                    </Link>
                  ) : (
                    "ไม่ระบุออเดอร์"
                  )}
                  {item.printRun && ` · รอบ ${item.printRun.runNumber}`}
                </p>
                <p className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  คงเหลือ{" "}
                  <span className="font-medium text-slate-900 dark:text-white">{item.qty}</span>/
                  {item.initialQty} ชิ้น · เข้าคลัง {formatDate(item.createdAt)}
                </p>
                {item.qty > 0 && (
                  <Button
                    onClick={() => setConsuming(item)}
                    className="mt-3 h-11 w-full gap-1.5"
                  >
                    <Hand className="h-4 w-4" />
                    หยิบใช้
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {consuming && <ConsumeDialog item={consuming} onClose={() => setConsuming(null)} />}
    </div>
  );
}

// ============================================================
// Dialog หยิบใช้ — ตัดจำนวนออกจากคลัง (รีดงานซ้ำ / ตัดทิ้งฟิล์มเสีย)
// ============================================================

function ConsumeDialog({ item, onClose }: { item: FilmStockItem; onClose: () => void }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();
  const consume = useMutationWithInvalidation(trpc.filmStock.consume, {
    invalidate: [utils.filmStock.list],
    onSuccess: () => {
      toast.success(`หยิบใช้ ${item.label} แล้ว ${qty} ชิ้น`, {
        description: `คงเหลือ ${item.qty - qty} ชิ้น`,
      });
      onClose();
    },
    onError: (err: { message?: string }) =>
      toast.error("หยิบใช้ไม่สำเร็จ", { description: err.message }),
  });

  const invalid = !Number.isInteger(qty) || qty < 1 || qty > item.qty;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>หยิบใช้ฟิล์ม</DialogTitle>
          <DialogDescription>
            ตัดจำนวนออกจากคลัง — ใช้รีดงานสั่งซ้ำ หรือตัดทิ้งฟิล์มเสีย
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</p>
          <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {item.customer.name} · คงเหลือ {item.qty} ชิ้น
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">จำนวนที่หยิบใช้ (ชิ้น)</label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={item.qty}
              value={qty}
              onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className={cn(
                "h-11 w-32 text-center tabular-nums",
                invalid && "border-red-300 focus-visible:ring-red-400"
              )}
            />
            {qty > item.qty && (
              <p className="mt-1 text-xs text-red-500">เกินจำนวนคงเหลือ ({item.qty} ชิ้น)</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">หมายเหตุ (ไม่บังคับ)</label>
            <Input
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ใช้กับออเดอร์ ORD-xxxx / ฟิล์มเสีย ตัดทิ้ง"
              className="h-11"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11">
            ยกเลิก
          </Button>
          <Button
            disabled={consume.isPending || invalid}
            onClick={() =>
              consume.mutate({ id: item.id, qty, note: note.trim() || undefined })
            }
            className="h-11 gap-1.5"
          >
            {consume.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Hand className="h-4 w-4" />
            )}
            ยืนยันหยิบใช้
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
