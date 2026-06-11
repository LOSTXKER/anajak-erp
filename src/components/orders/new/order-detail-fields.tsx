"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FilterChip } from "@/components/ui/filter-chip";
import { CHANNEL_LABELS, PRIORITY_LABELS } from "@/lib/order-status";

// ช่องข้อมูลงาน (ชื่อ/กำหนดส่ง/ช่องทาง/รายละเอียด/หมายเหตุ) — แยกจาก orders/new/page.tsx
// ตอนรื้อฟอร์ม 2026-06-12 · ลำดับใหม่: รายละเอียดจากแชทขึ้นก่อน (จุด capture หลักตอนถือแชท)

const CHANNELS = Object.keys(CHANNEL_LABELS) as string[];
const labelClass = "mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400";

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
  return (
    <>
      <div>
        <label className={labelClass}>รายละเอียดจากแชท</label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="จดสิ่งที่ลูกค้าต้องการ — แบบ/สี/จำนวน/งบ..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>ชื่องาน</label>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="เว้นว่างได้ — ระบบตั้งให้"
          />
        </div>
        <div>
          <label className={labelClass}>กำหนดส่ง</label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => onDeadlineChange(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>ช่องทาง</label>
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((ch) => (
            <FilterChip key={ch} selected={channel === ch} onClick={() => onChannelChange(ch)}>
              {CHANNEL_LABELS[ch]}
            </FilterChip>
          ))}
        </div>
        {isMarketplace && (
          <div className="mt-2">
            <label className={labelClass}>เลขออเดอร์ {CHANNEL_LABELS[channel]}</label>
            <Input
              value={externalOrderId}
              onChange={(e) => onExternalOrderIdChange(e.target.value)}
              placeholder="เช่น 2502120001234"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>ความเร่งด่วน</label>
          <NativeSelect
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value as Priority)}
          >
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label className={labelClass}>หมายเหตุภายใน</label>
          <Input
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="หมายเหตุภายใน..."
          />
        </div>
      </div>
    </>
  );
}
