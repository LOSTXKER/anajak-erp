import type { LucideIcon } from "lucide-react";
import { DASHED_INTERACTIVE, FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

/**
 * กล่อง "ยังไม่มีของ — กดเพื่อเพิ่ม" ขอบประเต็มแถว
 *
 * ที่เดียวของทั้งระบบ: สินค้า/ลาย/ส่วนเสริมในชุดงาน + ค่าใช้จ่ายเพิ่มเติม ใช้ตัวนี้ร่วมกัน
 * (เบสสั่ง 2026-08-05 "ค่าใช้จ่ายเพิ่มเติม ถ้ายังไม่มีรายการ ทำเป็นกล่อง CTA แบบรายการ")
 * — เดิมคลาสก้อนนี้ถูกก๊อปไว้หลายที่ พอแก้ที่เดียวอีกที่ก็เพี้ยนทันที
 */
export function AddCard({
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        DASHED_INTERACTIVE,
        FOCUS_BUTTON,
        "flex w-full flex-col items-center gap-1.5 rounded-lg p-4 text-center transition-colors hover:bg-interactive-hover hover:text-strong active:bg-interactive-pressed"
      )}
    >
      <Icon className="h-6 w-6 shrink-0 text-muted" strokeWidth={1.75} />
      <span>
        <span className="block text-sm font-medium text-secondary">
          {label}
        </span>
        <span className="block text-xs text-muted">
          {desc}
        </span>
      </span>
    </button>
  );
}
