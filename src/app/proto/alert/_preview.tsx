"use client";

/**
 * ตัวอย่างจริง 6 จุดที่ทั้งเว็บใช้กล่องแจ้งเตือน — ข้อความยกมาจากหน้าจริง (ใบผลิต · โต๊ะงาน · สูตรขั้นงาน · ออเดอร์)
 * ทุกทางเห็นทั้ง 6 จุดเรียงกัน กดสลับแล้วเทียบได้ทันที
 */

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { NoticeA, NoticeB, type AlertTone } from "./_pieces";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · กล่องสี + ตัวหนังสือ" },
  { value: "mark", label: "A · ตราไอคอน + ชั้นข้อความ" },
  { value: "bar", label: "B · แถบสีข้าง พื้นเรียบ" },
] as const;

export type Variant = (typeof OPTIONS)[number]["value"];
export const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

type Sample = {
  key: string;
  where: string;
  variant: AlertTone;
  title: string;
  body: string;
  meta?: readonly { label: string; value: string }[];
  action?: { label: string; primary?: boolean; danger?: boolean };
};

export const SAMPLES: readonly Sample[] = [
  {
    key: "problem",
    where: "ใบผลิต — การ์ดปัญหา (ตัวที่เบสส่งรูปมา)",
    variant: "error",
    title: "เสื้อไม่พอ",
    body: "ไซซ์ L สีกรมท่า ขาด 60 ตัว — สต๊อกจองไม่ครบ ต้องสั่งเพิ่มหรือเปลี่ยนไซซ์",
    meta: [
      { label: "ขั้น", value: "เตรียมเสื้อ — เบิกจากสต๊อก" },
      { label: "แจ้งโดย", value: "เนส" },
      { label: "เมื่อ", value: "28 ส.ค. 14:20" },
    ],
    action: { label: "แก้ให้" },
  },
  {
    key: "stale",
    where: "ทุกหน้ารายการ — ข้อมูลค้าง",
    variant: "warning",
    title: "ข้อมูลล่าสุดอาจยังไม่ครบ",
    body: "กำลังแสดงข้อมูลเดิมที่โหลดไว้ — ปุ่มลงมือถูกปิดจนกว่าจะโหลดใหม่สำเร็จ",
    action: { label: "ลองใหม่" },
  },
  {
    key: "note",
    where: "ใบผลิต — หมายเหตุจากใบงาน",
    variant: "warning",
    title: "หมายเหตุใบผลิต",
    body: "ห้ามพับ ลูกค้าให้ส่งแบบแขวน · ป้ายคอเดิมต้องเลาะออกก่อนติดป้ายทอ",
  },
  {
    key: "done",
    where: "ใบผลิต — ทุกขั้นเสร็จ",
    variant: "success",
    title: "ทุกขั้นผลิตเสร็จแล้ว",
    body: "ส่งงานเข้าตรวจ QC เพื่อไปต่อขั้นแพ็กและจัดส่ง",
    action: { label: "ส่งเข้า QC", primary: true },
  },
  {
    key: "fail",
    where: "ตั้งค่าสูตรขั้นงาน — บันทึกไม่สำเร็จ",
    variant: "error",
    title: "แก้สูตรไม่สำเร็จ",
    body: "สูตรที่ปล่อยใช้แล้วแก้ไม่ได้ — คัดลอกเป็นร่างใหม่แล้วแก้ที่ร่างแทน",
  },
  {
    key: "readonly",
    where: "ออเดอร์ — สิทธิ์ดูอย่างเดียว",
    variant: "info",
    title: "ดูได้อย่างเดียว",
    body: "บัญชีนี้ไม่มีสิทธิ์แก้รายการหรือราคา — ติดต่อหัวหน้าถ้าต้องเปลี่ยน",
  },
];

function ActionButton({ action }: { action: Sample["action"] }) {
  if (!action) return null;
  return (
    <Button size="sm" variant={action.primary ? "default" : "outline"}>
      {action.label}
    </Button>
  );
}

/** ของจริงตอนนี้ — meta เป็นบรรทัดตัวหนังสือจาง · ปุ่มยัดในบรรทัดเดียวกับข้อความ (ท่าที่หน้าใบผลิตใช้อยู่) */
function CurrentAlert({ sample }: { sample: Sample }) {
  return (
    <Alert variant={sample.variant} title={sample.title}>
      {sample.action ? (
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>{sample.body}</span>
          <ActionButton action={sample.action} />
        </span>
      ) : (
        <p>{sample.body}</p>
      )}
      {sample.meta ? <p className="mt-1 text-xs opacity-80">{sample.meta.map((m) => `${m.label} ${m.value}`).join(" · ")}</p> : null}
    </Alert>
  );
}

export function Preview({ variant }: { variant: Variant }) {
  return (
    <ul className="grid gap-5 lg:grid-cols-2">
      {SAMPLES.map((sample) => (
        <li key={sample.key} className="space-y-1.5">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted">{sample.where}</p>
          {variant === "now" ? (
            <CurrentAlert sample={sample} />
          ) : variant === "mark" ? (
            <NoticeA variant={sample.variant} title={sample.title} meta={sample.meta} action={<ActionButton action={sample.action} />}>
              {sample.body}
            </NoticeA>
          ) : (
            <NoticeB variant={sample.variant} title={sample.title} meta={sample.meta} action={<ActionButton action={sample.action} />}>
              {sample.body}
            </NoticeB>
          )}
        </li>
      ))}
    </ul>
  );
}
