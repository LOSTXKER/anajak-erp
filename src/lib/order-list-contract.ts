import type { OrderType } from "@prisma/client";
import { CHANNEL_LABELS, ORDER_TYPE_UI_LABELS } from "@/lib/order-status";

export const CHANNEL_FILTERS = [
  { value: "", label: "ทุกช่องทาง" },
  ...Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label })),
];

export const TYPE_FILTERS = [
  { value: "", label: "ทุกประเภท" },
  ...Object.entries(ORDER_TYPE_UI_LABELS).map(([value, label]) => ({
    value: value as OrderType,
    label,
  })),
];

export type SortDirection = "asc" | "desc";

/** ทิศที่จะได้ตอนกดหัวคอลัมน์ครั้งแรก */
export const SORT_DEFAULT_DIRECTION = {
  orderNumber: "desc",
  totalAmount: "desc",
  createdAt: "desc",
  deadline: "asc",
} as const satisfies Record<string, SortDirection>;

export type SortKey = keyof typeof SORT_DEFAULT_DIRECTION;
export type SortValue = `${SortKey}:${SortDirection}`;
export type SortOption = Readonly<{ value: SortValue; label: string }>;

// ทุกคอลัมน์มีครบสองทิศ — ค่าเดียวกับที่ order.list ยอมรับ
export const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "วันที่ (ล่าสุด)" },
  { value: "createdAt:asc", label: "วันที่ (เก่าสุด)" },
  { value: "deadline:asc", label: "กำหนดส่ง (ใกล้สุด)" },
  { value: "deadline:desc", label: "กำหนดส่ง (ไกลสุด)" },
  { value: "totalAmount:desc", label: "ยอดรวม (มาก→น้อย)" },
  { value: "totalAmount:asc", label: "ยอดรวม (น้อย→มาก)" },
  { value: "orderNumber:desc", label: "เลขออเดอร์ (ล่าสุด)" },
  { value: "orderNumber:asc", label: "เลขออเดอร์ (เก่าสุด)" },
] as const satisfies readonly SortOption[];

/** ค่า default ไม่เก็บใน URL — caller แปลงกลับเป็น null ตอนเขียน URL */
export const DEFAULT_SORT: SortValue = "createdAt:desc";

export const ATTENTION_FILTERS = [
  { value: "", label: "ทุกงาน" },
  { value: "overdue", label: "เลยกำหนด" },
  { value: "due-soon", label: "ใกล้กำหนด 48 ชม." },
  { value: "stuck", label: "งานนิ่งเกิน 3 วัน" },
] as const;

export type OrderAttention = Exclude<
  (typeof ATTENTION_FILTERS)[number]["value"],
  ""
>;

export function validDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10) === value ? value : "";
}

export function resolveOrderListSort(
  rawSort: string | null | undefined,
  canSeeMoney: boolean,
): {
  sortOptions: readonly SortOption[];
  sort: SortValue;
  sortBy: SortKey;
  sortOrder: SortDirection;
} {
  const sortOptions: readonly SortOption[] = canSeeMoney
    ? SORT_OPTIONS
    : SORT_OPTIONS.filter((option) => !option.value.startsWith("totalAmount"));
  const requestedSort = rawSort ?? DEFAULT_SORT;
  const sort = sortOptions.some((option) => option.value === requestedSort)
    ? (requestedSort as SortValue)
    : DEFAULT_SORT;
  const [sortBy, sortOrder] = sort.split(":") as [SortKey, SortDirection];

  return { sortOptions, sort, sortBy, sortOrder };
}
