"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { FINANCE_ROLES } from "@/lib/roles";
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-labels";
import {
  DollarSign,
  AlertCircle,
  TrendingUp,
  CreditCard,
  FileText,
} from "lucide-react";

const paymentStatusConfig: Record<
  string,
  { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" }
> = {
  UNPAID: { label: "ยังไม่จ่าย", variant: "warning" },
  PARTIALLY_PAID: { label: "จ่ายบางส่วน", variant: "accent" },
  PAID: { label: "จ่ายแล้ว", variant: "success" },
  OVERDUE: { label: "เกินกำหนด", variant: "destructive" },
  VOIDED: { label: "ยกเลิก", variant: "default" },
};

// ตัวเลือกกรองชนิดใบ — เรียงตาม flow เงิน (QUOTATION ไม่ออกเป็น invoice แล้ว ไม่ใส่ตัวกรอง
// แต่แถว legacy ยังโชว์ป้ายถูกผ่าน INVOICE_TYPE_LABELS ตอนเลือก "ทั้งหมด")
const TYPE_FILTER_OPTIONS = [
  "DEPOSIT_INVOICE",
  "FINAL_INVOICE",
  "RECEIPT",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
] as const;

// Radix Select ห้าม value ว่าง — ใช้ sentinel แล้วแปลงเป็น undefined ตอนยิง query
const ALL = "ALL";

export default function BillingPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [page, setPage] = useState(1);

  // debounce 300ms — pattern เดียวกับหน้าลูกค้า/WHT (เดิมยิง query ทุกตัวอักษร)
  // เปลี่ยนคำค้นแล้วกลับหน้า 1 เสมอ — ค้างหน้าลึกจะเจอหน้าว่างทั้งที่มีผลลัพธ์
  // guard ค่าเท่ากัน = ไม่ตั้ง timer ตอน mount (timer ตอน mount เคยยิง setPage(1)
  // ทับปุ่มหน้าถัดไปที่ผู้ใช้เพิ่งกดในช่วง 300ms แรกได้ — review จับ)
  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const { data: me } = trpc.user.me.useQuery();
  // หน้าการเงินทั้งหน้าเป็นของฝั่งบริหาร-บัญชี (ตรงกับ requireRole ฝั่ง server)
  const canView = me ? FINANCE_ROLES.includes(me.role) : true;
  const stats = trpc.billing.stats.useQuery(undefined, {
    enabled: canView,
  });
  const { data, isLoading, isError, refetch } = trpc.billing.list.useQuery(
    {
      search: debouncedSearch.trim() || undefined,
      status: statusFilter === ALL ? undefined : statusFilter,
      type: typeFilter === ALL ? undefined : typeFilter,
      page,
      limit: 50,
    },
    // เปลี่ยนหน้า/ตัวกรองแล้วค้างข้อมูลเดิมไว้ระหว่างโหลด — ไม่งั้นตารางยุบเหลือ
    // skeleton + แถบ pagination หายใต้เคอร์เซอร์ (pattern B7)
    { enabled: canView, placeholderData: (prev) => prev }
  );

  // clamp หน้าเกินช่วง — กดหน้าถัดไปช่วง placeholder ค้างเลขหน้าชุดกรองเก่า แล้วชุดใหม่
  // มีหน้าน้อยกว่า จะค้างบนหน้าว่างที่ไม่มีแถบ pagination ให้ถอยกลับ (review จับ)
  useEffect(() => {
    if (data && page > data.pages && data.pages >= 1) setPage(data.pages);
  }, [data, page]);

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="บิล/การเงิน"
          description="ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ"
        />
        <p className="text-sm text-slate-400">
          หน้านี้เปิดเฉพาะเจ้าของ ผู้จัดการ และบัญชี
        </p>
      </div>
    );
  }

  // && !data: พังเฉพาะโหลดแรก — refetch เบื้องหลังล้มทั้งที่มี cache ไม่ต้องถอนตารางทิ้ง
  if (isError && !data) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="บิล/การเงิน"
        description="ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ"
      />

      {/* stats พังต้องบอก — เลขเงินโชว์ ฿0 เงียบๆ อ่านเป็น "ไม่มียอดค้าง" ได้ (ขัด DESIGN.md) */}
      {stats.isError ? (
        <QueryError
          message="โหลดสถิติการเงินไม่สำเร็จ"
          onRetry={() => stats.refetch()}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="ค้างชำระ"
            value={formatCurrency(stats.data?.totalUnpaid ?? 0)}
            icon={DollarSign}
          />
          <StatCard
            title="เกินกำหนด"
            value={stats.data?.overdueCount ?? 0}
            icon={AlertCircle}
            caption="บิล"
          />
          <StatCard
            title="รายได้เดือนนี้"
            value={formatCurrency(stats.data?.revenueThisMonth ?? 0)}
            icon={TrendingUp}
          />
          <StatCard
            title="รับชำระเดือนนี้"
            value={formatCurrency(stats.data?.paidThisMonth ?? 0)}
            icon={CreditCard}
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <SearchInput
            placeholder="ค้นหาเลขบิล, ชื่อลูกค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="กรองตามสถานะ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกสถานะ</SelectItem>
            {Object.entries(paymentStatusConfig).map(([value, cfg]) => (
              <SelectItem key={value} value={value}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="กรองตามประเภท">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกประเภท</SelectItem>
            {TYPE_FILTER_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {INVOICE_TYPE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable.Root>
        <DataTable.Head>
          <tr>
            <DataTable.Th>เลขบิล</DataTable.Th>
            <DataTable.Th>ประเภท</DataTable.Th>
            <DataTable.Th>ลูกค้า</DataTable.Th>
            <DataTable.Th>ออเดอร์</DataTable.Th>
            <DataTable.Th align="right">จำนวนเงิน</DataTable.Th>
            <DataTable.Th>สถานะ</DataTable.Th>
            <DataTable.Th>ครบกำหนด</DataTable.Th>
          </tr>
        </DataTable.Head>
        <DataTable.Body>
          {isLoading &&
            [...Array(5)].map((_, i) => (
              <tr key={i}>
                {[...Array(7)].map((_, j) => (
                  <DataTable.Td key={j}>
                    <Skeleton className="h-4 w-20" />
                  </DataTable.Td>
                ))}
              </tr>
            ))}
          {data?.invoices?.map((inv) => {
            const statusCfg =
              paymentStatusConfig[inv.paymentStatus] ?? paymentStatusConfig.UNPAID;
            return (
              <DataTable.Row key={inv.id}>
                <DataTable.Td className="font-medium text-slate-900 dark:text-white">
                  {inv.invoiceNumber}
                </DataTable.Td>
                <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                  {INVOICE_TYPE_LABELS[inv.type] ?? inv.type}
                </DataTable.Td>
                <DataTable.Td>{inv.customer.name}</DataTable.Td>
                <DataTable.Td className="text-blue-600 dark:text-blue-400">
                  {inv.order.orderNumber}
                </DataTable.Td>
                <DataTable.Td
                  align="right"
                  className="font-medium tabular-nums text-slate-900 dark:text-white"
                >
                  {formatCurrency(inv.totalAmount)}
                </DataTable.Td>
                <DataTable.Td>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </DataTable.Td>
                <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                  {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                </DataTable.Td>
              </DataTable.Row>
            );
          })}
          {!isLoading && data?.invoices?.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  icon={FileText}
                  title={
                    debouncedSearch || statusFilter !== ALL || typeFilter !== ALL
                      ? "ไม่พบบิลตามเงื่อนไข"
                      : "ยังไม่มีบิล"
                  }
                  description={
                    debouncedSearch || statusFilter !== ALL || typeFilter !== ALL
                      ? "ลองปรับคำค้นหรือตัวกรอง"
                      : "สร้างบิลได้จากหน้าออเดอร์ — การ์ด บิล/การชำระเงิน"
                  }
                />
              </td>
            </tr>
          )}
        </DataTable.Body>
      </DataTable.Root>
      {/* เกิน 50 ใบต้องเปิดหน้าถัดไปได้ (pattern B7 — เดิมตรึง 50 มองไม่เห็นที่เหลือ) */}
      <TablePagination
        page={page}
        totalPages={data?.pages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        label="ใบ"
      />
    </div>
  );
}
