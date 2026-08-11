import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NextStep, NextStepAction } from "@/lib/order-next-step";
import { shouldGateOnReadiness } from "@/lib/order-tabs";

// รูปร่าง readiness ที่ต้องใช้ (มาจาก trpc.production.orderContext) — type-only เลี่ยงดึง server code
export interface ReadinessLike {
  ready: boolean;
  checks: { key: string; label: string; ok: boolean; detail: string; waitingOn?: string | null }[];
}

interface OrderNextStepActionProps {
  nextStep: NextStep | null;
  readiness: ReadinessLike | null;
  isPending: boolean;
  onStatus: (to: string) => void;
  // undefined = role นี้แก้รายการไม่ได้ (ช่าง/กราฟิก) — ซ่อนปุ่ม EDIT_ITEMS ไปเลย
  onEditItems?: () => void;
  onAnchor: (target: "billing" | "design" | "production" | "delivery" | "qc") => void;
  // role ไม่เห็นเงิน (ช่าง/กราฟิก) = ซ่อนปุ่มไปการ์ดบิล (ปุ่มพาไปแท็บที่เขาเข้าไม่ได้ = ปุ่มตาย ขัด B8)
  canSeeMoney?: boolean;
}

/**
 * ปุ่ม "ขั้นต่อไป" บนหัวหน้าออเดอร์ (เบสสั่งถอดแถบฟ้าออก 2026-08-11 แล้วย้ายปุ่มขึ้นหัวหน้า)
 *
 * เดิมเป็นแถบเต็มความกว้างที่มีทั้งหัวข้อ คำอธิบาย และปุ่ม — เบสว่ากินที่เกินความจำเป็น
 * ตอนนี้เหลือ "ปุ่ม" อย่างเดียว (ตรรกะเดิมทั้งชุดจาก lib/order-next-step.ts ไม่ได้เขียนใหม่)
 *
 * ที่ต้องระวัง: ปุ่มนี้เป็นทางเดียวที่เช็ค "ด่านพร้อมผลิต" ให้ก่อนกด (เมนู ⋯ ไม่เช็ค)
 * ตอนติดด่าน จึง **ไม่ render ปุ่ม** แล้วให้แถบสถานะเป็นคนบอกว่าติดอะไรแทน
 * (ดู `blockers` ที่หน้าออเดอร์ส่งเข้า OrderStatusBar) — ห้ามโชว์ปุ่มที่กดแล้ว server ปฏิเสธ (B8)
 *
 * terminal (COMPLETED/CANCELLED) = nextStep null → ไม่ render อะไรเลย
 */
export function OrderNextStepAction({
  nextStep,
  readiness,
  isPending,
  onStatus,
  onEditItems,
  onAnchor,
  canSeeMoney = true,
}: OrderNextStepActionProps) {
  if (!nextStep) return null;

  const action = nextStep.action;
  if (action.type === "NONE" || !nextStep.buttonLabel) return null;
  if (shouldGateOnReadiness(action, readiness)) return null;
  if (action.type === "EDIT_ITEMS" && !onEditItems) return null;
  if (action.type === "ANCHOR" && action.target === "billing" && !canSeeMoney) return null;

  function dispatch(a: NextStepAction) {
    switch (a.type) {
      case "EDIT_ITEMS":
        return onEditItems?.();
      case "STATUS":
        return onStatus(a.to);
      case "ANCHOR":
        return onAnchor(a.target);
      case "NONE":
        return;
    }
  }

  return (
    <Button
      onClick={() => dispatch(action)}
      disabled={isPending}
      // ชื่อปุ่มสั้น ("เข้าคิวผลิต") — บริบทเต็มอยู่ใน title สำหรับคนที่ยังไม่ชิน
      title={`${nextStep.title} — ${nextStep.description}`}
      className="shrink-0"
    >
      {nextStep.buttonLabel}
      <ChevronRight />
    </Button>
  );
}

/** ข้อความ "ติดอะไร" สำหรับแถบสถานะ — คืน [] เมื่อไม่ได้ติดด่าน (แถบจะไม่โชว์อะไรเลย) */
export function nextStepBlockers(
  nextStep: NextStep | null,
  readiness: ReadinessLike | null,
): string[] {
  if (!nextStep || !shouldGateOnReadiness(nextStep.action, readiness)) return [];
  return (readiness?.checks ?? [])
    .filter((c) => !c.ok)
    .map((c) => {
      const why = c.waitingOn ? ` · ${c.waitingOn}` : c.detail ? ` — ${c.detail}` : "";
      return `${c.label}${why}`;
    });
}
