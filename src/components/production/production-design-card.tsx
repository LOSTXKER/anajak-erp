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
import { DASHED, FOCUS_BUTTON, RADIUS, TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

// ข้อมูลอ้างอิง “แบบและจำนวนที่ต้องผลิต” บน job traveler — ช่างเห็นลายอนุมัติ+เวอร์ชัน+ตารางไซส์
// โดยไม่ต้องออกจากหน้า/พึ่งใบกระดาษ job ticket · ไม่มีตัวเลขเงินบน component นี้
// ข้อมูลทั้งหมดมาจาก production.getById ที่ select ราย field (ไม่มี unitPrice ติดมา)
export function ProductionDesignCard({
  order,
  embedded = false,
  missingApprovalIsReference = false,
}: {
  order: ProductionDetail["order"];
  /** วางข้าง action ใน work workspace โดยไม่สร้าง card ซ้อน */
  embedded?: boolean;
  /** งานพิมพ์ผ่านไปแล้ว: ไม่มีไฟล์อนุมัติเป็นข้อมูลกำกับ ไม่ใช่ blocker ของขั้นปัจจุบัน */
  missingApprovalIsReference?: boolean;
}) {
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
    <section
      className={cn(
        embedded ? "space-y-3" : "card-surface space-y-4 p-4 sm:p-5",
        !embedded && RADIUS.surface,
      )}
      aria-labelledby="production-work-spec"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Palette className="h-4 w-4 text-muted" />
        <h3 id="production-work-spec" className="text-sm font-semibold text-strong">
          แบบและสเปกงาน
        </h3>
        {approvedDesign && (
          <Badge variant="success" size="sm">
            อนุมัติ v{approvedDesign.versionNumber}
          </Badge>
        )}
      </div>

      {/* แบบอนุมัติล่าสุด — แตะขยายเต็มจอ · ไม่มีแบบอนุมัติ = บอกตรงๆ (B8 ห้ามจอเงียบ) */}
      {approvedDesign ? (
        <div className="flex flex-wrap items-start gap-3 border-t border-divider pt-3">
          {approvedImage ? (
            <button
              type="button"
              onClick={() => setZoom({ src: approvedImage, label: `แบบอนุมัติ v${approvedDesign.versionNumber}` })}
              className={cn(
                RADIUS.inner,
                FOCUS_BUTTON,
                "shrink-0 overflow-hidden border border-border transition-opacity hover:opacity-90",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={approvedImage}
                alt={`แบบอนุมัติ v${approvedDesign.versionNumber}`}
                loading="lazy"
                decoding="async"
                className={cn(
                  "bg-white object-contain",
                  embedded ? "h-24 w-24 sm:h-28 sm:w-28" : "h-32 w-32 sm:h-40 sm:w-40",
                )}
              />
            </button>
          ) : (
            <div
              className={cn(
                DASHED,
                RADIUS.inner,
                "flex shrink-0 flex-col items-center justify-center gap-1.5 text-muted",
                embedded ? "h-24 w-24 sm:h-28 sm:w-28" : "h-32 w-32 sm:h-40 sm:w-40",
              )}
            >
              <ImageOff className="h-5 w-5" />
              <span className="text-xs">ไฟล์ไม่ใช่รูป</span>
            </div>
          )}
          <div className="min-w-0 space-y-1 text-sm">
            <p className="font-medium text-strong">
              แบบอนุมัติล่าสุด — เวอร์ชัน {approvedDesign.versionNumber}
            </p>
            {approvedDesign.approvedAt && (
              <p className="text-xs text-muted">
                อนุมัติ {formatDate(approvedDesign.approvedAt)}
              </p>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={approvedDesign.fileUrl} target="_blank" rel="noreferrer">
                <ExternalLink />
                เปิดไฟล์เต็ม
              </a>
            </Button>
          </div>
        </div>
      ) : (
        prints.length > 0 && (
          <p
            className={cn(
              "text-xs font-medium",
              missingApprovalIsReference
                ? "border-t border-divider pt-3 text-muted"
                : cn(TINT.warning, RADIUS.inner, "border px-3 py-2"),
            )}
          >
            {missingApprovalIsReference
              ? "ไม่พบไฟล์แบบอนุมัติในใบนี้ · ขั้นพิมพ์เสร็จแล้ว ข้อมูลด้านล่างใช้เป็นข้อมูลอ้างอิงและไม่บล็อกขั้นปัจจุบัน"
              : "ไม่พบไฟล์แบบอนุมัติในใบนี้ — เช็กกับแอดมินก่อนเริ่มพิมพ์"}
          </p>
        )
      )}

      {/* ลายพิมพ์ต่อตำแหน่ง — ภาพ+ตำแหน่ง+วิธี+ขนาด (ข้อมูลเดียวกับใบ job ticket) */}
      {prints.length > 0 && (
        <div className="space-y-2 border-t border-divider pt-3">
          <p className="text-xs font-medium text-muted">
            ลายพิมพ์
          </p>
          <ul
            className={cn(
              embedded ? "divide-y divide-divider" : "grid gap-2 sm:grid-cols-2",
            )}
          >
            {prints.map((pr) => (
              <li
                key={pr.id}
                className={cn(
                  "flex items-center gap-3",
                  embedded ? "py-2.5 first:pt-0 last:pb-0" : cn(RADIUS.inner, "border border-border p-3"),
                )}
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
                    className={cn(
                      RADIUS.item,
                      FOCUS_BUTTON,
                      "shrink-0 overflow-hidden border border-border transition-opacity hover:opacity-90",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pr.designImageUrl!}
                      alt={`ลาย ${PRINT_POSITIONS[pr.position] ?? pr.position}`}
                      loading="lazy"
                      decoding="async"
                      className="h-14 w-14 bg-white object-contain"
                    />
                  </button>
                ) : (
                  <div
                    className={cn(
                      DASHED,
                      RADIUS.item,
                      "flex h-14 w-14 shrink-0 items-center justify-center text-muted",
                    )}
                  >
                    <ImageOff className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-strong">
                    {PRINT_POSITIONS[pr.position] ?? pr.position}
                    <span className="ml-1.5 font-normal text-muted">
                      {PRINT_TYPES[pr.printType] ?? pr.printType}
                    </span>
                  </p>
                  <p className="text-muted">
                    {pr.width && pr.height
                      ? `${pr.width} × ${pr.height} ซม.`
                      : (pr.printSize ?? "ไม่ระบุขนาด")}
                    {pr.colorCount ? ` · ${pr.colorCount} สี` : ""}
                  </p>
                  {pr.designNote && (
                    <p className="truncate text-muted">{pr.designNote}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ตารางไซส์ต่อสินค้า — ข้อมูลห่อบรรทัดเอง อ่านบนมือถือได้โดยไม่ดูเหมือนปุ่ม */}
      {productsWithSizes.length > 0 && (
        <div className="space-y-2.5 border-t border-divider pt-3">
          <p className="text-xs font-medium text-muted">
            ไซส์
          </p>
          {productsWithSizes.map((p) => (
            <div key={p.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-secondary">
                  {p.description}
                  {p.fabricColor ? ` · สี ${p.fabricColor}` : ""}
                </p>
                <p className="text-sm tabular-nums text-strong">
                  <span className="text-muted">รวม</span>{" "}
                  <span className="font-semibold">{p.totalQuantity} ตัว</span>
                </p>
              </div>
              <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-sm tabular-nums">
                {p.variants.map((v) => (
                  <div key={v.id} className="inline-flex items-baseline gap-1.5">
                    <dt className="text-muted">
                      {v.size}
                      {v.color ? ` ${v.color}` : ""}
                    </dt>
                    <dd className="font-semibold text-strong">×{v.quantity}</dd>
                  </div>
                ))}
              </dl>
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
              className={cn(RADIUS.item, "max-h-[72vh] w-full bg-white object-contain")}
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
    </section>
  );
}
