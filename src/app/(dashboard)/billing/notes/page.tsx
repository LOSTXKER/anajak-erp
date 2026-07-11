"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { ResponsiveList } from "@/components/ui/responsive-list";
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
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <BillingNotesPageContent />
    </Suspense>
  );
}

function positivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function BillingNotesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const page = positivePage(searchParams.get("page"));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Create form state
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const replaceListState = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (!value || (key === "page" && value === "1")) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    []
  );
  useEffect(() => {
    if (searchInputRef.current && searchInputRef.current.value !== search) {
      searchInputRef.current.value = search;
    }
  }, [search]);

  const { data: me } = trpc.user.me.useQuery();
  const canView = me ? permAllows(me.permissions, "manage_billing_docs") : true;

  const utils = trpc.useUtils();
  const { data, isLoading, isFetching, isError, refetch } = trpc.billingNote.list.useQuery(
    { search: search.trim() || undefined, page, limit: 50 },
    { enabled: canView, placeholderData: (previous) => previous }
  );

  useEffect(() => {
    if (data && page > data.pages && data.pages >= 1) {
      replaceListState({ page: String(data.pages) });
    }
  }, [data, page, replaceListState]);
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
        <p className="text-sm text-slate-400">ต้องมีสิทธิ์ &quot;ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี&quot; — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้</p>
      </div>
    );
  }

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
        ref={searchInputRef}
        placeholder="ค้นหาเลขใบวางบิล, ชื่อลูกค้า..."
        defaultValue={search}
        onChange={(event) => {
          if (searchTimer.current) clearTimeout(searchTimer.current);
          const value = event.target.value;
          searchTimer.current = setTimeout(
            () => replaceListState({ q: value.trim() || null, page: null }),
            300
          );
        }}
      />

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
                      <Button asChild variant="ghost" size="icon-sm">
                        <a
                          href={`/print/billing-note/${note.id}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`พิมพ์ใบวางบิล ${note.billingNoteNumber}`}
                        >
                          <Printer className="h-4 w-4" />
                        </a>
                      </Button>
                      {!note.isVoided && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-500 hover:text-red-700"
                          aria-label={`ยกเลิกใบวางบิล ${note.billingNoteNumber}`}
                          onClick={() => {
                            setVoidReason("");
                            setVoidTarget(note.id);
                          }}
                        >
                          <Ban className="h-4 w-4" />
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
              <article key={note.id} role="listitem" className="card-surface rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {note.billingNoteNumber}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {note.customer.company || note.customer.name}
                    </p>
                  </div>
                  {note.isVoided ? (
                    <Badge variant="default">ยกเลิก</Badge>
                  ) : note.currentOutstanding === 0 ? (
                    <Badge variant="success">รับครบแล้ว</Badge>
                  ) : (
                    <Badge variant="accent">ใช้งาน</Badge>
                  )}
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
                      <Printer className="h-4 w-4" />
                      พิมพ์
                    </a>
                  </Button>
                  {!note.isVoided && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-700"
                      aria-label={`ยกเลิกใบวางบิล ${note.billingNoteNumber}`}
                      onClick={() => {
                        setVoidReason("");
                        setVoidTarget(note.id);
                      }}
                    >
                      <Ban className="h-4 w-4" />
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
            <DialogDescription>
              เลือกลูกค้าแล้วติ๊กใบแจ้งหนี้ค้างชำระที่จะรวมเรียกเก็บ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="billing-note-customer-search" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                ค้นหาและเลือกลูกค้า
              </label>
              <Input
                id="billing-note-customer-search"
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
                  <SelectTrigger aria-label="เลือกลูกค้าออกใบวางบิล">
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
                <p className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ใบแจ้งหนี้ค้างชำระ
                </p>
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
                <label htmlFor="billing-note-due-date" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  วันนัดรับชำระ
                </label>
                <Input id="billing-note-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <label htmlFor="billing-note-notes" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  หมายเหตุ
                </label>
                <Input
                  id="billing-note-notes"
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
            <label htmlFor="billing-note-void-reason" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              เหตุผลที่ยกเลิก
            </label>
            <Textarea
              id="billing-note-void-reason"
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
