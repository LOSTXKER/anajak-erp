"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Truck, Star } from "lucide-react";

const outsourceStatusConfig: Record<string, { label: string; variant: "secondary" | "default" | "success" | "warning" | "destructive" }> = {
  DRAFT: { label: "ร่าง", variant: "secondary" },
  SENT: { label: "ส่งแล้ว", variant: "default" },
  IN_PROGRESS: { label: "กำลังทำ", variant: "default" },
  COMPLETED: { label: "เสร็จ", variant: "success" },
  RECEIVED_BACK: { label: "รับกลับ", variant: "success" },
  QC_PASSED: { label: "QC ผ่าน", variant: "success" },
  QC_FAILED: { label: "QC ไม่ผ่าน", variant: "destructive" },
};

export default function OutsourcePage() {
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorCapabilities, setVendorCapabilities] = useState("");

  const utils = trpc.useUtils();
  const { data: vendors, isLoading: loadingVendors } = trpc.outsource.listVendors.useQuery({});
  const { data: orders, isLoading: loadingOrders } = trpc.outsource.listOrders.useQuery({});

  const createVendor = trpc.outsource.createVendor.useMutation({
    onSuccess: () => {
      utils.outsource.listVendors.invalidate();
      setShowVendorForm(false);
      setVendorName("");
      setVendorPhone("");
      setVendorCapabilities("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Outsource</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">จัดการ vendor และงาน outsource</p>
        </div>
        <Button onClick={() => setShowVendorForm(!showVendorForm)}>
          <Plus className="h-4 w-4" />
          เพิ่ม Vendor
        </Button>
      </div>

      {showVendorForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">เพิ่ม Vendor ใหม่</CardTitle></CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createVendor.mutate({
                  name: vendorName,
                  phone: vendorPhone || undefined,
                  capabilities: vendorCapabilities ? vendorCapabilities.split(",").map((s) => s.trim()) : [],
                });
              }}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">ชื่อ Vendor *</label>
                <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} required placeholder="ชื่อร้าน/โรงงาน" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">โทรศัพท์</label>
                <Input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">ความสามารถ (คั่นด้วย ,)</label>
                <Input value={vendorCapabilities} onChange={(e) => setVendorCapabilities(e.target.value)} placeholder="ปัก, พิมพ์, เย็บ" />
              </div>
              <Button type="submit" disabled={createVendor.isPending}>บันทึก</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Vendors */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" /> Vendors ({vendors?.length ?? 0})</CardTitle></CardHeader>
          <CardContent>
            {loadingVendors ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : vendors?.length === 0 ? (
              <p className="text-sm text-slate-400">ยังไม่มี vendor</p>
            ) : (
              <div className="space-y-2">
                {vendors?.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{v.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {v.capabilities.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {v.qualityRating && (
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <Star className="h-3 w-3 fill-current" />
                          {v.qualityRating.toFixed(1)}
                        </span>
                      )}
                      <Badge variant="secondary">{v._count.outsourceOrders} งาน</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outsource Orders */}
        <Card>
          <CardHeader><CardTitle className="text-base">งาน Outsource ({orders?.length ?? 0})</CardTitle></CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : orders?.length === 0 ? (
              <p className="text-sm text-slate-400">ยังไม่มีงาน outsource</p>
            ) : (
              <div className="space-y-2">
                {orders?.map((o) => {
                  const cfg = outsourceStatusConfig[o.status] ?? outsourceStatusConfig.DRAFT;
                  return (
                    <div key={o.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{o.description}</p>
                          <p className="text-xs text-slate-400">{o.vendor.name} -- {o.quantity} ชิ้น</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm tabular-nums font-medium">{formatCurrency(o.totalCost)}</span>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>
                      </div>
                      {o.expectedBackAt && (
                        <p className="mt-1 text-xs text-slate-400">กำหนดรับกลับ: {formatDate(o.expectedBackAt)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
