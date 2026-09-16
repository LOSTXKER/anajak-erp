"use client";

import { trpc } from "@/lib/trpc";
import { formatDate, isImageUrl } from "@/lib/utils";
import { ARTWORK_POSITION_LABELS } from "@/lib/artwork";
import { PRINT_TYPES } from "@/types/order-form";
import { c, Prop } from "@/components/kit/kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLinkError } from "@/components/public-link-error";
import {
  PublicPageShell,
  FullScreenLoading,
} from "@/components/public/public-page";
import { Shirt, Paperclip, Palette, FileText, PenTool, AlertTriangle, CalendarClock } from "lucide-react";
import { StatusLabel, type StatusTone } from "@/components/ui/status-label";
import { dueTagContent } from "@/components/ui/due-tag";
import { InfoChip, InfoChipRow, type InfoChipTone } from "@/components/ui/info-chip";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { FOCUS_BUTTON, INTERACTIVE_HOVER, INTERACTIVE_PRESSED, TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

// หน้าใบงานสำหรับร้านนอก (Gate B14 — LINE-friendly ไม่พิมพ์กระดาษ)
// เปิดผ่านลิงก์ token ไม่ต้อง login — โชว์เฉพาะสิ่งที่ร้านต้องใช้ทำงาน
// (sanitize ที่ server แล้ว: ไม่มีค่าจ้าง/ราคาขาย/ชื่อลูกค้า/สถานะภายใน)

/** โทนของชิปกำหนดส่ง → โทนของป้ายสถานะ (ป้ายซ้ายกับชิปขวาต้องหนักเท่ากัน) */
const STATUS_TONE_OF: Record<InfoChipTone, StatusTone> = {
  neutral: "neutral",
  info: "accent",
  warning: "warning",
  error: "danger",
  success: "success",
};

export function JobShareView({ token }: { token: string }) {
  const job = trpc.outsourceShare.getByToken.useQuery({ token });

  if (job.isLoading) {
    return <FullScreenLoading />;
  }

  if (job.error || !job.data) {
    return <PublicLinkError error={job.error} message="ลิงก์ใบงานอาจไม่ถูกต้องหรือหมดอายุแล้ว" contactLabel="ติดต่อผู้ส่งงาน" onRetry={() => void job.refetch()} />;
  }

  const d = job.data;
  const partialBatch = d.quantity !== d.orderTotalQuantity;
  const prints = d.items.flatMap((it) => it.prints);
  const attachmentImages = d.attachments.filter((a) => isImageUrl(a.fileUrl ?? ""));
  const attachmentFiles = d.attachments.filter((a) => !isImageUrl(a.fileUrl ?? ""));
  const design = d.approvedDesign;
  const designIsImage = !!design && isImageUrl(design.imageUrl ?? "");
  // แบบอนุมัติที่ไม่ใช่รูป (เช่น .pdf ไม่มี thumbnail) — โชว์เป็นลิงก์ไฟล์ ไม่ให้หายเงียบ
  const designFileOnly = !!design && !designIsImage && !!(design.fileUrl || design.imageUrl);
  const dueInDays = differenceInBangkokDays(d.expectedBackAt, job.dataUpdatedAt);
  // คำบอกความรีบมาจากชุดกลาง (พูดว่า "เลยกำหนด/ส่งวันนี้") — ชิปข้าง ๆ เป็นตัวบอกว่าคือวันนัดรับ
  const due = dueTagContent(dueInDays);

  return (
    <PublicPageShell
      icon={<Shirt />}
      pageLabel="ใบงานร้านนอก"
      brandNote="สำหรับร้านที่รับงานไปทำ"
      title={`${d.description} ${d.quantity.toLocaleString("th-TH")} ชิ้น`}
      subtitle={<span className="tabular-nums">อ้างอิง {d.orderNumber} · {d.vendorName}</span>}
      footer="ลิงก์นี้เห็นเฉพาะใบงานนี้ ไม่เห็นราคาและข้อมูลลูกค้า — หากข้อมูลไม่ตรงกับที่คุยไว้ กรุณาติดต่อผู้ส่งงาน"
    >
        {/* สรุปใบงาน (ต้นแบบ: แถวสถานะนัดรับ → ของที่ส่งไป / งานที่ต้องทำ / ข้อควรระวัง) */}
        <Card>
          <CardContent className="space-y-3.5 pt-4.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusLabel label={due.text} tone={STATUS_TONE_OF[due.tone]} emphasize className="text-sm" />
              <InfoChip icon={CalendarClock} tone={due.tone} strong={due.strong}>
                {d.expectedBackAt ? `นัดรับ ${formatDate(d.expectedBackAt)}` : "ยังไม่นัดวันรับ"}
              </InfoChip>
            </div>
            <dl className={c("props one")}>
              <Prop icon={Shirt} label="ของที่ส่งไป">
                {d.quantity.toLocaleString("th-TH")} ชิ้น
                {partialBatch && (
                  <small>จากทั้งออเดอร์ {d.orderTotalQuantity.toLocaleString("th-TH")} ชิ้น · ดูตารางไซซ์ด้านล่าง</small>
                )}
                {d.sentAt && <small>ส่งของให้ร้าน {formatDate(d.sentAt)}</small>}
              </Prop>
              <Prop icon={PenTool} label="งานที่ต้องทำ" none={prints.length === 0}>
                {prints.length > 0
                  ? prints.map((pr, i) => (
                      <span key={i} className="block">
                        {ARTWORK_POSITION_LABELS[pr.position] ?? pr.position} · {PRINT_TYPES[pr.printType] ?? pr.printType}
                        {pr.colorCount != null ? ` ${pr.colorCount} สี` : ""}
                        {pr.width && pr.height ? ` ${pr.width}×${pr.height} ซม.` : pr.printSize ? ` ขนาด ${pr.printSize}` : ""}
                      </span>
                    ))
                  : "ดูไฟล์ลายและรายละเอียดด้านล่าง"}
              </Prop>
              <Prop icon={AlertTriangle} label="ข้อควรระวัง" none={!d.notes}>
                {d.notes || "ไม่มีข้อควรระวังเพิ่มเติม — ทำตามสเปคด้านล่างได้เลย"}
              </Prop>
            </dl>
          </CardContent>
        </Card>

        {/* ของที่ส่งไป: ตารางไซซ์ */}
        {d.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted" />
                ตารางไซซ์
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ตาราง/สเปคเป็นของทั้งออเดอร์ — ใบ outsource ผูกกับขั้นตอนผลิต ไม่ได้แยกรายชิ้น
                  (งานที่ส่งหลายร้าน/แบ่งรอบ ให้ยึดที่ตกลงในแชทเป็นหลัก) */}
              <p className={cn(TINT.neutral, "rounded-lg border p-3 text-sm")}>
                {partialBatch
                  ? `รอบนี้ส่ง ${d.quantity} ชิ้น จากทั้งออเดอร์ ${d.orderTotalQuantity} ชิ้น — `
                  : ""}
                ตาราง/สเปคด้านล่างเป็นของทั้งออเดอร์ งานที่ต้องทำจริงยึดที่ตกลงกันในแชท
              </p>
              {d.items.map((it, i) => (
                <div key={i} className="space-y-2">
                  {it.description && (
                    <p className="text-sm font-medium text-strong">
                      {it.description}
                      <span className="ml-1 font-normal text-muted">
                        ({it.totalQuantity} ชิ้น)
                      </span>
                    </p>
                  )}
                  {it.products.map((p, j) => (
                    <div key={j} className="overflow-x-auto">
                      {p.description && (
                        <p className="mb-1 text-sm text-muted">{p.description}</p>
                      )}
                      {p.variants.length > 0 && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-divider text-left text-sm text-muted">
                              <th scope="col" className="py-1.5 pr-2 font-medium">ไซซ์</th>
                              <th scope="col" className="py-1.5 pr-2 font-medium">สี</th>
                              <th scope="col" className="py-1.5 text-right font-medium">จำนวน</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.variants.map((v, k) => (
                              <tr key={k} className="border-b border-divider">
                                <td className="py-1.5 pr-2 font-medium text-strong">{v.size}</td>
                                <td className="py-1.5 pr-2 text-secondary">{v.color ?? "—"}</td>
                                <td className="py-1.5 text-right tabular-nums text-strong">
                                  {v.quantity}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* งานที่ต้องทำ: ไฟล์แนบ + แบบอนุมัติ + สเปคพิมพ์รายจุด */}
        {(d.attachments.length > 0 || d.approvedDesign || prints.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4 text-muted" />
                ลาย / ไฟล์งาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(attachmentImages.length > 0 || designIsImage) && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {attachmentImages.map((a) => (
                    <a key={a.id} href={a.fileUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                      <img
                        src={a.fileUrl ?? ""}
                        alt={a.fileName}
                        className="h-36 w-full rounded-lg border border-border bg-surface object-contain"
                      />
                      <p className="mt-1 truncate text-sm text-muted">{a.fileName}</p>
                    </a>
                  ))}
                  {designIsImage && design && (
                    <a
                      href={design.fileUrl ?? design.imageUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={design.imageUrl ?? ""}
                        alt={`แบบ v${design.versionNumber}`}
                        className="h-36 w-full rounded-lg border border-border bg-surface object-contain"
                      />
                      <p className="mt-1 truncate text-sm text-muted">
                        แบบที่อนุมัติ (v{design.versionNumber})
                      </p>
                    </a>
                  )}
                </div>
              )}

              {(attachmentFiles.length > 0 || designFileOnly) && (
                <ul className="space-y-1.5">
                  {designFileOnly && design && (
                    <li>
                      <a
                        href={design.fileUrl ?? design.imageUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-secondary", INTERACTIVE_HOVER, INTERACTIVE_PRESSED, FOCUS_BUTTON)}
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate">แบบที่อนุมัติ (v{design.versionNumber})</span>
                      </a>
                    </li>
                  )}
                  {attachmentFiles.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.fileUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-secondary", INTERACTIVE_HOVER, INTERACTIVE_PRESSED, FOCUS_BUTTON)}
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate">{a.fileName}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {prints.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-secondary">สเปคพิมพ์</p>
                  {prints.map((pr, i) => (
                    <div
                      key={i}
                      className={cn(TINT.neutral, "flex gap-3 rounded-lg border p-3 text-sm")}
                    >
                      {/* รูปลายรายจุดพิมพ์ — งานหลายจุด ร้านแยกออกว่าลายไหนตำแหน่งไหน */}
                      {pr.designImageUrl && isImageUrl(pr.designImageUrl) && (
                        <a
                          href={pr.designImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <img
                            src={pr.designImageUrl}
                            alt={ARTWORK_POSITION_LABELS[pr.position] ?? pr.position}
                            className="h-16 w-16 rounded border border-border bg-surface object-contain"
                          />
                        </a>
                      )}
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="font-medium text-strong">
                          {ARTWORK_POSITION_LABELS[pr.position] ?? pr.position}
                        </p>
                        <InfoChipRow>
                          <InfoChip size="sm">{PRINT_TYPES[pr.printType] ?? pr.printType}</InfoChip>
                          {pr.printSize && <InfoChip size="sm">ขนาด {pr.printSize}</InfoChip>}
                          {pr.width && pr.height && (
                          <InfoChip size="sm">
                            {pr.width}×{pr.height} ซม.
                          </InfoChip>
                        )}
                          {pr.colorCount != null && <InfoChip size="sm">{pr.colorCount} สี</InfoChip>}
                        </InfoChipRow>
                        {pr.designNote && (
                          <p className="break-words text-sm text-secondary [overflow-wrap:anywhere]">{pr.designNote}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
    </PublicPageShell>
  );
}
