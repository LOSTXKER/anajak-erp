"use client";

import { Suspense, useState } from "react";
import { History } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { permAllows } from "@/lib/permissions";
import { cn, formatDateTime } from "@/lib/utils";
import { c } from "@/components/kit/kit";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { INTERACTIVE_PRESSED, FOCUS_INSET } from "@/components/ui/tokens";
import { KitDateRange } from "@/components/kit/date-range";
import { validDateParam } from "@/lib/order-list-contract";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { TablePagination } from "@/components/ui/table-pagination";
import { PageShell } from "@/components/page-shell";
import {
  AUDIT_ENTITY_FILTERS,
  AUDIT_ENTITY_LABELS,
  auditChanges,
  auditFieldLabel,
  auditSubject,
  auditSummary,
  auditValueText,
  isSevereAudit,
} from "./audit-labels";

/* ประวัติระบบ — โครงตามต้นแบบที่เบสเคาะ 2026-09-16 (setaudit):
   เรื่องเป็นคำไทย + จุดสี · รายละเอียดคือเลขเอกสารและสิ่งที่เปลี่ยน · แถวกดดูรายละเอียดได้
   ช่องค้นหาของต้นแบบทำไม่ได้: analytics.auditLog ไม่รับคำค้น และกรองเฉพาะหน้าที่เปิดอยู่
   จะหลอกผู้ใช้ว่าค้นทั้งระบบ — ใช้ตัวกรองประเภท + ช่วงวันที่ ซึ่งกรองที่ฐานข้อมูลจริง */

type AuditRow = RouterOutput["analytics"]["auditLog"]["logs"][number];

const PAGE_LIMIT = 30;

export default function AuditLogPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <AuditLogContent />
    </Suspense>
  );
}

function AuditLogContent() {
  const { page, searchParams, replaceListState } = useListPageState();
  const dateFrom = validDateParam(searchParams.get("from"));
  const dateTo = validDateParam(searchParams.get("to"));
  const typeParam = searchParams.get("type") ?? "";
  const entityType = AUDIT_ENTITY_FILTERS.some((item) => item.value === typeParam)
    ? typeParam
    : "";
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const meLoading = meQuery.isLoading;
  const canView = permAllows(me?.permissions, "view_admin_reports");
  const query = trpc.analytics.auditLog.useQuery(
    {
      from: dateFrom || undefined,
      to: dateTo || undefined,
      entityType: entityType || undefined,
      page,
      limit: PAGE_LIMIT,
    },
    { enabled: canView }
  );
  usePageClamp(page, query.data?.pages, replaceListState);

  const [selected, setSelected] = useState<AuditRow | null>(null);
  const hasFilter = Boolean(dateFrom || dateTo || entityType);

  // เดิมลบ page ทิ้งเมื่อ nextPage <= 1 — hook ลบให้เองเฉพาะค่า "1" จึงส่ง null ครอบเคส <= 1
  const goToPage = (nextPage: number) =>
    replaceListState({ page: nextPage > 1 ? String(nextPage) : null });

  return (
    <PageShell
      title="ประวัติระบบ"
      description="ใครแก้อะไรเมื่อไหร่ · ระบบบันทึกให้เอง แก้และลบไม่ได้"
      error={
        meQuery.isError
          ? {
              message: "ตรวจสิทธิ์ดูประวัติระบบไม่สำเร็จ",
              onRetry: () => void meQuery.refetch(),
            }
          : null
      }
      // !meLoading: ระหว่างเช็คสิทธิ์ยังตอบไม่ได้ว่า "ไม่มีสิทธิ์" — ให้ ResponsiveList
      // โชว์ skeleton รูปรายการของมันเองไปก่อน (ไม่ส่ง loading ให้ shell)
      denied={!meLoading && !canView && { title: "คุณไม่มีสิทธิ์ดูประวัติระบบ" }}
    >
      <ResponsiveList
        toolbar={
          <Toolbar>
            <ToolbarGroup>
              <KitDateRange
                label="ช่วงวันที่ของประวัติ"
                from={dateFrom}
                to={dateTo}
                onChange={(from, to) =>
                  replaceListState({ from: from || null, to: to || null, page: null })
                }
              />
              <Select
                shape="pill"
                surface="raised"
                aria-label="กรองประเภทเหตุการณ์"
                value={entityType}
                onChange={(event) =>
                  replaceListState({ type: event.target.value || null, page: null })
                }
                className="@2xl:w-56"
              >
                <option value="">ทุกประเภท</option>
                {AUDIT_ENTITY_FILTERS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    replaceListState({ from: null, to: null, type: null, page: null })
                  }
                >
                  ล้างตัวกรอง
                </Button>
              )}
            </ToolbarGroup>
            <span
              className="text-xs tabular-nums text-muted @2xl:ml-auto"
              aria-live="polite"
              aria-busy={query.isFetching}
            >
              {query.data ? `${query.data.total.toLocaleString("th-TH")} รายการ` : ""}
            </span>
          </Toolbar>
        }
        items={query.data?.logs}
        isLoading={meLoading || query.isLoading || query.isFetching}
        isError={query.isError}
        errorMessage="โหลดประวัติระบบไม่สำเร็จ"
        onRetry={() => query.refetch()}
        label="ประวัติระบบ"
        emptyState={
          hasFilter ? (
            <EmptyState
              icon={History}
              title="ไม่มีเหตุการณ์ในตัวกรองนี้"
              description="ลองขยายช่วงวันที่ หรือเลือกประเภทอื่น"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    replaceListState({ from: null, to: null, type: null, page: null })
                  }
                >
                  ล้างตัวกรอง
                </Button>
              }
            />
          ) : (
            <EmptyState icon={History} title="ยังไม่มีประวัติระบบ" />
          )
        }
        renderMobile={(logs) => (
          <ul className="space-y-3">
            {logs.map((log) => {
              const subject = auditSubject(log.action, log.entityType);
              const summary = auditSummary(log);
              return (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(log)}
                    className={cn(
                      "card-surface w-full rounded-2xl p-4 text-left",
                      INTERACTIVE_PRESSED,
                      FOCUS_INSET,
                      isSevereAudit(log.action) && "row-tone-danger",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={c("stat")}>
                        <span className={c("d", subject.tone || "gray")} aria-hidden="true" />
                        {subject.label}
                      </span>
                      <time
                        dateTime={new Date(log.createdAt).toISOString()}
                        className="text-xs text-muted"
                      >
                        {formatDateTime(log.createdAt)}
                      </time>
                    </span>
                    {summary && (
                      <span className="mt-2 block text-sm text-secondary">{summary}</span>
                    )}
                    <span className="mt-1 block text-xs text-muted">โดย {log.user.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        renderDesktop={(logs) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>เรื่อง</DataTable.Th>
                <DataTable.Th>รายละเอียด</DataTable.Th>
                <DataTable.Th>คนทำ</DataTable.Th>
                <DataTable.Th>เมื่อไหร่</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {logs.map((log) => {
                const subject = auditSubject(log.action, log.entityType);
                const summary = auditSummary(log);
                return (
                  <DataTable.Row
                    key={log.id}
                    tone={isSevereAudit(log.action) ? "danger" : undefined}
                    onClick={() => setSelected(log)}
                    className={cn("cursor-pointer", INTERACTIVE_PRESSED)}
                  >
                    <DataTable.Td>
                      {/* ปุ่มในเซลล์แรก = ทางคีย์บอร์ดของแถวที่กดได้ (tr กดได้อย่างเดียวจะข้ามคนใช้คีย์บอร์ด) */}
                      <button
                        type="button"
                        onClick={() => setSelected(log)}
                        className={cn("text-left", FOCUS_INSET)}
                      >
                        <span className={c("stat")}>
                          <span className={c("d", subject.tone || "gray")} aria-hidden="true" />
                          {subject.label}
                        </span>
                      </button>
                    </DataTable.Td>
                    <DataTable.Td className="text-muted">{summary || "—"}</DataTable.Td>
                    <DataTable.Td>{log.user.name}</DataTable.Td>
                    <DataTable.Td className="text-xs text-muted">
                      {formatDateTime(log.createdAt)}
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable.Root>
        )}
        pagination={
          query.data && query.data.logs.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={query.data.pages}
              total={query.data.total}
              limit={PAGE_LIMIT}
              onPageChange={goToPage}
              label="รายการ"
            />
          ) : undefined
        }
      />
      {selected && (
        <AuditDetailDialog log={selected} onClose={() => setSelected(null)} />
      )}
    </PageShell>
  );
}

/** รายละเอียดเหตุการณ์ — อ่านอย่างเดียว ไม่มีปุ่มที่เปลี่ยนข้อมูล (ประวัติระบบแก้ไม่ได้) */
function AuditDetailDialog({ log, onClose }: { log: AuditRow; onClose: () => void }) {
  const subject = auditSubject(log.action, log.entityType);
  const changes = auditChanges(log.oldValue, log.newValue);
  const entityLabel = AUDIT_ENTITY_LABELS[log.entityType] ?? log.entityType;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className={c("stat")}>
              <span className={c("d", subject.tone || "gray")} aria-hidden="true" />
              {subject.label}
            </span>
          </DialogTitle>
          <DialogDescription>
            {entityLabel} · {formatDateTime(log.createdAt)} · โดย {log.user.name}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-3 text-sm">
          {log.entityId && (
            <div>
              <dt className="text-xs font-medium text-muted">เอกสาร/รหัสอ้างอิง</dt>
              <dd className="break-all font-medium text-strong">{log.entityId}</dd>
            </div>
          )}
          {log.reason && (
            <div>
              <dt className="text-xs font-medium text-muted">เหตุผลที่บันทึกไว้</dt>
              <dd className="whitespace-pre-wrap text-secondary">{log.reason}</dd>
            </div>
          )}
          {changes.length > 0 && (
            <div>
              <dt className="mb-1 text-xs font-medium text-muted">สิ่งที่เปลี่ยน</dt>
              <dd>
                <ul className="space-y-1.5">
                  {changes.map((change) => (
                    <li key={change.key} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs text-muted">{auditFieldLabel(change.key)}</span>
                      <span className="text-secondary">
                        {auditValueText(change.key, change.before)}
                      </span>
                      <span aria-hidden="true" className="text-muted">→</span>
                      <span className="font-medium text-strong">
                        {auditValueText(change.key, change.after)}
                      </span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>

        <p className="border-t border-divider pt-3 text-xs text-muted">
          ประวัติระบบแก้ไม่ได้และลบไม่ได้ — ใช้เป็นหลักฐานย้อนกลับได้เสมอ
        </p>
      </DialogContent>
    </Dialog>
  );
}
