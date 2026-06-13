"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
} from "@/lib/order-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertCircle,
  Package,
  CheckCircle2,
  Palette,
  FileText,
  Truck,
  ExternalLink,
  Check,
  XCircle,
} from "lucide-react";

// หน้าสถานะออเดอร์สำหรับลูกค้า (FLOW-REDESIGN ก้อน 4 — portal ขั้น 1)
// เปิดผ่านลิงก์ token ไม่ต้อง login — โชว์เฉพาะข้อมูลของลูกค้า (sanitize ที่ server แล้ว)

const PAYMENT_STATUS: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "default" }> = {
  UNPAID: { label: "ยังไม่ชำระ", variant: "warning" },
  PARTIALLY_PAID: { label: "ชำระบางส่วน", variant: "warning" },
  PAID: { label: "ชำระแล้ว", variant: "success" },
  OVERDUE: { label: "เลยกำหนด", variant: "destructive" },
  VOIDED: { label: "ยกเลิก", variant: "default" },
};

const INVOICE_TYPE: Record<string, string> = {
  DEPOSIT_INVOICE: "ใบแจ้งหนี้ (มัดจำ)",
  FINAL_INVOICE: "ใบแจ้งหนี้",
  RECEIPT: "ใบเสร็จรับเงิน",
  CREDIT_NOTE: "ใบลดหนี้",
  DEBIT_NOTE: "ใบเพิ่มหนี้",
};

const QUOTATION_STATUS: Record<string, string> = {
  DRAFT: "ร่าง",
  SENT: "ส่งแล้ว",
  ACCEPTED: "ตกลงแล้ว",
  REJECTED: "ปฏิเสธ",
  EXPIRED: "หมดอายุ",
  CONVERTED: "ยืนยันเป็นออเดอร์",
};

const DELIVERY_STATUS: Record<string, string> = {
  PENDING: "รอจัดส่ง",
  PREPARING: "กำลังเตรียมส่ง",
  SHIPPED: "จัดส่งแล้ว",
  DELIVERED: "ส่งถึงแล้ว",
  RETURNED: "ตีกลับ",
};

const SHIPPING_METHOD: Record<string, string> = {
  PICKUP: "รับเอง",
  KERRY: "Kerry Express",
  FLASH: "Flash Express",
  THAILAND_POST: "ไปรษณีย์ไทย",
  J_AND_T: "J&T Express",
  GRAB: "Grab",
  LALAMOVE: "Lalamove",
  SHOPEE_SHIP: "Shopee",
  LAZADA_SHIP: "Lazada",
  OTHER: "อื่นๆ",
};

const baht = (n: number) =>
  `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const status = trpc.customerStatus.getStatus.useQuery({ token });

  if (status.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      </div>
    );
  }

  if (status.error || !status.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              เปิดลิงก์ไม่ได้
            </h2>
            <p className="text-sm text-slate-500">
              {status.error?.message ??
                "ลิงก์อาจไม่ถูกต้องหรือหมดอายุแล้ว กรุณาติดต่อทีมงาน"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = status.data;
  const cancelled = d.customerStatus === "CANCELLED";
  const currentIdx = d.steps.findIndex((s) => s.status === d.customerStatus);
  const statusColor = CUSTOMER_STATUS_COLORS[d.customerStatus];

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-2xl space-y-5 py-6">
        {/* Header */}
        <div className="text-center">
          <div className="mb-1 flex items-center justify-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">{d.brandName}</h1>
          </div>
          <p className="text-sm text-slate-500">ติดตามสถานะงานของคุณ</p>
        </div>

        {/* Order info + current status */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-slate-900">{d.title}</p>
                <p className="text-sm text-slate-500">เลขออเดอร์ {d.orderNumber}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusColor.bg} ${statusColor.text}`}
              >
                <span className={`h-2 w-2 rounded-full ${statusColor.dot}`} />
                {CUSTOMER_STATUS_LABELS[d.customerStatus]}
              </span>
            </div>
            <div className="grid gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">ลูกค้า</span>
                <span className="font-medium text-slate-800">{d.customerName}</span>
              </div>
              {d.deadline && (
                <div className="flex justify-between">
                  <span className="text-slate-500">กำหนดส่ง</span>
                  <span className="font-medium text-slate-800">{formatDate(d.deadline)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {cancelled ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <XCircle className="h-8 w-8 shrink-0 text-red-500" />
              <div>
                <p className="font-semibold text-red-700">ออเดอร์ถูกยกเลิก</p>
                <p className="text-sm text-slate-500">กรุณาติดต่อทีมงานหากมีข้อสงสัย</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ความคืบหน้า</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <ol className="space-y-3">
                {d.steps.map((s, i) => {
                  const done = i < currentIdx;
                  const current = i === currentIdx;
                  return (
                    <li key={s.status} className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                          done
                            ? "bg-green-500 text-white"
                            : current
                              ? "bg-blue-600 text-white ring-4 ring-blue-100"
                              : "bg-slate-200 text-slate-400"
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span
                        className={`text-sm ${
                          current
                            ? "font-semibold text-blue-700"
                            : done
                              ? "text-slate-700"
                              : "text-slate-400"
                        }`}
                      >
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Approved design */}
        {d.approvedDesign && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4 text-blue-600" />
                แบบที่อนุมัติแล้ว
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {d.approvedDesign.imageUrl && (
                <a
                  href={d.approvedDesign.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-slate-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.approvedDesign.imageUrl}
                    alt="แบบที่อนุมัติ"
                    className="max-h-80 w-full object-contain"
                  />
                </a>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                เวอร์ชัน {d.approvedDesign.versionNumber} · อนุมัติแล้ว
              </p>
            </CardContent>
          </Card>
        )}

        {/* Shipping / tracking */}
        {d.deliveries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-blue-600" />
                การจัดส่ง
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {d.deliveries.map((dv, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">
                      {SHIPPING_METHOD[dv.shippingMethod] ?? dv.shippingMethod}
                    </span>
                    <Badge variant="secondary">
                      {DELIVERY_STATUS[dv.status] ?? dv.status}
                    </Badge>
                  </div>
                  {dv.trackingNumber && (
                    <p className="mt-1 text-slate-600">
                      เลขพัสดุ: <span className="font-mono font-medium">{dv.trackingNumber}</span>
                    </p>
                  )}
                  {dv.shippedAt && (
                    <p className="text-xs text-slate-400">ส่งเมื่อ {formatDate(dv.shippedAt)}</p>
                  )}
                  {dv.deliveredAt && (
                    <p className="text-xs text-green-600">ถึงปลายทาง {formatDate(dv.deliveredAt)}</p>
                  )}
                  {dv.lines.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                      {dv.lines.map((l, j) => (
                        <li key={j}>
                          • {l.description}
                          {l.size ? ` · ${l.size}` : ""}
                          {l.color ? ` · ${l.color}` : ""} × {l.qty}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Documents: quotations + invoices */}
        {(d.quotations.length > 0 || d.invoices.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-blue-600" />
                เอกสาร
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-5 pt-0">
              {d.quotations.map((q, i) => (
                <div key={`q${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">
                      ใบเสนอราคา {q.quotationNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {QUOTATION_STATUS[q.status] ?? q.status} · ยืนราคาถึง {formatDate(q.validUntil)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800">{baht(q.totalAmount)}</span>
                    {q.pdfUrl && (
                      <a
                        href={q.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {d.invoices.map((inv, i) => {
                const ps = PAYMENT_STATUS[inv.paymentStatus] ?? {
                  label: inv.paymentStatus,
                  variant: "default" as const,
                };
                return (
                  <div key={`i${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">
                        {INVOICE_TYPE[inv.type] ?? "ใบแจ้งหนี้"} {inv.invoiceNumber}
                        {inv.isVoided && <span className="ml-1 text-xs text-red-500">(ยกเลิก)</span>}
                      </p>
                      {inv.dueDate && !inv.isVoided && (
                        <p className="text-xs text-slate-500">ครบกำหนด {formatDate(inv.dueDate)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-800">{baht(inv.totalAmount)}</span>
                      <Badge variant={ps.variant}>{ps.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-slate-400">
          {d.isBlindShip ? "" : "Powered by Anajak Print ERP"}
        </p>
      </div>
    </div>
  );
}
