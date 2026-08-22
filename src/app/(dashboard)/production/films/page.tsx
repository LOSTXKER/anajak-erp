"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useListPageState } from "@/hooks/use-list-page-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { StatusLabel } from "@/components/ui/status-label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/ui/data-table";
import { ResponsiveList } from "@/components/ui/responsive-list";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { formatDate, cn } from "@/lib/utils";
import { FOCUS_FIELD_INVALID } from "@/components/ui/tokens";
import { permAllows } from "@/lib/permissions";
import { Film, Hand } from "lucide-react";
import { FilterChip } from "@/components/ui/filter-chip";
import { ProductionModuleNav } from "@/components/production/production-module-nav";

// คลังฟิล์มพร้อมรีด (FLOW-REDESIGN ก้อน 2) — ฟิล์มพิมพ์เผื่อจากรอบพิมพ์
// "ลายไหน ของลูกค้าไหน เหลือกี่ชิ้น" — ลูกค้าสั่งซ้ำเช็คที่นี่ก่อน รีดได้เลยไม่ต้องพิมพ์ใหม่
// หยิบใช้ = ตัดจำนวนคงเหลือ (server กันติดลบ) · ไม่มีเงินบนหน้านี้ (มติเลิกคิดต้นทุนต่องาน)

type FilmStockItem = RouterOutput["filmStock"]["list"][number];

export default function FilmStockPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <FilmStockPageContent />
    </Suspense>
  );
}

function FilmStockPageContent() {
  // ช่องค้นหาใช้ param "search" (ไม่ใช่ "q" มาตรฐาน) — ลิงก์เตือนฟิล์มค้างจาก
  // ฟอร์มเปิดงาน (order-customer-section) ส่ง ?search=<ชื่อลูกค้า> มาแบบเดิม ต้องรับได้ต่อ
  const { search, onSearchChange, searchInputRef } = useListPageState({
    searchParam: "search",
  });
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [consuming, setConsuming] = useState<FilmStockItem | null>(null);
  // B8: ปุ่ม "หยิบใช้" (ตัดคงเหลือฟิล์ม) เฉพาะคนมีสิทธิ์ผลิต — role อื่นเห็นคลังอ่านอย่างเดียว
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const canManage =
    !meQuery.isError && permAllows(me?.permissions, "manage_production");

  const listQuery = trpc.filmStock.list.useQuery({
    search: search.trim() || undefined,
    includeEmpty,
  });

  const hasSearch = search.trim().length > 0;
  const listStale = listQuery.isError && Boolean(listQuery.data);
  const canWrite = canManage && !listStale;

  return (
    <div className="space-y-5">
      <PageHeader
        title="คลังฟิล์มพร้อมรีด"
        description="ค้นหาฟิล์มที่เหลือและตรวจจำนวนก่อนเปิดรอบพิมพ์ใหม่"
      />
      <ProductionModuleNav />

      {meQuery.isError && (
        <Alert variant="warning">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>โหลดสิทธิ์การผลิตไม่สำเร็จ — หน้านี้จึงเปิดให้อ่านอย่างเดียว</span>
            <Button variant="outline" size="sm" onClick={() => void meQuery.refetch()}>
              ลองใหม่
            </Button>
          </span>
        </Alert>
      )}

      {/* ── ค้นหา + toggle แสดงที่หมดแล้ว — อยู่นอก list area กัน focus หลุดตอนโหลด ── */}
      <Toolbar>
        <SearchInput
          surface="raised"
          ref={searchInputRef}
          placeholder="ค้นหาลาย ลูกค้า หรือเลขออเดอร์"
          defaultValue={search}
          onChange={(e) => onSearchChange(e.target.value)}
          containerClassName="@2xl:max-w-sm @2xl:flex-1"
        />
        <ToolbarGroup className="shrink-0">
          {/* เดิมเป็นสวิตช์ + ปุ่มข้อความแยกกัน = ตัวกรองแบบที่ 5 ของระบบ
              เปลี่ยนเป็นชิปเปิด/ปิด ให้เหมือนหน้ารายการอื่น (กติกาใน tokens.ts) */}
          <FilterChip
            surface="raised"
            selected={includeEmpty}
            onClick={() => setIncludeEmpty(!includeEmpty)}
          >
            รวมฟิล์มหมด
          </FilterChip>
        </ToolbarGroup>
      </Toolbar>

      {listStale && (
        <Alert variant="warning">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>ข้อมูลคลังล่าสุดอาจยังไม่สด — ปิดปุ่มหยิบใช้ชั่วคราว</span>
            <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
              ลองใหม่
            </Button>
          </span>
        </Alert>
      )}

      {/* โหลด/พัง/ว่าง/สลับตาราง↔การ์ดที่ lg — ResponsiveList จัดการแทน branch ทำมือ */}
      <ResponsiveList
        items={listQuery.data}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        emptyState={
          hasSearch ? (
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
          )
        }
        renderDesktop={(items) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>ฟิล์มพร้อมรีด</DataTable.Th>
                <DataTable.Th>ต้นทาง</DataTable.Th>
                <DataTable.Th align="right">คงเหลือ</DataTable.Th>
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
                    <Link
                      href={`/customers/${item.customer.id}`}
                      className="mt-1 inline-flex text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {item.customer.name}
                    </Link>
                  </DataTable.Td>
                  <DataTable.Td>
                    <p className="text-sm">
                      {item.order ? (
                        <Link
                          href={`/orders/${item.order.id}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {item.order.orderNumber}
                        </Link>
                      ) : (
                        <span className="text-slate-400">ไม่ระบุออเดอร์</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {item.printRun ? `รอบ ${item.printRun.runNumber} · ` : ""}
                      เข้าคลัง {formatDate(item.createdAt)}
                    </p>
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
                      /* ฟิล์มหมด = ปลายทางของรายการนี้ (ค่าเปลี่ยนตามการหยิบใช้)
                         → เป็นสถานะ ใช้ป้ายจุดสีภาษาเดียวกับทั้งเว็บ · items-end ให้ชิดขวาตามคอลัมน์ */
                      <StatusLabel label="หมดแล้ว" className="items-end" />
                    )}
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    {canWrite && item.qty > 0 && (
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => setConsuming(item)}
                        className="gap-1.5"
                      >
                        <Hand />
                        หยิบใช้
                      </Button>
                    )}
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(items) => (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="card-surface rounded-lg p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-slate-900 dark:text-white">
                    {item.label}
                  </span>
                  {item.qty === 0 && <StatusLabel label="หมดแล้ว" />}
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
                {canWrite && item.qty > 0 && (
                  <Button
                    onClick={() => setConsuming(item)}
                    className="mt-3 h-11 w-full gap-1.5"
                  >
                    <Hand />
                    หยิบใช้
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      />

      {consuming && canWrite && (
        <ConsumeDialog item={consuming} onClose={() => setConsuming(null)} />
      )}
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
            ตัดจำนวนออกจากคลัง
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-surface-muted p-3">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</p>
          <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {item.customer.name} · คงเหลือ {item.qty} ชิ้น
          </p>
        </div>
        <div className="space-y-3">
          <Field
            label="จำนวนที่หยิบใช้ (ชิ้น)"
            error={qty > item.qty ? `เกินจำนวนคงเหลือ (${item.qty} ชิ้น)` : undefined}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={item.qty}
              value={qty}
              onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className={cn(
                "w-32 text-center tabular-nums",
                invalid && cn("border-red-300", FOCUS_FIELD_INVALID)
              )}
            />
          </Field>
          <Field label="หมายเหตุ (ไม่บังคับ)">
            <Input
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ใช้กับออเดอร์ ORD-xxxx / ฟิล์มเสีย ตัดทิ้ง"
            />
          </Field>
        </div>
        <DialogSubmitFooter
          pending={consume.isPending}
          disabled={invalid}
          submitLabel="ยืนยันหยิบใช้"
          submitIcon={<Hand />}
          onCancel={onClose}
          onSubmit={() =>
            consume.mutate({ id: item.id, qty, note: note.trim() || undefined })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
