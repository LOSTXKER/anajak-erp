/**
 * ข้อมูลของหน้าลอง "โมดูลผลิตใหม่" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล**
 *
 * ยกใบงานจาก `_kit/demo-jobs.ts` (ชุดเดียวกับหน้าลองอื่น · ชื่อ/จำนวน/กำหนดส่งยาวเท่าของจริง)
 * แล้วเติมสิ่งที่โมดูลผลิตต้องรู้แต่ชุดกลางไม่มี: **เส้นทางงานทีละขั้น** (ขั้นไหนผ่าน/กำลังทำ/ติด/รอ)
 * และ **งานร้านนอก** (ร้านไหน กลับเมื่อไร เลยกำหนดรับหรือยัง) — ทั้งสามทางอ่านจากก้อนเดียวกัน
 * จึงไม่มีทางไหนได้เปรียบเพราะตัดของออก
 *
 * วันที่ตรึงไว้ที่ "วันนี้ = 30 ส.ค. 2569" เหมือนชุดกลาง (ไม่เรียก Date.now())
 */

import { protoJobs, type ProtoJob } from "../_kit/demo-jobs";

/* ───────────────────────────── สถานีในโรงงาน (ทำเองมีแค่ DTF) ───────────────────────────── */

export const STATIONS = [
  { key: "prep", label: "เตรียมเสื้อ", short: "เตรียม", action: "เบิกเสื้อ / ตรวจรับเสื้อลูกค้า" },
  { key: "dtf-print", label: "พิมพ์ DTF", short: "พิมพ์", action: "เปิดรอบพิมพ์" },
  { key: "heat-press", label: "รีดร้อน", short: "รีด", action: "เริ่มรีด" },
  { key: "qc", label: "ตรวจ QC", short: "QC", action: "บันทึกผลตรวจ" },
  { key: "pack", label: "แพ็กสุดท้าย", short: "แพ็ก", action: "แพ็กและปิดใบ" },
] as const;

export type StationKey = (typeof STATIONS)[number]["key"];

export const STATION_LABEL = Object.fromEntries(
  STATIONS.map((station) => [station.key, station.label]),
) as Record<StationKey, string>;

export type StepState = "done" | "active" | "blocked" | "waiting" | "todo";

export type RouteStep = {
  key: StationKey | "outsource";
  label: string;
  state: StepState;
  /** ขั้นที่ส่งร้านนอก — ร้านไหน กลับเมื่อไร */
  outsource?: {
    vendor: string;
    work: string;
    backLabel: string;
    /** ระยะถึงวันนัดรับกลับ · ติดลบ = เลยกำหนดรับแล้ว */
    backInDays: number;
  };
  /** ช่วงวันที่ตามแผน (ใช้เฉพาะทาง C — ของจริงยังไม่มีข้อมูลนี้ต่อขั้น) */
  plan: { start: number; end: number };
};

/** ร้านนอกที่ผูกกับใบตัวอย่าง — ชื่อร้านและงานยาวเท่าที่ทีมพิมพ์จริงใน LINE */
const OUTSOURCE_BY_ORDER: Record<
  string,
  { vendor: string; work: string; backLabel: string; backInDays: number; parallel?: boolean }
> = {
  "ORD-2608-0048": { vendor: "ร้านปักพี่หน่อย (บางบอน)", work: "ปักอกซ้าย 320 ตัว", backLabel: "29 ส.ค.", backInDays: -1 },
  "ORD-2608-0062": { vendor: "โรงงานตัดเย็บ SP การ์เมนท์", work: "ตัดเย็บโปโล 600 ตัว", backLabel: "4 ก.ย.", backInDays: 5 },
  "ORD-2608-0064": { vendor: "ร้านสกรีนบางแค", work: "ซิลค์สกรีน 2 สี 1,500 ตัว", backLabel: "2 ก.ย.", backInDays: 3 },
  "ORD-2608-0072": { vendor: "Labelist ป้ายคอทอ", work: "ป้ายคอทอ 800 ชิ้น", backLabel: "27 ส.ค.", backInDays: -3 },
  // งานผสม: DTF เดินในโรงงานพร้อมกับปักที่ร้านนอก (เบสเคาะ 2026-09-01 ว่าเดินขนานได้)
  "ORD-2608-0061": { vendor: "ร้านปักพี่หน่อย (บางบอน)", work: "ปักโลโก้แขน 240 ตัว", backLabel: "1 ก.ย.", backInDays: 2, parallel: true },
};

function plan(due: number, startOffset: number, endOffset: number) {
  return { start: due - startOffset, end: due - endOffset };
}

/**
 * แปลงใบงานชุดกลาง (ที่รู้แค่ "ช่วง" กับ "ผ่านกี่ขั้น") เป็นเส้นทางทีละขั้น
 * — กติกาเดียวกับสูตรขั้นงานมาตรฐาน: เตรียมเสื้อ → พิมพ์ DTF → รีดร้อน → QC → แพ็ก
 *   ร้านนอกแทรกก่อนรีดร้อน (ของต้องกลับมาก่อนถึงรีด/QC ได้) หรือเดินขนานกับ DTF
 */
export function routeOf(job: ProtoJob): RouteStep[] {
  const due = job.dueInDays ?? 9;
  const outsource = OUTSOURCE_BY_ORDER[job.orderNumber];
  const blocked = Boolean(job.problem);

  const base: Record<StationKey, RouteStep> = {
    prep: { key: "prep", label: "เตรียมเสื้อ", state: "todo", plan: plan(due, 6, 5) },
    "dtf-print": { key: "dtf-print", label: "พิมพ์ DTF", state: "todo", plan: plan(due, 5, 3) },
    "heat-press": { key: "heat-press", label: "รีดร้อน", state: "todo", plan: plan(due, 3, 2) },
    qc: { key: "qc", label: "ตรวจ QC", state: "todo", plan: plan(due, 2, 1) },
    pack: { key: "pack", label: "แพ็กสุดท้าย", state: "todo", plan: plan(due, 1, 0) },
  };

  const activeOrBlocked: StepState = blocked ? "blocked" : "active";
  const order: StationKey[] = ["prep", "dtf-print", "heat-press", "qc", "pack"];

  let activeIndex: number;
  switch (job.stage) {
    case "prep":
      activeIndex = 0;
      break;
    case "dtf":
      activeIndex = job.progress.done >= 3 ? 2 : 1;
      break;
    case "outsource":
      activeIndex = -1; // ขั้นที่กำลังทำคือร้านนอก
      break;
    case "qc":
      activeIndex = 3;
      break;
    case "ship":
      activeIndex = 4;
      break;
    default:
      activeIndex = 0;
  }

  order.forEach((key, index) => {
    if (activeIndex === -1) {
      base[key].state = index === 0 ? "done" : index === 1 ? "done" : "waiting";
      return;
    }
    base[key].state =
      index < activeIndex ? "done" : index === activeIndex ? activeOrBlocked : "todo";
  });

  const steps: RouteStep[] = [];
  steps.push(base.prep);
  if (outsource && !outsource.parallel) {
    steps.push(base["dtf-print"]);
    steps.push({
      key: "outsource",
      label: outsource.work,
      state: job.stage === "outsource" ? (outsource.backInDays < 0 ? "blocked" : "active") : "done",
      outsource,
      plan: plan(due, 7, 2),
    });
  } else if (outsource?.parallel) {
    steps.push({
      key: "outsource",
      label: outsource.work,
      state: "active",
      outsource,
      plan: plan(due, 6, 2),
    });
    steps.push(base["dtf-print"]);
  } else {
    steps.push(base["dtf-print"]);
  }
  steps.push(base["heat-press"], base.qc, base.pack);
  return steps;
}

export type ProductionJob = ProtoJob & {
  route: RouteStep[];
  /** ขั้นที่กำลังทำอยู่ (ขั้นแรกที่ยังไม่ผ่าน) */
  current: RouteStep;
  /** สถานีในโรงงานที่ใบนี้รอลงมือ — null = อยู่ร้านนอกทั้งใบ */
  station: StationKey | null;
  /** งานร้านนอกที่ยังไม่กลับ (ถ้ามี) */
  outsource: RouteStep["outsource"] | null;
};

/** เฉพาะใบที่เปิดใบผลิตแล้ว — ช่วงรับงาน/ออกแบบยังไม่เข้าโมดูลนี้ */
export function productionJobs(busy: boolean): ProductionJob[] {
  return protoJobs(busy)
    .filter((job) => job.stage !== "intake" && job.stage !== "design")
    .map((job) => {
      const route = routeOf(job);
      const current =
        route.find((step) => step.state === "blocked") ??
        route.find((step) => step.state === "active") ??
        route.find((step) => step.state !== "done") ??
        route[route.length - 1]!;
      const outsourceStep = route.find(
        (step) => step.key === "outsource" && step.state !== "done",
      );
      const stationStep = route.find(
        (step) => step.key !== "outsource" && (step.state === "active" || step.state === "blocked"),
      );
      return {
        ...job,
        route,
        current,
        station: (stationStep?.key as StationKey | undefined) ?? null,
        outsource: outsourceStep?.outsource ?? null,
      };
    });
}

/** ใบที่รอเปิดใบผลิต (ช่วงรับงาน/ออกแบบที่ยืนยันแล้ว) — โมดูลใหม่ต้องมีทางเปิดใบผลิตด้วย */
export function awaitingProduction(busy: boolean): ProtoJob[] {
  return protoJobs(busy).filter((job) => job.stage === "design");
}

/* ───────────────────────────── ตัวเลขสรุปที่ทุกทางใช้ร่วมกัน ───────────────────────────── */

export function summarize(jobs: ProductionJob[]) {
  return {
    late: jobs.filter((job) => (job.dueInDays ?? 99) < 0).length,
    blocked: jobs.filter((job) => job.problem).length,
    outsourceDue: jobs.filter((job) => job.outsource && job.outsource.backInDays <= 0).length,
    ready: jobs.filter((job) => job.stage === "ship").length,
  };
}

export function stationCounts(jobs: ProductionJob[]) {
  return STATIONS.map((station) => {
    const inStation = jobs.filter((job) => job.station === station.key);
    return {
      ...station,
      count: inStation.length,
      late: inStation.filter((job) => (job.dueInDays ?? 99) < 0).length,
      blocked: inStation.filter((job) => job.problem).length,
    };
  });
}

/** ป้ายสถานะขั้น — สูตรสีเดียวกับคอลัมน์ "เส้นทางงาน" ที่เบสเคาะแบบ C (2026-09-02) */
export const STEP_TONE: Record<StepState, { bar: string; label: string }> = {
  done: { bar: "bg-green-500/80 dark:bg-green-400/70", label: "ผ่านแล้ว" },
  active: { bar: "bg-amber-500", label: "กำลังทำ" },
  blocked: { bar: "bg-red-500", label: "ติดปัญหา" },
  waiting: { bar: "bg-slate-300 dark:bg-slate-600", label: "รอของกลับ" },
  todo: { bar: "bg-slate-200 dark:bg-slate-700", label: "ยังไม่ถึง" },
};
