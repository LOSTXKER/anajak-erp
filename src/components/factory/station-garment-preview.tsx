"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InfoChip, InfoChipRow } from "@/components/ui/info-chip";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOCUS_INSET_ON_LIGHT, RADIUS, TINT } from "@/components/ui/tokens";
import { formatDate, isImageUrl } from "@/lib/utils";
import { PRINT_POSITIONS, PRINT_TYPES } from "@/types/order-form";
import { cn } from "@/lib/utils";
import { ExternalLink, ImageOff, Package, Shirt } from "lucide-react";

export interface StationPreviewDesign {
  versionNumber: number;
  fileUrl: string;
  thumbnailUrl: string | null;
  approvedAt: Date | null;
  /** รูปทั้งชุดของม็อกอัพเวอร์ชันนี้ (หน้า/หลัง/แขน) — ว่าง = เวอร์ชันเก่าที่มีแค่รูปปก */
  files?: readonly {
    fileUrl: string;
    thumbnailUrl?: string | null;
    position?: string | null;
    caption?: string | null;
  }[];
}

export interface StationPreviewPrint {
  id?: string;
  position: string;
  printType: string;
  printSize: string | null;
  width: number | null;
  height: number | null;
  colorCount?: number | null;
  note: string | null;
  imageUrl: string | null;
  /** สเปกรีดจากคลังลายลูกค้า (CustomerArtwork) — มีเมื่อลายถูก promote แล้ว (mockup v2) */
  heat?: {
    tempC: number | null;
    pressSec: number | null;
    pressure: string | null;
  } | null;
}

export interface StationGarmentLine {
  id?: string;
  product: string;
  size: string | null;
  color: string | null;
  quantity: number;
}

export interface StationPreviewWorkGroup {
  id?: string;
  garmentLines: readonly StationGarmentLine[];
  prints: readonly StationPreviewPrint[];
  showShirtDiagram: boolean;
}

const DATA_IMAGE_URL =
  /^data:image\/(?:png|jpe?g|webp|gif|avif|svg\+xml)(?:;[^,]*)?,/i;

/**
 * Station demo ใช้ data:image/svg+xml แต่ global isImageUrl ตั้งใจกำกับไฟล์ปกติ
 * จึงเปิด data URL เฉพาะชนิดภาพที่ browser แสดงใน <img> ได้ และไม่เปลี่ยนกติกาทั้งระบบ
 */
export function isStationPreviewImageUrl(
  url: string | null | undefined,
): url is string {
  return Boolean(url && (isImageUrl(url) || DATA_IMAGE_URL.test(url)));
}

const POSITION_SIDES = {
  FRONT: { sideLabel: "ด้านหน้า" },
  BACK: { sideLabel: "ด้านหลัง" },
  SLEEVE_L: { sideLabel: "แขนซ้ายของผู้สวม" },
  SLEEVE_R: { sideLabel: "แขนขวาของผู้สวม" },
  COLLAR: { sideLabel: "บริเวณปกเสื้อ" },
} as const;

export function stationSideForPosition(position: string) {
  return POSITION_SIDES[position as keyof typeof POSITION_SIDES] ?? null;
}

function printDimensionLabel(print: StationPreviewPrint) {
  if (
    print.width != null &&
    print.width > 0 &&
    print.height != null &&
    print.height > 0
  ) {
    return `${print.width} × ${print.height} ซม.`;
  }
  return print.printSize ?? "ไม่ระบุขนาด";
}

function GarmentPlacementDiagram({
  position,
  showShirtDiagram,
}: {
  position: string;
  showShirtDiagram: boolean;
}) {
  const side = stationSideForPosition(position);
  const positionLabel = PRINT_POSITIONS[position] ?? position;

  if (!showShirtDiagram) {
    return (
      <figure
        data-station-no-shirt-diagram=""
        className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-divider bg-surface-muted p-4 text-center"
      >
        <Package className="h-8 w-8 text-muted" aria-hidden="true" />
        <figcaption className="mt-3">
          <p className="font-semibold text-strong">{positionLabel}</p>
          <p className="mt-1 text-xs font-medium text-muted">
            สินค้านี้ไม่มีแผนภาพเสื้อที่ตรงชนิด
          </p>
          <p className="mt-1 text-xs text-muted">
            ดูไฟล์แบบ ขนาด และหมายเหตุ · ห้ามเทียบตำแหน่งกับทรงเสื้อ
          </p>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="flex h-full flex-col rounded-lg border border-divider bg-surface-muted p-3">
      <div
        className="relative mx-auto aspect-[4/3] w-full max-w-44 text-secondary"
        role="img"
        aria-label={
          side
            ? `แผนภาพเสื้อบอกเพียง${side.sideLabel} ไม่ระบุตำแหน่งย่อย`
            : `แผนภาพเสื้อที่ไม่เดาด้านสำหรับข้อมูล ${positionLabel}`
        }
      >
        <svg
          viewBox="0 0 240 180"
          className="h-full w-full"
          aria-hidden="true"
        >
          <path
            d="M91 22c7 9 17 14 29 14s22-5 29-14l32 16 35 37-24 22-20-18v75H68V79L48 97 24 75l35-37 32-16Z"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M91 22c5 20 53 20 58 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        {side ? (
          <span
            data-station-side-diagram={position}
            className={cn(
              TINT.info,
              "absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-md border px-3 py-2 text-center text-sm font-semibold",
            )}
            aria-hidden="true"
          >
            {side.sideLabel}
          </span>
        ) : null}
      </div>
      <figcaption className="mt-2 text-center">
        <p className="font-semibold text-strong">
          {side ? side.sideLabel : positionLabel}
        </p>
        <p className="mt-1 text-xs font-medium text-muted">
          แผนภาพบอกด้านเท่านั้น · ไม่ระบุตำแหน่งย่อย
        </p>
        <p className="mt-1 text-xs text-muted">
          {side
            ? "ยึดขนาดและหมายเหตุในใบงาน · ห้ามเดาจุดวางจากภาพนี้"
            : "ข้อมูลนี้บอกด้านไม่ได้ · ดูไฟล์แบบและหมายเหตุ ห้ามเดาตำแหน่ง"}
        </p>
      </figcaption>
    </figure>
  );
}

function ApprovedDesignReference({
  design,
  image,
  onZoom,
}: {
  design: StationPreviewDesign;
  image: string | null;
  onZoom: (image: { src: string; label: string }) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = `ม็อกอัพที่ลูกค้าอนุมัติ v${design.versionNumber}`;
  const showImage = Boolean(image && !imageFailed);
  // รูปเพิ่มเติมในชุดนอกจากรูปที่กางใหญ่อยู่ — ด้านหลัง/แขนที่ช่างต้องเห็นด้วย
  const extraImages: { src: string; sideLabel: string | null }[] = [];
  for (const file of design.files ?? []) {
    const src = isStationPreviewImageUrl(file.thumbnailUrl)
      ? file.thumbnailUrl
      : isStationPreviewImageUrl(file.fileUrl)
        ? file.fileUrl
        : null;
    if (!src || src === image) continue;
    extraImages.push({
      src,
      sideLabel: file.position
        ? (stationSideForPosition(file.position)?.sideLabel ?? null)
        : null,
    });
  }

  return (
    <section
      data-station-approved-reference=""
      className="overflow-hidden rounded-lg border border-border bg-surface"
      aria-labelledby="station-approved-reference-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4
            id="station-approved-reference-title"
            className="text-base font-semibold text-strong"
          >
            ม็อกอัพอนุมัติสำหรับเปิดเทียบ
          </h4>
          {/* เลขเวอร์ชันเป็นค่าอ่านอย่างเดียว ไม่ใช่สถานะ — ชิปสงวนให้สถานะ (UI-2026) */}
          <span className="text-sm font-medium tabular-nums text-muted">
            v{design.versionNumber}
          </span>
        </div>
        {design.approvedAt ? (
          <p className="text-xs text-muted">
            อนุมัติ {formatDate(design.approvedAt)}
          </p>
        ) : null}
      </div>

      <p
        className={cn(
          TINT.warning,
          "border-b px-4 py-2 text-xs font-medium sm:px-5",
        )}
      >
        ใช้เทียบหน้าตางานที่ลูกค้าตกลง · ขนาดและจุดวางยึดตัวเลขในใบงาน ห้ามวางตำแหน่งจากภาพนี้
      </p>

      {showImage && image ? (
        <button
          type="button"
          data-station-approved-reference-image=""
          onClick={() => onZoom({ src: image, label })}
          className={cn(FOCUS_INSET_ON_LIGHT, "group flex min-h-48 w-full items-center justify-center bg-white p-3 sm:min-h-56 sm:p-4")}
          aria-label={`ขยาย${label}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={label}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="max-h-56 w-full object-contain transition-opacity group-hover:opacity-90"
          />
        </button>
      ) : (
        <div
          data-station-approved-image-error={imageFailed ? "" : undefined}
          className="flex min-h-52 flex-col items-center justify-center gap-2 bg-surface-muted px-5 py-8 text-center"
        >
          <ImageOff className="h-7 w-7 text-muted" aria-hidden="true" />
          <p className="font-medium text-strong">
            {imageFailed
              ? "โหลดภาพแบบอนุมัติไม่ได้"
              : "แบบอนุมัติเป็นไฟล์ที่จอนี้แสดงภาพไม่ได้"}
          </p>
          <p className="max-w-md text-sm text-muted">
            เปิดไฟล์เต็มเพื่อดูไฟล์ที่อนุมัติก่อนลงมือ · ห้ามเดาจากภาพเก่าหรือรูปลายแยก
          </p>
        </div>
      )}

      {/* ด้านอื่นในชุดเดียวกัน — งานพิมพ์หน้า+หลังต้องเห็นครบ ไม่งั้นช่างทำเฉพาะด้านที่เห็น */}
      {extraImages.length > 0 ? (
        <ul
          data-station-approved-reference-extra=""
          className="flex flex-wrap gap-3 border-t border-divider px-4 py-3 sm:px-5"
        >
          {extraImages.map((item, index) => (
            <li key={`${item.src}-${index}`}>
              <button
                type="button"
                onClick={() =>
                  onZoom({
                    src: item.src,
                    label: item.sideLabel ? `${label} — ${item.sideLabel}` : label,
                  })
                }
                className={cn(FOCUS_INSET_ON_LIGHT, "block overflow-hidden rounded-lg border border-border bg-white")}
                aria-label={`ขยาย${label}${item.sideLabel ? ` ${item.sideLabel}` : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.src}
                  alt={item.sideLabel ? `${label} ${item.sideLabel}` : label}
                  loading="lazy"
                  decoding="async"
                  className="h-20 w-20 object-contain"
                />
                {item.sideLabel ? (
                  <span className="block bg-surface-muted px-1 py-0.5 text-xs text-secondary">
                    {item.sideLabel}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3 sm:px-5">
        <p className="text-xs text-muted">
          {showImage ? "แตะเพื่อขยายไฟล์อ้างอิง" : "เปิดไฟล์เพื่อตรวจข้อมูลอ้างอิง"}
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={design.fileUrl} target="_blank" rel="noreferrer">
            <ExternalLink />
            เปิดไฟล์เต็ม
          </a>
        </Button>
      </div>
    </section>
  );
}

export function stationHeatLabel(heat: StationPreviewPrint["heat"]): string | null {
  if (!heat) return null;
  const parts: string[] = [];
  if (heat.tempC != null) parts.push(`${heat.tempC}°C`);
  if (heat.pressSec != null) parts.push(`${heat.pressSec} วิ`);
  if (heat.pressure) parts.push(heat.pressure);
  return parts.length > 0 ? `รีด ${parts.join(" · ")}` : null;
}

function StationPrintRow({
  print,
  workLabel,
  showShirtDiagram,
  onZoom,
}: {
  print: StationPreviewPrint;
  workLabel: string;
  showShirtDiagram: boolean;
  onZoom: (image: { src: string; label: string }) => void;
}) {
  const [artImageFailed, setArtImageFailed] = useState(false);
  const positionLabel = PRINT_POSITIONS[print.position] ?? print.position;
  const typeLabel = PRINT_TYPES[print.printType] ?? print.printType;
  const artImage = isStationPreviewImageUrl(print.imageUrl)
    ? print.imageUrl
    : null;
  const heatLabel = stationHeatLabel(print.heat);

  return (
    <li className="space-y-4 px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="text-xl font-semibold text-strong">{positionLabel}</h5>
          <p className="mt-1 text-sm text-secondary">{typeLabel}</p>
          <p className="mt-1 text-xs font-medium text-muted">ใช้กับ {workLabel}</p>
        </div>
        <div className="text-right">
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-base font-semibold tabular-nums text-strong">
            {printDimensionLabel(print)}
            {print.colorCount ? ` · ${print.colorCount} สี` : ""}
          </p>
          {heatLabel ? (
            <p
              data-station-heat-spec=""
              className="mt-1.5 text-sm font-semibold tabular-nums text-secondary"
            >
              {heatLabel}
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4",
          artImage ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        {artImage ? (
          <figure className="flex h-full flex-col overflow-hidden rounded-lg border border-divider bg-surface-muted">
            {artImageFailed ? (
              <div
                data-station-art-image-error=""
                className="flex min-h-36 flex-1 flex-col items-center justify-center gap-2 px-3 py-5 text-center"
              >
                <ImageOff className="h-6 w-6 text-muted" aria-hidden="true" />
                <p className="text-sm font-medium text-strong">
                  โหลดรูปลายไม่ได้
                </p>
                <p className="text-xs text-muted">
                  ดูแบบอนุมัติและหมายเหตุ · ห้ามเดาลาย
                </p>
              </div>
            ) : (
              <button
                type="button"
                data-station-standalone-art=""
                onClick={() =>
                  onZoom({
                    src: artImage,
                    label: `รูปลายแยก · ${positionLabel} · ${workLabel}`,
                  })
                }
                className={cn(FOCUS_INSET_ON_LIGHT, "flex min-h-36 flex-1 items-center justify-center bg-white p-3")}
                aria-label={`ขยายรูปลายแยก ${positionLabel} สำหรับ ${workLabel}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={artImage}
                  alt={`รูปลายแยก ${positionLabel} สำหรับ ${workLabel}`}
                  loading="lazy"
                  decoding="async"
                  onError={() => setArtImageFailed(true)}
                  className="max-h-44 w-full object-contain"
                />
              </button>
            )}
            <figcaption className="border-t border-divider px-3 py-2 text-center text-xs font-medium text-muted">
              รูปลายแยกในใบงาน · ไม่ใช่ภาพวางบนเสื้อ
            </figcaption>
          </figure>
        ) : null}
        <GarmentPlacementDiagram
          position={print.position}
          showShirtDiagram={showShirtDiagram}
        />
      </div>

      {print.note ? (
        <div className={cn(TINT.info, RADIUS.inner, "border px-4 py-3")}>
          <p className="text-xs font-medium">หมายเหตุจากใบงาน</p>
          <p className="mt-1 text-base font-semibold">{print.note}</p>
        </div>
      ) : null}
    </li>
  );
}

function StationGarmentSummary({
  garmentLines,
  showHeading = true,
  headingId = "station-garment-summary-title",
  itemNoun = "เสื้อ",
}: {
  garmentLines: readonly StationGarmentLine[];
  showHeading?: boolean;
  headingId?: string;
  itemNoun?: "เสื้อ" | "สินค้า";
}) {
  if (garmentLines.length === 0) return null;

  return (
    <section
      aria-labelledby={showHeading ? headingId : undefined}
      aria-label={showHeading ? undefined : `รายการ${itemNoun}`}
    >
      {showHeading ? (
        <h4
          id={headingId}
          className="flex items-center gap-2 text-lg font-semibold text-strong"
        >
          {itemNoun === "เสื้อ" ? (
            <Shirt className="h-5 w-5 text-blue-500" aria-hidden="true" />
          ) : (
            <Package className="h-5 w-5 text-blue-500" aria-hidden="true" />
          )}
          {itemNoun} ไซส์ และจำนวน
        </h4>
      ) : null}
      <div
        className={cn(
          "divide-y divide-divider overflow-hidden rounded-lg border border-border bg-surface",
          showHeading && "mt-3",
        )}
      >
        {garmentLines.map((line, index) => (
          <div
            key={
              line.id ??
              `${line.product}|${line.size ?? ""}|${line.color ?? ""}|${index}`
            }
            className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-5"
          >
            <div className="min-w-0">
              <p className="font-semibold text-strong">{line.product}</p>
              <InfoChipRow className="mt-1">
                {line.size ? <InfoChip size="sm">ไซส์ {line.size}</InfoChip> : null}
                {line.color ? <InfoChip size="sm">สี {line.color}</InfoChip> : null}
                {!line.size && !line.color ? <InfoChip size="sm">ไม่ระบุไซส์/สี</InfoChip> : null}
              </InfoChipRow>
            </div>
            <p className="text-lg font-semibold tabular-nums text-strong">
              ×{line.quantity}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function stationWorkLabel(
  group: StationPreviewWorkGroup,
  index: number,
) {
  const products = Array.from(
    new Set(
      group.garmentLines.map((line) =>
        [line.product, line.color].filter(Boolean).join(" · "),
      ),
    ),
  ).filter(Boolean);

  return products.join(" + ") || `รายการที่ ${index + 1}`;
}

function StationWorkGroupSection({
  group,
  index,
  total,
  onZoom,
  showGarmentHeading = true,
}: {
  group: StationPreviewWorkGroup;
  index: number;
  total: number;
  onZoom: (image: { src: string; label: string }) => void;
  showGarmentHeading?: boolean;
}) {
  const workLabel = stationWorkLabel(group, index);
  const groupKey = group.id ?? `group-${index + 1}`;

  return (
    <section
      data-station-work-group={groupKey}
      aria-labelledby={`station-work-group-${groupKey}`}
      className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      <header>
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-300">
          {total > 1
            ? `รายการที่ ${index + 1} จาก ${total}`
            : group.showShirtDiagram
              ? "ทำกับเสื้อนี้"
              : "ทำกับสินค้านี้"}
        </p>
        <h4
          id={`station-work-group-${groupKey}`}
          className="mt-1 text-lg font-semibold text-strong"
        >
          {workLabel}
        </h4>
      </header>

      {group.prints.length > 0 ? (
        <section aria-label={`จุดที่ต้องทำสำหรับ ${workLabel}`}>
          <h5 className="text-base font-semibold text-strong">จุดที่ต้องทำ</h5>
          <ul className="mt-3 divide-y divide-divider overflow-hidden rounded-lg border border-border bg-surface">
            {group.prints.map((print, printIndex) => (
              <StationPrintRow
                key={`${print.id ?? `${print.position}|${print.printType}|${printIndex}`}|${print.imageUrl ?? ""}`}
                print={print}
                workLabel={workLabel}
                showShirtDiagram={group.showShirtDiagram}
                onZoom={onZoom}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <StationGarmentSummary
        garmentLines={group.garmentLines}
        showHeading={showGarmentHeading}
        headingId={`station-garment-summary-${groupKey}`}
        itemNoun={group.showShirtDiagram ? "เสื้อ" : "สินค้า"}
      />
    </section>
  );
}

export function StationGarmentPreview({
  approvedDesign,
  workGroups,
  embedded = false,
  missingApprovalIsReference = false,
}: {
  approvedDesign: StationPreviewDesign | null;
  workGroups: readonly StationPreviewWorkGroup[];
  embedded?: boolean;
  missingApprovalIsReference?: boolean;
}) {
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);
  const approvedImage = approvedDesign
    ? ([approvedDesign.thumbnailUrl, approvedDesign.fileUrl].find(
        isStationPreviewImageUrl,
      ) ?? null)
    : null;
  const visibleGroups = workGroups.filter(
    (group) => group.garmentLines.length > 0 || group.prints.length > 0,
  );
  const totalPrints = visibleGroups.reduce(
    (total, group) => total + group.prints.length,
    0,
  );
  const productOnly = !approvedDesign && totalPrints === 0;
  const allGroupsUseShirtDiagram =
    visibleGroups.length > 0 &&
    visibleGroups.every((group) => group.showShirtDiagram);

  return (
    <section
      data-station-garment-preview=""
      className={cn(
        "space-y-5",
        embedded ? "" : "card-surface p-4 sm:p-5",
        !embedded && RADIUS.surface,
      )}
      aria-labelledby="station-work-visual-title"
    >
      <h3
        id="station-work-visual-title"
        className="flex items-center gap-2 text-xl font-semibold text-strong"
      >
        {allGroupsUseShirtDiagram ? (
          <Shirt className="h-6 w-6 text-blue-500" aria-hidden="true" />
        ) : (
          <Package className="h-6 w-6 text-blue-500" aria-hidden="true" />
        )}
        {productOnly
          ? `${allGroupsUseShirtDiagram ? "เสื้อ" : "สินค้า"} ไซส์ และจำนวน`
          : "แบบและจุดที่ต้องทำ"}
      </h3>

      {productOnly ? (
        <div className="space-y-4">
          {visibleGroups.map((group, index) => (
            <StationWorkGroupSection
              key={group.id ?? `group-${index + 1}`}
              group={group}
              index={index}
              total={visibleGroups.length}
              onZoom={setZoom}
              showGarmentHeading={false}
            />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <div className="min-w-0 space-y-4">
            {visibleGroups.map((group, index) => (
              <StationWorkGroupSection
                key={group.id ?? `group-${index + 1}`}
                group={group}
                index={index}
                total={visibleGroups.length}
                onZoom={setZoom}
              />
            ))}
          </div>

          <div className="min-w-0">
            {approvedDesign ? (
              <ApprovedDesignReference
                key={`${approvedDesign.versionNumber}|${approvedImage ?? approvedDesign.fileUrl}`}
                design={approvedDesign}
                image={approvedImage}
                onZoom={setZoom}
              />
            ) : totalPrints > 0 ? (
              <p
                className={cn(
                  "border px-4 py-3 text-sm font-medium",
                  RADIUS.inner,
                  missingApprovalIsReference ? TINT.neutral : TINT.warning,
                )}
              >
                {missingApprovalIsReference
                  ? "ไม่พบไฟล์แบบอนุมัติในใบนี้ · ใช้ข้อมูลด้านล่างเป็นข้อมูลอ้างอิงเท่านั้น"
                  : "ยังไม่มีแบบที่ลูกค้าอนุมัติ · ห้ามเริ่มจากรูปลายแยกหรือแผนผังด้านล่าง"}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <Dialog open={!!zoom} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-[96vw] p-3 sm:max-w-4xl sm:p-4">
          <DialogTitle className="pr-8 text-base">{zoom?.label}</DialogTitle>
          {zoom ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={zoom.src}
              alt={zoom.label}
              className={cn(
                RADIUS.item,
                "max-h-[76vh] w-full bg-white object-contain",
              )}
            />
          ) : null}
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
