"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { CHANNEL_LABELS, PRIORITY_LABELS } from "@/lib/order-status";
import { FIELD_MEASURE } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

// ช่องข้อมูลงาน (กำหนดส่ง/ช่องทาง/รายละเอียด/หมายเหตุ) — แยกจาก orders/new/page.tsx
// ตอนรื้อฟอร์ม 2026-06-12 · ลำดับใหม่: รายละเอียดจากแชทขึ้นก่อน (จุด capture หลักตอนถือแชท)
// ไม่มีช่อง "ชื่องาน" แล้ว (เบสสั่ง 2026-08-30 เอาระบบชื่องานออก) — สามช่องที่เหลือ
// อ่านเป็นชุดเดียว "มาจากไหน · ส่งเมื่อไหร่ · ด่วนแค่ไหน" จึงวางเรียงสามช่องในแถวเดียว

const CHANNELS = Object.keys(CHANNEL_LABELS) as string[];

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
  showGuidance?: boolean;
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
  showGuidance = true,
}: OrderDetailFieldsProps) {
  const id = useId();

  return (
    <div className="space-y-4">
      {/* คำสั่งสอนอยู่ description ใต้ช่อง (ไม่หายตอนพิมพ์) — placeholder เหลือตัวอย่างค่า */}
      <Field
        label="ข้อความจากลูกค้า"
        id={`${id}-description`}
        help={showGuidance ? "สรุปจากแชทให้ครบแบบ สี จำนวน งบ และสิ่งที่ลูกค้าเน้น" : undefined}
      >
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="โปโล 120 ตัว สีกรม ปักอกซ้าย ส่งก่อน 25 ส.ค."
          rows={3}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <DatePicker
            value={deadline}
            onChange={(v) => onDeadlineChange(v)}
          />
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
      </div>

      {isMarketplace && (
        <Field label={`เลขออเดอร์ ${CHANNEL_LABELS[channel]}`} id={`${id}-external`} className={FIELD_MEASURE}>
          <Input
            value={externalOrderId}
            onChange={(e) => onExternalOrderIdChange(e.target.value)}
            placeholder="เช่น 2502120001234"
          />
        </Field>
      )}

      <Field
        label="หมายเหตุภายใน (ลูกค้าไม่เห็น)"
        id={`${id}-notes`}
        className={cn(FIELD_MEASURE, "w-full max-sm:max-w-none")}
      >
        <Input
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="เช่น นัดโทรกลับ รอไฟล์ต้นฉบับ"
        />
      </Field>
    </div>
  );
}
