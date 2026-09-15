"use client";

import { useState } from "react";
import { Calendar, Layers, Printer, Shirt } from "lucide-react";
import { OrderGoodsReceiptSection } from "@/components/goods-receipt/order-goods-receipt-section";
import { OrderMockupHandoff } from "@/components/mockup/mockup-handoff";
import { c, CardHead, DueTag, Rw } from "@/components/kit/kit";
import { ProductionSummaryCard } from "@/components/orders/production-summary-card";
import { OrderQcSection } from "@/components/qc/order-qc-section";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { layerForCategory } from "@/lib/file-layers";
import { getProductSourcePresentation } from "@/lib/order-item-composer";
import { sumOrderQuantity } from "@/lib/pricing";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { formatDateCompact } from "@/lib/utils";

/* ============================================================
   แท็บ "งานผลิต" — ต้นแบบ tabProduction() ทีละชิ้น (รื้อ 2026-09-15)

   หน้าออเดอร์เป็นที่ดูสรุป ตัวจัดการผลิตจริงอยู่ /production (เบสเคาะแยกโมดูล)
   ซ้าย: การ์ดงานผลิต + ของเข้า/ตรวจรับ (เฉพาะ flow เดิม)
   ขวา: ของที่ต้องพร้อมก่อนผลิต (ม็อกอัพ, ไฟล์พิมพ์, เสื้อ, กำหนดส่ง) + ตรวจนับ QC (เฉพาะ flow เดิม)
   เปิด Production V2 = ไม่วางรับของ/QC ในหน้านี้ (หลักฐานอยู่หน้าผลิต)
   แถวเสื้อใช้กติกาเดียวกับด่าน "ของครบ" ของ production-readiness: สต๊อกต้องจองได้, เสื้อลูกค้าต้องตรวจรับ, โรงเย็บไม่กั้น
   ============================================================ */

type Order = RouterOutput["order"]["getById"];
type RowTone = "good" | "warn" | "bad" | undefined;

export interface OrderProductionTabProps {
  orderId: string;
  order: Order;
  productionV2Enabled: boolean;
  /** permAllows(me.permissions, "supervise_operations") — เปิดใบผลิต */
  isManagerUp: boolean;
  /** permAllows(me.permissions, "manage_delivery") — บันทึกรับของ */
  canReceive: boolean;
  /** permAllows(me.permissions, "manage_production") — ตรวจนับ QC */
  canCount: boolean;
  /** ไปแท็บ "ม็อกอัพ & ไฟล์" */
  onOpenFiles: () => void;
}

const TONE_RANK = { good: 1, warn: 2, bad: 3 } as const;

function worse(current: RowTone, next: Exclude<RowTone, undefined>): RowTone {
  return !current || TONE_RANK[next] > TONE_RANK[current] ? next : current;
}

/** แถว "เสื้อ" — อ่านจากช่องจริงของออเดอร์ (จองสต๊อก/ตรวจรับเสื้อลูกค้า) ไม่เดาเพิ่ม */
function garmentStatus(order: Order): { tone: RowTone; sub: string; sources: string | null } {
  // getById คืน items เป็น union (ซ่อนเงิน/ไม่ซ่อน) — ระบุเฉพาะช่องที่ใช้ ไม่งั้น flatMap เสียชนิด
  const products = (order.items ?? []).flatMap(
    (item): { itemSource: string | null; receivedInspected: boolean }[] => item.products ?? [],
  );
  if (products.length === 0) return { tone: undefined, sub: "ยังไม่มีรายการสินค้า", sources: null };

  const sources = [
    ...new Set(products.map((p) => p.itemSource).filter((s): s is string => Boolean(s))),
  ];
  const parts: string[] = [];
  let tone: RowTone;

  if (sources.includes("FROM_STOCK")) {
    if (order.stockReservationError) {
      parts.push("จองสต๊อกไม่สำเร็จ");
      tone = worse(tone, "bad");
    } else if (order.stockReservedAt) {
      parts.push("จองสต๊อกแล้ว");
      tone = worse(tone, "good");
    } else {
      parts.push("ยังไม่จองสต๊อก");
      tone = worse(tone, "warn");
    }
  }

  const customerGarments = products.filter((p) => p.itemSource === "CUSTOMER_PROVIDED");
  if (customerGarments.length > 0) {
    const pending = customerGarments.filter((p) => !p.receivedInspected).length;
    if (pending > 0) {
      parts.push(`เสื้อลูกค้ายังไม่ตรวจรับ ${pending} รายการ`);
      tone = worse(tone, "warn");
    } else {
      parts.push("เสื้อลูกค้ารับครบแล้ว");
      tone = worse(tone, "good");
    }
  }

  return {
    // โรงเย็บ/ไม่ระบุแหล่งไม่กั้นการผลิต — ถือว่าพร้อม
    tone: tone ?? "good",
    sub: parts.length > 0 ? parts.join(" · ") : "ไม่มีของที่ต้องรอ",
    sources:
      sources.length > 0 ? sources.map((s) => getProductSourcePresentation(s).label).join(", ") : null,
  };
}

export function OrderProductionTab({
  orderId,
  order,
  productionV2Enabled,
  isManagerUp,
  canReceive,
  canCount,
  onOpenFiles,
}: OrderProductionTabProps) {
  const [now] = useState(() => new Date());
  // key เดียวกับการ์ดม็อกอัพ/แท็บไฟล์ — cache ร่วม ไม่ยิงเพิ่ม
  const attachments = trpc.attachment.listByEntity.useQuery({ entityType: "ORDER", entityId: orderId });
  const printFileCount = attachments.data
    ? attachments.data.filter(
        (file: { category?: string | null }) => layerForCategory(file.category) === "PRINT",
      ).length
    : null;

  const isCustom = order.orderType === "CUSTOM";
  const totalQuantity = sumOrderQuantity(order.items ?? []);
  const garment = garmentStatus(order);

  const printTone: RowTone =
    printFileCount === null ? undefined : printFileCount > 0 || !isCustom ? "good" : "warn";
  const printSub = attachments.isError
    ? "โหลดรายการไฟล์ไม่สำเร็จ"
    : printFileCount === null
      ? "กำลังโหลด…"
      : printFileCount > 0
        ? `${printFileCount.toLocaleString("th-TH")} ไฟล์ · พร้อมผลิต`
        : isCustom
          ? "ยังไม่มี"
          : "ไม่ต้องใช้";

  return (
    <div className={c("two")}>
      <div className={c("stack")}>
        {/* การ์ดสรุปอ่านอย่างเดียว — ตัวจัดการผลิตจริงอยู่ /production (เบสเคาะแยกโมดูล) */}
        <ProductionSummaryCard
          orderId={orderId}
          internalStatus={order.internalStatus}
          productions={order.productions ?? []}
          isManagerUp={isManagerUp}
          productionV2Enabled={productionV2Enabled}
          orderType={order.orderType}
          printFileCount={printFileCount}
          onOpenFiles={onOpenFiles}
        />
        {!productionV2Enabled ? (
          <OrderGoodsReceiptSection
            orderId={orderId}
            itemSources={(order.items ?? []).flatMap((it) =>
              (it.products ?? []).map((p) => p.itemSource).filter((s): s is string => s !== null),
            )}
            canReceive={canReceive}
          />
        ) : null}
      </div>

      <section className={c("card")} aria-labelledby="prod-ready-h">
        <CardHead icon={Layers} tone="violet" id="prod-ready-h" title="ของที่ต้องพร้อมก่อนผลิต" />
        <div className={c("cb")}>
          <div className={c("rows")}>
            <OrderMockupHandoff orderId={orderId} orderType={order.orderType} onOpenMockup={onOpenFiles} />
            <Rw onClick={onOpenFiles} icon={Printer} tone={printTone} title="ไฟล์พิมพ์" sub={printSub} />
            <Rw
              icon={Shirt}
              tone={garment.tone}
              title={totalQuantity > 0 ? `เสื้อ ${totalQuantity.toLocaleString("th-TH")} ตัว` : "เสื้อ"}
              sub={garment.sub}
              right={garment.sources ?? undefined}
            />
            <Rw
              icon={Calendar}
              title="กำหนดส่ง"
              sub={order.deadline ? formatDateCompact(order.deadline) : "ยังไม่กำหนด"}
              right={
                <DueTag
                  status={order.internalStatus}
                  deadline={order.deadline}
                  dueInDays={differenceInBangkokDays(order.deadline, now)}
                />
              }
            />
          </div>

          {!productionV2Enabled ? (
            <OrderQcSection orderId={orderId} internalStatus={order.internalStatus} canCount={canCount} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
