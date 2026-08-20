import {
  FACTORY_STATIONS,
  factoryStationKeyForStep,
  type FactoryStationKey,
} from "@/lib/factory-station";
import {
  OUTSOURCE_ACTIVE_STATUSES,
  STEP_TYPE_LABELS,
  evaluateHeatPressGate,
} from "@/lib/production-steps";
import { firstPendingStepIdsByLane } from "@/lib/production-step-actions";
import { currentProductionProblemReason } from "@/lib/production-problem";

export type ProductionControlTone =
  | "danger"
  | "warning"
  | "active"
  | "success"
  | "neutral";

export type ProductionControlStep = {
  id: string;
  stepType: string;
  customStepName?: string | null;
  status: string;
  sortOrder: number;
  qtyDone?: number | null;
  qtyTotal?: number | null;
  notes?: string | null;
  qcNotes?: string | null;
  assignedTo?: { id: string; name: string } | null;
  completedAt?: Date | string | null;
  outsourceOrders?: readonly { status: string }[];
  printRunItems?: readonly { printRun: { runNumber: string } }[];
};

export type GarmentControlLine = {
  sku: string;
  productName: string;
  size: string;
  color: string | null;
  needed: number;
  issued: number;
  returned: number;
};

export type GarmentControlSummary = {
  lines: readonly GarmentControlLine[];
  totalNeeded: number;
  netIssued: number;
  fulfilled: number;
  missing: number;
};

export type GarmentControlEvidence =
  | { kind: "not-applicable" }
  | { kind: "unknown"; reason: string }
  | { kind: "known"; summary: GarmentControlSummary };

export type ProductionControlReadiness = {
  status: "not-applicable" | "unknown" | "waiting" | "active" | "ready" | "issue";
  statusLabel: string;
  detail: string;
  tone: ProductionControlTone;
};

export type ProductionControlRow<S extends ProductionControlStep> = {
  step: S;
  label: string;
  station: FactoryStationKey | null;
  stationLabel: string;
  statusLabel: string;
  tone: ProductionControlTone;
  actualLabel: string;
  ownerLabel: string;
  blocker: string | null;
  requiresAttention: boolean;
  stationExecutable: boolean;
};

export type ProductionControlAttention<S extends ProductionControlStep> = {
  kind: "step" | "garment-readiness";
  step: S | null;
  label: string;
  station: FactoryStationKey | null;
  stationLabel: string;
  tone: "danger" | "warning";
  blocker: string;
  detail: string | null;
};

export type ProductionControlView<S extends ProductionControlStep> = {
  rows: ProductionControlRow<S>[];
  attention: ProductionControlAttention<S> | null;
  garmentReadiness: ProductionControlReadiness;
  dtfReadiness: ProductionControlReadiness | null;
  overallLabel: string;
  overallTone: ProductionControlTone;
};

const STATION_LABELS = new Map(
  FACTORY_STATIONS.map((station) => [station.key, station.label]),
);

function stepLabel(step: ProductionControlStep) {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

export function summarizeGarmentControl(
  lines: readonly GarmentControlLine[],
): GarmentControlSummary {
  return lines.reduce<GarmentControlSummary>(
    (summary, line) => {
      const net = Math.max(0, line.issued - line.returned);
      summary.totalNeeded += line.needed;
      summary.netIssued += net;
      summary.fulfilled += Math.min(line.needed, net);
      summary.missing += Math.max(0, line.needed - net);
      return summary;
    },
    { lines, totalNeeded: 0, netIssued: 0, fulfilled: 0, missing: 0 },
  );
}

function actualLabel(step: ProductionControlStep) {
  if (step.qtyTotal != null && step.qtyTotal > 0) {
    return `${step.qtyDone ?? 0} / ${step.qtyTotal} ตัว`;
  }
  return step.status === "COMPLETED" ? "เสร็จแล้ว" : "—";
}

function rowRank(row: ProductionControlRow<ProductionControlStep>) {
  if (row.tone === "danger") return 0;
  if (row.step.stepType === "GARMENT_PICK" && row.blocker) return 1;
  if (row.step.stepType === "CUSTOM" && !row.station) return 2;
  if (row.tone === "warning") return 3;
  return 9;
}

function garmentReadiness(
  evidence: GarmentControlEvidence,
): ProductionControlReadiness {
  if (evidence.kind === "not-applicable") {
    return {
      status: "not-applicable",
      statusLabel: "ไม่เกี่ยวข้อง",
      detail: "ใบผลิตนี้ไม่มีเสื้อจากสต๊อค",
      tone: "neutral",
    };
  }
  if (evidence.kind === "unknown") {
    return {
      status: "unknown",
      statusLabel: "ยังไม่ทราบ",
      detail: evidence.reason,
      tone: "warning",
    };
  }
  if (evidence.summary.missing > 0) {
    return {
      status: "issue",
      statusLabel: `ขาด ${evidence.summary.missing.toLocaleString("th-TH")}`,
      detail: evidence.summary.lines[0]?.productName || "รายการเสื้อของใบผลิต",
      tone: "warning",
    };
  }
  return {
    status: "ready",
    statusLabel: "พร้อม",
    detail: evidence.summary.lines[0]?.productName || "เบิกครบตามจำนวน",
    tone: "success",
  };
}

function dtfReadiness<S extends ProductionControlStep>(
  rows: readonly ProductionControlRow<S>[],
): ProductionControlReadiness | null {
  const dtfRows = rows.filter((row) => row.step.stepType === "DTF_PRINT");
  if (dtfRows.length === 0) return null;

  if (dtfRows.every((row) => row.step.status === "COMPLETED")) {
    return {
      status: "ready",
      statusLabel: "เสร็จ",
      detail: "ผ่านขั้นพิมพ์แล้ว",
      tone: "success",
    };
  }

  const issue = dtfRows.find((row) => row.tone === "danger" || row.requiresAttention);
  if (issue) {
    return {
      status: "issue",
      statusLabel: "มีปัญหา",
      detail: issue.blocker || issue.statusLabel,
      tone: issue.tone === "danger" ? "danger" : "warning",
    };
  }

  const active = dtfRows.find(
    (row) => row.step.status === "IN_PROGRESS" || row.tone === "active",
  );
  if (active) {
    return {
      status: "active",
      statusLabel: "กำลังพิมพ์",
      detail: active.blocker || active.statusLabel,
      tone: "active",
    };
  }

  return {
    status: "waiting",
    statusLabel: "ยังไม่พร้อม",
    detail: "รอพิมพ์ฟิล์มให้ครบ",
    tone: "warning",
  };
}

export function buildProductionControlView<S extends ProductionControlStep>(
  steps: readonly S[],
  garmentEvidence: GarmentControlEvidence,
): ProductionControlView<S> {
  const ordered = [...steps].sort((left, right) => left.sortOrder - right.sortOrder);
  const firstPending = firstPendingStepIdsByLane(ordered);
  const pressGate = evaluateHeatPressGate(ordered);

  const rows = ordered.map<ProductionControlRow<S>>((step) => {
    const station = factoryStationKeyForStep(step.stepType);
    const activeOutsource = (step.outsourceOrders ?? []).find((order) =>
      OUTSOURCE_ACTIVE_STATUSES.includes(order.status),
    );
    const activeRun = step.printRunItems?.[0]?.printRun;
    let tone: ProductionControlTone = "neutral";
    let statusLabel = "รอดำเนินการ";
    let blocker: string | null = null;
    let requiresAttention = false;

    if (step.status === "FAILED") {
      tone = "danger";
      statusLabel = "มีปัญหา";
      blocker = currentProductionProblemReason(step) || "มีปัญหาที่ต้องตรวจสอบ";
      requiresAttention = true;
    } else if (step.status === "ON_HOLD") {
      tone = "warning";
      statusLabel = "พักไว้";
      blocker = currentProductionProblemReason(step) || "รอหัวหน้าตัดสินใจ";
      requiresAttention = true;
    } else if (step.status === "COMPLETED") {
      tone = "success";
      statusLabel = "เสร็จแล้ว";
    } else if (step.status === "IN_PROGRESS") {
      tone = "active";
      statusLabel = "กำลังทำ";
    } else if (
      step.stepType === "GARMENT_PICK" &&
      garmentEvidence.kind === "known" &&
      garmentEvidence.summary.missing > 0
    ) {
      tone = "warning";
      statusLabel = "ต้องจัดการ";
      blocker = `ยังไม่ได้เบิกเสื้อ ${garmentEvidence.summary.missing.toLocaleString("th-TH")} ตัว`;
      requiresAttention = true;
    } else if (step.stepType === "HEAT_PRESS" && !pressGate.ready) {
      tone = "neutral";
      statusLabel = "รอเงื่อนไข";
      blocker = pressGate.waitingOn.join(" · ") || "รอเงื่อนไขก่อนรีดร้อน";
    } else if (activeRun) {
      tone = "active";
      statusLabel = "อยู่ในรอบพิมพ์";
      blocker = `รอบ ${activeRun.runNumber}`;
    } else if (activeOutsource) {
      tone = "active";
      statusLabel = "อยู่ร้านนอก";
      blocker = "รอรับกลับและตรวจ QC";
    } else if (step.stepType === "CUSTOM" && !station) {
      tone = "warning";
      statusLabel = "ต้องจัดเส้นทาง";
      blocker = "งานแก้นี้ยังไม่ได้ระบุจุดทำงาน";
      requiresAttention = true;
    } else if (firstPending.has(step.id)) {
      tone = "neutral";
      statusLabel = "พร้อมทำ";
    } else {
      tone = "neutral";
      statusLabel = "รอขั้นก่อนหน้า";
      blocker = "รอขั้นก่อนหน้าในสายงานเดียวกัน";
    }

    if (
      step.status !== "COMPLETED" &&
      step.status !== "FAILED" &&
      step.status !== "ON_HOLD" &&
      step.stepType === "GARMENT_PICK" &&
      garmentEvidence.kind === "known" &&
      garmentEvidence.summary.missing > 0
    ) {
      blocker = `ยังไม่ได้เบิกเสื้อ ${garmentEvidence.summary.missing.toLocaleString("th-TH")} ตัว`;
      requiresAttention = true;
      tone = "warning";
      statusLabel = "ต้องจัดการ";
    }

    if (
      step.status !== "COMPLETED" &&
      step.status !== "FAILED" &&
      step.status !== "ON_HOLD" &&
      step.stepType === "GARMENT_PICK" &&
      garmentEvidence.kind === "unknown"
    ) {
      blocker = garmentEvidence.reason;
      requiresAttention = true;
      if (step.status !== "IN_PROGRESS") {
        tone = "warning";
        statusLabel = "ยังไม่ทราบ";
      }
    }

    if (
      step.status !== "COMPLETED" &&
      step.status !== "FAILED" &&
      step.status !== "ON_HOLD" &&
      step.stepType === "HEAT_PRESS" &&
      garmentEvidence.kind === "unknown" &&
      !ordered.some((candidate) => candidate.stepType === "GARMENT_PICK")
    ) {
      blocker = garmentEvidence.reason;
      requiresAttention = true;
      if (step.status !== "IN_PROGRESS") {
        tone = "warning";
        statusLabel = "รอตรวจเสื้อ";
      }
    }

    return {
      step,
      label: stepLabel(step),
      station,
      stationLabel: station ? (STATION_LABELS.get(station) ?? station) : "ไม่มีสถานีรองรับ",
      statusLabel,
      tone,
      actualLabel: actualLabel(step),
      ownerLabel: step.assignedTo?.name || "ยังไม่มอบหมาย",
      blocker,
      requiresAttention,
      stationExecutable: station !== null,
    };
  });

  const stepAttention = [...rows]
    .filter((row) => row.requiresAttention && row.blocker !== null)
    .sort((left, right) => rowRank(left) - rowRank(right))[0] ?? null;
  const garmentUnknownAttention = garmentEvidence.kind === "unknown"
    ? {
        rank: 1,
        value: {
          kind: "garment-readiness" as const,
          step: ordered.find((step) => step.stepType === "GARMENT_PICK") ?? null,
          label: "ความพร้อมเสื้อ",
          station: ordered.some((step) => step.stepType === "GARMENT_PICK")
            ? factoryStationKeyForStep("GARMENT_PICK")
            : null,
          stationLabel: ordered.some((step) => step.stepType === "GARMENT_PICK")
            ? (STATION_LABELS.get("prep") ?? "เตรียมเสื้อ")
            : "ใบเก่าไม่มีขั้นเตรียมเสื้อ",
          tone: "warning" as const,
          blocker: "ยังยืนยันความพร้อมเสื้อไม่ได้",
          detail: garmentEvidence.reason,
        },
      }
    : null;
  const stepAttentionCandidate = stepAttention
    ? {
        rank: rowRank(stepAttention),
        value: {
          kind: "step" as const,
          step: stepAttention.step,
          label: stepAttention.label,
          station: stepAttention.station,
          stationLabel: stepAttention.stationLabel,
          tone: stepAttention.tone === "danger" ? "danger" as const : "warning" as const,
          blocker: stepAttention.blocker!,
          detail: stepAttention.blocker,
        },
      }
    : null;
  const attention = [stepAttentionCandidate, garmentUnknownAttention]
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((left, right) => left.rank - right.rank)[0]?.value ?? null;
  const allComplete = rows.length > 0 && rows.every((row) => row.step.status === "COMPLETED");
  const hasDanger = rows.some((row) => row.tone === "danger");
  const hasAttention = attention !== null;
  const hasActive = rows.some((row) => row.tone === "active");

  return {
    rows,
    attention,
    garmentReadiness: garmentReadiness(garmentEvidence),
    dtfReadiness: dtfReadiness(rows),
    overallLabel: allComplete
      ? "เสร็จงานผลิต"
      : hasDanger || hasAttention
        ? "ต้องจัดการ"
        : hasActive
          ? "กำลังผลิต"
          : "รอดำเนินการ",
    overallTone: allComplete
      ? "success"
      : hasDanger
        ? "danger"
        : hasAttention
          ? "warning"
          : hasActive
            ? "active"
            : "neutral",
  };
}
