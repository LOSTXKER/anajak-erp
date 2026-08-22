"use client";

import { trpc } from "@/lib/trpc";
import { formatDate, isImageUrl } from "@/lib/utils";
import { ARTWORK_POSITION_LABELS } from "@/lib/artwork";
import { PRINT_TYPES } from "@/types/order-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLinkError } from "@/components/public-link-error";
import {
  PublicPageShell,
  FullScreenLoading,
} from "@/components/public/public-page";
import { Shirt, CalendarClock, Paperclip, Palette, FileText } from "lucide-react";
import { FOCUS_BUTTON, INTERACTIVE_HOVER, INTERACTIVE_PRESSED, TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

// หน้าใบงานสำหรับร้านนอก (Gate B14 — LINE-friendly ไม่พิมพ์กระดาษ)
// เปิดผ่านลิงก์ token ไม่ต้อง login — โชว์เฉพาะสิ่งที่ร้านต้องใช้ทำงาน
// (sanitize ที่ server แล้ว: ไม่มีค่าจ้าง/ราคาขาย/ชื่อลูกค้า/สถานะภายใน)

export function JobShareView({ token }: { token: string }) {
  const job = trpc.outsourceShare.getByToken.useQuery({ token });

  if (job.isLoading) {
    return <FullScreenLoading />;
  }

  if (job.error || !job.data) {
    return <PublicLinkError message="ลิงก์ใบงานอาจไม่ถูกต้องหรือหมดอายุแล้ว" contactLabel="ติดต่อผู้ส่งงาน" onRetry={() => void job.refetch()} />;
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

  return (
    <PublicPageShell
      icon={<Shirt />}
      title="ใบงานผลิต"
      subtitle={`สำหรับ ${d.vendorName} · อ้างอิง ${d.orderNumber}`}
      footer="เปิดจากลิงก์ที่ได้รับเท่านั้น — หากข้อมูลไม่ตรงกับที่คุยไว้ กรุณาติดต่อผู้ส่งงาน"
    >

        {/* งาน + จำนวน + กำหนดส่งคืน */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="text-lg font-semibold text-strong">{d.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(TINT.neutral, "rounded-lg border p-3 text-center")}>
                <p className="text-2xl font-semibold tabular-nums text-strong">{d.quantity}</p>
                <p className="text-xs text-muted">จำนวน (ชิ้น)</p>
              </div>
              <div className={cn(TINT.neutral, "rounded-lg border p-3 text-center")}>
                <p className="flex items-center justify-center gap-1.5 text-lg font-semibold text-strong">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  {d.expectedBackAt ? formatDate(d.expectedBackAt) : "—"}
                </p>
                <p className="text-xs text-muted">กำหนดส่งคืน</p>
              </div>
            </div>
            <div className="grid gap-1.5 text-sm">
              {d.sentAt && (
                <div className="flex justify-between">
                  <span className="text-muted">ส่งของให้ร้าน</span>
                  <span className="font-medium text-strong">{formatDate(d.sentAt)}</span>
                </div>
              )}
              {d.notes && (
                <div className={cn(TINT.neutral, "rounded-lg border p-3")}>
                  <span className="font-medium">หมายเหตุ:</span> {d.notes}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ลาย: ไฟล์แนบ + แบบอนุมัติ + สเปคพิมพ์ */}
        {(d.attachments.length > 0 || d.approvedDesign || prints.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4 text-muted" />
                ลาย / ไฟล์งาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {(attachmentImages.length > 0 || designIsImage) && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {attachmentImages.map((a) => (
                    <a key={a.id} href={a.fileUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                      <img
                        src={a.fileUrl ?? ""}
                        alt={a.fileName}
                        className="h-36 w-full rounded-lg border border-border bg-surface object-contain"
                      />
                      <p className="mt-1 truncate text-2xs text-muted">{a.fileName}</p>
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
                      <p className="mt-1 truncate text-2xs text-muted">
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
                        className={cn("flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-blue-600", INTERACTIVE_HOVER, INTERACTIVE_PRESSED, FOCUS_BUTTON)}
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
                        className={cn("flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-blue-600", INTERACTIVE_HOVER, INTERACTIVE_PRESSED, FOCUS_BUTTON)}
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
                  <p className="text-xs font-medium text-muted">สเปคพิมพ์</p>
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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="font-medium">
                          {ARTWORK_POSITION_LABELS[pr.position] ?? pr.position}
                        </span>
                        <span>{PRINT_TYPES[pr.printType] ?? pr.printType}</span>
                        {pr.printSize && <span>ขนาด {pr.printSize}</span>}
                        {pr.width && pr.height && (
                          <span>
                            {pr.width}×{pr.height} ซม.
                          </span>
                        )}
                        {pr.colorCount != null && <span>{pr.colorCount} สี</span>}
                        {pr.designNote && (
                          <span className="w-full text-xs text-muted">{pr.designNote}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ตารางไซซ์ */}
        {d.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted" />
                ตารางไซซ์
                <span className="font-normal text-muted">
                  (ทั้งออเดอร์ {d.orderTotalQuantity} ชิ้น)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {/* ตาราง/สเปคเป็นของทั้งออเดอร์ — ใบ outsource ผูกกับขั้นตอนผลิต ไม่ได้แยกรายชิ้น
                  (งานที่ส่งหลายร้าน/แบ่งรอบ ให้ยึดที่ตกลงในแชทเป็นหลัก) */}
              <p className={cn(TINT.neutral, "rounded-lg border p-3 text-xs")}>
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
                        <p className="mb-1 text-xs text-muted">{p.description}</p>
                      )}
                      {p.variants.length > 0 && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-divider text-left text-xs text-muted">
                              <th className="py-1.5 pr-2 font-medium">ไซซ์</th>
                              <th className="py-1.5 pr-2 font-medium">สี</th>
                              <th className="py-1.5 text-right font-medium">จำนวน</th>
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
    </PublicPageShell>
  );
}
