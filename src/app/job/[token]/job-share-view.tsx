"use client";

import { trpc } from "@/lib/trpc";
import { formatDate, isImageUrl } from "@/lib/utils";
import { ARTWORK_POSITION_LABELS } from "@/lib/artwork";
import { PRINT_TYPES } from "@/types/order-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  AlertCircle,
  Shirt,
  CalendarClock,
  Paperclip,
  Palette,
  FileText,
} from "lucide-react";

// หน้าใบงานสำหรับร้านนอก (Gate B14 — LINE-friendly ไม่พิมพ์กระดาษ)
// เปิดผ่านลิงก์ token ไม่ต้อง login — โชว์เฉพาะสิ่งที่ร้านต้องใช้ทำงาน
// (sanitize ที่ server แล้ว: ไม่มีค่าจ้าง/ราคาขาย/ชื่อลูกค้า/สถานะภายใน)

export function JobShareView({ token }: { token: string }) {
  const job = trpc.outsourceShare.getByToken.useQuery({ token });

  if (job.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      </div>
    );
  }

  if (job.error || !job.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h2 className="mb-2 text-lg font-semibold text-slate-900">เปิดลิงก์ไม่ได้</h2>
            <p className="text-sm text-slate-500">
              {job.error?.message ?? "ลิงก์อาจไม่ถูกต้องหรือหมดอายุแล้ว กรุณาติดต่อผู้ส่งงาน"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
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
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-2xl space-y-5 py-6">
        {/* Header */}
        <div className="text-center">
          <div className="mb-1 flex items-center justify-center gap-2">
            <Shirt className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">ใบงานผลิต</h1>
          </div>
          <p className="text-sm text-slate-500">
            สำหรับ {d.vendorName} · อ้างอิง {d.orderNumber}
          </p>
        </div>

        {/* งาน + จำนวน + กำหนดส่งคืน */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="text-lg font-semibold text-slate-900">{d.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-blue-700">{d.quantity}</p>
                <p className="text-xs text-slate-500">จำนวน (ชิ้น)</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="flex items-center justify-center gap-1.5 text-lg font-bold text-amber-700">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  {d.expectedBackAt ? formatDate(d.expectedBackAt) : "—"}
                </p>
                <p className="text-xs text-slate-500">กำหนดส่งคืน</p>
              </div>
            </div>
            <div className="grid gap-1.5 text-sm">
              {d.sentAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ส่งของให้ร้าน</span>
                  <span className="font-medium text-slate-800">{formatDate(d.sentAt)}</span>
                </div>
              )}
              {d.notes && (
                <div className="rounded-md bg-slate-100 p-2.5 text-slate-700">
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
                <Palette className="h-4 w-4 text-blue-600" />
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
                        className="h-36 w-full rounded-lg border border-slate-200 bg-white object-contain"
                      />
                      <p className="mt-1 truncate text-[11px] text-slate-400">{a.fileName}</p>
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
                        className="h-36 w-full rounded-lg border border-slate-200 bg-white object-contain"
                      />
                      <p className="mt-1 truncate text-[11px] text-slate-400">
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
                        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2.5 text-sm text-blue-600 hover:bg-slate-50"
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
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
                        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2.5 text-sm text-blue-600 hover:bg-slate-50"
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate">{a.fileName}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {prints.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">สเปคพิมพ์</p>
                  {prints.map((pr, i) => (
                    <div
                      key={i}
                      className="flex gap-3 rounded-md bg-slate-100 p-2.5 text-sm text-slate-700"
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
                            className="h-16 w-16 rounded border border-slate-200 bg-white object-contain"
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
                          <span className="w-full text-xs text-slate-500">{pr.designNote}</span>
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
                <FileText className="h-4 w-4 text-blue-600" />
                ตารางไซซ์
                <span className="font-normal text-slate-400">
                  (ทั้งออเดอร์ {d.orderTotalQuantity} ชิ้น)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {/* ตาราง/สเปคเป็นของทั้งออเดอร์ — ใบ outsource ผูกกับขั้นตอนผลิต ไม่ได้แยกรายชิ้น
                  (งานที่ส่งหลายร้าน/แบ่งรอบ ให้ยึดที่ตกลงในแชทเป็นหลัก) */}
              <p className="rounded-md bg-slate-100 p-2.5 text-xs text-slate-500">
                {partialBatch
                  ? `รอบนี้ส่ง ${d.quantity} ชิ้น จากทั้งออเดอร์ ${d.orderTotalQuantity} ชิ้น — `
                  : ""}
                ตาราง/สเปคด้านล่างเป็นของทั้งออเดอร์ งานที่ต้องทำจริงยึดที่ตกลงกันในแชท
              </p>
              {d.items.map((it, i) => (
                <div key={i} className="space-y-2">
                  {it.description && (
                    <p className="text-sm font-medium text-slate-800">
                      {it.description}
                      <span className="ml-1 font-normal text-slate-400">
                        ({it.totalQuantity} ชิ้น)
                      </span>
                    </p>
                  )}
                  {it.products.map((p, j) => (
                    <div key={j} className="overflow-x-auto">
                      {p.description && (
                        <p className="mb-1 text-xs text-slate-500">{p.description}</p>
                      )}
                      {p.variants.length > 0 && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                              <th className="py-1.5 pr-2 font-medium">ไซซ์</th>
                              <th className="py-1.5 pr-2 font-medium">สี</th>
                              <th className="py-1.5 text-right font-medium">จำนวน</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.variants.map((v, k) => (
                              <tr key={k} className="border-b border-slate-100">
                                <td className="py-1.5 pr-2 font-medium text-slate-800">{v.size}</td>
                                <td className="py-1.5 pr-2 text-slate-600">{v.color ?? "—"}</td>
                                <td className="py-1.5 text-right tabular-nums text-slate-800">
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

        <p className="pb-4 text-center text-xs text-slate-400">
          เปิดจากลิงก์ที่ได้รับเท่านั้น — หากข้อมูลไม่ตรงกับที่คุยไว้ กรุณาติดต่อผู้ส่งงาน
        </p>
      </div>
    </div>
  );
}
