export type TaskAttention = "blocked" | "overdue" | "due-soon" | "normal";
export type TaskOwnership = "mine" | "team";

export type TaskListItem = {
  key: string;
  href: string;
  title: string;
  description?: string | null;
  deadline?: Date | string | null;
  attention: TaskAttention;
  ownership: TaskOwnership;
  badge?: string;
  badgeTone?: "default" | "accent" | "warning" | "destructive";
  meta?: string;
};

export type TaskGroup = {
  id: "attention" | "mine" | "team";
  title: string;
  description: string;
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
      description: "เลยกำหนด ติดปัญหา หรือครบกำหนดใน 2 วัน",
      items: takeUnique((item) => item.attention !== "normal"),
    },
    {
      id: "mine",
      title: "งานของฉัน",
      description: "งานที่มอบให้คุณโดยตรง",
      items: takeUnique((item) => item.ownership === "mine"),
    },
    {
      id: "team",
      title: "คิวทีม",
      description: "งานส่วนกลางและงานที่ยังไม่มีคนรับ",
      items: takeUnique(() => true),
    },
  ];
}
