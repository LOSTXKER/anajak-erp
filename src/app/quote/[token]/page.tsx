"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertCircle,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

// หน้ายืนยันใบเสนอราคาสำหรับลูกค้า (FLOW-REDESIGN ก้อน 4 — ขอบลูกค้า)
// เปิดผ่านลิงก์ token ไม่ต้อง login — โชว์รายการ+ราคาเต็ม (ลูกค้าตกลงราคานี้) → ยืนยัน / ขอแก้ไข

const baht = (n: number) =>
  `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-2xl space-y-5 py-6">{children}</div>
    </div>
  );
}

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      </div>
    );
  }

  if (quote.error || !quote.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h2 className="mb-2 text-lg font-semibold text-slate-900">เปิดลิงก์ไม่ได้</h2>
            <p className="text-sm text-slate-500">
              {quote.error?.message ??
                "ลิงก์อาจไม่ถูกต้องหรือใบเสนอกำลังปรับปรุง กรุณาติดต่อทีมงาน"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const q = quote.data;
  const isPending = accept.isPending || reject.isPending;
  // สถานะที่กดได้: ส่งแล้ว (SENT) + ยังไม่หมดอายุ + ยังไม่เพิ่งกดในหน้านี้
  const actionable = q.status === "SENT" && !q.isExpired && done === null;
  const decided = done ?? (q.status === "ACCEPTED" || q.status === "CONVERTED" ? "ACCEPTED" : q.status === "REJECTED" ? "REJECTED" : null);

  return (
    <Shell>
      {/* Header */}
      <div className="text-center">
        <div className="mb-1 flex items-center justify-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Anajak Print</h1>
        </div>
        <p className="text-sm text-slate-500">ใบเสนอราคา {q.quotationNumber}</p>
      </div>

      {/* Quote header card */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-lg font-semibold text-slate-900">{q.title}</p>
            {q.description && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{q.description}</p>
            )}
          </div>
          <div className="grid gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">ลูกค้า</span>
              <span className="font-medium text-slate-800">{q.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ยืนราคาถึง</span>
              <span className="font-medium text-slate-800">{formatDate(q.validUntil)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items + totals */}
      <Card>
        <CardContent className="p-5">
          <div className="space-y-3">
            {q.items.map((it, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{it.name}</p>
                  {it.description && <p className="text-xs text-slate-400">{it.description}</p>}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {it.quantity.toLocaleString("th-TH")} {it.unit} × {baht(it.unitPrice)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-slate-800">
                  {baht(it.totalPrice)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">ยอดรวมสินค้า</span>
              <span className="tabular-nums text-slate-700">{baht(q.subtotal)}</span>
            </div>
            {q.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">ส่วนลด</span>
                <span className="tabular-nums text-red-600">-{baht(q.discount)}</span>
              </div>
            )}
            {q.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">ภาษี (VAT)</span>
                <span className="tabular-nums text-slate-700">+{baht(q.tax)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-2.5">
              <span className="text-base font-semibold text-slate-900">ยอดรวมทั้งหมด</span>
              <span className="text-lg font-bold tabular-nums text-blue-600">{baht(q.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms */}
      {q.terms && (
        <Card>
          <CardContent className="p-5">
            <p className="mb-1 text-xs font-medium text-slate-400">เงื่อนไข</p>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{q.terms}</p>
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
              <p className="text-sm text-slate-500">ขอบคุณค่ะ ทีมงานจะติดต่อกลับเพื่อดำเนินการต่อ</p>
            </div>
          </CardContent>
        </Card>
      ) : decided === "REJECTED" ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <XCircle className="h-8 w-8 shrink-0 text-slate-400" />
            <div>
              <p className="font-semibold text-slate-700">ส่งคำขอแก้ไขแล้ว</p>
              <p className="text-sm text-slate-500">ทีมงานได้รับเรื่องแล้ว จะติดต่อกลับเพื่อปรับใบเสนอให้ค่ะ</p>
            </div>
          </CardContent>
        </Card>
      ) : q.isExpired || q.status === "EXPIRED" ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Clock className="h-8 w-8 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold text-amber-700">ใบเสนอนี้หมดอายุแล้ว</p>
              <p className="text-sm text-slate-500">กรุณาติดต่อร้านเพื่อขอใบเสนอราคาฉบับใหม่</p>
            </div>
          </CardContent>
        </Card>
      ) : actionable ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            {(accept.error || reject.error) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {accept.error?.message || reject.error?.message}
              </div>
            )}
            {!showReject ? (
              <>
                <p className="text-center text-sm text-slate-600">
                  กรุณาตรวจสอบรายการและราคา หากถูกต้องกด “ยืนยันใบเสนอ” เพื่อให้เราเริ่มงานได้เลยค่ะ
                </p>
                <Button
                  onClick={() => accept.mutate({ token })}
                  disabled={isPending}
                  className="w-full gap-1.5 bg-green-600 py-6 text-base text-white hover:bg-green-700"
                >
                  {accept.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
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
                <p className="text-sm font-medium text-slate-700">อยากให้แก้ไขส่วนไหน? (ไม่บังคับ)</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="เช่น ขอลดจำนวน / ปรับราคา / เปลี่ยนแบบ ..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    ส่งคำขอแก้ไข
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-xs text-slate-400">Powered by Anajak Print ERP</p>
    </Shell>
  );
}
