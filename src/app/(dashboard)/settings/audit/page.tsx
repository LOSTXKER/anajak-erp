"use client";

import { Suspense } from "react";
import { History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useListPageState } from "@/hooks/use-list-page-state";
import { permAllows } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";
import { PageShell } from "@/components/page-shell";

export default function AuditLogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <AuditLogContent />
    </Suspense>
  );
}

function AuditLogContent() {
  const { page, replaceListState } = useListPageState();
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const meLoading = meQuery.isLoading;
  const canView = permAllows(me?.permissions, "view_admin_reports");
  const query = trpc.analytics.auditLog.useQuery(
    { page, limit: 30 },
    { enabled: canView }
  );

  // เดิมลบ page ทิ้งเมื่อ nextPage <= 1 — hook ลบให้เองเฉพาะค่า "1" จึงส่ง null ครอบเคส <= 1
  const goToPage = (nextPage: number) =>
    replaceListState({ page: nextPage > 1 ? String(nextPage) : null });

  return (
    <PageShell
      back={{ href: "/settings", label: "ย้อนกลับ" }}
      title="ประวัติระบบ"
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
        items={query.data?.logs}
        isLoading={meLoading || query.isLoading || query.isFetching}
        isError={query.isError}
        errorMessage="โหลดประวัติระบบไม่สำเร็จ"
        onRetry={() => query.refetch()}
        label="ประวัติระบบ"
        emptyState={<EmptyState icon={History} title="ยังไม่มีประวัติระบบ" />}
        renderMobile={(logs) => (
          <ul className="space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="card-surface rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge size="sm">{log.action}</Badge>
                  <time className="text-xs text-muted">
                    {formatDateTime(log.createdAt)}
                  </time>
                </div>
                <p className="mt-2 text-sm font-medium text-strong">
                  {log.entityType}
                </p>
                <p className="text-xs text-secondary">โดย {log.user.name}</p>
              </li>
            ))}
          </ul>
        )}
        renderDesktop={(logs) => (
          <DataTable.Root bordered={false} flush>
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
                  <DataTable.Td><Badge size="sm">{log.action}</Badge></DataTable.Td>
                  <DataTable.Td>{log.entityType}</DataTable.Td>
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
              onPageChange={goToPage}
              label="รายการ"
            />
          ) : undefined
        }
      />
    </PageShell>
  );
}
