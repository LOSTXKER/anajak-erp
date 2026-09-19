/**
 * ปัญหาของขั้นผลิต — ตัวอ่านชุดเดียวของทั้งระบบ
 *
 * ตั้งแต่ 2026-09-20 เรื่องหนึ่งเรื่อง = แถวจริงใน `production_exceptions` (ใครแจ้ง เมื่อไร เสียกี่ตัว
 * หยุดขั้นหรือไม่ หัวหน้ารับเรื่องหรือยัง ตัดสินว่าอะไร) · ใบเก่าที่ไม่มีแถวยังอ่านได้จาก marker ใน notes
 * ของเดิม จึงต้องผ่านฟังก์ชันในไฟล์นี้เสมอ ไม่ใช่เช็ค `status === "FAILED"` กระจายตามจอ
 */

const STATION_REPORT_PREFIX = "[แจ้งปัญหาจากสถานี] ";
const STATION_RESOLVED_PREFIX = "[แก้ปัญหาแล้ว] ";
/** ขั้นจดบนกระดาษที่ระบบปิดให้ตอนส่งเข้า QC (กระดาษเป็นหลัก · ROADMAP §A5) — ไม่ใช่เหตุปัญหา ต้องไม่โผล่เป็นหมายเหตุล่าสุด */
export const PAPER_DONE_PREFIX = "[ถือว่าผ่าน] ";

export const normalizedProblemReason = (reason: string) =>
  reason.replace(/\s+/g, " ").trim();

export const stationProblemMarker = (reason: string) =>
  `${STATION_REPORT_PREFIX}${normalizedProblemReason(reason)}`;

export const resolvedProblemMarker = (reason: string) =>
  `${STATION_RESOLVED_PREFIX}${normalizedProblemReason(reason)}`;

export function hasStationProblemMarker(
  notes: string | null | undefined,
  reason: string,
): boolean {
  const marker = stationProblemMarker(reason);
  return notes?.split("\n").some((line) => line === marker) ?? false;
}

export function stationProblemNotes(
  existingNotes: string | null | undefined,
  reason: string,
): string {
  const marker = stationProblemMarker(reason);
  return existingNotes ? `${existingNotes}\n${marker}` : marker;
}

export function resolvedProblemNotes(
  reportNotes: string | null | undefined,
  reason: string,
): string {
  const marker = resolvedProblemMarker(reason);
  return reportNotes ? `${reportNotes}\n${marker}` : marker;
}

/**
 * ProductionStep.notes เก็บ trail เพื่อรองรับใบเก่า แต่จอปัจจุบันต้องแสดงเหตุที่ยังเปิดอยู่
 * ไม่ใช่ clamp ประวัติจากบรรทัดแรกจนเหตุล่าสุดถูกซ่อน.
 */
export function activeStationProblemReason(
  notes: string | null | undefined,
): string | null {
  let active: string | null = null;
  for (const rawLine of notes?.split("\n") ?? []) {
    const line = rawLine.trim();
    if (line.startsWith(STATION_REPORT_PREFIX)) {
      active = line.slice(STATION_REPORT_PREFIX.length).trim() || null;
    } else if (line.startsWith(STATION_RESOLVED_PREFIX)) {
      active = null;
    }
  }
  return active;
}

/** fallback สำหรับใบเก่าที่ยังไม่ได้ใช้ marker: แสดงหมายเหตุล่าสุด ไม่ยกทั้ง trail มาเป็นเหตุปัจจุบัน */
export function latestPlainProductionNote(
  notes: string | null | undefined,
): string | null {
  const lines = (notes?.split("\n") ?? [])
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith(STATION_REPORT_PREFIX) &&
        !line.startsWith(STATION_RESOLVED_PREFIX) &&
        !line.startsWith(PAPER_DONE_PREFIX),
    );
  return lines.at(-1) ?? null;
}

export function currentProductionProblemReason(input: {
  notes?: string | null;
  qcNotes?: string | null;
}): string | null {
  return (
    activeStationProblemReason(input.notes) ??
    input.qcNotes?.trim() ??
    latestPlainProductionNote(input.notes)
  );
}

/* ───────────────────────── เรื่องที่ยังไม่จบของขั้น ───────────────────────── */

export const PROBLEM_OPEN_STATES = ["OPEN", "ACKNOWLEDGED"] as const;

export type ProblemLineLike = {
  id: string;
  size: string | null;
  color: string | null;
  qty: number;
};

/** รูปของแถวปัญหาเท่าที่จอต้องใช้ — ตรงกับ select ของ production.getById */
export type ProblemRowLike = {
  id: string;
  title: string;
  description: string | null;
  blocksJob: boolean;
  state: string;
  source: string;
  createdAt: Date | string;
  acknowledgedAt: Date | string | null;
  resolvedAt: Date | string | null;
  resolution: string | null;
  raisedBy: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  lines: ProblemLineLike[];
};

export type ProblemStepLike = {
  id: string;
  status: string;
  notes?: string | null;
  qcNotes?: string | null;
  assignedTo?: { id: string; name: string } | null;
  exceptions?: ProblemRowLike[];
};

/**
 * เรื่องหนึ่งเรื่องที่จอวาด — มาจากแถวจริง หรือปั้นจากใบเก่าที่มีแต่ marker
 * `stopsWork` = ตอนนี้งานหยุดจริงไหม (ต้องทั้งตั้งใจให้หยุด และสถานะขั้นหยุดอยู่จริง)
 * แยกจาก `blocksJob` ที่เป็นเจตนาในฐาน เพราะใบที่ Manufacturing V2 เปิดไว้อาจตั้ง blocksJob
 * โดยที่สถานะขั้นฝั่ง legacy ยังเดินอยู่ — จอต้องพูดตามความจริงที่ช่างเห็น ไม่ใช่ตามเจตนา
 */
export type StepProblem = ProblemRowLike & { legacy: boolean; held: boolean; stopsWork: boolean };

const isOpen = (row: ProblemRowLike) =>
  (PROBLEM_OPEN_STATES as readonly string[]).includes(row.state);

/** ขั้นถูกหยุดอยู่หรือไม่ (สถานะงาน) — ต่างจาก "มีเรื่องค้าง" ที่รวมเรื่องแบบไม่หยุดขั้นด้วย */
export const stepIsStopped = (step: Pick<ProblemStepLike, "status">) =>
  step.status === "FAILED" || step.status === "ON_HOLD";

/**
 * เรื่องที่ยังไม่จบของขั้นนี้ เรียงตามเวลาแจ้ง
 * ใบเก่า (ขั้นหยุดอยู่แต่ไม่มีแถว) ได้เรื่องปั้นจาก marker หนึ่งเรื่อง เพื่อให้จอเดิมไม่หาย
 */
export function openProblemsOf(step: ProblemStepLike): StepProblem[] {
  const rows = (step.exceptions ?? []).filter(isOpen);
  const held = step.status === "ON_HOLD";
  const stopped = stepIsStopped(step);
  const list: StepProblem[] = rows.map((row) => ({
    ...row,
    legacy: false,
    held: held && row.blocksJob,
    stopsWork: row.blocksJob && stopped,
  }));
  if (stopped && !list.some((row) => row.blocksJob)) {
    list.unshift({
      id: `legacy:${step.id}`,
      title: currentProductionProblemReason(step) ?? "ยังไม่ระบุเหตุ",
      description: null,
      blocksJob: true,
      state: "OPEN",
      source: "STATION",
      createdAt: new Date(0),
      acknowledgedAt: null,
      resolvedAt: null,
      resolution: null,
      raisedBy: step.assignedTo ?? null,
      owner: null,
      lines: [],
      legacy: true,
      held,
      stopsWork: true,
    });
  }
  return list;
}

/** เรื่องที่ทำให้ขั้นนี้เดินต่อไม่ได้ตอนนี้ — มีได้เรื่องเดียว (server กันไม่ให้ซ้อน) */
export function blockingProblemOf(step: ProblemStepLike): StepProblem | null {
  return openProblemsOf(step).find((row) => row.stopsWork) ?? null;
}

/** มีเรื่องค้างไหม — รวมเรื่องที่ไม่หยุดขั้น (ของเสียไม่กี่ตัวที่ยังทำต่อได้) */
export function stepHasOpenProblem(step: ProblemStepLike): boolean {
  return openProblemsOf(step).length > 0;
}
