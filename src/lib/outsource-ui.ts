export type OutsourceStatus =
  | "DRAFT"
  | "SENT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "RECEIVED_BACK"
  | "QC_PASSED"
  | "QC_FAILED";

export type OutsourceStatusVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "destructive";

export type OutsourceQueue = "send" | "receive" | "qc" | "done";

export const OUTSOURCE_STATUS_CONFIG: Record<
  OutsourceStatus,
  { label: string; variant: OutsourceStatusVariant }
> = {
  DRAFT: { label: "รอส่งร้าน", variant: "default" },
  SENT: { label: "ส่งร้านแล้ว", variant: "accent" },
  IN_PROGRESS: { label: "ร้านกำลังทำ", variant: "accent" },
  COMPLETED: { label: "ร้านทำเสร็จ", variant: "accent" },
  RECEIVED_BACK: { label: "รับกลับแล้ว รอ QC", variant: "warning" },
  QC_PASSED: { label: "QC ผ่าน", variant: "success" },
  QC_FAILED: { label: "QC ไม่ผ่าน", variant: "destructive" },
};

export const OUTSOURCE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(OUTSOURCE_STATUS_CONFIG).map(([status, config]) => [status, config.label])
);

// งานที่ยังไม่จบรอบ — production ใช้กั้นการเปิดรอบ/ผ่านรวดทับงานที่ค้างอยู่
export const OUTSOURCE_ACTIVE_STATUSES = [
  "DRAFT",
  "SENT",
  "IN_PROGRESS",
  "COMPLETED",
  "RECEIVED_BACK",
];

export const OUTSOURCE_QUEUE_FILTERS: ReadonlyArray<{
  value: OutsourceQueue;
  label: string;
}> = [
  { value: "send", label: "รอส่งร้าน" },
  { value: "receive", label: "รับกลับ" },
  { value: "qc", label: "รอ QC" },
  { value: "done", label: "ประวัติ" },
];

const RECEIVE_QUEUE_STATUSES: ReadonlySet<string> = new Set([
  "SENT",
  "IN_PROGRESS",
  "COMPLETED",
]);

const DONE_STATUSES: ReadonlySet<string> = new Set(["QC_PASSED", "QC_FAILED"]);

export function outsourceQueueForStatus(status: string): OutsourceQueue {
  if (status === "DRAFT") return "send";
  if (RECEIVE_QUEUE_STATUSES.has(status)) return "receive";
  if (status === "RECEIVED_BACK") return "qc";
  return "done";
}

export function outsourceStatusMeta(status: string) {
  return (
    OUTSOURCE_STATUS_CONFIG[status as OutsourceStatus] ?? {
      label: status,
      variant: "default" as const,
    }
  );
}

export interface OutsourceActionPermissions {
  canHandleGoods: boolean;
  canJudgeQc: boolean;
  canManageSettings: boolean;
}

export interface OutsourceActionAvailability {
  canShare: boolean;
  canMarkSent: boolean;
  canReceiveBack: boolean;
  canPassQc: boolean;
  canFailQc: boolean;
  canCancelDraft: boolean;
}

/**
 * กติกาปุ่มหน้า Outsource คู่กับ permission/status ฝั่ง server
 * เพื่อไม่ให้หลายหน้าประกาศเงื่อนไขคนละชุดแล้วชวนผู้ใช้กดสิ่งที่ server ปฏิเสธ
 */
export function outsourceActionAvailability(
  status: string,
  permissions: OutsourceActionPermissions
): OutsourceActionAvailability {
  const isDraft = status === "DRAFT";
  const canJudgeThisQc = status === "RECEIVED_BACK" && permissions.canJudgeQc;

  return {
    canShare: permissions.canHandleGoods && !DONE_STATUSES.has(status),
    canMarkSent: permissions.canHandleGoods && isDraft,
    canReceiveBack:
      permissions.canHandleGoods && RECEIVE_QUEUE_STATUSES.has(status),
    canPassQc: canJudgeThisQc,
    canFailQc: canJudgeThisQc,
    canCancelDraft: permissions.canManageSettings && isDraft,
  };
}

const OVERDUE_STATUSES: ReadonlySet<string> = new Set([
  "DRAFT",
  "SENT",
  "IN_PROGRESS",
  "COMPLETED",
]);

// กำหนดรับหมายถึงจบวันนั้น ร้านยังมีเวลาถึง 23:59 — รับ now เพื่อให้ unit test ไม่ผูกนาฬิกา
export function isOutsourceOverdue(
  order: { expectedBackAt: Date | string | null; status: string },
  now = new Date()
): boolean {
  if (!order.expectedBackAt || !OVERDUE_STATUSES.has(order.status)) return false;
  const due = new Date(order.expectedBackAt);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(23, 59, 59, 999);
  return due < now;
}
