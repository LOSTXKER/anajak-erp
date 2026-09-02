"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RADIUS, SUNK_PANEL, TINT } from "@/components/ui/tokens";
import { MockupGallery } from "@/components/mockup/mockup-gallery";
import { cn, formatDate } from "@/lib/utils";
import { mockupImageCount } from "@/lib/mockup";
import { PRINT_POSITIONS, PRINT_TYPES } from "@/types/order-form";
import { Flame, MessageSquare, Shirt } from "lucide-react";
import type { ProductionDetail } from "./types";

// แท็บม็อกอัพฝั่งฝ่ายผลิต — อ่านอย่างเดียวล้วน ไม่มีอัป/อนุมัติ/ลิงก์ลูกค้า/เงิน
// (การจัดการม็อกอัพมีบ้านเดียวคือหน้าออเดอร์ · ที่นี่คือ "ดูให้ทำถูก")
//
// ตอบสองคำถามที่ช่างถามหน้าเครื่อง: ลายหน้าตายังไงครบทุกด้าน และรีดที่กี่องศากี่วินาที
// สเปกรีดมาจากคลังลาย (CustomerArtwork) ที่กรอกครั้งเดียวต่อลาย ไม่ต้องกรอกซ้ำทุกออเดอร์

type OrderDesign = ProductionDetail["order"]["designs"][number];
type OrderPrint = ProductionDetail["order"]["items"][number]["prints"][number];

function heatSpecText(artwork: OrderPrint["artwork"]): string | null {
  if (!artwork) return null;
  const parts: string[] = [];
  if (artwork.heatTempC != null) parts.push(`${artwork.heatTempC}°C`);
  if (artwork.heatPressSec != null) parts.push(`${artwork.heatPressSec} วิ`);
  if (artwork.heatPressure) parts.push(`แรง${artwork.heatPressure}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function HeatSpecList({ prints }: { prints: readonly OrderPrint[] }) {
  const rows = prints
    .map((print) => ({ print, spec: heatSpecText(print.artwork) }))
    .filter((row) => row.spec !== null);

  // ไม่มีสเปกรีดสักลาย = ไม่ขึ้นหัวข้อเปล่า · งานที่ไม่ใช่งานรีดก็ไม่ต้องมีส่วนนี้
  if (rows.length === 0) return null;

  return (
    <section className={cn("p-3", SUNK_PANEL, RADIUS.inner)}>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-strong">
        <Flame className="h-4 w-4" />
        สเปกรีด
      </h3>
      <ul className="space-y-1.5">
        {rows.map(({ print, spec }) => (
          <li key={print.id} className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">
              {PRINT_POSITIONS[print.position] ?? print.position}
            </Badge>
            <span className="text-muted">
              {PRINT_TYPES[print.printType] ?? print.printType}
            </span>
            <span className="font-medium tabular-nums text-strong">{spec}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        ค่าจากคลังลายของลูกค้า — แก้ได้ที่ลายนั้นเพื่อให้ทุกออเดอร์ถัดไปตรงกัน
      </p>
    </section>
  );
}

export function ProductionMockupTab({ order }: { order: ProductionDetail["order"] }) {
  const designs = order.designs ?? [];
  const prints = order.items.flatMap((item) => item.prints);
  const [latest, ...older] = designs as readonly OrderDesign[];

  if (!latest) {
    return (
      <div className="space-y-5">
        <EmptyState
          icon={Shirt}
          title="ยังไม่มีม็อกอัพที่ลูกค้าอนุมัติ"
          description="งานนี้อ้างอิงจากลายและสเปกด้านล่าง หรือสอบถามฝ่ายขายก่อนลงมือถ้าไม่แน่ใจ"
        />
        <HeatSpecList prints={prints} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-strong">
            ม็อกอัพที่อนุมัติ — เวอร์ชัน {latest.versionNumber}
          </h3>
          <Badge variant="success">อนุมัติแล้ว</Badge>
          <span className="text-xs text-muted">
            {mockupImageCount(latest)} รูป
            {latest.approvedAt ? ` · ${formatDate(latest.approvedAt)}` : ""}
          </span>
        </div>

        <MockupGallery version={latest} versionNumber={latest.versionNumber} />

        {latest.designerNotes ? (
          <p className="mt-3 text-xs text-muted">{latest.designerNotes}</p>
        ) : null}
        {latest.customerComment ? (
          <p
            className={cn(
              "mt-3 flex items-start gap-1.5 border p-2 text-xs",
              TINT.warning,
              RADIUS.item,
            )}
          >
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{latest.customerComment}</span>
          </p>
        ) : null}
      </section>

      <HeatSpecList prints={prints} />

      {/* เวอร์ชันก่อนหน้าเก็บไว้ตรวจย้อน — ยุบเป็นรายการเล็กเพราะของที่ต้องทำตามคือรุ่นล่าสุด
          ถ้ากางเท่ากันหมดช่างมีโอกาสหยิบรุ่นเก่าไปพิมพ์ */}
      {older.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-medium text-strong">เวอร์ชันก่อนหน้า</h3>
          <ul className="space-y-3">
            {older.map((design) => (
              <li key={design.id} className={cn("p-3", SUNK_PANEL, RADIUS.inner)}>
                <p className="mb-2 text-xs text-muted">
                  เวอร์ชัน {design.versionNumber}
                  {design.approvedAt ? ` · ${formatDate(design.approvedAt)}` : ""}
                </p>
                <MockupGallery
                  version={design}
                  versionNumber={design.versionNumber}
                  columns="compact"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
