import Link from "next/link";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON } from "@/components/ui/tokens";

const pages = [
  ["/billing", "บิลทั้งหมด"],
  ["/billing/notes", "ใบวางบิล"],
  ["/billing/aging", "ลูกหนี้"],
  ["/billing/tax", "ภาษีขาย"],
  ["/billing/wht", "หัก ณ ที่จ่าย"],
] as const;

export function BillingNavigation({ active }: { active: (typeof pages)[number][0] }) {
  return (
    <nav aria-label="งานการเงิน" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-divider pb-3">
      {pages.map(([href, label]) => (
        <Link key={href} href={href} aria-current={active === href ? "page" : undefined}
          className={cn("rounded py-1 text-sm", FOCUS_BUTTON, active === href ? "font-semibold text-blue-700 dark:text-blue-300" : "text-secondary hover:text-strong")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
