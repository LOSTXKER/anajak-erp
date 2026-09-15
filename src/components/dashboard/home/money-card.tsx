import Link from "next/link";
import { ChevronRight, ClipboardList, Landmark, ReceiptText } from "lucide-react";
import { FOCUS_INSET, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { cn, formatBaht } from "@/lib/utils";
import type { HomeMoney } from "@/server/services/home-overview";
import { HomeCard, HomeChip, HomeIconTile } from "./home-card";
import styles from "./home.module.css";

/** เงินที่ต้องตาม — แยกจากงานผลิต เห็นเฉพาะคนมีสิทธิ์ see_finance (service คืน null ให้คนอื่น) */
export function MoneyCard({ money }: { money: HomeMoney }) {
  const rows = [
    money.overdueInvoices.count > 0
      ? {
          key: "invoices",
          tone: "danger" as const,
          icon: ReceiptText,
          title: "บิลเลยกำหนด",
          count: `${money.overdueInvoices.count} ใบ`,
          amount: money.overdueInvoices.amount,
          href: "/billing?status=OVERDUE",
        }
      : null,
    money.quotationsAwaiting.count > 0
      ? {
          key: "quotations",
          tone: "warning" as const,
          icon: ClipboardList,
          title: "ใบเสนอราคารอลูกค้าตอบ",
          count: `${money.quotationsAwaiting.count} ใบ`,
          amount: money.quotationsAwaiting.amount,
          href: "/quotations?status=SENT",
        }
      : null,
  ].filter((row) => row !== null);

  return (
    <HomeCard
      id="home-money"
      title="เงินที่ต้องตาม"
      icon={Landmark}
      tone="finance"
      action={rows.length === 0 ? <HomeChip tone="success">เรียบร้อย</HomeChip> : undefined}
    >
      {rows.length === 0 ? (
        <p className={styles.moneyEmpty}>ไม่มีบิลค้างและใบเสนอราคาที่รอตอบ</p>
      ) : (
        <ul className="divide-y divide-divider border-t border-divider">
          {rows.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href}
                className={cn(
                  FOCUS_INSET,
                  INTERACTIVE_PRESSED,
                  styles.moneyRow,
                )}
              >
                <HomeIconTile icon={row.icon} tone={row.tone} />
                <span className="min-w-0 flex-1">
                  <span className={styles.moneyLabel}>{row.title}</span>
                  <span className="block text-xs text-muted">{row.count}</span>
                </span>
                <span
                  className={cn(
                    styles.moneyAmount,
                    row.tone === "danger" ? "text-red-700 dark:text-red-300" : "text-strong",
                  )}
                >
                  {formatBaht(row.amount)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </HomeCard>
  );
}
