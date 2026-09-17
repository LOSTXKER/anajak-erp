"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { c } from "@/components/kit/kit";
import { CHANNEL_LABELS, PRIORITY_LABELS } from "@/lib/order-status";

// ช่องข้อมูลงาน (กำหนดส่ง/ช่องทาง/รายละเอียด/หมายเหตุ) — แยกจาก orders/new/page.tsx
// ตอนรื้อฟอร์ม 2026-06-12 · ลำดับใหม่: รายละเอียดจากแชทขึ้นก่อน (จุด capture หลักตอนถือแชท)
// ไม่มีช่อง "ชื่องาน" แล้ว (เบสสั่ง 2026-08-30 เอาระบบชื่องานออก)

// LINE ขึ้นก่อนตามต้นแบบ — เป็นค่าเริ่มต้นและช่องทางที่รับงานบ่อยสุด · ที่เหลือคงลำดับเดิม
const CHANNELS = ["LINE", ...Object.keys(CHANNEL_LABELS).filter((key) => key !== "LINE")];

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface OrderDetailFieldsProps {
  deadline: string;
  onDeadlineChange: (v: string) => void;
  priority: Priority;
  onPriorityChange: (v: Priority) => void;
  channel: string;
  onChannelChange: (v: string) => void;
  isMarketplace: boolean;
  externalOrderId: string;
  onExternalOrderIdChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  /** โหมดแก้ออเดอร์: ช่องทางเปลี่ยนไม่ได้ (ผูกกับเลขออเดอร์/สูตรภาษีที่คิดไปแล้ว)
   *  โชว์เป็นช่องเทาพร้อมเหตุผล — ห้ามซ่อน ไม่งั้นคนคิดว่าข้อมูลหาย (เบสสั่ง) */
  channelLockedReason?: string;
}

export function OrderDetailFields({
  deadline,
  onDeadlineChange,
  priority,
  onPriorityChange,
  channel,
  onChannelChange,
  isMarketplace,
  externalOrderId,
  onExternalOrderIdChange,
  description,
  onDescriptionChange,
  notes,
  onNotesChange,
  channelLockedReason,
}: OrderDetailFieldsProps) {
  const id = useId();

  /* ซ้ายอ่านแชท ขวากรอกสิ่งที่อ่านได้ — เรียงตามที่แอดมินทำจริงตอนถือแชท
     (ต้นแบบ mockup-order-form-2026-09-18 .intake · จอ ≤860px รวมเป็นคอลัมน์เดียว) */
  return (
    <div className={c("intake")}>
      <div className={c("side main")}>
        <Field label="ข้อความจากลูกค้า" id={`${id}-description`}>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="โปโล 120 ตัว สีกรม ปักอกซ้าย ส่งก่อน 25 ส.ค."
            rows={5}
          />
        </Field>

        <Field label="หมายเหตุภายใน (ลูกค้าไม่เห็น)" id={`${id}-notes`}>
          <Input
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="เช่น นัดโทรกลับ รอไฟล์ต้นฉบับ"
          />
        </Field>
      </div>

      <div className={c("side")}>
        <Field label="ช่องทาง" id={`${id}-channel`} description={channelLockedReason}>
          <Select
            value={channel}
            onChange={(e) => onChannelChange(e.target.value)}
            disabled={Boolean(channelLockedReason)}
            title={channelLockedReason}
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_LABELS[ch]}</option>
            ))}
          </Select>
        </Field>
        <Field label="กำหนดส่ง" id={`${id}-deadline`}>
          <DatePicker value={deadline} onChange={(v) => onDeadlineChange(v)} />
        </Field>
        <Field label="ความเร่งด่วน" id={`${id}-priority`}>
          <Select
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value as Priority)}
          >
            {Object.entries(PRIORITY_LABELS).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </Select>
        </Field>
        {isMarketplace && (
          <Field label={`เลขออเดอร์ ${CHANNEL_LABELS[channel]}`} id={`${id}-external`}>
            <Input
              value={externalOrderId}
              onChange={(e) => onExternalOrderIdChange(e.target.value)}
              placeholder="เช่น 2502120001234"
            />
          </Field>
        )}
      </div>
    </div>
  );
}
