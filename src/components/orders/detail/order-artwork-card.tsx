"use client";

import { useState } from "react";
import { ArrowRight, FileText, ImageOff, Palette, Shirt, StickyNote, Tag, Type, Upload } from "lucide-react";
import { c, CardHead, MockupPill, Prop, SubHead } from "@/components/orders/orders-ui";
import { MockupThumbRow } from "@/components/mockup/mockup-thumb-row";
import { trpc } from "@/lib/trpc";
import { layerForCategory } from "@/lib/file-layers";
import { mockupCoverImage, mockupImageCount, type MockupVersionLike } from "@/lib/mockup";
import { formatDateCompact } from "@/lib/utils";

/** เท่าที่การ์ดนี้ใช้จริงจาก DesignVersion — รูปทั้งชุดอ่านผ่านสูตรกลางใน lib/mockup */
export type ArtworkVersion = MockupVersionLike & {
  versionNumber: number;
  approvalStatus: string;
  approvedAt: Date | string | null;
  createdAt: Date | string;
};

export interface ArtworkBrand {
  brandName: string;
  logoUrl?: string | null;
  colorCodes: string[];
  fonts: string[];
  styleNotes: string | null;
}

/* ============================================================
   การ์ด "ม็อกอัพ & ไฟล์" คอลัมน์ขวาของภาพรวม — ต้นแบบ tabOverview() ส่วน right (รื้อ 2026-09-15)

   รูปม็อกอัพใหญ่ + สถานะอนุมัติที่หัวการ์ด → วันที่ส่ง/อนุมัติ → จำนวนไฟล์แต่ละชั้น → รายละเอียดงาน/แบรนด์ (มีหัวข้อทุกช่อง)
   เป็น **ที่ดู ไม่ใช่ที่จัดการ** (กติกา 08-22): อัป/อนุมัติ/ลบไฟล์อยู่แท็บ "ม็อกอัพ & ไฟล์" ที่เดียว
   ปุ่มในการ์ดนี้แค่พาไปแท็บนั้น · query ใช้ key เดียวกับแท็บไฟล์ react-query จึงไม่ยิงซ้ำ
   ============================================================ */

export function OrderArtworkCard({
  orderId,
  description,
  orderType,
  brand,
  onOpenFiles,
}: {
  orderId: string;
  description: string | null;
  orderType?: string;
  brand?: ArtworkBrand | null;
  onOpenFiles?: () => void;
}) {
  const designs = trpc.design.listByOrder.useQuery({ orderId });
  const attachments = trpc.attachment.listByEntity.useQuery({ entityType: "ORDER", entityId: orderId });
  const [now] = useState(() => new Date());

  const files = attachments.data ?? [];
  const rawCount = files.filter((file: { category?: string | null }) => layerForCategory(file.category) !== "PRINT").length;

  return (
    <OrderArtworkCardView
      latest={designs.data?.[0] ?? null}
      versionCount={designs.data?.length ?? 0}
      rawCount={rawCount}
      printCount={files.length - rawCount}
      description={description}
      orderType={orderType}
      brand={brand}
      onOpenFiles={onOpenFiles}
      now={now}
      // โหลดยังไม่เสร็จ = ยังไม่รู้ว่ามีม็อกอัพไหม · โครงร่างดีกว่ากระพริบ "ยังไม่มีม็อกอัพ"
      isLoading={designs.isLoading || attachments.isLoading}
    />
  );
}

/** ตัวที่วาดจริง — ไม่ยิง query เอง เอาไปวางในหน้าลอง/ด่านตรวจด้วยข้อมูลนิ่งได้ */
export function OrderArtworkCardView({
  latest,
  versionCount,
  rawCount,
  printCount,
  description,
  orderType,
  brand,
  onOpenFiles,
  isLoading = false,
  now,
}: {
  latest: ArtworkVersion | null;
  versionCount: number;
  rawCount: number;
  printCount: number;
  description: string | null;
  orderType?: string;
  brand?: ArtworkBrand | null;
  onOpenFiles?: () => void;
  isLoading?: boolean;
  /** เวลาที่ใช้นับ "รอลูกค้าตรวจกี่วัน" */
  now?: Date;
}) {
  const cover = latest ? mockupCoverImage(latest) : null;
  const imageCount = latest ? mockupImageCount(latest) : 0;
  const isCustom = orderType === undefined || orderType === "CUSTOM";
  const brief = description?.trim() || null;
  const counts = [
    { key: "mockup", label: "ม็อกอัพ", value: versionCount, unit: "เวอร์ชัน" },
    { key: "raw", label: "ไฟล์ลูกค้า", value: rawCount, unit: null },
    { key: "print", label: "ไฟล์พิมพ์", value: printCount, unit: null },
  ];

  return (
    <section className={c("card")} aria-labelledby="ov-art" data-order-overview-card="artwork">
      <CardHead
        icon={Shirt}
        tone="violet"
        id="ov-art"
        title="ม็อกอัพ & ไฟล์"
        right={isLoading ? undefined : <MockupPill design={latest} now={now ?? new Date(latest?.createdAt ?? 0)} />}
      />
      <div className={c("cb")}>
        {isLoading ? (
          <span className={c("sk")} style={{ aspectRatio: "4 / 3" }} />
        ) : latest ? (
          <>
            <div className={c("canvas")}>
              <span className={c("ver chip gray")}>v{latest.versionNumber}</span>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={`ม็อกอัพ v${latest.versionNumber}`} loading="lazy" decoding="async" />
              ) : (
                <div className={c("e")}>
                  <ImageOff aria-hidden="true" />
                  <span>เวอร์ชันนี้ไม่มีรูปตัวอย่าง</span>
                </div>
              )}
            </div>
            {imageCount > 1 ? (
              <div className={c("vers")}>
                <MockupThumbRow version={latest} versionNumber={latest.versionNumber} size="sm" />
              </div>
            ) : null}
            <div className={c("caption")}>
              <span>
                ส่งให้ลูกค้าดู {formatDateCompact(latest.createdAt)}
                {latest.approvedAt ? ` · อนุมัติ ${formatDateCompact(latest.approvedAt)}` : ""}
              </span>
              {onOpenFiles ? (
                <button type="button" className={c("btn ghost sm")} onClick={onOpenFiles}>
                  เปิดม็อกอัพ
                  <ArrowRight aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className={c("canvas")}>
            <div className={c("e")}>
              <ImageOff aria-hidden="true" />
              <span>ยังไม่มีม็อกอัพ</span>
              {!isCustom ? (
                <small>งานสำเร็จรูป ไม่ต้องมีแบบ</small>
              ) : rawCount > 0 ? (
                <small>มีไฟล์จากลูกค้า {rawCount} ไฟล์รออยู่</small>
              ) : null}
              {isCustom && onOpenFiles ? (
                <button type="button" className={c("btn sm")} onClick={onOpenFiles}>
                  <Upload aria-hidden="true" />
                  อัปม็อกอัพ
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* จำนวนไฟล์แต่ละชั้น — กดแล้วไปแท็บที่จัดการได้จริง */}
        {!isLoading ? (
          <div className={c("fcount")}>
            {counts.map((count) => {
              const body = (
                <>
                  {count.label}
                  <b>
                    {count.value.toLocaleString("th-TH")}
                    {count.unit ? <small>{count.unit}</small> : null}
                    {count.key === "print" && orderType === "CUSTOM" ? (
                      <span className={c("chip", count.value > 0 ? "good" : "warn")}>
                        {count.value > 0 ? "พร้อมผลิต" : "ยังไม่มี"}
                      </span>
                    ) : null}
                  </b>
                </>
              );
              return onOpenFiles ? (
                <button key={count.key} type="button" onClick={onOpenFiles}>
                  {body}
                </button>
              ) : (
                <button key={count.key} type="button" disabled>
                  {body}
                </button>
              );
            })}
          </div>
        ) : null}

        {brief || brand ? (
          <>
            <div className={c("hr")} />
            <SubHead icon={FileText} tone="violet" title="รายละเอียดงาน" />
            {/* ทุกช่องมีหัวข้อ (เบส 09-15) — ช่องที่ไม่มีค่าไม่ขึ้น */}
            <dl className={c("props top")}>
              {brief ? (
                <Prop icon={FileText} label="ชื่องาน" wide>
                  {brief}
                </Prop>
              ) : null}
              {brand ? (
                <Prop icon={Tag} label="แบรนด์">
                  {brand.brandName}
                  {brand.logoUrl ? (
                    <>
                      {" "}
                      <a href={brand.logoUrl} target="_blank" rel="noopener noreferrer" className={c("chip line")}>
                        เปิดไฟล์โลโก้
                      </a>
                    </>
                  ) : null}
                </Prop>
              ) : null}
              {brand && brand.colorCodes.length > 0 ? (
                <Prop icon={Palette} label="สีแบรนด์">
                  <span className={c("sws")}>
                    {brand.colorCodes.map((code) => (
                      <span key={code} className={c("sw")} style={{ background: code }} title={code} aria-label={`สี ${code}`} role="img" />
                    ))}
                  </span>
                </Prop>
              ) : null}
              {brand && brand.fonts.length > 0 ? (
                <Prop icon={Type} label="ฟอนต์">
                  {brand.fonts.join(", ")}
                </Prop>
              ) : null}
              {brand?.styleNotes ? (
                <Prop icon={StickyNote} label="หมายเหตุสไตล์" wide>
                  {brand.styleNotes}
                </Prop>
              ) : null}
            </dl>
          </>
        ) : null}
      </div>
    </section>
  );
}
