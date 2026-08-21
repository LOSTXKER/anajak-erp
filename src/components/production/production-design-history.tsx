"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { History, ExternalLink, ImageOff } from "lucide-react";
import { isImageUrl, formatDate } from "@/lib/utils";
import { DASHED, FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import type { ProductionDetail } from "./types";

/* ============================================================
   ประวัติและเทียบรุ่นม็อกอัพ (mockup v2 §4)

   แหล่งข้อมูล = DesignVersion ที่อนุมัติแล้วของออเดอร์ (getById select เฉพาะ
   field ปลอดเงิน) · รุ่นแรกสุดของลิสต์คือรุ่นที่ใช้งาน รุ่นที่เหลือเก็บถาวร
   ดูย้อนได้แต่ไม่ใช่ของที่จะพิมพ์ — กันหน้างานหยิบไฟล์เก่าจากแชทมาใช้
   ============================================================ */

export type ProductionDesignVersionLike = {
  versionNumber: number;
  fileUrl: string;
  thumbnailUrl: string | null;
  approvedAt: Date | string | null;
  customerComment: string | null;
};

function VersionImage({
  version,
  label,
  onZoom,
  className,
}: {
  version: ProductionDesignVersionLike;
  label: string;
  onZoom: (src: string, label: string) => void;
  className?: string;
}) {
  const image = [version.thumbnailUrl, version.fileUrl].find(isImageUrl) ?? null;
  if (!image) {
    return (
      <div
        className={cn(
          DASHED,
          RADIUS.inner,
          "flex aspect-square w-full items-center justify-center text-muted",
          className,
        )}
        aria-label={`${label} — ไฟล์ไม่ใช่รูป`}
      >
        <ImageOff className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onZoom(image, label)}
      className={cn(
        RADIUS.inner,
        FOCUS_BUTTON,
        "overflow-hidden border border-border bg-white transition-opacity hover:opacity-90",
        className,
      )}
      aria-label={`ขยาย${label}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={label}
        loading="lazy"
        decoding="async"
        className="aspect-square w-full object-contain"
      />
    </button>
  );
}

export function ProductionDesignHistory({
  designs,
}: {
  designs: readonly ProductionDesignVersionLike[] | ProductionDetail["order"]["designs"];
}) {
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);
  if (designs.length === 0) return null;

  const versions = [...designs].sort((a, b) => b.versionNumber - a.versionNumber);
  const [current, previous] = versions;

  return (
    <section
      className="card-surface space-y-4 p-4 sm:p-5"
      aria-labelledby="production-design-history"
    >
      <div className="flex flex-wrap items-center gap-2">
        <History className="h-4 w-4 text-muted" aria-hidden="true" />
        <h3
          id="production-design-history"
          className="text-sm font-semibold text-strong"
        >
          ประวัติรุ่นแบบที่อนุมัติ
        </h3>
        <Badge variant="success" size="sm">
          v{current.versionNumber} ใช้งาน
        </Badge>
      </div>

      {/* เทียบสองรุ่นล่าสุด — เห็นทันทีว่ารุ่นที่ใช้ต่างจากก่อนหน้าตรงไหน */}
      {previous ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { version: previous, badge: "ก่อนหน้า · เก็บถาวร", variant: "default" as const },
            { version: current, badge: "ใช้งาน", variant: "success" as const },
          ].map(({ version, badge, variant }) => (
            <div
              key={version.versionNumber}
              className={cn(
                RADIUS.inner,
                "border p-3",
                variant === "success" ? "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30" : "border-border",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-strong">
                  v{version.versionNumber}
                  {version.approvedAt ? (
                    <span className="ml-1.5 font-normal text-muted">
                      อนุมัติ {formatDate(version.approvedAt)}
                    </span>
                  ) : null}
                </p>
                <Badge variant={variant} size="sm">{badge}</Badge>
              </div>
              <VersionImage
                version={version}
                label={`แบบอนุมัติ v${version.versionNumber}`}
                onZoom={(src, label) => setZoom({ src, label })}
              />
              {version.customerComment ? (
                <p className="mt-2 line-clamp-2 text-xs text-muted">
                  {version.customerComment}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* ทุกรุ่นที่อนุมัติ — ไล่ย้อนและเปิดไฟล์ต้นฉบับได้ */}
      <ul className="divide-y divide-divider">
        {versions.map((version) => (
          <li key={version.versionNumber} className="flex items-center gap-3 py-2.5">
            <VersionImage
              version={version}
              label={`แบบอนุมัติ v${version.versionNumber}`}
              onZoom={(src, label) => setZoom({ src, label })}
              className="h-10 w-10 shrink-0 border-border"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-strong">
                เวอร์ชัน {version.versionNumber}
              </p>
              <p className="text-xs text-muted">
                {version.approvedAt
                  ? `อนุมัติ ${formatDate(version.approvedAt)}`
                  : "ไม่ระบุวันอนุมัติ"}
              </p>
            </div>
            {version.versionNumber === current.versionNumber ? (
              <Badge variant="success" size="sm">ใช้งาน</Badge>
            ) : (
              <Badge size="sm">เก็บถาวร</Badge>
            )}
            <Button variant="ghost" size="sm" asChild>
              <a
                href={version.fileUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`เปิดไฟล์เวอร์ชัน ${version.versionNumber}`}
              >
                <ExternalLink />
              </a>
            </Button>
          </li>
        ))}
      </ul>

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
