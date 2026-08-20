const STATION_REPORT_PREFIX = "[แจ้งปัญหาจากสถานี] ";
const STATION_RESOLVED_PREFIX = "[แก้ปัญหาแล้ว] ";

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
        !line.startsWith(STATION_RESOLVED_PREFIX),
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
