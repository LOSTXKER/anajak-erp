"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Truck, Star } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";

type StatusVariant = "default" | "accent" | "success" | "warning" | "destructive";

const outsourceStatusConfig: Record<string, { label: string; variant: StatusVariant }> = {
  DRAFT: { label: "ร่าง", variant: "default" },
  SENT: { label: "ส่งแล้ว", variant: "accent" },
  IN_PROGRESS: { label: "กำลังทำ", variant: "accent" },
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
  const { data: vendors, isLoading: loadingVendors } =
    trpc.outsource.listVendors.useQuery({});
  const { data: orders, isLoading: loadingOrders } =
    trpc.outsource.listOrders.useQuery({});

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
    <div className="space-y-5">
      <PageHeader
        title="Outsource"
        description="จัดการ vendor และงาน outsource"
        action={
          <Button size="sm" onClick={() => setShowVendorForm(!showVendorForm)}>
            <Plus className="h-4 w-4" />
            เพิ่ม Vendor
          </Button>
        }
      />

      {showVendorForm && (
        <Section title="เพิ่ม Vendor ใหม่">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createVendor.mutate({
                name: vendorName,
                phone: vendorPhone || undefined,
                capabilities: vendorCapabilities
                  ? vendorCapabilities.split(",").map((s) => s.trim())
                  : [],
              });
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                ชื่อ Vendor *
              </label>
              <Input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                required
                placeholder="ชื่อร้าน/โรงงาน"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                โทรศัพท์
              </label>
              <Input
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                ความสามารถ (คั่นด้วย ,)
              </label>
              <Input
                value={vendorCapabilities}
                onChange={(e) => setVendorCapabilities(e.target.value)}
                placeholder="ปัก, พิมพ์, เย็บ"
              />
            </div>
            <Button type="submit" disabled={createVendor.isPending}>
              บันทึก
            </Button>
          </form>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title={`Vendors (${vendors?.length ?? 0})`} bordered>
          {loadingVendors ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : !vendors || vendors.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="ยังไม่มี vendor"
              description="เพิ่ม vendor แรกของคุณเพื่อเริ่มต้น"
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {vendors.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {v.name}
                    </p>
                    {v.capabilities.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {v.capabilities.map((c) => (
                          <Badge key={c} variant="default" size="sm">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    {v.qualityRating && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star className="h-3 w-3 fill-current" />
                        {v.qualityRating.toFixed(1)}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {v._count.outsourceOrders} งาน
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`งาน Outsource (${orders?.length ?? 0})`} bordered>
          {loadingOrders ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <EmptyState icon={Truck} title="ยังไม่มีงาน outsource" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map((o) => {
                const cfg =
                  outsourceStatusConfig[o.status] ?? outsourceStatusConfig.DRAFT;
                return (
                  <li key={o.id} className="space-y-1 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {o.description}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {o.vendor.name} · {o.quantity} ชิ้น
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-medium tabular-nums">
                          {formatCurrency(o.totalCost)}
                        </span>
                        <Badge variant={cfg.variant} size="sm">
                          {cfg.label}
                        </Badge>
                      </div>
                    </div>
                    {o.expectedBackAt && (
                      <p className="text-xs text-slate-400">
                        กำหนดรับกลับ: {formatDate(o.expectedBackAt)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
