"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";

function positivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <AuditLogContent />
    </Suspense>
  );
}

function AuditLogContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = positivePage(searchParams.get("page"));
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const meLoading = meQuery.isLoading;
  const canView = permAllows(me?.permissions, "view_admin_reports");
  const query = trpc.analytics.auditLog.useQuery(
    { page, limit: 30 },
    { enabled: canView }
  );

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  if (meQuery.isError) {
    return (
      <div className="space-y-5">
        <SettingsPageHeader title="ประวัติระบบ" />
        <QueryError
          message="ตรวจสิทธิ์ดูประวัติระบบไม่สำเร็จ"
          onRetry={() => void meQuery.refetch()}
        />
      </div>
    );
  }

  if (!meLoading && !canView) {
    return (
      <div className="space-y-5">
        <SettingsPageHeader title="ประวัติระบบ" />
        <QueryError message="คุณไม่มีสิทธิ์ดูประวัติระบบ" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsPageHeader
        title="ประวัติระบบ"
        description="ตรวจว่าใครเปลี่ยนข้อมูลอะไร เมื่อไหร่"
      />
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
              <li key={log.id} className="card-surface rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge size="sm">{log.action}</Badge>
                  <time className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(log.createdAt)}
                  </time>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                  {log.entityType}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">โดย {log.user.name}</p>
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
                  <DataTable.Td><Badge size="sm">{log.action}</Badge></DataTable.Td>
                  <DataTable.Td>{log.entityType}</DataTable.Td>
                  <DataTable.Td>{log.user.name}</DataTable.Td>
                  <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
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
    </div>
  );
}
