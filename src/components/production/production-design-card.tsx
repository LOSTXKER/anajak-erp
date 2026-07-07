"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRINT_POSITIONS, PRINT_TYPES } from "@/types/order-form";
import { isImageUrl, formatDate } from "@/lib/utils";
import { Palette, ExternalLink, ImageOff } from "lucide-react";
import type { ProductionDetail } from "./types";

// การ์ด "แบบ + ไซส์" บนหน้าใบผลิต (UX1) — ช่างเห็นลายอนุมัติ+เวอร์ชัน+ตารางไซส์
// โดยไม่ต้องออกจากหน้า/พึ่งใบกระดาษ job ticket · ไม่มีตัวเลขเงินบน component นี้
// ข้อมูลทั้งหมดมาจาก production.getById ที่ select ราย field (ไม่มี unitPrice ติดมา)
export function ProductionDesignCard({ order }: { order: ProductionDetail["order"] }) {
  // รูปที่กดขยายเต็มจอ — ลายอนุมัติหรือภาพลายพิมพ์ต่อตำแหน่งก็ได้
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);

  const approvedDesign = order.designs[0] ?? null;
  const approvedImage = approvedDesign
    ? ([approvedDesign.thumbnailUrl, approvedDesign.fileUrl].find(isImageUrl) ?? null)
    : null;

  const prints = order.items.flatMap((it) => it.prints);
  const productsWithSizes = order.items.flatMap((it) =>
    it.products.filter((p) => p.variants.length > 0)
  );

  // ไม่มีอะไรให้โชว์เลย (งานไม่มีลาย+ไม่มีไซส์ เช่นงานบริการล้วน) — ไม่ render การ์ดเปล่า
  if (!approvedDesign && prints.length === 0 && productsWithSizes.length === 0) {
    return null;
  }

  return (
    <div className="card-surface space-y-4 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">แบบ + ไซส์</h2>
        {approvedDesign && (
          <Badge variant="success" size="sm">
            อนุมัติ v{approvedDesign.versionNumber}
          </Badge>
        )}
      </div>

      {/* แบบอนุมัติล่าสุด — แตะขยายเต็มจอ · ไม่มีแบบอนุมัติ = บอกตรงๆ (B8 ห้ามจอเงียบ) */}
      {approvedDesign ? (
        <div className="flex flex-wrap items-start gap-3">
          {approvedImage ? (
            <button
              type="button"
              onClick={() => setZoom({ src: approvedImage, label: `แบบอนุมัติ v${approvedDesign.versionNumber}` })}
              className="shrink-0 overflow-hidden rounded-xl border border-slate-200 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={approvedImage}
                alt={`แบบอนุมัติ v${approvedDesign.versionNumber}`}
                className="h-32 w-32 bg-white object-contain sm:h-40 sm:w-40"
              />
            </button>
          ) : (
            <div className="flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 text-slate-400 dark:border-slate-700">
              <ImageOff className="h-5 w-5" />
              <span className="text-[11px]">ไฟล์ไม่ใช่รูป</span>
            </div>
          )}
          <div className="min-w-0 space-y-1 text-sm">
            <p className="font-medium text-slate-900 dark:text-white">
              แบบอนุมัติล่าสุด — เวอร์ชัน {approvedDesign.versionNumber}
            </p>
            {approvedDesign.approvedAt && (
              <p className="text-xs text-slate-500">
                อนุมัติ {formatDate(approvedDesign.approvedAt)}
              </p>
            )}
            <p className="text-xs text-slate-400">แตะรูปเพื่อขยาย · กันพิมพ์ผิดเวอร์ชัน</p>
            <Button variant="outline" size="sm" asChild className="h-9">
              <a href={approvedDesign.fileUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                เปิดไฟล์เต็ม
              </a>
            </Button>
          </div>
        </div>
      ) : (
        prints.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            ยังไม่มีแบบที่ลูกค้าอนุมัติ — เช็คกับแอดมินก่อนพิมพ์
          </p>
        )
      )}

      {/* ลายพิมพ์ต่อตำแหน่ง — ภาพ+ตำแหน่ง+วิธี+ขนาด (ข้อมูลเดียวกับใบ job ticket) */}
      {prints.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            ลายพิมพ์
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {prints.map((pr) => (
              <div
                key={pr.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700"
              >
                {isImageUrl(pr.designImageUrl) ? (
                  <button
                    type="button"
                    onClick={() =>
                      setZoom({
                        src: pr.designImageUrl!,
                        label: PRINT_POSITIONS[pr.position] ?? pr.position,
                      })
                    }
                    className="shrink-0 overflow-hidden rounded-lg border border-slate-200 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pr.designImageUrl!}
                      alt={`ลาย ${PRINT_POSITIONS[pr.position] ?? pr.position}`}
                      className="h-14 w-14 bg-white object-contain"
                    />
                  </button>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300 dark:border-slate-700">
                    <ImageOff className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {PRINT_POSITIONS[pr.position] ?? pr.position}
                    <span className="ml-1.5 font-normal text-slate-500">
                      {PRINT_TYPES[pr.printType] ?? pr.printType}
                    </span>
                  </p>
                  <p className="text-slate-500">
                    {pr.width && pr.height
                      ? `${pr.width} × ${pr.height} ซม.`
                      : (pr.printSize ?? "ไม่ระบุขนาด")}
                    {pr.colorCount ? ` · ${pr.colorCount} สี` : ""}
                  </p>
                  {pr.designNote && (
                    <p className="truncate text-slate-400">{pr.designNote}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ตารางไซส์ต่อสินค้า — chip ห่อบรรทัดเอง อ่านบนมือถือได้ไม่ต้อง scroll แนวนอน */}
      {productsWithSizes.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            ไซส์
          </p>
          {productsWithSizes.map((p) => (
            <div key={p.id} className="space-y-1.5">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {p.description}
                {p.fabricColor ? ` · สี ${p.fabricColor}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {p.variants.map((v) => (
                  <span
                    key={v.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm tabular-nums text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                  >
                    <span className="font-semibold">{v.size}</span>
                    {v.color ? <span className="text-slate-500"> {v.color}</span> : null}
                    <span className="font-bold"> ×{v.quantity}</span>
                  </span>
                ))}
                <span className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-sm font-bold tabular-nums text-white dark:bg-white dark:text-slate-900">
                  รวม {p.totalQuantity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* รูปขยายเต็มจอ — ช่างดูรายละเอียดลายหน้าเครื่องได้จริง */}
      <Dialog open={!!zoom} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-[96vw] p-3 sm:max-w-3xl sm:p-4">
          <DialogTitle className="pr-8 text-sm">{zoom?.label}</DialogTitle>
          {zoom && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={zoom.src}
              alt={zoom.label}
              className="max-h-[72vh] w-full rounded-lg bg-white object-contain"
            />
          )}
          {/* มือถือ: X ของ dialog เล็กเกินเป้านิ้ว — ให้ปุ่มปิดเต็มแถวแทน */}
          <Button
            variant="outline"
            className="h-11 w-full sm:hidden"
            onClick={() => setZoom(null)}
          >
            ปิด
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
