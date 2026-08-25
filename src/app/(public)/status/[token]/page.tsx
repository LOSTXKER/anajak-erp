"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { formatDate, formatBaht, isImageUrl } from "@/lib/utils";
import { INVOICE_TYPE_LABELS_CUSTOMER } from "@/lib/invoice-labels";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS,
  QUOTATION_STATUS_LABELS_CUSTOMER,
  DELIVERY_STATUS_LABELS_CUSTOMER,
  DELIVERY_STATUS_VARIANTS,
} from "@/lib/status-config";
import { SHIPPING_METHOD_LABELS } from "@/lib/shipping-methods";
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_TONES,
} from "@/lib/order-status";
import { StatusLabel } from "@/components/ui/status-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicLinkError } from "@/components/public-link-error";
import {
  PublicPageShell,
  FullScreenLoading,
  InfoRow,
} from "@/components/public/public-page";
import { Package, CheckCircle2, Palette, FileText, Truck, ExternalLink, Check, XCircle } from "lucide-react";

// หน้าสถานะออเดอร์สำหรับลูกค้า (FLOW-REDESIGN ก้อน 4 — portal ขั้น 1)
// เปิดผ่านลิงก์ token ไม่ต้อง login — โชว์เฉพาะข้อมูลของลูกค้า (sanitize ที่ server แล้ว)

// สถานะ/วิธีส่งทุกชุดมาจาก lib กลาง — ห้ามประกาศ map ในไฟล์นี้อีก
// (เคยประกาศเอง 4 ชุดแล้ว drift: สี PARTIALLY_PAID กับคำหลายตัวไม่ตรงฝั่งทีม)

const baht = formatBaht;

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const status = trpc.customerStatus.getStatus.useQuery({ token });

  if (status.isLoading) {
    return <FullScreenLoading />;
  }

  if (status.error || !status.data) {
    return <PublicLinkError message="ลิงก์ติดตามงานอาจไม่ถูกต้องหรือหมดอายุแล้ว" onRetry={() => void status.refetch()} />;
  }

  const d = status.data;
  const cancelled = d.customerStatus === "CANCELLED";
  const currentIdx = d.steps.findIndex((s) => s.status === d.customerStatus);

  return (
    <PublicPageShell
      icon={<Package />}
      title={d.brandName}
      subtitle="ติดตามสถานะงานของคุณ"
      hideFooter={d.isBlindShip}
    >
        {/* Order info + current status */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-strong">{d.title}</p>
                <p className="text-sm text-muted">เลขออเดอร์ {d.orderNumber}</p>
              </div>
              {/* เดิมเป็นแคปซูลพื้นสี ทำให้สถานะเดียวกันลูกค้าเห็นคนละหน้าตากับที่ทีมเห็น
                  (UI-2026 · เบสสั่ง 2026-08-26) ตอนนี้ใช้ป้ายกลางตัวเดียวกันทั้งเว็บ */}
              <StatusLabel
                label={CUSTOMER_STATUS_LABELS[d.customerStatus]}
                tone={CUSTOMER_STATUS_TONES[d.customerStatus]}
                emphasize
                className="text-sm"
              />
            </div>
            <div className="grid gap-1.5 text-sm">
              <InfoRow label="ลูกค้า">{d.customerName}</InfoRow>
              {d.deadline && (
                <InfoRow label="กำหนดส่ง">{formatDate(d.deadline)}</InfoRow>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {cancelled ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <XCircle className="h-8 w-8 shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">ออเดอร์ถูกยกเลิก</p>
                <p className="text-sm text-muted">กรุณาติดต่อทีมงานหากมีข้อสงสัย</p>
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
                              ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900"
                              : "bg-surface-muted text-muted"
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span
                        className={`text-sm ${
                          current
                            ? "font-semibold text-blue-700 dark:text-blue-300"
                            : done
                              ? "text-secondary"
                              : "text-muted"
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
                <Palette className="h-4 w-4 text-muted" />
                แบบที่อนุมัติแล้ว
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {d.approvedDesign.imageUrl &&
                (isImageUrl(d.approvedDesign.imageUrl) ? (
                  <a
                    href={d.approvedDesign.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.approvedDesign.imageUrl}
                      alt="แบบที่อนุมัติ"
                      className="max-h-80 w-full object-contain"
                    />
                  </a>
                ) : (
                  // ไฟล์แบบเป็นไฟล์งาน (.ai/.psd/.pdf) เปิดเป็นรูปไม่ได้ — โชว์ปุ่มเปิดไฟล์
                  <a
                    href={d.approvedDesign.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-secondary hover:bg-interactive-hover hover:text-strong hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    เปิดไฟล์แบบที่อนุมัติ
                  </a>
                ))}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
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
                <Truck className="h-4 w-4 text-muted" />
                การจัดส่ง
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {d.deliveries.map((dv, i) => (
                <div key={i} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-strong">
                      {SHIPPING_METHOD_LABELS[dv.shippingMethod] ?? dv.shippingMethod}
                    </span>
                    <Badge variant={DELIVERY_STATUS_VARIANTS[dv.status as keyof typeof DELIVERY_STATUS_VARIANTS] ?? "secondary"}>
                      {DELIVERY_STATUS_LABELS_CUSTOMER[dv.status] ?? dv.status}
                    </Badge>
                  </div>
                  {dv.trackingNumber && (
                    <p className="mt-1 text-secondary">
                      เลขพัสดุ: <span className="font-mono font-medium">{dv.trackingNumber}</span>
                    </p>
                  )}
                  {dv.shippedAt && (
                    <p className="text-xs text-muted">ส่งเมื่อ {formatDate(dv.shippedAt)}</p>
                  )}
                  {dv.deliveredAt && (
                    <p className="text-xs text-green-600 dark:text-green-400">ถึงปลายทาง {formatDate(dv.deliveredAt)}</p>
                  )}
                  {dv.lines.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted">
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
                <FileText className="h-4 w-4 text-muted" />
                เอกสาร
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-5 pt-0">
              {d.quotations.map((q, i) => (
                <div key={`q${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-strong">
                      ใบเสนอราคา {q.quotationNumber}
                    </p>
                    <p className="text-xs text-muted">
                      {QUOTATION_STATUS_LABELS_CUSTOMER[q.status] ?? q.status} · ยืนราคาถึง {formatDate(q.validUntil)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-strong">{baht(q.totalAmount)}</span>
                    {q.pdfUrl && (
                      <a
                        href={q.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 px-2 text-xs text-secondary hover:text-strong hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {d.invoices.map((inv, i) => {
                const ps = {
                  label: PAYMENT_STATUS_LABELS[inv.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS] ?? inv.paymentStatus,
                  variant: PAYMENT_STATUS_VARIANTS[inv.paymentStatus as keyof typeof PAYMENT_STATUS_VARIANTS] ?? ("default" as const),
                };
                return (
                  <div key={`i${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-strong">
                        {INVOICE_TYPE_LABELS_CUSTOMER[inv.type] ?? "ใบแจ้งหนี้"} {inv.invoiceNumber}
                        {inv.isVoided && <span className="ml-1 text-xs text-red-600 dark:text-red-400">(ยกเลิก)</span>}
                      </p>
                      {inv.dueDate && !inv.isVoided && (
                        <p className="text-xs text-muted">ครบกำหนด {formatDate(inv.dueDate)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-strong">{baht(inv.totalAmount)}</span>
                      <Badge variant={ps.variant}>{ps.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
    </PublicPageShell>
  );
}
