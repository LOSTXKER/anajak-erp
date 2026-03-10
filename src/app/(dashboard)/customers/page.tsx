"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Plus, Users, UserPlus, Crown, UserX, Building2, User } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const segmentConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" | "purple" }> = {
  VIP: { label: "VIP", variant: "success" },
  REGULAR: { label: "ขาประจำ", variant: "default" },
  NEW: { label: "ใหม่", variant: "purple" },
  INACTIVE: { label: "ไม่เคลื่อนไหว", variant: "warning" },
  WHOLESALE: { label: "ค้าส่ง", variant: "secondary" },
  RETAIL: { label: "ค้าปลีก", variant: "secondary" },
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
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
  const { data: statsData } = trpc.customer.stats.useQuery();
  const { data, isLoading, isError, refetch } = trpc.customer.list.useQuery({
    search: search || undefined,
    limit: 50,
  });

  const createCustomer = trpc.customer.create.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      utils.customer.stats.invalidate();
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
      creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
      defaultPaymentTerms: formData.defaultPaymentTerms || undefined,
    });
  };

  const stats = [
    { title: "ลูกค้าทั้งหมด", value: statsData?.total ?? 0, icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
    { title: "ใหม่เดือนนี้", value: statsData?.newThisMonth ?? 0, icon: UserPlus, color: "text-green-600 bg-green-50 dark:bg-green-950" },
    { title: "VIP", value: statsData?.vip ?? 0, icon: Crown, color: "text-purple-600 bg-purple-50 dark:bg-purple-950" },
    { title: "ไม่เคลื่อนไหว", value: statsData?.inactive ?? 0, icon: UserX, color: "text-amber-600 bg-amber-50 dark:bg-amber-950" },
  ];

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ลูกค้า"
        description="จัดการข้อมูลลูกค้าและ CRM"
        action={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            เพิ่มลูกค้า
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} color={stat.color} />
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">เพิ่มลูกค้าใหม่</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Type Toggle */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">ประเภทลูกค้า</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, customerType: "INDIVIDUAL" })}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      !isCorporate
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <User className="h-4 w-4" /> บุคคลธรรมดา
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, customerType: "CORPORATE" })}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      isCorporate
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Building2 className="h-4 w-4" /> นิติบุคคล
                  </button>
                </div>
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
                        />
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
                          <SelectItem value="COD">เก็บเงินปลายทาง (COD)</SelectItem>
                          <SelectItem value="FULL_PREPAY">ชำระเต็มล่วงหน้า</SelectItem>
                          <SelectItem value="DEPOSIT_50">มัดจำ 50%</SelectItem>
                          <SelectItem value="NET_15">เครดิต 15 วัน</SelectItem>
                          <SelectItem value="NET_30">เครดิต 30 วัน</SelectItem>
                          <SelectItem value="NET_60">เครดิต 60 วัน</SelectItem>
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
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <SearchInput placeholder="ค้นหาชื่อ, บริษัท, โทร, อีเมล..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Customer List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ลูกค้า</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ประเภท</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ติดต่อ</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">กลุ่ม</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">ออเดอร์</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">ยอดรวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                ))}</tr>
              ))}
              {data?.customers?.map((customer) => {
                const seg = segmentConfig[customer.segment] ?? { label: customer.segment, variant: "secondary" as const };
                return (
                  <tr key={customer.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${customer.id}`} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                        {customer.name}
                      </Link>
                      {customer.company && <p className="text-xs text-slate-400">{customer.company}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {customer.customerType === "CORPORATE" ? (
                        <Badge variant="default" className="gap-1 text-xs">
                          <Building2 className="h-3 w-3" /> นิติบุคคล
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">บุคคล</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {customer.phone || customer.email || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={seg.variant}>{seg.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-900 dark:text-white">
                      {customer._count.orders}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-slate-900 dark:text-white">
                      {formatCurrency(customer.totalSpent)}
                    </td>
                  </tr>
                );
              })}
              {data?.customers?.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">ไม่พบลูกค้า</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
