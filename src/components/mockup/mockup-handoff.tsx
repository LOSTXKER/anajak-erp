"use client";

import { ImageIcon } from "lucide-react";
import { c, Rw } from "@/components/kit/kit";
import { mockupImageCount } from "@/lib/mockup";
import { trpc } from "@/lib/trpc";
import { APPROVAL_STATUS_LABELS_BY_CUSTOMER } from "@/lib/status-config";

/**
 * แถว "ม็อกอัพ" ในการ์ด "ของที่ต้องพร้อมก่อนผลิต" (แท็บงานผลิต) — บอกสถานะแล้วพาไปที่เดียวที่จัดการได้จริง
 *
 * ตั้งใจไม่มี action ของตัวเอง: ม็อกอัพมีบ้านเดียวคือแท็บ "ม็อกอัพ & ไฟล์" ถ้าตรงนี้
 * อัป/อนุมัติได้ด้วยก็กลับไปเป็นสองบ้านเหมือนเดิม — ทั้งแถวกดแล้วเปิดแท็บนั้น
 *
 * หน้าตาตามต้นแบบ tabProduction() (รื้อ 2026-09-15): ไอคอนเขียว = ลูกค้าอนุมัติ, ส้ม = งานสั่งทำที่ยังไม่ผ่าน
 * ใช้ query key เดียวกับ MockupPanel — react-query cache ให้ ไม่ได้ยิงเพิ่ม
 */

export function OrderMockupHandoff({
  orderId,
  onOpenMockup,
  orderType,
}: {
  orderId: string;
  onOpenMockup: () => void;
  /** ไม่ส่ง = ถือเป็นงานสั่งทำ (ต้องมีม็อกอัพ) */
  orderType?: string;
}) {
  const designs = trpc.design.listByOrder.useQuery({ orderId });

  if (designs.isLoading) {
    return <span className={c("sk skrow")} aria-hidden="true" />;
  }

  const isCustom = orderType !== "READY_MADE";
  const latest = designs.data?.[0];
  const tone =
    latest?.approvalStatus === "APPROVED"
      ? "good"
      : latest?.approvalStatus === "REJECTED"
        ? "bad"
        : isCustom && !designs.isError
          ? "warn"
          : undefined;
  // โหลดพังไม่ขวางงาน — แท็บม็อกอัพมี error+retry เต็มรูปแบบ แถวนี้บอกสั้น ๆ แล้วพาไปที่นั่น
  const sub = designs.isError
    ? "โหลดสถานะไม่สำเร็จ ดูในแท็บม็อกอัพ"
    : latest
      ? `v${latest.versionNumber} · ${APPROVAL_STATUS_LABELS_BY_CUSTOMER[latest.approvalStatus] ?? latest.approvalStatus}`
      : isCustom
        ? "ยังไม่มี"
        : "งานสำเร็จรูป ไม่ต้องมี";

  return (
    <Rw
      onClick={onOpenMockup}
      icon={ImageIcon}
      tone={tone}
      title="ม็อกอัพ"
      sub={sub}
      right={latest ? `${mockupImageCount(latest)} รูป` : undefined}
    />
  );
}
