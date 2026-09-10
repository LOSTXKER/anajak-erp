"use client";

import { useMemo, useState } from "react";

export type StepKind = "receive" | "print" | "outsource" | "press" | "finish";
export type Scenario = "single" | "parallel" | "long";
export type Phase = "start" | "partial" | "ready" | "problem";
export type Step = { id: string; kind: StepKind; label: string };
export type Group = { id: string; label: string; steps: Step[] };

export const MANUAL_CHECKS: Record<StepKind, string[]> = {
  receive: [
    "ตรวจสีและไซซ์เสื้อตรงกับใบงาน",
    "ตรวจคราบและตำหนิ แยกตัวที่มีปัญหาออก",
    "แยกกองตามไซซ์และติดเลขออเดอร์",
  ],
  print: [
    "ตรวจไฟล์ตรงกับแบบล่าสุดที่ลูกค้าอนุมัติ",
    "ทดสอบพิมพ์ 1 ชิ้นและเทียบสีกับตัวอย่าง",
    "ตรวจฟิล์มที่ตัดแยกและติดป้ายตรงกับแต่ละงาน",
  ],
  outsource: [
    "ส่งไฟล์ปักและตัวอย่างสีด้ายให้ร้านตรงใบงาน",
    "ตรวจตำแหน่งปัก ด้ายไม่หลุดและลายไม่เอียงเมื่อรับกลับ",
    "แยกงานที่ตรวจไม่ผ่านและระบุจุดที่ต้องแก้",
  ],
  press: [
    "ตั้งอุณหภูมิ เวลา และแรงกดตรงกับงาน",
    "รีดตัวอย่าง 1 ตัว ตรวจตำแหน่งเทียบแบบอนุมัติ",
    "ตรวจการลอกและการติดหลังเย็นก่อนส่งต่อ",
  ],
  finish: [
    "ตรวจว่าทุกกองติดเลขออเดอร์และไซซ์ถูกต้อง",
    "แยกตัวที่มีปัญหาพร้อมระบุจุดให้ผู้ตรวจ QC",
  ],
};

const receive = (): Step => ({ id: "receive", kind: "receive", label: "ตรวจรับเสื้อลูกค้า" });
const print = (): Step => ({ id: "print", kind: "print", label: "พิมพ์ฟิล์ม DTF" });
const press = (): Step => ({ id: "press", kind: "press", label: "รีดร้อน" });

export function groupsFor(scenario: Scenario): Group[] {
  if (scenario === "single") {
    return [{ id: "press", label: "รีดร้อน", steps: [press()] }];
  }
  if (scenario === "parallel") {
    return [
      { id: "prepare", label: "ตรวจรับเสื้อ + พิมพ์ฟิล์ม", steps: [receive(), print()] },
      { id: "press", label: "รีดร้อน", steps: [press()] },
    ];
  }
  return [
    { id: "receive", label: "ตรวจรับเสื้อลูกค้า", steps: [receive()] },
    { id: "print", label: "พิมพ์ฟิล์ม DTF", steps: [print()] },
    { id: "outsource", label: "ปักลายร้านนอก", steps: [{ id: "outsource", kind: "outsource", label: "ปักลายร้านนอก" }] },
    { id: "press", label: "รีดร้อน", steps: [press()] },
    { id: "finish", label: "จัดกองส่งต่อ QC", steps: [{ id: "finish", kind: "finish", label: "จัดกองส่งต่อ QC" }] },
  ];
}

type SimulationState = {
  index: number;
  done: boolean;
  completed: number[];
  quantities: Record<string, number>;
  checks: Record<string, number[]>;
  heldStepId: string | null;
  message: string;
};

const PROBLEM_REASONS: Record<StepKind, string> = {
  receive: "พบเสื้อเสียหายจากการตรวจรับ — แยกของที่มีปัญหา รอหัวหน้าจัดการ",
  print: "เครื่องพิมพ์ฟิล์มขัดข้อง — พักขั้นพิมพ์ไว้ รอหัวหน้าจัดการ",
  outsource: "งานรับกลับจากร้านมีตำหนิ — พักตรวจรับ รอหัวหน้าตัดสินงานแก้",
  press: "เครื่องรีดขัดข้อง — พักขั้นรีดไว้ รอหัวหน้าจัดการ",
  finish: "ป้ายระบุกองงานไม่ตรงใบงาน — พักส่งต่อ รอแก้ป้ายให้ถูกต้อง",
};
const BASELINE_EVIDENCE_STEPS = new Set<StepKind>(["receive", "print", "outsource"]);

function initialState(groups: Group[], phase: Phase): SimulationState {
  const steps = groups.flatMap((group) => group.steps);
  const quantities = Object.fromEntries(steps.map((step) => [step.id, 0]));
  const checks: Record<string, number[]> = Object.fromEntries(steps.map((step) => [step.id, []]));
  const first = groups[0]!;
  const problemStep = phase === "problem" ? first.steps.find((step) => step.kind === "print") ?? first.steps[0]! : null;
  if (phase === "partial") quantities[(first.steps.find((step) => step.kind === "receive") ?? first.steps[0]!).id] = 45;
  if (phase === "ready") {
    for (const step of first.steps) {
      quantities[step.id] = 60;
      checks[step.id] = MANUAL_CHECKS[step.kind].map((_, index) => index);
    }
  }
  return {
    index: 0,
    done: false,
    completed: [],
    quantities,
    checks,
    heldStepId: problemStep?.id ?? null,
    message: problemStep ? PROBLEM_REASONS[problemStep.kind] : "",
  };
}

/** สถานะในหน้าลองเท่านั้น; caller ใช้ key เมื่อเปลี่ยน scenario/phase เพื่อเริ่มตัวอย่างใหม่ */
export function useWorkSimulation(scenario: Scenario, phase: Phase, baseline = false) {
  const groups = useMemo(() => groupsFor(scenario), [scenario]);
  const [state, setState] = useState(() => initialState(groups, phase));
  const current = groups[state.index]!;
  const heldStep = current.steps.find((step) => step.id === state.heldStepId);
  const held = state.heldStepId !== null;
  const problemReason = heldStep ? PROBLEM_REASONS[heldStep.kind] : "";
  const canAdvance = !state.done && !held && current.steps.every((step) =>
    state.quantities[step.id] === 60 &&
    ((baseline && BASELINE_EVIDENCE_STEPS.has(step.kind)) ||
      MANUAL_CHECKS[step.kind].every((_, index) => state.checks[step.id]?.includes(index))),
  );

  function saveQty(stepId: string, qty: number): boolean {
    if (state.done || !current.steps.some((step) => step.id === stepId)) return false;
    if (state.heldStepId === stepId) {
      setState((previous) => ({ ...previous, message: "ขั้นนี้ถูกพักอยู่ ให้หัวหน้าจัดการปัญหาก่อนบันทึกผล" }));
      return false;
    }
    if (!Number.isInteger(qty) || qty < 0 || qty > 60) {
      setState((previous) => ({ ...previous, message: "จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 60 ตัว" }));
      return false;
    }
    setState((previous) => ({
      ...previous,
      quantities: { ...previous.quantities, [stepId]: qty },
      message: `บันทึกยอด ${qty} / 60 ตัวแล้ว — ข้อที่ต้องตรวจเองยังคงตามผลที่ติ๊กไว้`,
    }));
    return true;
  }

  function toggleCheck(stepId: string, index: number) {
    const step = current.steps.find((entry) => entry.id === stepId);
    if (!step || state.done || state.heldStepId === stepId || !Number.isInteger(index) || index < 0 || index >= MANUAL_CHECKS[step.kind].length) return;
    setState((previous) => {
      const checked = previous.checks[stepId] ?? [];
      return {
        ...previous,
        checks: { ...previous.checks, [stepId]: checked.includes(index) ? checked.filter((entry) => entry !== index) : [...checked, index].sort((a, b) => a - b) },
        message: "",
      };
    });
  }

  function advance(): boolean {
    if (!canAdvance) {
      setState((previous) => ({ ...previous, message: previous.heldStepId
        ? "งานยังถูกพักอยู่ ให้หัวหน้าจัดการปัญหาก่อนเดินต่อ"
        : previous.done ? "จบทุกช่วงงานแล้ว" : "บันทึกยอดและตรวจข้อกำหนดของทุกงานในช่วงนี้ให้ครบก่อน" }));
      return false;
    }
    const final = state.index === groups.length - 1;
    setState((previous) => ({
      ...previous,
      completed: [...previous.completed, previous.index],
      index: final ? previous.index : previous.index + 1,
      done: final,
      message: final ? "จบทุกช่วงงานแล้ว — พร้อมส่งต่อ QC" : `จบ ${current.label} แล้ว — เปิดช่วง ${groups[state.index + 1]!.label}`,
    }));
    return true;
  }

  function resolveProblem() {
    if (!state.heldStepId) return;
    setState((previous) => ({ ...previous, heldStepId: null, message: "จัดการปัญหาแล้ว กลับมาบันทึกงานต่อได้ — ยอดและผลตรวจยังคงเดิม" }));
  }

  return { groups, index: state.index, done: state.done, completed: state.completed, current,
    quantities: state.quantities, checks: state.checks, held, heldStepId: state.heldStepId, problemReason, message: state.message,
    saveQty, toggleCheck, advance, resolveProblem, canAdvance };
}
