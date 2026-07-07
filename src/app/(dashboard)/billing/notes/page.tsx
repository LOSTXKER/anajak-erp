"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { TablePagination } from "@/components/ui/table-pagination";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { FileStack, Plus, Printer, Ban, Loader2 } from "lucide-react";
import { permAllows } from "@/lib/permissions";
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-labels";

export default function BillingNotesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Create form state
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: me } = trpc.user.me.useQuery();
  const canView = me ? permAllows(me.permissions, "manage_billing_docs") : true;

  const utils = trpc.useUtils();
  const { data, isLoading, isError, refetch } = trpc.billingNote.list.useQuery(
    { search: search || undefined, page, limit: 50 },
    { enabled: canView }
  );
  // ค้นหาผ่าน server — ลูกค้าเกินหน้าแรกของลิสต์ต้องหาเจอด้วยการพิมพ์ ไม่หายเงียบ
  const customers = trpc.customer.list.useQuery(
    { search: customerSearch || undefined, limit: 50 },
    { enabled: showCreate }
  );
  const eligible = trpc.billingNote.eligibleInvoices.useQuery(
    { customerId },
    { enabled: showCreate && !!customerId }
  );

  const createNote = useMutationWithInvalidation(trpc.billingNote.create, {
    invalidate: [utils.billingNote.list, utils.billingNote.eligibleInvoices],
    onSuccess: (note: { billingNoteNumber: string }) => {
      setShowCreate(false);
      resetCreateForm();
      // ไม่ window.open ตรงนี้ — ไม่ใช่ user gesture โดน popup blocker ได้ ให้กดพิมพ์จากตาราง
      toast.success(`สร้างใบวางบิล ${note.billingNoteNumber} แล้ว — กดไอคอนพิมพ์ในตารางเพื่อส่งลูกค้า`);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "สร้างใบวางบิลไม่สำเร็จ");
    },
  });

  const voidNote = useMutationWithInvalidation(trpc.billingNote.void, {
    invalidate: [utils.billingNote.list, utils.billingNote.eligibleInvoices],
    onSuccess: () => {
      setVoidTarget(null);
      setVoidReason("");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "ยกเลิกใบวางบิลไม่สำเร็จ");
    },
  });

  function resetCreateForm() {
    setCustomerId("");
    setSelectedIds(new Set());
    setDueDate("");
    setNotes("");
  }

  function toggleInvoice(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const eligibleList = eligible.data?.invoices ?? [];
  const creditNoteTotal = eligible.data?.creditNoteTotal ?? 0;
  const selectedTotal = eligibleList
    .filter((inv) => selectedIds.has(inv.id))
    .reduce((sum, inv) => sum + inv.outstanding, 0);
  const allSelected = eligibleList.length > 0 && selectedIds.size === eligibleList.length;

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader title="ใบวางบิล" description="รวมใบแจ้งหนี้ค้างชำระเรียกเก็บตามรอบ" />
        <p className="text-sm text-slate-400">หน้านี้เปิดเฉพาะเจ้าของ ผู้จัดการ และบัญชี</p>
      </div>
    );
  }

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ใบวางบิล"
        description="รวมใบแจ้งหนี้ค้างชำระของลูกค้าเรียกเก็บตามรอบ"
        breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "ใบวางบิล" }]}
        action={
          <Button onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            สร้างใบวางบิล
          </Button>
        }
      />

      <SearchInput
        placeholder="ค้นหาเลขใบวางบิล, ชื่อลูกค้า..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <DataTable.Root>
        <DataTable.Head>
          <tr>
            <DataTable.Th>เลขที่</DataTable.Th>
            <DataTable.Th>ลูกค้า</DataTable.Th>
            <DataTable.Th>วันที่วางบิล</DataTable.Th>
            <DataTable.Th>นัดรับชำระ</DataTable.Th>
            <DataTable.Th align="right">จำนวนใบ</DataTable.Th>
            <DataTable.Th align="right">ยอดเรียกเก็บ</DataTable.Th>
            <DataTable.Th align="right">คงเหลือจริง</DataTable.Th>
            <DataTable.Th>สถานะ</DataTable.Th>
            <DataTable.Th> </DataTable.Th>
          </tr>
        </DataTable.Head>
        <DataTable.Body>
          {isLoading &&
            [...Array(4)].map((_, i) => (
              <tr key={i}>
                {[...Array(9)].map((_, j) => (
                  <DataTable.Td key={j}>
                    <Skeleton className="h-4 w-16" />
                  </DataTable.Td>
                ))}
              </tr>
            ))}
          {data?.notes?.map((note) => (
            <DataTable.Row key={note.id}>
              <DataTable.Td className="font-medium text-slate-900 dark:text-white">
                {note.billingNoteNumber}
              </DataTable.Td>
              <DataTable.Td>
                {note.customer.company
                  ? `${note.customer.company} (${note.customer.name})`
                  : note.customer.name}
              </DataTable.Td>
              <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(note.billingDate)}
              </DataTable.Td>
              <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                {note.dueDate ? formatDate(note.dueDate) : "—"}
              </DataTable.Td>
              <DataTable.Td align="right" className="tabular-nums">
                {note._count.items}
              </DataTable.Td>
              <DataTable.Td
                align="right"
                className="font-medium tabular-nums text-slate-900 dark:text-white"
              >
                {formatCurrency(note.totalAmount)}
              </DataTable.Td>
              <DataTable.Td align="right" className="tabular-nums">
                {note.isVoided ? "—" : formatCurrency(note.currentOutstanding)}
              </DataTable.Td>
              <DataTable.Td>
                {note.isVoided ? (
                  <Badge variant="default">ยกเลิก</Badge>
                ) : note.currentOutstanding === 0 ? (
                  <Badge variant="success">รับครบแล้ว</Badge>
                ) : (
                  <Badge variant="accent">ใช้งาน</Badge>
                )}
              </DataTable.Td>
              <DataTable.Td>
                <div className="flex items-center justify-end gap-1">
                  <a
                    href={`/print/billing-note/${note.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded p-1.5 text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                    title="พิมพ์ / PDF"
                  >
                    <Printer className="h-4 w-4" />
                  </a>
                  {!note.isVoided && (
                    <button
                      onClick={() => {
                        setVoidReason(""); // กันเหตุผลของใบก่อนหน้าค้างมาแล้วถูกบันทึกผิดใบ
                        setVoidTarget(note.id);
                      }}
                      className="rounded p-1.5 text-slate-400 transition-colors hover:text-red-600"
                      title="ยกเลิกใบวางบิล"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </DataTable.Td>
            </DataTable.Row>
          ))}
          {!isLoading && data?.notes?.length === 0 && (
            <tr>
              <td colSpan={9}>
                <EmptyState
                  icon={FileStack}
                  title="ยังไม่มีใบวางบิล"
                  description="กดสร้างใบวางบิล แล้วเลือกใบแจ้งหนี้ค้างชำระของลูกค้าที่จะเรียกเก็บ"
                />
              </td>
            </tr>
          )}
        </DataTable.Body>
      </DataTable.Root>

      {data && data.notes.length > 0 && (
        <TablePagination
          page={page}
          totalPages={data.pages}
          total={data.total}
          onPageChange={setPage}
        />
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        {/* max-h+scroll ตาม pattern dialog อื่น (aging/wht) — สอง QueryError ซ้อนกันสูงเกินจอมือถือได้ */}
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>สร้างใบวางบิล</DialogTitle>
            <DialogDescription>
              เลือกลูกค้าแล้วติ๊กใบแจ้งหนี้ค้างชำระที่จะรวมเรียกเก็บ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                ลูกค้า
              </label>
              <Input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="พิมพ์ค้นหาชื่อลูกค้า/บริษัท..."
                className="mb-2"
              />
              {/* query พังห้ามเงียบ — dropdown ว่างเปล่าอ่านเป็น "ไม่มีลูกค้า" ได้ (DESIGN.md) */}
              {customers.isError && !customers.data ? (
                <QueryError
                  message="โหลดรายชื่อลูกค้าไม่สำเร็จ"
                  onRetry={() => customers.refetch()}
                />
              ) : (
                <Select
                  value={customerId}
                  onValueChange={(v) => {
                    setCustomerId(v);
                    setSelectedIds(new Set());
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกลูกค้า..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.data?.customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company ? `${c.company} (${c.name})` : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {customerId && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ใบแจ้งหนี้ค้างชำระ
                </label>
                {/* isError มาก่อน — query พังแล้วโชว์ "ไม่มีใบค้าง" = เลขโกหก คนข้ามใบจริง */}
                {eligible.isError && !eligible.data ? (
                  <QueryError
                    message="โหลดใบแจ้งหนี้ค้างชำระไม่สำเร็จ"
                    onRetry={() => eligible.refetch()}
                  />
                ) : eligible.isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : eligibleList.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700">
                    ลูกค้ารายนี้ไม่มีใบแจ้งหนี้ค้างชำระที่วางบิลได้
                  </p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2 pb-1.5 text-sm font-medium dark:border-slate-800">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() =>
                          setSelectedIds(
                            allSelected
                              ? new Set()
                              : new Set(eligibleList.map((inv) => inv.id))
                          )
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                      เลือกทั้งหมด ({eligibleList.length} ใบ)
                    </label>
                    {eligibleList.map((inv) => (
                      <label
                        key={inv.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(inv.id)}
                            onChange={() => toggleInvoice(inv.id)}
                            className="h-4 w-4 accent-blue-600"
                          />
                          <span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {inv.invoiceNumber}
                            </span>
                            <span className="ml-1.5 text-xs text-slate-500">
                              {INVOICE_TYPE_LABELS[inv.type] ?? inv.type} · {inv.orderNumber}
                              {inv.dueDate && ` · ครบกำหนด ${formatDate(inv.dueDate)}`}
                            </span>
                          </span>
                        </span>
                        <span className="text-sm font-medium tabular-nums">
                          {formatCurrency(inv.outstanding)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedIds.size > 0 && (
                  <p className="mt-1.5 text-right text-sm">
                    เลือก {selectedIds.size} ใบ · รวม{" "}
                    <span className="font-semibold">{formatCurrency(selectedTotal)}</span>
                  </p>
                )}
                {creditNoteTotal > 0 && (
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    ลูกค้ารายนี้มีใบลดหนี้ที่ยังไม่ผูกใบเดิมรวม {formatCurrency(creditNoteTotal)} —
                    ระบบหักให้อัตโนมัติไม่ได้ ตรวจยอดเรียกเก็บก่อนส่งลูกค้า (ใบที่ผูกใบเดิมถูกหักจากยอดค้างแล้ว)
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  วันนัดรับชำระ
                </label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  หมายเหตุ
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="เช่น รอบวางบิลสิ้นเดือน"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() =>
                createNote.mutate({
                  customerId,
                  // ตัดกับลิสต์ล่าสุดเสมอ — ใบที่เพิ่งจ่ายครบ/ถูกวางบิลไปแล้วหลุดจาก set เอง
                  invoiceIds: eligibleList
                    .filter((inv) => selectedIds.has(inv.id))
                    .map((inv) => inv.id),
                  dueDate: dueDate || undefined,
                  notes: notes || undefined,
                })
              }
              disabled={!customerId || selectedIds.size === 0 || createNote.isPending}
              className="gap-1.5"
            >
              {createNote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileStack className="h-4 w-4" />
              )}
              สร้างใบวางบิล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void dialog */}
      <Dialog open={voidTarget !== null} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยกเลิกใบวางบิล</DialogTitle>
            <DialogDescription>
              ใบแจ้งหนี้ในใบนี้จะกลับมาวางบิลใหม่ได้ (ยกเลิก-ออกใหม่เท่านั้น ห้ามลบ)
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              เหตุผลที่ยกเลิก
            </label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              placeholder="ระบุเหตุผล..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>
              ไม่ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => voidTarget && voidNote.mutate({ id: voidTarget, reason: voidReason })}
              disabled={!voidReason || voidNote.isPending}
              className="gap-1.5"
            >
              {voidNote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              ยืนยันยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
