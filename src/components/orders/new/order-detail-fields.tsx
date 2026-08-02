"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FilterChip } from "@/components/ui/filter-chip";
import { Field } from "@/components/ui/field";
import { CHANNEL_LABELS, PRIORITY_LABELS } from "@/lib/order-status";

// ช่องข้อมูลงาน (ชื่อ/กำหนดส่ง/ช่องทาง/รายละเอียด/หมายเหตุ) — แยกจาก orders/new/page.tsx
// ตอนรื้อฟอร์ม 2026-06-12 · ลำดับใหม่: รายละเอียดจากแชทขึ้นก่อน (จุด capture หลักตอนถือแชท)

const CHANNELS = Object.keys(CHANNEL_LABELS) as string[];
const legendClass = "mb-2 block text-xs text-slate-500 dark:text-slate-400";

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface OrderDetailFieldsProps {
  title: string;
  onTitleChange: (v: string) => void;
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
}

export function OrderDetailFields({
  title,
  onTitleChange,
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
}: OrderDetailFieldsProps) {
  const id = useId();

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className={legendClass}>ช่องทางที่รับงาน (ค่าเริ่มต้น LINE)</legend>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((ch) => (
            <FilterChip key={ch} selected={channel === ch} onClick={() => onChannelChange(ch)}>
              {CHANNEL_LABELS[ch]}
            </FilterChip>
          ))}
        </div>
      </fieldset>

      {isMarketplace && (
        <Field label={`เลขออเดอร์ ${CHANNEL_LABELS[channel]}`} id={`${id}-external`}>
          <Input
            value={externalOrderId}
            onChange={(e) => onExternalOrderIdChange(e.target.value)}
            placeholder="เช่น 2502120001234"
          />
        </Field>
      )}

      <Field
        label="ข้อความจากลูกค้า"
        id={`${id}-description`}
        description="สรุปจากแชท เช่น แบบ สี จำนวน งบ และสิ่งที่ลูกค้าเน้น"
      >
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="วางหรือสรุปข้อความจากแชทไว้ตรงนี้..."
          rows={4}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="กำหนดส่ง" id={`${id}-deadline`}>
          <DatePicker
            value={deadline}
            onChange={(v) => onDeadlineChange(v)}
          />
        </Field>
        <Field label="ชื่องาน (ไม่บังคับ)" id={`${id}-title`}>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="เว้นว่างได้ — ระบบตั้งให้จากชื่อลูกค้า"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field
          label="หมายเหตุสำหรับทีม"
          id={`${id}-notes`}
          description="ใช้ภายในร้าน ลูกค้าจะไม่เห็นข้อความนี้"
        >
          <Input
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="เช่น นัดโทรกลับ รอไฟล์ต้นฉบับ..."
          />
        </Field>
      </div>
    </div>
  );
}
