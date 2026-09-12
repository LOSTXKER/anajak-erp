"use client";

import Link from "next/link";
import { AUDIT_ENTITIES, auditActionLabel, auditEntityLabel, auditRecordHref } from "@/components/settings/audit-labels";
import { Select } from "@/components/ui/select";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { Suspense } from "react";
import { History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { permAllows } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { TablePagination } from "@/components/ui/table-pagination";
import { PageShell } from "@/components/page-shell";

export default function AuditLogPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <AuditLogContent />
    </Suspense>
  );
}

function AuditLogContent() {
  const { page, searchParams, replaceListState } = useListPageState();
  const rawType = searchParams.get("type") ?? "";
  const entityType = Object.hasOwn(AUDIT_ENTITIES, rawType) ? rawType : "";
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const meLoading = meQuery.isLoading;
  const canView = permAllows(me?.permissions, "view_admin_reports");
  const query = trpc.analytics.auditLog.useQuery(
    { page, limit: 30, entityType: entityType || undefined },
    { enabled: canView }
  );
  usePageClamp(page, query.data?.pages, replaceListState);

  // เดิมลบ page ทิ้งเมื่อ nextPage <= 1 — hook ลบให้เองเฉพาะค่า "1" จึงส่ง null ครอบเคส <= 1
  const goToPage = (nextPage: number) =>
    replaceListState({ page: nextPage > 1 ? String(nextPage) : null });

  return (
    <PageShell
      back={{ href: "/settings", label: "ย้อนกลับ" }}
      title="ประวัติระบบ"
      description="ดูว่าใครเปลี่ยนข้อมูลอะไรและเมื่อไร เลือกหมวดเพื่อหาเหตุการณ์ที่ต้องตรวจ"
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
      <Select aria-label="กรองประวัติตามหมวดข้อมูล" value={entityType} onChange={(event) => replaceListState({ type: event.target.value || null, page: null })} className="sm:max-w-xs"><option value="">ทุกหมวดข้อมูล</option>{Object.entries(AUDIT_ENTITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <ResponsiveList
        items={query.data?.logs}
        isLoading={meLoading || query.isLoading || query.isFetching}
        isError={query.isError}
        errorMessage="โหลดประวัติระบบไม่สำเร็จ"
        onRetry={() => query.refetch()}
        label="ประวัติระบบ"
        emptyState={<EmptyState icon={History} title={entityType ? "ไม่พบประวัติในหมวดนี้" : "ยังไม่มีประวัติระบบ"} />}
        renderMobile={(logs) => (
          <ul className="space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="card-surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge size="sm">{auditActionLabel(log.action)}</Badge>
                  <time dateTime={new Date(log.createdAt).toISOString()} className="text-xs text-muted">
                    {formatDateTime(log.createdAt)}
                  </time>
                </div>
                <p className="mt-2 text-sm font-medium text-strong">
                  {auditEntityLabel(log.entityType)}
                </p>
                <p className="text-xs text-secondary">โดย {log.user.name}</p>
                <AuditRecord entityType={log.entityType} entityId={log.entityId} />
              </li>
            ))}
          </ul>
        )}
        renderDesktop={(logs) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>การทำงาน</DataTable.Th>
                <DataTable.Th>ข้อมูล</DataTable.Th>
                <DataTable.Th>ผู้ใช้</DataTable.Th>
                <DataTable.Th>เวลา</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {logs.map((log) => (
                <DataTable.Row key={log.id}>
                  <DataTable.Td><Badge size="sm">{auditActionLabel(log.action)}</Badge></DataTable.Td>
                  <DataTable.Td>{auditEntityLabel(log.entityType)}<AuditRecord entityType={log.entityType} entityId={log.entityId} /></DataTable.Td>
                  <DataTable.Td>{log.user.name}</DataTable.Td>
                  <DataTable.Td className="text-xs text-muted">
                    {formatDateTime(log.createdAt)}
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>
        )}
        pagination={
          query.data && query.data.logs.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={query.data.pages}
              total={query.data.total}
              limit={30}
              onPageChange={goToPage}
              label="รายการ"
            />
          ) : undefined
        }
      />
    </PageShell>
  );
}

function AuditRecord({ entityType, entityId }: { entityType: string; entityId: string | null }) {
  if (!entityId) return null;
  const href = auditRecordHref(entityType, entityId);
  return href
    ? <Link href={href} className={`mt-1 inline-flex min-h-11 items-center rounded-lg text-sm text-blue-700 underline dark:text-blue-400 ${FOCUS_BUTTON}`}>เปิดรายการ</Link>
    : <p className="mt-1 break-all text-xs text-secondary">อ้างอิง {entityId}</p>;
}
