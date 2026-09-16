import type { LucideIcon } from "lucide-react";

export type TaskAttention = "blocked" | "overdue" | "due-soon" | "normal";
export type TaskOwnership = "mine" | "team";
/** โทนของกอง/แถว — ชุดเดียวกับ chip/ic ของ kit (gray = โทนเปล่า) */
export type TaskTone = "bad" | "warn" | "gray";

export type TaskListItem = {
  key: string;
  href: string;
  /** ไอคอนประจำเรื่อง (ต้นแบบ .tasks .ti) — บอกว่าเป็นงานผลิต/บิล/ร้านนอก ตั้งแต่ยังไม่อ่านข้อความ */
  icon?: LucideIcon;
  title: string;
  description?: string | null;
  deadline?: Date | string | null;
  /** คำนำหน้าวันที่ เช่น นัดรับ / ครบกำหนดชำระ — ไม่ใส่ = กำหนดส่ง */
  deadlineLabel?: string;
  attention: TaskAttention;
  ownership: TaskOwnership;
  /** เลขออเดอร์แยกเป็นช่องของตัวเอง (ต้นแบบ a.mono.tid) — ลิงก์เมื่อรู้ปลายทางจริง */
  orderNumber?: string;
  orderHref?: string;
  /** คำสั่งบนปุ่มท้ายแถว เช่น ตรวจรับของ / ออกบิล — บอกว่ากดแล้วไปทำอะไร */
  actionLabel?: string;
  /** กติกาที่ห้ามพลาด เช่น Blind ship — ขึ้นเป็นป้าย ไม่ใช่ข้อความจาง */
  warning?: string;
  meta?: string;
};

export type TaskGroup = {
  id: "attention" | "mine" | "team";
  title: string;
  tone: TaskTone;
  description?: string;
  items: TaskListItem[];
};

const ATTENTION_WEIGHT: Record<TaskAttention, number> = {
  blocked: 0,
  overdue: 1,
  "due-soon": 2,
  normal: 3,
};

function deadlineTime(value: TaskListItem["deadline"]) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

export function taskAttention(deadline: Date | string | null | undefined, blocked = false) {
  if (blocked) return "blocked" satisfies TaskAttention;
  if (!deadline) return "normal" satisfies TaskAttention;

  const dueAt = new Date(deadline).getTime();
  if (Number.isNaN(dueAt)) return "normal" satisfies TaskAttention;

  const now = Date.now();
  if (dueAt < now) return "overdue" satisfies TaskAttention;
  if (dueAt - now <= 2 * 24 * 60 * 60 * 1000) return "due-soon" satisfies TaskAttention;
  return "normal" satisfies TaskAttention;
}

/** โทนของแถวมาจากความเร่งของเรื่องนั้น — กล่องไอคอนแดง/ส้ม/เทาตามต้นแบบ */
export function taskTone(attention: TaskAttention): TaskTone {
  if (attention === "blocked" || attention === "overdue") return "bad";
  if (attention === "due-soon") return "warn";
  return "gray";
}

export function groupTaskItems(items: TaskListItem[]): TaskGroup[] {
  const sorted = items.toSorted((a, b) => {
    const byAttention = ATTENTION_WEIGHT[a.attention] - ATTENTION_WEIGHT[b.attention];
    if (byAttention !== 0) return byAttention;
    const byDeadline = deadlineTime(a.deadline) - deadlineTime(b.deadline);
    if (byDeadline !== 0) return byDeadline;
    return a.title.localeCompare(b.title, "th");
  });

  // หนึ่ง action โผล่ได้กองเดียว: ต้องทำก่อนชนะงานของฉัน และงานของฉันชนะคิวทีม
  const seen = new Set<string>();
  const takeUnique = (predicate: (item: TaskListItem) => boolean) =>
    sorted.filter((item) => {
      if (!predicate(item) || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });

  return [
    {
      id: "attention",
      title: "ต้องทำก่อน",
      tone: "bad",
      description: "เลยกำหนด ติดปัญหา หรือครบกำหนดใน 2 วัน",
      items: takeUnique((item) => item.attention !== "normal"),
    },
    {
      // ชื่อกองของต้นแบบ — เกณฑ์ยังเป็น "งานที่มอบให้เรา" เหมือนเดิม (ไม่เปลี่ยนว่าใครเห็นอะไร)
      id: "mine",
      title: "ค้างบนโต๊ะ",
      tone: "warn",
      description: "งานที่มอบให้คุณโดยตรง",
      items: takeUnique((item) => item.ownership === "mine"),
    },
    {
      id: "team",
      title: "คิวทีม",
      tone: "gray",
      description: "งานส่วนกลางและงานที่ยังไม่มีคนรับ",
      items: takeUnique(() => true),
    },
  ];
}
