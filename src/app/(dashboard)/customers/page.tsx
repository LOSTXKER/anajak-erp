"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { formatCurrency } from "@/lib/utils";
import { ORDER_MONEY_ROLES, roleAllows } from "@/lib/roles";
import { PAYMENT_TERMS, type PaymentTermsValue } from "@/lib/payment-terms";
import { PageHeader } from "@/components/page-header";
import { Plus, Users, UserPlus, Crown, UserX, Building2, User } from "lucide-react";
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

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  // debounce 300ms — pattern เดียวกับหน้า WHT/คลังฟิล์ม (เดิมยิง query ทุกตัวอักษร)
  // เปลี่ยนคำค้นแล้วกลับหน้า 1 เสมอ — ค้างหน้าลึกจะเจอหน้าว่างทั้งที่มีผลลัพธ์
  // guard ค่าตรงกัน: กัน timer ตอน mount ยิง setPage(1) ทับปุ่มหน้าถัดไปใน 300ms แรก
  // (class เดียวกับที่แก้บน billing — review QW จับ)
  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);
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
  // วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES ตั้งเองไม่ได้ (ตรง server guard ฝั่ง create)
  const canSetCredit = !me || me.role !== "SALES";
  // Policy ⑦: ฝ่ายผลิต/กราฟิกไม่เห็นเงินฝั่งขาย — ซ่อนคอลัมน์ยอดรวมทั้งแถบ (server ส่ง null มาอยู่แล้ว)
  const canSeeMoney = roleAllows(me?.role, ORDER_MONEY_ROLES);
  const statsQuery = trpc.customer.stats.useQuery();
  const { data, isLoading, isError, refetch } = trpc.customer.list.useQuery(
    {
      search: debouncedSearch.trim() || undefined,
      page,
      limit: 50,
    },
    // เปลี่ยนหน้าแล้วค้างข้อมูลหน้าเดิมไว้ระหว่างโหลด — ไม่งั้นตาราง 50 แถวยุบเหลือ
    // skeleton + แถบ pagination หายใต้เคอร์เซอร์ (review B7 จับ)
    { placeholderData: (prev) => prev }
  );

  // กดหน้าถัดไปช่วง placeholder ค้าง → ผลใหม่มีหน้าน้อยกว่า — ดึงกลับหน้าสุดท้ายที่มีจริง
  // ไม่งั้นติดหน้าว่างไร้แถบถอย (pattern เดียวกับ billing)
  useEffect(() => {
    if (data && page > data.pages && data.pages >= 1) setPage(data.pages);
  }, [data, page]);

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

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ลูกค้า"
        description="จัดการข้อมูลลูกค้าและ CRM"
        action={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            เพิ่มลูกค้า
          </Button>
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

      {showForm && (
        <Section title="เพิ่มลูกค้าใหม่">
          <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Type Toggle */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">ประเภทลูกค้า</label>
                <SegmentedControl
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
                  <label className="mb-1.5 block text-sm font-medium">ชื่อ {isCorporate ? "ผู้ติดต่อ" : ""} *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={isCorporate ? "ชื่อผู้ติดต่อ" : "ชื่อลูกค้า"}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    บริษัท {isCorporate && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="ชื่อบริษัท/แบรนด์"
                    required={isCorporate}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">โทรศัพท์</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="08x-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">LINE ID</label>
                  <Input
                    value={formData.lineId}
                    onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                    placeholder="@lineid"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">อีเมล</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">ที่อยู่ (ทั่วไป)</label>
                  <Input
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
                        <label className="mb-1.5 block text-sm font-medium">
                          เลขประจำตัวผู้เสียภาษี <span className="text-red-500">*</span>
                        </label>
                        <Input
                          value={formData.taxId}
                          onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                          placeholder="เลข 13 หลัก"
                          required={isCorporate}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">สาขา</label>
                        <Input
                          value={formData.branchNumber}
                          onChange={(e) => setFormData({ ...formData, branchNumber: e.target.value })}
                          placeholder="00000 = สำนักงานใหญ่"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">วงเงินเครดิต (บาท)</label>
                        <Input
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
                      <label className="mb-1.5 block text-sm font-medium">เงื่อนไขการชำระเงิน (ค่าเริ่มต้น)</label>
                      <Select
                        value={formData.defaultPaymentTerms}
                        onValueChange={(v) => setFormData({ ...formData, defaultPaymentTerms: v })}
                      >
                        <SelectTrigger className="w-full md:w-64">
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
                        <label className="mb-1.5 block text-sm font-medium">ที่อยู่</label>
                        <Input
                          value={formData.billingAddress}
                          onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                          placeholder="เลขที่ ถนน"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">แขวง/ตำบล</label>
                        <Input
                          value={formData.billingSubDistrict}
                          onChange={(e) => setFormData({ ...formData, billingSubDistrict: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">เขต/อำเภอ</label>
                        <Input
                          value={formData.billingDistrict}
                          onChange={(e) => setFormData({ ...formData, billingDistrict: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">จังหวัด</label>
                        <Input
                          value={formData.billingProvince}
                          onChange={(e) => setFormData({ ...formData, billingProvince: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">รหัสไปรษณีย์</label>
                        <Input
                          value={formData.billingPostalCode}
                          onChange={(e) => setFormData({ ...formData, billingPostalCode: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">หมายเหตุ</label>
                <Textarea
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

      <SearchInput
        placeholder="ค้นหาชื่อ, บริษัท, โทร, อีเมล..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

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
          {isLoading &&
            [...Array(5)].map((_, i) => (
              <tr key={i}>
                {[...Array(canSeeMoney ? 6 : 5)].map((_, j) => (
                  <DataTable.Td key={j}>
                    <Skeleton className="h-4 w-20" />
                  </DataTable.Td>
                ))}
              </tr>
            ))}
          {data?.customers?.map((customer) => {
            const seg =
              segmentConfig[customer.segment] ??
              ({ label: customer.segment, variant: "default" } as const);
            return (
              <DataTable.Row key={customer.id}>
                <DataTable.Td>
                  <Link
                    href={`/customers/${customer.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
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
                    <span className="text-xs text-slate-400">บุคคล</span>
                  )}
                </DataTable.Td>
                <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                  {customer.phone || customer.email || "—"}
                </DataTable.Td>
                <DataTable.Td>
                  <Badge variant={seg.variant}>{seg.label}</Badge>
                </DataTable.Td>
                <DataTable.Td
                  align="right"
                  className="tabular-nums text-slate-900 dark:text-white"
                >
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
          {!isLoading && data?.customers?.length === 0 && (
            <tr>
              <td colSpan={canSeeMoney ? 6 : 5}>
                <EmptyState
                  icon={Users}
                  title="ไม่พบลูกค้า"
                  description="เพิ่มลูกค้าใหม่เพื่อเริ่มต้นการจัดการ CRM"
                  action={
                    <Button size="sm" onClick={() => setShowForm(true)}>
                      <Plus className="h-4 w-4" />
                      เพิ่มลูกค้า
                    </Button>
                  }
                />
              </td>
            </tr>
          )}
        </DataTable.Body>
      </DataTable.Root>
      {/* เกิน 50 รายต้องเปิดหน้าถัดไปได้ (Gate B7 — เดิมตรึง 50 มองไม่เห็นที่เหลือ) */}
      <TablePagination
        page={page}
        totalPages={data?.pages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        label="ราย"
      />
    </div>
  );
}
