"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { formatDate, formatDateShort, formatBaht, isImageUrl } from "@/lib/utils";
import { differenceInBangkokDays } from "@/lib/date-utils";
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
import { StatusLabel, toneFromBadgeVariant } from "@/components/ui/status-label";
import { DueTag } from "@/components/ui/due-tag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionZone } from "@/components/ui/action-zone";
import { PublicLinkError } from "@/components/public-link-error";
import {
  PublicPageShell,
  FullScreenLoading,
} from "@/components/public/public-page";
import { Package, CheckCircle2, Palette, FileText, Truck, ExternalLink, Check, XCircle, Phone, Mail, MessageCircle } from "lucide-react";

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
  // blind ship = ห้ามเปิดตัวตนผู้ผลิต — ยังไม่รู้คำตอบให้ถือว่าใช่ไว้ก่อน จะได้ไม่ยิงถามเบอร์ร้าน
  const blindShip = status.data?.isBlindShip ?? true;
  const contact = trpc.settings.publicContact.useQuery(undefined, {
    enabled: !blindShip,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (status.isLoading) {
    return <FullScreenLoading />;
  }

  if (status.error || !status.data) {
    return <PublicLinkError error={status.error} message="ลิงก์ติดตามงานอาจไม่ถูกต้องหรือหมดอายุแล้ว" onRetry={() => void status.refetch()} />;
  }

  const d = status.data;
  const cancelled = d.customerStatus === "CANCELLED";
  const currentIdx = d.steps.findIndex((s) => s.status === d.customerStatus);
  const currentLabel = CUSTOMER_STATUS_LABELS[d.customerStatus];
  const dueInDays = differenceInBangkokDays(d.deadline, status.dataUpdatedAt);
  const contactPhone = contact.data?.phone ?? null;
  const contactEmail = contact.data?.email ?? null;
  const canContactShop = !d.isBlindShip && Boolean(contactPhone || contactEmail);

  return (
    <PublicPageShell
      icon={<Package />}
      pageLabel="สถานะงาน"
      brandName={d.brandName}
      brandNote="ลิงก์นี้เปิดดูได้โดยไม่ต้องเข้าระบบ"
      title={<span className="tabular-nums">ออเดอร์ {d.orderNumber}</span>}
      subtitle={d.customerName}
      hideFooter={d.isBlindShip}
    >
        {/* สถานะ + กำหนดส่ง + แถบขั้น (ต้นแบบ: pstat → psteps → pnote) */}
        {cancelled ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-4.5">
              <XCircle className="h-8 w-8 shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">ออเดอร์ถูกยกเลิก</p>
                <p className="text-sm text-muted">กรุณาติดต่อทีมงานหากมีข้อสงสัย</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* เดิมเป็นแคปซูลพื้นสี ทำให้สถานะเดียวกันลูกค้าเห็นคนละหน้าตากับที่ทีมเห็น
                    (UI-2026 · เบสสั่ง 2026-08-26) ตอนนี้ใช้ป้ายกลางตัวเดียวกันทั้งเว็บ */}
                <StatusLabel
                  label={currentLabel}
                  tone={CUSTOMER_STATUS_TONES[d.customerStatus]}
                  emphasize
                  className="text-sm"
                />
                {d.deadline && (
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    กำหนดส่ง
                    <DueTag dueInDays={dueInDays} dateLabel={formatDateShort(d.deadline)} />
                  </span>
                )}
              </div>
              <ol className="mt-3">
                {d.steps.map((s, i) => {
                  const done = i < currentIdx;
                  const current = i === currentIdx;
                  return (
                    <li key={s.status} className="flex items-center gap-2.5 py-2">
                      {/* วงกลม 24px ไม่มีตัวเลข: ผ่านแล้ว = ติ๊กพื้นเขียวจาง · ขั้นนี้ = วงทึบ · ยังไม่ถึง = ขอบบาง */}
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          done
                            ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                            : current
                              ? "bg-blue-600"
                              : "border border-border"
                        }`}
                        aria-hidden="true"
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      {/* ขั้นปัจจุบันเน้นด้วยน้ำหนัก/ความเข้ม ไม่ย้อมสี (กฎโฟกัส: ขนาด-น้ำหนักก่อนสี) */}
                      <span
                        className={
                          current
                            ? "text-sm font-semibold text-strong"
                            : done
                              ? "text-sm text-secondary"
                              : "text-sm text-muted"
                        }
                      >
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                ตอนนี้อยู่ขั้น{currentLabel} — ทีมงานจะอัปเดตให้อีกครั้งเมื่อขั้นถัดไปเริ่ม
              </p>
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
            <CardContent>
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
                    className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-secondary"
                  >
                    <ExternalLink className="h-4 w-4" />
                    เปิดไฟล์แบบที่อนุมัติ
                  </a>
                ))}
              <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
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
            <CardContent className="space-y-3">
              {d.deliveries.map((dv, i) => (
                <div key={i} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-strong">
                      {SHIPPING_METHOD_LABELS[dv.shippingMethod] ?? dv.shippingMethod}
                    </span>
                    {/* ป้ายสถานะทั้งหน้าเป็นชุดเดียว (จุดสี + ข้อความ) — เดิมการ์ดนี้ใช้ Badge พื้นสี */}
                    <StatusLabel
                      label={DELIVERY_STATUS_LABELS_CUSTOMER[dv.status] ?? dv.status}
                      tone={toneFromBadgeVariant(DELIVERY_STATUS_VARIANTS[dv.status as keyof typeof DELIVERY_STATUS_VARIANTS])}
                      emphasize
                    />
                  </div>
                  {dv.trackingNumber && (
                    <p className="mt-1 text-secondary">
                      เลขพัสดุ: <span className="font-mono font-medium">{dv.trackingNumber}</span>
                    </p>
                  )}
                  {dv.shippedAt && (
                    <p className="text-sm text-muted">ส่งเมื่อ {formatDate(dv.shippedAt)}</p>
                  )}
                  {dv.deliveredAt && (
                    <p className="text-sm text-green-700 dark:text-green-300">ถึงปลายทาง {formatDate(dv.deliveredAt)}</p>
                  )}
                  {dv.lines.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-sm text-muted">
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
            <CardContent className="space-y-2.5">
              {d.quotations.map((q, i) => (
                <div key={`q${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-strong">
                      ใบเสนอราคา {q.quotationNumber}
                    </p>
                    <p className="text-sm text-muted">
                      {QUOTATION_STATUS_LABELS_CUSTOMER[q.status] ?? q.status} · ยืนราคาถึง {formatDate(q.validUntil)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums text-strong">{baht(q.totalAmount)}</span>
                    {q.pdfUrl && (
                      <a
                        href={q.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 px-2 text-sm text-secondary"
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
                        {inv.isVoided && <span className="ml-1 text-sm text-red-700 dark:text-red-300">(ยกเลิก)</span>}
                      </p>
                      {inv.dueDate && !inv.isVoided && (
                        <p className="text-sm text-muted">ครบกำหนด {formatDate(inv.dueDate)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums text-strong">{baht(inv.totalAmount)}</span>
                      <StatusLabel label={ps.label} tone={toneFromBadgeVariant(ps.variant)} emphasize />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* สิ่งที่คุณทำได้ตอนนี้ — ปิดทั้งโซนตอน blind ship (ห้ามเปิดช่องทางร้านให้ปลายทาง) */}
        {canContactShop && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สิ่งที่คุณทำได้ตอนนี้</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionZone
                icon={MessageCircle}
                note="อยากถามเรื่องงานนี้เพิ่ม ทักร้านได้เลย แจ้งเลขออเดอร์บนหัวหน้านี้จะหาได้เร็วขึ้น"
              >
                {contactPhone ? (
                  <Button asChild>
                    <a href={`tel:${contactPhone}`}>
                      <Phone aria-hidden="true" />
                      ทักร้าน {contactPhone}
                    </a>
                  </Button>
                ) : (
                  <Button asChild>
                    <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(`สอบถามออเดอร์ ${d.orderNumber}`)}`}>
                      <Mail aria-hidden="true" />
                      ทักร้าน
                    </a>
                  </Button>
                )}
              </ActionZone>
            </CardContent>
          </Card>
        )}
    </PublicPageShell>
  );
}
