"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { Button } from "@/components/ui/button";
import { StatusLabel } from "@/components/ui/status-label";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar } from "@/components/ui/toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { TablePagination } from "@/components/ui/table-pagination";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { FileStack, Plus, Printer, Ban, Loader2 } from "lucide-react";
import { permAllows } from "@/lib/permissions";
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-labels";
import { DASHED } from "@/components/ui/tokens";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function BillingNotesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <BillingNotesPageContent />
    </Suspense>
  );
}

/* สถานะใบวางบิล = จุดสี + ข้อความ ภาษาเดียวกับทั้งเว็บ (เดิมเป็นแคปซูล <Badge>)
   ยกเลิก/รับครบแล้ว เป็นสถานะปลายทาง จึงย้อมข้อความให้สะดุดตาตอนสแกนตาราง
   ส่วน "ใช้งาน" เป็นระหว่างทาง คงข้อความเทาเข้ม ปล่อยให้จุดสีเป็นตัวบอก
   เขียนเป็นตัวช่วยตัวเดียวเพราะตาราง (เดสก์ท็อป) กับการ์ด (มือถือ) ต้องพูดตรงกันเสมอ */
function NoteStatus({
  isVoided,
  outstanding,
  className,
}: {
  isVoided: boolean;
  outstanding: number;
  className?: string;
}) {
  if (isVoided) {
    return <StatusLabel label="ยกเลิก" tone="danger" emphasize className={className} />;
  }
  if (outstanding === 0) {
    return <StatusLabel label="รับครบแล้ว" tone="success" emphasize className={className} />;
  }
  return <StatusLabel label="ใช้งาน" tone="accent" className={className} />;
}

function BillingNotesPageContent() {
  const { search, page, replaceListState, onSearchChange, searchInputRef } =
    useListPageState();
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
  const { data, isLoading, isFetching, isError, refetch } = trpc.billingNote.list.useQuery(
    { search: search.trim() || undefined, page, limit: 50 },
    { enabled: canView, placeholderData: (previous) => previous }
  );

  usePageClamp(page, data?.pages, replaceListState);
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

  return (
    <PageShell
      title="ใบวางบิล"
      breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "ใบวางบิล" }]}
      action={
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus />
          สร้างใบวางบิล
        </Button>
      }
      denied={
        me && !canView
          ? {
              description:
                'ต้องมีสิทธิ์ "ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี" — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้',
            }
          : null
      }
    >
      <Toolbar>
        <SearchInput
          surface="raised"
          ref={searchInputRef}
          containerClassName="@2xl:max-w-sm @2xl:flex-1"
          placeholder="ค้นหาเลขใบวางบิล, ชื่อลูกค้า..."
          defaultValue={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </Toolbar>

      <ResponsiveList
        items={data?.notes}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายการใบวางบิลไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ใบวางบิล"
        renderDesktop={(notesList) => (
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
                <DataTable.Th><span className="sr-only">การทำงาน</span></DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {notesList.map((note) => (
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
                  <DataTable.Td align="right" className="font-medium tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(note.totalAmount)}
                  </DataTable.Td>
                  <DataTable.Td align="right" className="tabular-nums">
                    {note.isVoided ? "—" : formatCurrency(note.currentOutstanding)}
                  </DataTable.Td>
                  <DataTable.Td>
                    <NoteStatus
                      isVoided={note.isVoided}
                      outstanding={note.currentOutstanding}
                    />
                  </DataTable.Td>
                  <DataTable.Td>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button asChild variant="ghost" size="icon-sm">
                        <a
                          href={`/print/billing-note/${note.id}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`พิมพ์ใบวางบิล ${note.billingNoteNumber}`}
                        >
                          <Printer />
                        </a>
                      </Button>
                      {!note.isVoided && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted hover:text-red-700 dark:hover:text-red-400"
                          aria-label={`ยกเลิกใบวางบิล ${note.billingNoteNumber}`}
                          onClick={() => {
                            setVoidReason("");
                            setVoidTarget(note.id);
                          }}
                        >
                          <Ban />
                        </Button>
                      )}
                    </div>
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(notesList) => (
          <div role="list" aria-label="รายการใบวางบิล" className="space-y-3">
            {notesList.map((note) => (
              <article key={note.id} role="listitem" className="card-surface rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {note.billingNoteNumber}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {note.customer.company || note.customer.name}
                    </p>
                  </div>
                  <NoteStatus
                    isVoided={note.isVoided}
                    outstanding={note.currentOutstanding}
                    className="shrink-0"
                  />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">วันที่วางบิล</dt>
                    <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{formatDate(note.billingDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">นัดรับชำระ</dt>
                    <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                      {note.dueDate ? formatDate(note.dueDate) : "ยังไม่กำหนด"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">ยอดเรียกเก็บ · {note._count.items} ใบ</dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(note.totalAmount)}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-slate-500 dark:text-slate-400">คงเหลือจริง</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-white">
                      {note.isVoided ? "—" : formatCurrency(note.currentOutstanding)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <a
                      href={`/print/billing-note/${note.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Printer />
                      พิมพ์
                    </a>
                  </Button>
                  {!note.isVoided && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-700 dark:text-red-400"
                      aria-label={`ยกเลิกใบวางบิล ${note.billingNoteNumber}`}
                      onClick={() => {
                        setVoidReason("");
                        setVoidTarget(note.id);
                      }}
                    >
                      <Ban />
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        emptyState={
          <EmptyState
            icon={FileStack}
            title="ยังไม่มีใบวางบิล"
            description={
              search
                ? "ลองเปลี่ยนคำค้นหา"
                : "กดสร้างใบวางบิล แล้วเลือกใบแจ้งหนี้ค้างชำระของลูกค้าที่จะเรียกเก็บ"
            }
          />
        }
        pagination={
          data && data.notes.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={data.pages}
              total={data.total}
              onPageChange={(nextPage) =>
                replaceListState({ page: String(nextPage) })
              }
            />
          ) : undefined
        }
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        {/* max-h+scroll ตาม pattern dialog อื่น (aging/wht) — สอง QueryError ซ้อนกันสูงเกินจอมือถือได้ */}
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>สร้างใบวางบิล</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Field label="ค้นหาและเลือกลูกค้า" id="billing-note-customer-search">
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="พิมพ์ค้นหาชื่อลูกค้า/บริษัท..."
                />
              </Field>
              {/* query พังห้ามเงียบ — dropdown ว่างเปล่าอ่านเป็น "ไม่มีลูกค้า" ได้ (DESIGN.md) */}
              {customers.isError && !customers.data ? (
                <QueryError
                  message="โหลดรายชื่อลูกค้าไม่สำเร็จ"
                  onRetry={() => customers.refetch()}
                />
              ) : (
                <Select value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    setSelectedIds(new Set());
                  }} aria-label="เลือกลูกค้าออกใบวางบิล" placeholder="เลือกลูกค้า...">
                    {customers.data?.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company ? `${c.company} (${c.name})` : c.name}
                      </option>
                    ))}
                  </Select>
              )}
            </div>

            {customerId && (
              // fieldset/legend ไม่ใช่ <Field> — ตัวถูกติดป้ายเป็น "กลุ่ม checkbox" ไม่ใช่ช่องเดี่ยว
              // (label htmlFor ชี้กลุ่มไม่ได้ · เดิมเป็น <p> โปรแกรมอ่านหน้าจอจับคู่ไม่ได้เลย)
              <fieldset>
                <legend className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ใบแจ้งหนี้ค้างชำระ
                </legend>
                {/* isError มาก่อน — query พังแล้วโชว์ "ไม่มีใบค้าง" = เลขโกหก คนข้ามใบจริง */}
                {eligible.isError && !eligible.data ? (
                  <QueryError
                    message="โหลดใบแจ้งหนี้ค้างชำระไม่สำเร็จ"
                    onRetry={() => eligible.refetch()}
                  />
                ) : eligible.isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : eligibleList.length === 0 ? (
                  <p className={cn(DASHED, "rounded-lg p-3 text-sm text-muted")}>
                    ลูกค้ารายนี้ไม่มีใบแจ้งหนี้ค้างชำระที่วางบิลได้
                  </p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2 pb-1.5 text-sm font-medium dark:border-slate-800">
                      <Checkbox
                        checked={allSelected}
                        onChange={() =>
                          setSelectedIds(
                            allSelected
                              ? new Set()
                              : new Set(eligibleList.map((inv) => inv.id))
                          )
                        }
                      />
                      เลือกทั้งหมด ({eligibleList.length} ใบ)
                    </label>
                    {eligibleList.map((inv) => (
                      <label
                        key={inv.id}
                        className="group flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-interactive-hover active:bg-interactive-pressed dark:hover:bg-interactive-hover dark:active:bg-interactive-pressed"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedIds.has(inv.id)}
                            onChange={() => toggleInvoice(inv.id)}
                          />
                          <span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {inv.invoiceNumber}
                            </span>
                            <span className="ml-1.5 text-xs text-muted group-hover:text-secondary group-active:text-secondary">
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
              </fieldset>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="วันนัดรับชำระ" id="billing-note-due-date">
                <DatePicker value={dueDate} onChange={(v) => setDueDate(v)} />
              </Field>
              <Field label="หมายเหตุ" id="billing-note-notes">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="เช่น รอบวางบิลสิ้นเดือน"
                />
              </Field>
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
                <Loader2 className="animate-spin" />
              ) : (
                <FileStack />
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
          <Field label="เหตุผลที่ยกเลิก" id="billing-note-void-reason">
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              placeholder="ระบุเหตุผล..."
            />
          </Field>
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
                <Loader2 className="animate-spin" />
              ) : (
                <Ban />
              )}
              ยืนยันยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
