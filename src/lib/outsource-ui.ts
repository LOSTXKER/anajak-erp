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
  RECEIVED_BACK: { label: "รับกลับแล้ว รอตรวจรับ", variant: "warning" },
  QC_PASSED: { label: "ตรวจรับผ่าน", variant: "success" },
  QC_FAILED: { label: "ตรวจรับไม่ผ่าน", variant: "destructive" },
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
  { value: "qc", label: "รอตรวจรับ" },
  { value: "done", label: "ประวัติ" },
];

const RECEIVE_QUEUE_STATUSES: ReadonlySet<string> = new Set([
  "SENT",
  "IN_PROGRESS",
  "COMPLETED",
]);

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

export type OutsourceAvailableCommand =
  | "share"
  | "markSent"
  | "receiveBack"
  | "passQc"
  | "failQc"
  | "cancelDraft";

export interface OutsourceActionAvailability {
  canShare: boolean;
  canMarkSent: boolean;
  canReceiveBack: boolean;
  canPassQc: boolean;
  canFailQc: boolean;
  canCancelDraft: boolean;
}

/**
 * แปลงคำสั่งที่ server อนุญาตเป็นปุ่มเท่านั้น หน้าจอห้ามเดาจาก status/role เอง.
 * enabled ใช้ปิดปุ่มชั่วคราวเมื่อข้อมูล cache ไม่สด โดยไม่เปลี่ยนกติกางาน.
 */
export function outsourceActionAvailability(
  availableCommands: readonly OutsourceAvailableCommand[],
  options: { enabled?: boolean } = {},
): OutsourceActionAvailability {
  const commands = new Set(
    options.enabled === false ? [] : availableCommands,
  );

  return {
    canShare: commands.has("share"),
    canMarkSent: commands.has("markSent"),
    canReceiveBack: commands.has("receiveBack"),
    canPassQc: commands.has("passQc"),
    canFailQc: commands.has("failQc"),
    canCancelDraft: commands.has("cancelDraft"),
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

/**
 * คิวรับกลับต้องอ่านตามกำหนดรับ ไม่ใช่ตามเวลาที่สร้างใบงาน:
 * งานเลยกำหนดขึ้นก่อน แล้วตามด้วยวันที่ใกล้สุด โดยรักษาลำดับเดิมเมื่อไม่มีวันที่
 */
export function sortOutsourceByExpectedReturn<
  T extends { expectedBackAt: Date | string | null; status: string },
>(orders: readonly T[], now = new Date()): T[] {
  return orders
    .map((order, index) => ({ order, index }))
    .sort((a, b) => {
      const overdueDiff =
        Number(isOutsourceOverdue(b.order, now)) -
        Number(isOutsourceOverdue(a.order, now));
      if (overdueDiff !== 0) return overdueDiff;

      const expectedAt = (value: Date | string | null) => {
        if (!value) return Number.POSITIVE_INFINITY;
        const timestamp = new Date(value).getTime();
        return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
      };
      const dueDiff = expectedAt(a.order.expectedBackAt) - expectedAt(b.order.expectedBackAt);
      return dueDiff || a.index - b.index;
    })
    .map(({ order }) => order);
}
