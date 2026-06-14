"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { FilterChip } from "@/components/ui/filter-chip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Plus,
  Truck,
  Star,
  Pencil,
  Send,
  PackageCheck,
  Check,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { GoodsReceiptDialog } from "@/components/goods-receipt/goods-receipt-dialog";

type StatusVariant = "default" | "accent" | "success" | "warning" | "destructive";

const outsourceStatusConfig: Record<string, { label: string; variant: StatusVariant }> = {
  DRAFT: { label: "ร่าง", variant: "default" },
  SENT: { label: "ส่งร้านแล้ว", variant: "accent" },
  IN_PROGRESS: { label: "ร้านกำลังทำ", variant: "accent" },
  COMPLETED: { label: "ร้านทำเสร็จ", variant: "accent" },
  RECEIVED_BACK: { label: "รับกลับ รอ QC", variant: "warning" },
  QC_PASSED: { label: "QC ผ่าน", variant: "success" },
  QC_FAILED: { label: "QC ไม่ผ่าน", variant: "destructive" },
};

// กลุ่มกรองตามจังหวะงานจริง: ค้างที่ร้าน → รอ QC → จบแล้ว
const FILTERS = [
  { value: "active", label: "ค้างที่ร้าน" },
  { value: "qc", label: "รอ QC" },
  { value: "done", label: "จบแล้ว" },
  { value: "all", label: "ทั้งหมด" },
] as const;
type FilterValue = (typeof FILTERS)[number]["value"];

const ACTIVE_STATUSES = ["DRAFT", "SENT", "IN_PROGRESS", "COMPLETED"];

// เลยกำหนดเมื่อพ้น "สิ้นวัน" ของวันกำหนดรับ — ไม่ใช่ตั้งแต่เช้าวันนั้น (ร้านมีเวลาทั้งวัน)
function isOverdueBack(o: { expectedBackAt: Date | string | null; status: string }): boolean {
  if (!o.expectedBackAt || !ACTIVE_STATUSES.includes(o.status)) return false;
  const due = new Date(o.expectedBackAt);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

export default function OutsourcePage() {
  const [filter, setFilter] = useState<FilterValue>("active");
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editVendorId, setEditVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorCapabilities, setVendorCapabilities] = useState("");

  // QC fail dialog
  const [qcFailTarget, setQcFailTarget] = useState<string | null>(null);
  const [qcFailNotes, setQcFailNotes] = useState("");

  // รับกลับร้านนอก = นับของก่อน (ใบตรวจรับ OUTSOURCE_RETURN — มตินับของ 2 จุด)
  // บันทึกใบเสร็จแล้วค่อย flip สถานะเป็น RECEIVED_BACK
  const [receiveTarget, setReceiveTarget] = useState<{
    id: string;
    orderId: string;
    description: string;
    quantity: number;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  // ตัดสิน QC = อำนาจหัวหน้า (ตรง server) — staff เห็นปุ่มรับส่งของเท่านั้น
  const canJudgeQc = !!me && ["OWNER", "MANAGER"].includes(me.role);
  // รับส่งของ = ทีมผลิตขึ้นไป (ตรง productionUp ฝั่ง server) — role อื่นดูได้อย่างเดียว
  const canHandleGoods = !!me && ["OWNER", "MANAGER", "PRODUCTION_STAFF"].includes(me.role);

  const { data: vendors, isLoading: loadingVendors } =
    trpc.outsource.listVendors.useQuery({});
  const { data: orders, isLoading: loadingOrders } =
    trpc.outsource.listOrders.useQuery({});

  const invalidateAll = [utils.outsource.listOrders, utils.outsource.listVendors];

  const createVendor = useMutationWithInvalidation(trpc.outsource.createVendor, {
    invalidate: invalidateAll,
    onSuccess: () => resetVendorForm(),
    onError: (err: { message?: string }) => toast.error(err.message ?? "บันทึกร้านไม่สำเร็จ"),
  });
  const updateVendor = useMutationWithInvalidation(trpc.outsource.updateVendor, {
    invalidate: invalidateAll,
    onSuccess: () => resetVendorForm(),
    onError: (err: { message?: string }) => toast.error(err.message ?? "บันทึกร้านไม่สำเร็จ"),
  });
  const updateStatus = useMutationWithInvalidation(trpc.outsource.updateOrderStatus, {
    invalidate: [utils.outsource.listOrders, utils.production.getByOrderId],
    onSuccess: () => {
      setQcFailTarget(null);
      setQcFailNotes("");
    },
    onError: (err: { message?: string }) => toast.error(err.message ?? "อัปเดตไม่สำเร็จ"),
  });
  const cancelDraft = useMutationWithInvalidation(trpc.outsource.cancelDraftOrder, {
    invalidate: [utils.outsource.listOrders, utils.production.getByOrderId],
    onError: (err: { message?: string }) => toast.error(err.message ?? "ยกเลิกไม่สำเร็จ"),
  });

  function resetVendorForm() {
    setShowVendorForm(false);
    setEditVendorId(null);
    setVendorName("");
    setVendorPhone("");
    setVendorCapabilities("");
  }

  function openEditVendor(v: {
    id: string;
    name: string;
    phone: string | null;
    capabilities: string[];
  }) {
    setEditVendorId(v.id);
    setVendorName(v.name);
    setVendorPhone(v.phone ?? "");
    setVendorCapabilities(v.capabilities.join(", "));
    setShowVendorForm(true);
  }

  const allOrders = orders ?? [];
  const activeOrders = allOrders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const qcOrders = allOrders.filter((o) => o.status === "RECEIVED_BACK");
  const overdueCount = allOrders.filter(isOverdueBack).length;

  const visibleOrders =
    filter === "active"
      ? activeOrders
      : filter === "qc"
        ? qcOrders
        : filter === "done"
          ? allOrders.filter((o) => ["QC_PASSED", "QC_FAILED"].includes(o.status))
          : allOrders;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Outsource"
        description="งานส่งร้านนอก (DTG/สกรีน/ปัก/ตัดเย็บ/ป้ายคอ) — สร้างใบงานจากขั้นตอนในหน้าใบผลิต (เมนูการผลิต)"
        action={
          <Button
            size="sm"
            onClick={() => (showVendorForm ? resetVendorForm() : setShowVendorForm(true))}
          >
            <Plus className="h-4 w-4" />
            เพิ่มร้าน
          </Button>
        }
      />

      {/* ไม่มี stat เงิน — เลิกคิดต้นทุนต่องานในระบบ (เบสเคาะ 2026-06-12) ช่องค่าจ้างถูกถอดแล้ว
          ใบใหม่ทุกใบ totalCost = 0 ถ้าโชว์มูลค่าจะกลายเป็นตัวเลขหลอก */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="ค้างที่ร้าน" value={activeOrders.length} icon={Truck} caption="งาน" />
        <StatCard title="เลยกำหนดรับ" value={overdueCount} icon={AlertCircle} caption="งาน" />
        <StatCard title="รอ QC" value={qcOrders.length} icon={PackageCheck} caption="งาน" />
      </div>

      {showVendorForm && (
        <Section title={editVendorId ? "แก้ไขร้าน" : "เพิ่มร้านใหม่"}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const payload = {
                name: vendorName,
                phone: vendorPhone || undefined,
                capabilities: vendorCapabilities
                  ? vendorCapabilities.split(",").map((s) => s.trim()).filter(Boolean)
                  : [],
              };
              if (editVendorId) {
                updateVendor.mutate({ id: editVendorId, ...payload });
              } else {
                createVendor.mutate(payload);
              }
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                ชื่อร้าน *
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
                placeholder="สกรีน, ปัก, เย็บ"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={resetVendorForm}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={createVendor.isPending || updateVendor.isPending}>
                บันทึก
              </Button>
            </div>
          </form>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* งาน outsource — คิวหลักของหน้า */}
        <div className="lg:col-span-2">
          <Section
            title={`งานส่งร้านนอก (${visibleOrders.length})`}
            bordered
            action={
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <FilterChip
                    key={f.value}
                    selected={filter === f.value}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </FilterChip>
                ))}
              </div>
            }
          >
            {loadingOrders ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-md" />
                ))}
              </div>
            ) : visibleOrders.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="ไม่มีงานในกลุ่มนี้"
                description='ส่งงานให้ร้านนอกได้จากหน้าใบผลิต (เมนูการผลิต → เปิดงาน) — ปุ่ม "ส่งร้านนอก" ที่ขั้นตอน'
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleOrders.map((o) => {
                  const cfg = outsourceStatusConfig[o.status] ?? outsourceStatusConfig.DRAFT;
                  const order = o.productionStep.production.order;
                  const overdue = isOverdueBack(o);
                  return (
                    <li key={o.id} className="space-y-1.5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            <Link
                              href={`/orders/${o.productionStep.production.orderId ?? ""}`}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {order.orderNumber}
                            </Link>{" "}
                            — {o.description}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {o.vendor.name} · {o.quantity} ชิ้น · {order.customer.name}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {/* ค่าจ้างโชว์เฉพาะใบเก่าที่เคยกรอกไว้ — ใบใหม่ไม่เก็บเงินแล้ว */}
                          {o.totalCost > 0 && (
                            <span className="text-sm font-medium tabular-nums">
                              {formatCurrency(o.totalCost)}
                            </span>
                          )}
                          <Badge variant={cfg.variant} size="sm">
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`text-xs ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-slate-400"}`}>
                          {o.sentAt && `ส่ง ${formatDate(o.sentAt)}`}
                          {o.expectedBackAt &&
                            ` · กำหนดรับ ${formatDate(o.expectedBackAt)}${overdue ? " — เลยกำหนด!" : ""}`}
                          {o.receivedAt && ` · รับกลับ ${formatDate(o.receivedAt)}`}
                          {o.qcNotes && ` · QC: ${o.qcNotes}`}
                        </p>
                        <div className="flex gap-1.5">
                          {o.status === "DRAFT" && (
                            <>
                              {canHandleGoods && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-xs"
                                  disabled={updateStatus.isPending}
                                  onClick={() => updateStatus.mutate({ id: o.id, status: "SENT" })}
                                >
                                  <Send className="h-3 w-3" />
                                  ส่งของให้ร้านแล้ว
                                </Button>
                              )}
                              {canJudgeQc && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-xs text-red-500 hover:text-red-600"
                                  disabled={cancelDraft.isPending}
                                  onClick={() => cancelDraft.mutate({ id: o.id })}
                                >
                                  <X className="h-3 w-3" />
                                  ยกเลิกร่าง
                                </Button>
                              )}
                            </>
                          )}
                          {["SENT", "IN_PROGRESS", "COMPLETED"].includes(o.status) &&
                            canHandleGoods && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs"
                              disabled={updateStatus.isPending}
                              onClick={() =>
                                setReceiveTarget({
                                  id: o.id,
                                  orderId: o.productionStep.production.orderId,
                                  description: o.description,
                                  quantity: o.quantity,
                                })
                              }
                            >
                              <PackageCheck className="h-3 w-3" />
                              รับของกลับแล้ว
                            </Button>
                          )}
                          {o.status === "RECEIVED_BACK" && canJudgeQc && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs text-green-700 dark:text-green-400"
                                disabled={updateStatus.isPending}
                                onClick={() =>
                                  updateStatus.mutate({ id: o.id, status: "QC_PASSED" })
                                }
                              >
                                <Check className="h-3 w-3" />
                                QC ผ่าน
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs text-red-600 dark:text-red-400"
                                disabled={updateStatus.isPending}
                                onClick={() => {
                                  setQcFailNotes("");
                                  setQcFailTarget(o.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                                QC ไม่ผ่าน
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        {/* Vendors */}
        <Section title={`ร้านนอก (${vendors?.length ?? 0})`} bordered>
          {loadingVendors ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : !vendors || vendors.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="ยังไม่มีร้าน"
              description="เพิ่มร้านแรกเพื่อเริ่มส่งงาน outsource"
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {vendors.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {v.name}
                      {v.phone && (
                        <span className="ml-2 text-xs font-normal text-slate-500">{v.phone}</span>
                      )}
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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditVendor(v)}
                      className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                      title="แก้ไขร้าน"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* QC fail dialog — ต้องบอกเหตุผล (ใช้คุยกับร้าน + เปิดรอบส่งแก้) */}
      <Dialog open={qcFailTarget !== null} onOpenChange={(open) => !open && setQcFailTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QC ไม่ผ่าน</DialogTitle>
            <DialogDescription>
              ระบุปัญหาที่พบ — ขั้นตอนผลิตจะยังเปิดอยู่ ส่งแก้รอบใหม่ได้จากหน้าใบผลิต
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={qcFailNotes}
            onChange={(e) => setQcFailNotes(e.target.value)}
            rows={3}
            placeholder="เช่น สีเพี้ยนจากแบบ 5 ตัว, ตำแหน่งพิมพ์เบี้ยว..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setQcFailTarget(null)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              disabled={!qcFailNotes || updateStatus.isPending}
              onClick={() =>
                qcFailTarget &&
                updateStatus.mutate({
                  id: qcFailTarget,
                  status: "QC_FAILED",
                  qcNotes: qcFailNotes,
                })
              }
              className="gap-1.5"
            >
              {updateStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              ยืนยัน QC ไม่ผ่าน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* รับกลับร้านนอก: นับของก่อน (ใบตรวจรับ) → บันทึกแล้วค่อย flip สถานะรับกลับ
          ถ้า flip พลาด (ใบถูกคนอื่นขยับ) ใบตรวจรับยังอยู่ — กด "รับของกลับแล้ว" ซ้ำได้ */}
      {receiveTarget && (
        <GoodsReceiptDialog
          orderId={receiveTarget.orderId}
          receiptType="OUTSOURCE_RETURN"
          outsourceOrderId={receiveTarget.id}
          presetLines={[
            {
              description: receiveTarget.description,
              qtyExpected: receiveTarget.quantity,
            },
          ]}
          onCreated={() =>
            updateStatus.mutate({ id: receiveTarget.id, status: "RECEIVED_BACK" })
          }
          onClose={() => setReceiveTarget(null)}
        />
      )}
    </div>
  );
}
