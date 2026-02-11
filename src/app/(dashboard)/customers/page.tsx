"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Plus, Search, Users, UserPlus, Crown, UserX } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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
  });

  const utils = trpc.useUtils();
  const { data: statsData } = trpc.customer.stats.useQuery();
  const { data, isLoading } = trpc.customer.list.useQuery({
    search: search || undefined,
    limit: 50,
  });

  const createCustomer = trpc.customer.create.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      utils.customer.stats.invalidate();
      setShowForm(false);
      setFormData({ name: "", company: "", email: "", phone: "", lineId: "", address: "", notes: "" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomer.mutate({
      ...formData,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      lineId: formData.lineId || undefined,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
    });
  };

  const stats = [
    { title: "ลูกค้าทั้งหมด", value: statsData?.total ?? 0, icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
    { title: "ใหม่เดือนนี้", value: statsData?.newThisMonth ?? 0, icon: UserPlus, color: "text-green-600 bg-green-50 dark:bg-green-950" },
    { title: "VIP", value: statsData?.vip ?? 0, icon: Crown, color: "text-purple-600 bg-purple-50 dark:bg-purple-950" },
    { title: "ไม่เคลื่อนไหว", value: statsData?.inactive ?? 0, icon: UserX, color: "text-amber-600 bg-amber-50 dark:bg-amber-950" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ลูกค้า</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">จัดการข้อมูลลูกค้าและ CRM</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          เพิ่มลูกค้า
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{stat.title}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">ชื่อ *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ชื่อลูกค้า"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">บริษัท</label>
                  <Input
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="ชื่อบริษัท/แบรนด์"
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
                  <label className="mb-1.5 block text-sm font-medium">ที่อยู่</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="ที่อยู่จัดส่ง"
                  />
                </div>
              </div>
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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="ค้นหาชื่อ, บริษัท, โทร, อีเมล..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customer List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ลูกค้า</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ติดต่อ</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">กลุ่ม</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">ออเดอร์</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">ยอดรวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(5)].map((_, j) => (
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
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">ไม่พบลูกค้า</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
