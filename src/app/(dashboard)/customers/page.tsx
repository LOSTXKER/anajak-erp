"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { NativeSelect } from "@/components/ui/native-select";
import { formatCurrency } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import { PAYMENT_TERMS, type PaymentTermsValue } from "@/lib/payment-terms";
import { PageHeader } from "@/components/page-header";
import { Plus, Users, UserPlus, Crown, UserX, Building2, User, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function positivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <CustomersPageContent />
    </Suspense>
  );
}

function CustomersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const rawSegment = searchParams.get("status") ?? "";
  const segment = Object.hasOwn(segmentConfig, rawSegment) ? rawSegment : "";
  const page = positivePage(searchParams.get("page"));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);

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
  const [formData, setFormData] = useState({
    name: "", company: "", email: "", phone: "",
    lineId: "", address: "", notes: "",
    customerType: "INDIVIDUAL" as "INDIVIDUAL" | "CORPORATE",
    taxId: "", branchNumber: "",
    billingAddress: "", billingSubDistrict: "", billingDistrict: "",
    billingProvince: "", billingPostalCode: "",
    creditLimit: "",
    defaultPaymentTerms: "",
  });

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

  // กดหน้าถัดไปช่วง placeholder ค้าง → ผลใหม่มีหน้าน้อยกว่า — ดึงกลับหน้าสุดท้ายที่มีจริง
  // ไม่งั้นติดหน้าว่างไร้แถบถอย (pattern เดียวกับ billing)
  useEffect(() => {
    if (data && page > data.pages && data.pages >= 1) {
      replaceListState({ page: String(data.pages) });
    }
  }, [data, page, replaceListState]);

  // useMutationWithInvalidation = ได้ toast error ฟรี (เดิม fail เงียบ — SALES กรอกวงเงิน
  // โดน FORBIDDEN แล้วฟอร์มค้างเฉยๆ ไม่มีอะไรบอก · review B7 จับ)
  const createCustomer = useMutationWithInvalidation(trpc.customer.create, {
    invalidate: [utils.customer.list, utils.customer.stats],
    onSuccess: () => {
      setShowForm(false);
      setFormData({
        name: "", company: "", email: "", phone: "", lineId: "", address: "", notes: "",
        customerType: "INDIVIDUAL", taxId: "", branchNumber: "",
        billingAddress: "", billingSubDistrict: "", billingDistrict: "",
        billingProvince: "", billingPostalCode: "",
        creditLimit: "", defaultPaymentTerms: "",
      });
    },
  });

  const isCorporate = formData.customerType === "CORPORATE";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomer.mutate({
      name: formData.name,
      company: formData.company || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      lineId: formData.lineId || undefined,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
      customerType: formData.customerType,
      taxId: formData.taxId || undefined,
      branchNumber: formData.branchNumber || undefined,
      billingAddress: formData.billingAddress || undefined,
      billingSubDistrict: formData.billingSubDistrict || undefined,
      billingDistrict: formData.billingDistrict || undefined,
      billingProvince: formData.billingProvince || undefined,
      billingPostalCode: formData.billingPostalCode || undefined,
      // SALES ไม่ส่ง creditLimit เลย — ส่งไปโดน FORBIDDEN (ช่องก็ disabled แล้ว)
      creditLimit:
        canSetCredit && formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
      defaultPaymentTerms: (formData.defaultPaymentTerms || undefined) as
        | PaymentTermsValue
        | undefined,
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="ลูกค้า"
        description="จัดการข้อมูลลูกค้าและ CRM"
        action={
          canManageCustomers ? (
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4" />
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
              {/* Customer Type Toggle */}
              <div>
                <p id="customer-type-label" className="mb-1.5 block text-sm font-medium">ประเภทลูกค้า</p>
                <SegmentedControl
                  aria-labelledby="customer-type-label"
                  value={formData.customerType}
                  onChange={(v) => setFormData({ ...formData, customerType: v })}
                  options={[
                    { value: "INDIVIDUAL", label: "บุคคลธรรมดา", icon: User },
                    { value: "CORPORATE", label: "นิติบุคคล", icon: Building2 },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="customer-name" className="mb-1.5 block text-sm font-medium">ชื่อ {isCorporate ? "ผู้ติดต่อ" : ""} *</label>
                  <Input
                    id="customer-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={isCorporate ? "ชื่อผู้ติดต่อ" : "ชื่อลูกค้า"}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="customer-company" className="mb-1.5 block text-sm font-medium">
                    บริษัท {isCorporate && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    id="customer-company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="ชื่อบริษัท/แบรนด์"
                    required={isCorporate}
                  />
                </div>
                <div>
                  <label htmlFor="customer-phone" className="mb-1.5 block text-sm font-medium">โทรศัพท์</label>
                  <Input
                    id="customer-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="08x-xxx-xxxx"
                  />
                </div>
                <div>
                  <label htmlFor="customer-line" className="mb-1.5 block text-sm font-medium">LINE ID</label>
                  <Input
                    id="customer-line"
                    value={formData.lineId}
                    onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                    placeholder="@lineid"
                  />
                </div>
                <div>
                  <label htmlFor="customer-email" className="mb-1.5 block text-sm font-medium">อีเมล</label>
                  <Input
                    id="customer-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="customer-address" className="mb-1.5 block text-sm font-medium">ที่อยู่ (ทั่วไป)</label>
                  <Input
                    id="customer-address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="ที่อยู่จัดส่ง"
                  />
                </div>
              </div>

              {/* Corporate-specific fields */}
              {isCorporate && (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">ข้อมูลนิติบุคคล</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label htmlFor="customer-tax-id" className="mb-1.5 block text-sm font-medium">
                          เลขประจำตัวผู้เสียภาษี <span className="text-red-500">*</span>
                        </label>
                        <Input
                          id="customer-tax-id"
                          value={formData.taxId}
                          onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                          placeholder="เลข 13 หลัก"
                          required={isCorporate}
                        />
                      </div>
                      <div>
                        <label htmlFor="customer-branch" className="mb-1.5 block text-sm font-medium">สาขา</label>
                        <Input
                          id="customer-branch"
                          value={formData.branchNumber}
                          onChange={(e) => setFormData({ ...formData, branchNumber: e.target.value })}
                          placeholder="00000 = สำนักงานใหญ่"
                        />
                      </div>
                      <div>
                        <label htmlFor="customer-credit-limit" className="mb-1.5 block text-sm font-medium">วงเงินเครดิต (บาท)</label>
                        <Input
                          id="customer-credit-limit"
                          type="number"
                          value={formData.creditLimit}
                          onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                          placeholder="เช่น 50000"
                          disabled={!canSetCredit}
                        />
                        {!canSetCredit && (
                          <p className="mt-1 text-xs text-slate-400">ผู้จัดการ/บัญชีเป็นคนกำหนด</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <label htmlFor="customer-payment-terms" className="mb-1.5 block text-sm font-medium">เงื่อนไขการชำระเงิน (ค่าเริ่มต้น)</label>
                      <Select
                        value={formData.defaultPaymentTerms}
                        onValueChange={(v) => setFormData({ ...formData, defaultPaymentTerms: v })}
                      >
                        <SelectTrigger id="customer-payment-terms" className="w-full md:w-64">
                          <SelectValue placeholder="เลือกเงื่อนไข" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TERMS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">ที่อยู่ออกใบกำกับภาษี</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label htmlFor="customer-billing-address" className="mb-1.5 block text-sm font-medium">ที่อยู่</label>
                        <Input
                          id="customer-billing-address"
                          value={formData.billingAddress}
                          onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                          placeholder="เลขที่ ถนน"
                        />
                      </div>
                      <div>
                        <label htmlFor="customer-billing-subdistrict" className="mb-1.5 block text-sm font-medium">แขวง/ตำบล</label>
                        <Input
                          id="customer-billing-subdistrict"
                          value={formData.billingSubDistrict}
                          onChange={(e) => setFormData({ ...formData, billingSubDistrict: e.target.value })}
                        />
                      </div>
                      <div>
                        <label htmlFor="customer-billing-district" className="mb-1.5 block text-sm font-medium">เขต/อำเภอ</label>
                        <Input
                          id="customer-billing-district"
                          value={formData.billingDistrict}
                          onChange={(e) => setFormData({ ...formData, billingDistrict: e.target.value })}
                        />
                      </div>
                      <div>
                        <label htmlFor="customer-billing-province" className="mb-1.5 block text-sm font-medium">จังหวัด</label>
                        <Input
                          id="customer-billing-province"
                          value={formData.billingProvince}
                          onChange={(e) => setFormData({ ...formData, billingProvince: e.target.value })}
                        />
                      </div>
                      <div>
                        <label htmlFor="customer-billing-postal-code" className="mb-1.5 block text-sm font-medium">รหัสไปรษณีย์</label>
                        <Input
                          id="customer-billing-postal-code"
                          value={formData.billingPostalCode}
                          onChange={(e) => setFormData({ ...formData, billingPostalCode: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="customer-notes" className="mb-1.5 block text-sm font-medium">หมายเหตุ</label>
                <Textarea
                  id="customer-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="หมายเหตุเพิ่มเติม..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>ยกเลิก</Button>
                <Button type="submit" disabled={createCustomer.isPending}>
                  {createCustomer.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
          </form>
        </Section>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <SearchInput
          ref={searchInputRef}
          containerClassName="flex-1"
          placeholder="ค้นหาชื่อ, บริษัท, โทร, อีเมล..."
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
        <NativeSelect
          aria-label="กรองกลุ่มลูกค้า"
          value={segment}
          onChange={(event) =>
            replaceListState({ status: event.target.value || null, page: null })
          }
          className="sm:w-44"
        >
          {SEGMENT_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>

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
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
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
          <div role="list" aria-label="รายชื่อลูกค้า" className="space-y-3">
            {customers.map((customer) => {
              const seg = segmentConfig[customer.segment] ?? {
                label: customer.segment,
                variant: "default" as const,
              };
              return (
                <article key={customer.id} role="listitem" className="card-surface rounded-2xl">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="block min-h-11 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={`เปิดข้อมูลลูกค้า ${customer.name}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {customer.company || customer.name}
                        </p>
                        {customer.company && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            ผู้ติดต่อ {customer.name}
                          </p>
                        )}
                      </div>
                      <ChevronRight aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={seg.variant}>{seg.label}</Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        {customer.customerType === "CORPORATE" && (
                          <Building2 aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {customer.customerType === "CORPORATE" ? "นิติบุคคล" : "บุคคล"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-slate-500 dark:text-slate-400">ติดต่อ</p>
                        <p className="mt-0.5 truncate text-slate-800 dark:text-slate-200">
                          {customer.phone || customer.email || "ยังไม่มีข้อมูล"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 dark:text-slate-400">
                          {customer._count.orders} ออเดอร์
                        </p>
                        {canSeeMoney && (
                          <p className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-white">
                            {formatCurrency(customer.totalSpent ?? 0)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
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
                  <Plus className="h-4 w-4" />
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
