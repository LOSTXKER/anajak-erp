"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDate, formatBaht } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { PublicLinkError } from "@/components/public-link-error";
import {
  PublicPageShell,
  FullScreenLoading,
  InfoRow,
} from "@/components/public/public-page";
import {
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

// หน้ายืนยันใบเสนอราคาสำหรับลูกค้า (FLOW-REDESIGN ก้อน 4 — ขอบลูกค้า)
// เปิดผ่านลิงก์ token ไม่ต้อง login — โชว์รายการ+ราคาเต็ม (ลูกค้าตกลงราคานี้) → ยืนยัน / ขอแก้ไข

const baht = formatBaht;

export default function QuoteConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const quote = trpc.quotationConfirm.getQuote.useQuery({ token });

  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  // ผลที่ลูกค้าเพิ่งกด (optimistic ในหน้านี้) — กันกดซ้ำ + โชว์ thank-you ทันที
  const [done, setDone] = useState<"ACCEPTED" | "REJECTED" | null>(null);

  const accept = trpc.quotationConfirm.accept.useMutation({
    onSuccess: () => {
      setDone("ACCEPTED");
      quote.refetch();
    },
  });
  const reject = trpc.quotationConfirm.reject.useMutation({
    onSuccess: () => {
      setDone("REJECTED");
      quote.refetch();
    },
  });

  if (quote.isLoading) {
    return <FullScreenLoading />;
  }

  if (quote.error || !quote.data) {
    return <PublicLinkError message="ใบเสนออาจหมดอายุหรือกำลังปรับปรุง กรุณาขอลิงก์ฉบับใหม่" onRetry={() => void quote.refetch()} />;
  }

  const q = quote.data;
  const isPending = accept.isPending || reject.isPending;
  // สถานะที่กดได้: ส่งแล้ว (SENT) + ยังไม่หมดอายุ + ยังไม่เพิ่งกดในหน้านี้
  const actionable = q.status === "SENT" && !q.isExpired && done === null;
  const decided = done ?? (q.status === "ACCEPTED" || q.status === "CONVERTED" ? "ACCEPTED" : q.status === "REJECTED" ? "REJECTED" : null);

  return (
    <PublicPageShell
      icon={<FileText />}
      subtitle={`ใบเสนอราคา ${q.quotationNumber}`}
    >
      {/* Quote header card */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-lg font-semibold text-strong">{q.title}</p>
            {q.description && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{q.description}</p>
            )}
          </div>
          <div className="grid gap-1.5 text-sm">
            <InfoRow label="ลูกค้า">{q.customerName}</InfoRow>
            <InfoRow label="ยืนราคาถึง">{formatDate(q.validUntil)}</InfoRow>
          </div>
        </CardContent>
      </Card>

      {/* Items + totals */}
      <Card>
        <CardContent className="p-5">
          <div className="space-y-3">
            {q.items.map((it, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border-b border-divider pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-strong">{it.name}</p>
                  {it.description && <p className="text-xs text-muted">{it.description}</p>}
                  <p className="mt-0.5 text-xs text-muted">
                    {it.quantity.toLocaleString("th-TH")} {it.unit} × {baht(it.unitPrice)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-strong">
                  {baht(it.totalPrice)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-divider pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">ยอดรวมสินค้า</span>
              <span className="tabular-nums text-secondary">{baht(q.subtotal)}</span>
            </div>
            {q.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">ส่วนลด</span>
                <span className="tabular-nums text-red-600">-{baht(q.discount)}</span>
              </div>
            )}
            {q.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">ภาษี (VAT)</span>
                <span className="tabular-nums text-secondary">+{baht(q.tax)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-divider pt-2.5">
              <span className="text-base font-semibold text-strong">ยอดรวมทั้งหมด</span>
              <span className="text-lg font-semibold tabular-nums text-strong">{baht(q.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms */}
      {q.terms && (
        <Card>
          <CardContent className="p-5">
            <p className="mb-1 text-xs font-medium text-muted">เงื่อนไข</p>
            <p className="whitespace-pre-wrap text-sm text-secondary">{q.terms}</p>
          </CardContent>
        </Card>
      )}

      {/* Action / status area */}
      {decided === "ACCEPTED" ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-green-500" />
            <div>
              <p className="font-semibold text-green-700">ยืนยันใบเสนอแล้ว</p>
              <p className="text-sm text-muted">ขอบคุณค่ะ ทีมงานจะติดต่อกลับเพื่อดำเนินการต่อ</p>
            </div>
          </CardContent>
        </Card>
      ) : decided === "REJECTED" ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <XCircle className="h-8 w-8 shrink-0 text-muted" />
            <div>
              <p className="font-semibold text-secondary">ส่งคำขอแก้ไขแล้ว</p>
              <p className="text-sm text-muted">ทีมงานได้รับเรื่องแล้ว จะติดต่อกลับเพื่อปรับใบเสนอให้ค่ะ</p>
            </div>
          </CardContent>
        </Card>
      ) : q.isExpired || q.status === "EXPIRED" ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Clock className="h-8 w-8 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-700">ใบเสนอนี้หมดอายุแล้ว</p>
              <p className="text-sm text-muted">กรุณาติดต่อร้านเพื่อขอใบเสนอราคาฉบับใหม่</p>
            </div>
          </CardContent>
        </Card>
      ) : actionable ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            {(accept.error || reject.error) && (
              <Alert variant="error">
                {accept.error?.message || reject.error?.message}
              </Alert>
            )}
            {!showReject ? (
              <>
                <p className="text-center text-sm text-secondary">
                  กรุณาตรวจสอบรายการและราคา หากถูกต้องกด “ยืนยันใบเสนอ” เพื่อให้เราเริ่มงานได้เลยค่ะ
                </p>
                <Button
                  size="lg"
                  onClick={() => accept.mutate({ token })}
                  disabled={isPending}
                  className="w-full gap-1.5"
                >
                  {accept.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  ยืนยันใบเสนอ
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReject(true)}
                  disabled={isPending}
                  className="h-11 w-full gap-1.5"
                >
                  ขอแก้ไข / ยังไม่ตกลง
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-secondary">อยากให้แก้ไขส่วนไหน? (ไม่บังคับ)</p>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="เช่น ขอลดจำนวน / ปรับราคา / เปลี่ยนแบบ ..."
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowReject(false)}
                    disabled={isPending}
                    className="h-11 flex-1"
                  >
                    ย้อนกลับ
                  </Button>
                  <Button
                    onClick={() => reject.mutate({ token, reason: reason.trim() || undefined })}
                    disabled={isPending}
                    className="h-11 flex-1 gap-1.5"
                  >
                    {reject.isPending ? <Loader2 className="animate-spin" /> : null}
                    ส่งคำขอแก้ไข
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </PublicPageShell>
  );
}
