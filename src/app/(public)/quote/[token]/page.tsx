"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDate, formatBaht } from "@/lib/utils";
import { c } from "@/components/kit/kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { ActionZone } from "@/components/ui/action-zone";
import { PublicLinkError } from "@/components/public-link-error";
import {
  PublicPageShell,
  FullScreenLoading,
} from "@/components/public/public-page";
import {
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ClipboardList,
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
    return <PublicLinkError error={quote.error} message="ใบเสนออาจหมดอายุหรือกำลังปรับปรุง กรุณาขอลิงก์ฉบับใหม่" onRetry={() => void quote.refetch()} />;
  }

  const q = quote.data;
  const isPending = accept.isPending || reject.isPending;
  // สถานะที่กดได้: ส่งแล้ว (SENT) + ยังไม่หมดอายุ + ยังไม่เพิ่งกดในหน้านี้
  const actionable = q.status === "SENT" && !q.isExpired && done === null;
  const decided = done ?? (q.status === "ACCEPTED" || q.status === "CONVERTED" ? "ACCEPTED" : q.status === "REJECTED" ? "REJECTED" : null);

  return (
    <PublicPageShell
      icon={<FileText />}
      pageLabel="ใบเสนอราคา"
      brandNote="กดรับหรือขอแก้ได้จากหน้านี้เลย"
      title={<>ใบเสนอราคา <span className="tabular-nums">{q.quotationNumber}</span></>}
      subtitle={`${q.customerName} · ยืนราคาถึง ${formatDate(q.validUntil)}`}
    >
      {/* รายการ + ยอด (ต้นแบบ: ตาราง 4 คอลัมน์ เลขชิดขวา แล้วต่อด้วยกล่องยอด) */}
      <Card>
        <CardContent className="p-0">
          {q.description && (
            <p className="whitespace-pre-wrap px-4.5 pt-3.5 text-sm text-muted">{q.description}</p>
          )}
          <div className={c("tblw")}>
            {/* ตารางกลางตั้ง min-width ไว้ที่ 760px สำหรับหน้าหลังบ้าน — ใบเสนอฝั่งลูกค้ามี 4 คอลัมน์จึงใช้ 460px ตามต้นแบบ */}
            <table className={c("orders")} style={{ minWidth: 460 }}>
              <thead>
                <tr>
                  <th scope="col">รายการ</th>
                  <th scope="col" className={c("r")}>จำนวน</th>
                  <th scope="col" className={c("r")}>ราคา/หน่วย</th>
                  <th scope="col" className={c("r")}>รวม</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((it, i) => (
                  <tr key={i}>
                    <td>
                      <span className="font-medium text-strong">{it.name}</span>
                      {it.description && (
                        <span className="block text-sm text-muted">{it.description}</span>
                      )}
                    </td>
                    <td className={c("q r")}>
                      <b>{it.quantity.toLocaleString("th-TH")}</b> {it.unit}
                    </td>
                    <td className={c("amt r")}>{baht(it.unitPrice)}</td>
                    <td className={c("amt r")}>{baht(it.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-divider px-4.5 py-3">
            {/* คำบนเอกสารเงินต้องตรงกับใบพิมพ์ — "ยอดก่อนภาษี" ใช้ได้เฉพาะตอนไม่มีส่วนลดคั่น */}
            <div className={c("srow")}>
              <span>{q.discount > 0 ? "ยอดรวมสินค้า" : "ยอดก่อนภาษี"}</span>
              <b>{baht(q.subtotal)}</b>
            </div>
            {q.discount > 0 && (
              <div className={c("srow")}>
                <span>ส่วนลด</span>
                <b className={c("neg")}>-{baht(q.discount)}</b>
              </div>
            )}
            {q.tax > 0 && (
              <div className={c("srow")}>
                <span>ภาษีมูลค่าเพิ่ม</span>
                <b>{baht(q.tax)}</b>
              </div>
            )}
            <div className={c("srow total")}>
              <span>ยอดสุทธิ</span>
              <b>{baht(q.totalAmount)}</b>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* เงื่อนไข */}
      {q.terms && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-muted" />
              เงื่อนไข
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">{q.terms}</p>
          </CardContent>
        </Card>
      )}

      {/* Action / status area */}
      {decided === "ACCEPTED" ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-4.5">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-semibold text-green-700 dark:text-green-300">ยืนยันใบเสนอแล้ว</p>
              <p className="text-sm text-muted">ขอบคุณค่ะ ทีมงานจะติดต่อกลับเพื่อดำเนินการต่อ</p>
            </div>
          </CardContent>
        </Card>
      ) : decided === "REJECTED" ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-4.5">
            <XCircle className="h-8 w-8 shrink-0 text-muted" />
            <div>
              <p className="font-semibold text-secondary">ส่งคำขอแก้ไขแล้ว</p>
              <p className="text-sm text-muted">ทีมงานได้รับเรื่องแล้ว จะติดต่อกลับเพื่อปรับใบเสนอให้ค่ะ</p>
            </div>
          </CardContent>
        </Card>
      ) : q.isExpired || q.status === "EXPIRED" ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-4.5">
            <Clock className="h-8 w-8 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-amber-700 dark:text-amber-400">ใบเสนอนี้หมดอายุแล้ว</p>
              <p className="text-sm text-muted">กรุณาติดต่อร้านเพื่อขอใบเสนอราคาฉบับใหม่</p>
            </div>
          </CardContent>
        </Card>
      ) : actionable ? (
        <>
          {(accept.error || reject.error) && (
            <Alert variant="error">
              {accept.error?.message || reject.error?.message}
            </Alert>
          )}
          {!showReject ? (
            // แถวปุ่มคู่ท้ายหน้าตามต้นแบบ (ต้นแบบติดขอบล่างด้วยเงา — เงาต้องมาจากชุดกลาง ดู sharedFileRequests)
            <ActionZone note="ตรวจรายการและราคาให้ครบก่อนกดรับ กดรับแล้วร้านจะเปิดออเดอร์ให้ทันที · ถ้ายังไม่ตกลงให้กดขอแก้ไข">
              <Button
                variant="outline"
                onClick={() => setShowReject(true)}
                disabled={isPending}
                className="flex-1"
              >
                ขอแก้ไข
              </Button>
              <Button
                onClick={() => accept.mutate({ token })}
                disabled={isPending}
                className="flex-1"
              >
                {accept.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                รับราคานี้
              </Button>
            </ActionZone>
          ) : (
            <Card>
              <CardContent className="space-y-3 p-4.5">
                <Field label="ส่วนที่ต้องการแก้ไข (ไม่บังคับ)">
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="เช่น ขอลดจำนวน / ปรับราคา / เปลี่ยนแบบ ..."
                    disabled={isPending}
                  />
                </Field>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => setShowReject(false)}
                    disabled={isPending}
                    className="flex-1"
                  >
                    ย้อนกลับ
                  </Button>
                  <Button
                    onClick={() => reject.mutate({ token, reason: reason.trim() || undefined })}
                    disabled={isPending}
                    className="flex-1"
                  >
                    {reject.isPending ? <Loader2 className="animate-spin" /> : null}
                    ส่งคำขอแก้ไข
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </PublicPageShell>
  );
}
