/**
 * "เครื่องยนต์จำลอง" ของหน้าลอง — pure ไม่มี DOM/DB
 *
 * แต่ละทางต่างกันตรง **รางนับอะไรเป็นหนึ่งช่อง** (stagesFor) เท่านั้น
 * ปุ่มหลักของขั้นเดี่ยว · การย้อน · สิทธิ์หัวหน้า/ช่าง ใช้กติกาชุดเดียวกันทุกทาง
 * (เลียน work-order-controller.primaryButton + selectNowSteps ของจริง ไม่ได้คิดกติกาใหม่)
 */

import { recordModeOf, type WorkStep } from "./_data";

export type Variant = "now" | "seq" | "gate" | "record";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · แผนที่เส้นทาง (แบบ E)" },
  { value: "seq", label: "A · ทีละขั้นตามเลข" },
  { value: "gate", label: "B · ราง = ด่าน (ขั้นพร้อมกันรวมช่องเดียว)" },
  { value: "record", label: "C · ราง = เฉพาะจุดที่ระบบจด" },
] as const;

export const VALUES = OPTIONS.map((o) => o.value) as readonly Variant[];

export type Stage = {
  key: string;
  /** ป้ายบนราง */
  label: string;
  /** ชื่อเต็มในฟอร์ม */
  title: string;
  steps: WorkStep[];
  kind: "single" | "parallel" | "paper";
};

const isDone = (s: WorkStep) => s.state === "done";

/** ราง "นับอะไรเป็นหนึ่งช่อง" — หัวใจของสิ่งที่กำลังเทียบ */
export function stagesFor(variant: Variant, steps: WorkStep[]): Stage[] {
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  if (variant === "gate") {
    // ด่าน = ตามผังเส้นทางจริง (lib/work-order-route.routeParts): สายขนานทั้งหมด → รีดร้อน → หางงานทีละขั้น
    const parallel = sorted.filter((s) => s.lane !== "merge" && s.lane !== "tail");
    const merge = sorted.filter((s) => s.lane === "merge");
    const tail = sorted.filter((s) => s.lane === "tail");
    const stages: Stage[] = [];
    if (parallel.length === 1) stages.push(single(parallel[0]!));
    else if (parallel.length > 1)
      stages.push({ key: "prep", label: `เตรียมงาน ${parallel.length} อย่าง`, title: `เตรียมงาน — ${parallel.length} อย่างทำพร้อมกัน`, steps: parallel, kind: "parallel" });
    for (const s of merge) stages.push(single(s));
    for (const s of tail) stages.push(single(s));
    return stages;
  }

  if (variant === "record") {
    // เฉพาะจุดที่ระบบจด (กติกา A5 กระดาษเป็นหลัก) — ขั้นกระดาษ/ผ่านเองรวมเป็นช่องเดียวท้ายราง "ส่งเข้า QC"
    const recorded = sorted.filter((s) => recordModeOf(s) === "screen");
    const paper = sorted.filter((s) => recordModeOf(s) !== "screen");
    const stages: Stage[] = recorded.map(single);
    stages.push({ key: "to-qc", label: "ส่งเข้า QC", title: "ทำตามใบสั่งงานแล้วส่งเข้า QC", steps: paper, kind: "paper" });
    return stages;
  }

  // seq (และ now ซึ่งไม่ใช้ราง) — หนึ่งขั้นหนึ่งช่องตามเลข
  return sorted.map(single);
}

function single(step: WorkStep): Stage {
  return { key: step.id, label: step.short, title: step.label, steps: [step], kind: "single" };
}

export function stageDone(stage: Stage): boolean {
  return stage.steps.every(isDone);
}

/** ช่องที่ยืนอยู่ = ช่องแรกที่ยังมีขั้นไม่ปิด (ครบทุกช่อง = ยืนช่องสุดท้าย) */
export function currentStageIndex(stages: Stage[]): number {
  const i = stages.findIndex((st) => !stageDone(st));
  return i < 0 ? stages.length - 1 : i;
}

/* ───────────────────────── ปุ่มหลักของขั้นเดี่ยว ───────────────────────── */

export type StepCta = {
  label: string;
  /** สถานะที่ขั้นจะกลายเป็นหลังกด */
  to: WorkStep["state"];
  /** ปุ่มแดง (จัดการปัญหา) */
  danger?: boolean;
};

/** ประโยคบอกว่าทำไมไม่มีปุ่ม (กติกา DESIGN: ห้ามวางปุ่มที่กดไม่ได้ — ให้ประโยคบอกแทน) */
export function stepBlockedNote(step: WorkStep, boss: boolean): string | null {
  if (step.state === "done") return null;
  if (step.state === "blocked" && !boss) return `ติดปัญหา: ${step.problem?.title ?? "รอหัวหน้าจัดการ"} — รอหัวหน้าจัดการ`;
  if (step.kind === "dtf" && step.state === "active") return "อยู่ในรอบพิมพ์ — ปิดรอบพิมพ์แล้วขั้นนี้ผ่านเอง";
  return null;
}

export function stepCta(step: WorkStep, boss: boolean): StepCta | null {
  if (step.state === "done") return null;
  if (step.state === "blocked") return boss ? { label: "จัดการปัญหา", to: step.kind === "outsource" ? "waiting" : "active", danger: true } : null;
  switch (step.kind) {
    case "receive":
      return { label: "บันทึกตรวจรับเสื้อลูกค้า", to: "done" };
    case "pick":
      return { label: `เบิกเสื้อ ${step.qtyTotal.toLocaleString("th-TH")} ตัว`, to: "done" };
    case "outsource":
      return step.state === "waiting" ? { label: "รับงานกลับ + ตรวจรับ", to: "done" } : { label: "ส่งร้านนอก", to: "waiting" };
    case "dtf":
      return step.state === "active" ? { label: "ปิดรอบพิมพ์ (ผ่านเอง)", to: "done" } : { label: "เปิดรอบพิมพ์", to: "active" };
    case "qc":
      return { label: "ส่งเข้า QC", to: "done" };
    case "pack":
      return { label: "แพ็กและปิดใบ", to: "done" };
    default:
      return step.state === "active" ? { label: "ปิดขั้นนี้", to: "done" } : { label: boss || step.owner ? "เริ่มทำ" : "รับงานนี้", to: "active" };
  }
}

/* ───────────────────────── ปุ่มหลักบนหัวใบ (ต่อช่อง) ───────────────────────── */

export type HeadCta =
  | { kind: "step"; step: WorkStep; cta: StepCta }
  | { kind: "close-stage"; label: string; steps: WorkStep[] }
  | { kind: "none"; note: string };

export function headCta(stage: Stage, next: Stage | null, boss: boolean): HeadCta {
  if (stage.kind === "single") {
    const step = stage.steps[0]!;
    const cta = stepCta(step, boss);
    if (cta) return { kind: "step", step, cta };
    return { kind: "none", note: stepBlockedNote(step, boss) ?? (step.state === "done" ? "ทุกขั้นปิดแล้ว — ใบนี้เสร็จ" : "ยังทำต่อไม่ได้") };
  }
  const open = stage.steps.filter((s) => !isDone(s));
  if (stage.kind === "parallel") {
    if (open.length === 0) return { kind: "close-stage", label: next ? `ปิดด่านนี้ → ${next.label}` : "ปิดด่านนี้", steps: stage.steps };
    return { kind: "none", note: `ยังปิดด่านนี้ไม่ได้ — รอ ${open.map((s) => s.short).join(" · ")} (กดที่แต่ละงานข้างล่าง)` };
  }
  // paper: ส่งเข้า QC = ระบบถือว่าขั้นกระดาษผ่าน
  if (open.length === 0) return { kind: "none", note: "ส่งเข้า QC แล้ว — ใบนี้เสร็จ" };
  const blocked = open.filter((s) => s.state === "blocked");
  if (blocked.length > 0 && !boss) return { kind: "none", note: `ติดปัญหา: ${blocked.map((s) => s.short).join(" · ")} — รอหัวหน้าจัดการ` };
  return { kind: "close-stage", label: `ส่งเข้า QC (ถือว่าผ่านขั้นกระดาษ ${open.length} ขั้น)`, steps: stage.steps };
}

/* ───────────────────────── เดินหน้า / ย้อนกลับ (จำลองในหน้า) ───────────────────────── */

export function applyStep(steps: WorkStep[], stepId: string, to: WorkStep["state"]): WorkStep[] {
  return steps.map((s) => {
    if (s.id !== stepId) return s;
    const done = to === "done";
    return {
      ...s,
      state: to,
      problem: to === "blocked" ? s.problem : undefined,
      qtyDone: done ? s.qtyTotal : s.qtyDone,
      startedAt: s.startedAt ?? (to === "todo" ? null : `${"8 ก.ย."} 10:00`),
      completedAt: done ? "8 ก.ย. 10:05" : null,
      checklist: done ? s.checklist.map((c) => ({ ...c, done: true })) : s.checklist,
      outsource: s.outsource && done ? { ...s.outsource, status: "รับกลับแล้ว" } : s.outsource,
    };
  });
}

export function closeAll(steps: WorkStep[], ids: string[]): WorkStep[] {
  return ids.reduce((acc, id) => applyStep(acc, id, "done"), steps);
}

/** ขั้นล่าสุดที่ปิดไป — ย้อนกลับจะเปิดขั้นนี้ใหม่ (ตามลำดับช่องของราง ไม่ใช่เวลาจริง) */
export function lastClosed(stages: Stage[]): WorkStep | null {
  for (let i = stages.length - 1; i >= 0; i--) {
    const closed = [...stages[i]!.steps].reverse().find(isDone);
    if (closed) return closed;
  }
  return null;
}

export function reopen(steps: WorkStep[], step: WorkStep): WorkStep[] {
  const to: WorkStep["state"] = step.kind === "outsource" ? "waiting" : step.kind === "receive" || step.kind === "pick" ? "todo" : "active";
  return steps.map((s) =>
    s.id === step.id
      ? {
          ...s,
          state: to,
          completedAt: null,
          qtyDone: to === "active" ? Math.min(s.qtyDone, s.qtyTotal - 1) : 0,
          checklist: s.checklist.map((c, i) => ({ ...c, done: i < s.checklist.length - 1 })),
          outsource: s.outsource ? { ...s.outsource, status: "ย้อนกลับมา — รอรับกลับใหม่" } : undefined,
        }
      : s,
  );
}
