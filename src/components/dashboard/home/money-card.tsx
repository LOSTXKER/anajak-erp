import Link from "next/link";
import { ArrowRight, ChevronRight, ClipboardList, ReceiptText, Wallet } from "lucide-react";
import { c, CardHead } from "@/components/kit/kit";
import { formatBaht } from "@/lib/utils";
import type { HomeMoney } from "@/server/services/home-overview";

/** เงินที่ต้องตาม (ต้นแบบ moneyHTML) — แยกจากงานผลิต เห็นเฉพาะคนมีสิทธิ์ see_finance (service คืน null ให้คนอื่น) */
export function MoneyCard({ money }: { money: HomeMoney }) {
  const rows = [
    money.overdueInvoices.count > 0
      ? {
          key: "invoices",
          tone: "bad" as const,
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
          tone: "warn" as const,
          icon: ClipboardList,
          title: "ใบเสนอราคารอลูกค้าตอบ",
          count: `${money.quotationsAwaiting.count} ใบ`,
          amount: money.quotationsAwaiting.amount,
          href: "/quotations?status=SENT",
        }
      : null,
  ].filter((row) => row !== null);

  return (
    <section className={c("card")} aria-labelledby="home-money">
      <CardHead
        icon={Wallet}
        tone="bad"
        id="home-money"
        title="เงินที่ต้องตาม"
        right={
          <>
            {/* ไม่มีรายการ = "เก็บครบแล้ว" ไม่ใช่ "โหลดไม่ขึ้น" — ป้ายนี้ของจริง ต้นแบบเว้นว่าง */}
            {rows.length === 0 ? <span className={c("chip good")}>เรียบร้อย</span> : null}
            <Link href="/billing" className={c("btn ghost sm")}>
              ไปหน้าการเงิน
              <ArrowRight aria-hidden="true" />
            </Link>
          </>
        }
      />
      {rows.length === 0 ? (
        <p className={c("mempty")}>ไม่มีบิลค้างและใบเสนอราคาที่รอตอบ</p>
      ) : (
        rows.map((row) => (
          <Link key={row.key} href={row.href} className={c("mrow", row.tone)}>
            <span className={c("tl")} aria-hidden="true">
              <row.icon />
            </span>
            <span className={c("tx")}>
              <b>{row.title}</b>
              <small>{row.count}</small>
            </span>
            <span className={c("amt")}>{formatBaht(row.amount)}</span>
            <ChevronRight className={c("arrow")} aria-hidden="true" />
          </Link>
        ))
      )}
    </section>
  );
}
