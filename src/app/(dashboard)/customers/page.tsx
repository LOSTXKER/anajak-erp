"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ListCards, ListCardItem, ListCardMetaGrid, ListCardMeta } from "@/components/ui/list-card";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import { CustomerFormFields } from "@/components/customers/customer-form-fields";
import {
  buildCustomerCreatePayload,
  emptyCustomerForm,
  validateCustomerEditForm,
  type CustomerEditForm,
} from "@/lib/customer-form";
import { PageHeader } from "@/components/page-header";
import { Plus, Users, UserPlus, Crown, UserX, Building2, ChevronRight } from "lucide-react";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

const segmentConfig: Record<string, { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" }> = {
  VIP: { label: "VIP", variant: "success" },
  REGULAR: { label: "ขาประจำ", variant: "accent" },
  NEW: { label: "ใหม่", variant: "accent" },
  INACTIVE: { label: "ไม่เคลื่อนไหว", variant: "warning" },
  WHOLESALE: { label: "ค้าส่ง", variant: "default" },
  RETAIL: { label: "ค้าปลีก", variant: "default" },
};

const SEGMENT_FILTERS = [
  { value: "", label: "ทุกกลุ่มลูกค้า" },
  ...Object.entries(segmentConfig).map(([value, config]) => ({
    value,
    label: config.label,
  })),
];

export default function CustomersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <CustomersPageContent />
    </Suspense>
  );
}

function CustomersPageContent() {
  const { search, page, searchParams, replaceListState, onSearchChange, searchInputRef } =
    useListPageState();
  const rawSegment = searchParams.get("status") ?? "";
  const segment = Object.hasOwn(segmentConfig, rawSegment) ? rawSegment : "";
  const [showForm, setShowForm] = useState(false);
  // ฟอร์มเพิ่มลูกค้าใช้ field ชุดเดียวกับฟอร์มแก้ไข (CustomerFormFields + CustomerEditForm)
  // — เดิมเขียนช่องซ้ำเองแล้ว drift: เลขภาษี/วงเงินไม่ถูก validate ตอนสร้าง
  const [form, setForm] = useState(emptyCustomerForm);
  // ฟอร์มใหม่เริ่มจากว่างทุกช่อง — โชว์ error หลังกดบันทึกครั้งแรกเท่านั้น
  // (ต่างจากฟอร์มแก้ไขที่ข้อมูลตั้งต้นถูกอยู่แล้ว โชว์สดได้)
  const [showErrors, setShowErrors] = useState(false);

  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const canManageCustomers = permAllows(me?.permissions, "manage_customers");
  // วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES ตั้งเองไม่ได้ (ตรง server guard ฝั่ง create)
  const canSetCredit = !me || me.role !== "SALES";
  // Policy ⑦: ฝ่ายผลิต/กราฟิกไม่เห็นเงินฝั่งขาย — ซ่อนคอลัมน์ยอดรวมทั้งแถบ (server ส่ง null มาอยู่แล้ว)
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const statsQuery = trpc.customer.stats.useQuery();
  const { data, isLoading, isFetching, isError, refetch } = trpc.customer.list.useQuery(
    {
      search: search.trim() || undefined,
      segment: segment || undefined,
      page,
      limit: 50,
    },
    // เปลี่ยนหน้าแล้วค้างข้อมูลหน้าเดิมไว้ระหว่างโหลด — ไม่งั้นตาราง 50 แถวยุบเหลือ
    // skeleton + แถบ pagination หายใต้เคอร์เซอร์ (review B7 จับ)
    { placeholderData: (prev) => prev }
  );
  // Router จงใจคืน null แทนตัวเลขเงินสำหรับ role หน้างาน — widen type ให้การ์ด/ตาราง
  // ใช้รายการเดียวกันได้โดยไม่ตีความ null เป็นศูนย์
  const customerItems = data?.customers.map((customer) => ({
    ...customer,
    totalSpent: customer.totalSpent as number | null,
    creditLimit: customer.creditLimit as number | null,
  }));

  usePageClamp(page, data?.pages, replaceListState);

  // เดิม fail เงียบ — SALES กรอกวงเงินโดน FORBIDDEN แล้วฟอร์มค้างเฉยๆ ไม่มีอะไรบอก
  // (review B7 จับ) · ตอนนี้ server error แสดงใน Alert ในฟอร์มที่เดียว (มาตรฐานเดียวกับ
  // ฟอร์มแก้ไข) — onError noop กัน hook ยิง toast ซ้ำเป็นสองทาง
  const createCustomer = useMutationWithInvalidation(trpc.customer.create, {
    invalidate: [utils.customer.list, utils.customer.stats],
    onSuccess: () => {
      setShowForm(false);
      setForm(emptyCustomerForm());
      setShowErrors(false);
    },
    onError: () => {},
  });

  // validate ชุดเดียวกับฟอร์มแก้ไข — เลขภาษีนิติบุคคล/วงเงินถูกตรวจตอนสร้างด้วย
  const validationErrors = validateCustomerEditForm(form);
  const setFormPatch = (patch: Partial<CustomerEditForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(validationErrors).length > 0) {
      setShowErrors(true);
      return;
    }
    // SALES ไม่ส่ง creditLimit เลย — ส่งไปโดน FORBIDDEN (ช่องก็ disabled แล้ว)
    createCustomer.mutate(buildCustomerCreatePayload(form, canSetCredit));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ลูกค้า"
        action={
          canManageCustomers ? (
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus />
              เพิ่มลูกค้า
            </Button>
          ) : undefined
        }
      />

      {/* stats พังต้องบอก — เลขโชว์ 0 เงียบๆ อ่านเป็น "ไม่มีลูกค้า" ได้ (ขัด DESIGN.md) */}
      {statsQuery.isError ? (
        <QueryError message="โหลดสถิติไม่สำเร็จ" onRetry={() => statsQuery.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="ลูกค้าทั้งหมด" value={statsQuery.data?.total ?? 0} icon={Users} />
          <StatCard title="ใหม่เดือนนี้" value={statsQuery.data?.newThisMonth ?? 0} icon={UserPlus} />
          <StatCard title="VIP" value={statsQuery.data?.vip ?? 0} icon={Crown} />
          <StatCard title="ไม่เคลื่อนไหว" value={statsQuery.data?.inactive ?? 0} icon={UserX} />
        </div>
      )}

      {showForm && canManageCustomers && (
        <Section title="เพิ่มลูกค้าใหม่">
          <form onSubmit={handleSubmit} className="space-y-4">
              <CustomerFormFields
                form={form}
                set={setFormPatch}
                errors={showErrors ? validationErrors : {}}
                canEditCredit={canSetCredit}
                mode="create"
              />
              {createCustomer.error && (
                <Alert variant="error">
                  บันทึกไม่สำเร็จ: {createCustomer.error.message}
                </Alert>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>ยกเลิก</Button>
                <Button type="submit" disabled={createCustomer.isPending}>
                  {createCustomer.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
          </form>
        </Section>
      )}

      <Toolbar>
        <SearchInput
          ref={searchInputRef}
          containerClassName="@2xl:max-w-sm @2xl:flex-1"
          placeholder="ค้นหาชื่อ, บริษัท, โทร, อีเมล..."
          defaultValue={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <ToolbarGroup>
          <Select
            shape="pill"
            aria-label="กรองกลุ่มลูกค้า"
            value={segment}
            onChange={(event) =>
              replaceListState({ status: event.target.value || null, page: null })
            }
            className="@2xl:w-44"
          >
            {SEGMENT_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </ToolbarGroup>
      </Toolbar>

      <ResponsiveList
        items={customerItems}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายชื่อลูกค้าไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ลูกค้า"
        renderDesktop={(customers) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>ลูกค้า</DataTable.Th>
                <DataTable.Th>ประเภท</DataTable.Th>
                <DataTable.Th>ติดต่อ</DataTable.Th>
                <DataTable.Th>กลุ่ม</DataTable.Th>
                <DataTable.Th align="right">ออเดอร์</DataTable.Th>
                {canSeeMoney && <DataTable.Th align="right">ยอดรวม</DataTable.Th>}
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {customers.map((customer) => {
                const seg = segmentConfig[customer.segment] ?? {
                  label: customer.segment,
                  variant: "default" as const,
                };
                return (
                  <DataTable.Row key={customer.id}>
                    <DataTable.Td>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {customer.name}
                      </Link>
                      {customer.company && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {customer.company}
                        </p>
                      )}
                    </DataTable.Td>
                    <DataTable.Td>
                      {customer.customerType === "CORPORATE" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <Building2 className="h-3 w-3" /> นิติบุคคล
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">บุคคล</span>
                      )}
                    </DataTable.Td>
                    <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                      {customer.phone || customer.email || "—"}
                    </DataTable.Td>
                    <DataTable.Td>
                      <Badge variant={seg.variant}>{seg.label}</Badge>
                    </DataTable.Td>
                    <DataTable.Td align="right" className="tabular-nums text-slate-900 dark:text-white">
                      {customer._count.orders}
                    </DataTable.Td>
                    {canSeeMoney && (
                      <DataTable.Td
                        align="right"
                        className="font-medium tabular-nums text-slate-900 dark:text-white"
                      >
                        {formatCurrency(customer.totalSpent ?? 0)}
                      </DataTable.Td>
                    )}
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(customers) => (
          <ListCards label="รายชื่อลูกค้า">
            {customers.map((customer) => {
              const seg = segmentConfig[customer.segment] ?? {
                label: customer.segment,
                variant: "default" as const,
              };
              return (
                <ListCardItem key={customer.id}>
                  <Link
                    href={`/customers/${customer.id}`}
                    className={cn("block min-h-11 rounded-2xl p-4", FOCUS_BUTTON)}
                    aria-label={`เปิดข้อมูลลูกค้า ${customer.name}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-strong">
                          {customer.company || customer.name}
                        </p>
                        {customer.company && (
                          <p className="mt-0.5 text-xs text-muted">
                            ผู้ติดต่อ {customer.name}
                          </p>
                        )}
                      </div>
                      <ChevronRight aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={seg.variant}>{seg.label}</Badge>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                        {customer.customerType === "CORPORATE" && (
                          <Building2 aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {customer.customerType === "CORPORATE" ? "นิติบุคคล" : "บุคคล"}
                      </span>
                    </div>
                    <ListCardMetaGrid>
                      <ListCardMeta label="ติดต่อ">
                        {customer.phone || customer.email || "ยังไม่มีข้อมูล"}
                      </ListCardMeta>
                      <ListCardMeta label={`${customer._count.orders} ออเดอร์`} align="right">
                        {canSeeMoney && (
                          <span className="font-semibold tabular-nums text-strong">
                            {formatCurrency(customer.totalSpent ?? 0)}
                          </span>
                        )}
                      </ListCardMeta>
                    </ListCardMetaGrid>
                  </Link>
                </ListCardItem>
              );
            })}
          </ListCards>
        )}
        emptyState={
          <EmptyState
            icon={Users}
            title="ไม่พบลูกค้า"
            description={
              search || segment
                ? "ลองเปลี่ยนคำค้นหาหรือกลุ่มลูกค้า"
                : "เพิ่มลูกค้าใหม่เพื่อเริ่มต้นการจัดการ CRM"
            }
            action={
              canManageCustomers ? (
                <Button size="sm" onClick={() => setShowForm(true)}>
                  <Plus />
                  เพิ่มลูกค้า
                </Button>
              ) : undefined
            }
          />
        }
        pagination={
          data && data.customers.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={data.pages}
              total={data.total}
              onPageChange={(nextPage) =>
                replaceListState({ page: String(nextPage) })
              }
              label="ราย"
            />
          ) : undefined
        }
      />
    </div>
  );
}
