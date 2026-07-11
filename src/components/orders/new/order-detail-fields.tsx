"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FilterChip } from "@/components/ui/filter-chip";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABELS, PRIORITY_LABELS } from "@/lib/order-status";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const id = useId();
  const [showMore, setShowMore] = useState(
    Boolean(title || notes || channel !== "LINE" || externalOrderId || priority !== "NORMAL")
  );

  return (
    <>
      <div>
        <label htmlFor={`${id}-description`} className={labelClass}>ข้อความจากแชท</label>
        <Textarea
          id={`${id}-description`}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="จดสิ่งที่ลูกค้าต้องการ — แบบ/สี/จำนวน/งบ..."
          rows={3}
        />
      </div>

      <div>
        <label htmlFor={`${id}-deadline`} className={labelClass}>กำหนดส่ง</label>
        <Input
          id={`${id}-deadline`}
          type="date"
          value={deadline}
          onChange={(e) => onDeadlineChange(e.target.value)}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        className="w-full justify-between border border-dashed border-slate-200 px-3 text-slate-600 dark:border-slate-700 dark:text-slate-300"
        onClick={() => setShowMore((current) => !current)}
        aria-expanded={showMore}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          เพิ่มเติม
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")}
          aria-hidden="true"
        />
      </Button>

      {showMore && (
        <div className="space-y-3.5 rounded-xl bg-slate-50/70 p-3 dark:bg-slate-900/50">
          <div>
            <label htmlFor={`${id}-title`} className={labelClass}>ชื่องาน</label>
            <Input
              id={`${id}-title`}
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="เว้นว่างได้ — ระบบตั้งให้จากลูกค้า"
            />
          </div>

          <fieldset>
            <legend className={labelClass}>ช่องทาง (ค่าเริ่มต้น LINE)</legend>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <FilterChip key={ch} selected={channel === ch} onClick={() => onChannelChange(ch)}>
                  {CHANNEL_LABELS[ch]}
                </FilterChip>
              ))}
            </div>
            {isMarketplace && (
              <div className="mt-3">
                <label htmlFor={`${id}-external`} className={labelClass}>
                  เลขออเดอร์ {CHANNEL_LABELS[channel]}
                </label>
                <Input
                  id={`${id}-external`}
                  value={externalOrderId}
                  onChange={(e) => onExternalOrderIdChange(e.target.value)}
                  placeholder="เช่น 2502120001234"
                />
              </div>
            )}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-priority`} className={labelClass}>ความเร่งด่วน</label>
              <NativeSelect
                id={`${id}-priority`}
                value={priority}
                onChange={(e) => onPriorityChange(e.target.value as Priority)}
              >
                {Object.entries(PRIORITY_LABELS).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <label htmlFor={`${id}-notes`} className={labelClass}>หมายเหตุภายใน</label>
              <Input
                id={`${id}-notes`}
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="ทีมงานเห็น ลูกค้าไม่เห็น"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
