"use client";

/**
 * B · หัวใบนำสายตา
 *
 * วิธีคิด: เปิดใบงานมา ตาต้องตกที่ "เรื่องเดียว" ก่อน แล้วค่อยไหลลงไปหารายละเอียด
 * → รวมทุกอย่างที่ตัดสินใจได้ทันที (เลขที่ · สถานะ · ลูกค้า · กำหนดส่ง ·
 *   จำนวน · ยอด · แถบสถานะ) ไว้ในแผ่นเดียวบนสุด พร้อมแถบสีบอกความเร่งด่วน
 * → ที่เหลือลดเสียงลงทั้งหมด: การ์ดเงียบ หัวข้อเล็ก ตัวหนังสือเล็กกว่าหัวใบชัดเจน
 *
 * ข้อแลก: หัวใบสูง กินพื้นที่จอแรกไปมาก (บนโน้ตบุ๊กจอเตี้ยจะเห็นเนื้อหาน้อยลง) ·
 * ของที่ไม่ได้อยู่บนหัวถูกลดความสำคัญเท่ากันหมด แม้บางใบเรื่องสำคัญจะอยู่ข้างล่าง
 */

import { Palette, ShoppingCart, Truck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CUSTOMER_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { demoOrder, demoStatus, demoTotals } from "../_data";
import {
  buildBrand,
  buildCustomerAddress,
  buildCustomerContact,
  buildCustomerHistory,
  buildCustomerTax,
  buildFacts,
  buildOrderMeta,
  buildShipping,
  buildTimeline,
  customerLink,
  CustomerPageLink,
  hasShippingInfo,
  type Row,
} from "../_content";
import {
  ProtoMoreButton,
  ProtoNextStepButton,
  ProtoNotices,
  ProtoStatusRail,
  ProtoTabBar,
} from "../_chrome";

/* ---------------------------------------------------------------- ชิ้นส่วน */

function QuietCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface rounded-2xl px-5 py-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function RowList({ items, cols = 2 }: { items: Row[]; cols?: 1 | 2 }) {
  if (items.length === 0) return null;
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-3.5",
        cols === 2 && "sm:grid-cols-2",
      )}
    >
      {items.map((row) => (
        <div
          key={row.key}
          className={cn("min-w-0", row.wide && cols === 2 && "sm:col-span-2")}
        >
          <dt className="text-2xs uppercase tracking-wide text-muted">{row.label}</dt>
          <dd
            className={cn(
              "mt-0.5 text-sm leading-5 [overflow-wrap:anywhere]",
              row.mono && "font-mono",
              row.tone === "warn"
                ? "text-amber-700 dark:text-amber-300"
                : "font-medium text-strong",
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SubGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-divider pt-4">
      <p className="text-2xs uppercase tracking-wide text-muted/80">{label}</p>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- หน้า */

export function LeadVariant({ thin, showMoney }: { thin: boolean; showMoney: boolean }) {
  const order = demoOrder(thin);
  const totals = demoTotals(thin);
  const status = demoStatus(thin);
  // หัวใบเหลือแค่ "สถานะ + ปุ่ม" ตามที่เบสสั่ง — สี่ข้อเท็จจริงเดิมย้ายลงการ์ดข้อมูลออเดอร์
  // เว้น "ลูกค้า" ที่ไม่ต้องย้ายมา เพราะการ์ดลูกค้าฝั่งซ้ายบอกอยู่แล้ว (ห้ามพูดซ้ำ 2 ที่)
  const headlineFacts = buildFacts(order, totals, showMoney).filter(
    (fact) => fact.key !== "customer",
  );
  const meta = buildOrderMeta(order, showMoney);
  const timeline = buildTimeline(order);
  const tax = buildCustomerTax(order);
  const contact = buildCustomerContact(order);
  const address = buildCustomerAddress(order);
  const history = buildCustomerHistory(order, showMoney);
  const shipping = buildShipping(order);
  const brand = buildBrand(order);
  const custHref = customerLink(order);

  const urgent = order.priority === "URGENT";
  const high = order.priority === "HIGH";

  return (
    <div className="space-y-5">
      {/* ---------------- หัวใบ: แผ่นเดียวจบ ---------------- */}
      <section className="card-surface relative overflow-hidden rounded-2xl">
        {/* แถบสีซ้าย = ความเร่งด่วน · ใบปกติไม่มีแถบ จึงไม่มีสีมารบกวนโดยไม่จำเป็น */}
        {(urgent || high) && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 left-0 w-1",
              urgent ? "bg-red-500" : "bg-amber-500",
            )}
          />
        )}

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-secondary"
              >
                <ShoppingCart className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tabular-nums text-strong">
                    {order.orderNumber}
                  </h1>
                  <Badge variant="accent" size="sm">
                    {CUSTOMER_STATUS_LABELS[status.customerStatus]}
                  </Badge>
                  {(urgent || high) && (
                    <Badge variant={urgent ? "destructive" : "warning"} size="sm">
                      {PRIORITY_LABELS[order.priority]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ProtoNextStepButton thin={thin} showMoney={showMoney} />
              <ProtoMoreButton />
            </div>
          </div>

          {/* แถบสถานะอยู่ในหัวใบ — "งานอยู่ตรงไหน" คือส่วนหนึ่งของหัวเรื่อง ไม่ใช่ของแยก */}
          <div className="-mb-1">
            <ProtoStatusRail thin={thin} />
          </div>
        </div>
      </section>

      <ProtoNotices order={order} />
      <ProtoTabBar showMoney={showMoney} pendingTab="production" />

      {/* ---------------- เนื้อหาที่เหลือ: เงียบทั้งหมด ---------------- */}
      <div className="grid items-start gap-5 pt-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          {order.description?.trim() && (
            <QuietCard title="รายละเอียดงาน">
              <p className="max-w-[70ch] text-sm leading-6 text-secondary [overflow-wrap:anywhere]">
                {order.description}
              </p>
            </QuietCard>
          )}

          <QuietCard
            icon={User}
            title="ลูกค้าและผู้ติดต่อ"
            action={custHref ? <CustomerPageLink href={custHref} /> : undefined}
          >
            {order.customer ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-strong [overflow-wrap:anywhere]">
                      {order.customer.name}
                    </p>
                    {order.customer.company && (
                      <p className="text-sm text-secondary [overflow-wrap:anywhere]">
                        {order.customer.company}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" size="sm">
                    {order.customer.customerType === "CORPORATE"
                      ? "นิติบุคคล"
                      : "บุคคลธรรมดา"}
                  </Badge>
                </div>
                <RowList items={tax} />
                {contact.length > 0 && (
                  <SubGroup label="ช่องทางติดต่อ">
                    <RowList items={contact} />
                  </SubGroup>
                )}
                {address.length > 0 && (
                  <SubGroup label="ที่อยู่และป้ายกำกับ">
                    <RowList items={address} />
                  </SubGroup>
                )}
                {history.length > 0 && (
                  <SubGroup label="ประวัติลูกค้า">
                    <RowList items={history} />
                  </SubGroup>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">ใบนี้ยังไม่ผูกกับลูกค้า</p>
            )}
          </QuietCard>
        </div>

        <div className="space-y-5">
          <QuietCard
            title="ข้อมูลออเดอร์"
            action={
              <Button variant="ghost" size="sm" aria-label="แก้ไขข้อมูลออเดอร์">
                แก้ไข
              </Button>
            }
          >
            {/* กำหนดส่ง · จำนวน · ยอด — เบสสั่งเอาออกจากหัวใบ (2026-08-30) แต่สามอย่างนี้
                ไม่มีที่อื่นในหน้าเลย ถ้าลบตามตรง ๆ = ข้อมูลหาย จึงย้ายมาไว้บนสุดของการ์ดนี้
                และยังทำให้เด่นกว่าแถวอื่นด้วยขนาด เพราะยังเป็นของที่คนเปิดมาหาบ่อยที่สุด
                (“ลูกค้า” ไม่ต้องย้ายมา — การ์ดลูกค้าข้างซ้ายบอกอยู่แล้ว) */}
            {headlineFacts.length > 0 && (
              <dl
                className={cn(
                  "mb-4 grid gap-3 border-b border-divider pb-4",
                  // ไม่เห็นเงิน = เหลือ 2 ช่อง ต้องยุบคอลัมน์ตาม ไม่งั้นเหลือช่องว่างค้างข้างขวา
                  headlineFacts.length >= 3 ? "grid-cols-3" : "grid-cols-2",
                )}
              >
                {headlineFacts.map((fact) => (
                  <div key={fact.key} className="min-w-0">
                    <dt className="text-2xs uppercase tracking-wide text-muted">
                      {fact.label}
                    </dt>
                    <dd
                      className={cn(
                        "mt-0.5 text-base font-semibold leading-5 [overflow-wrap:anywhere]",
                        fact.empty
                          ? fact.tone === "warn"
                            ? "text-sm font-medium text-amber-700 dark:text-amber-300"
                            : "text-sm font-medium text-muted"
                          : "text-strong",
                      )}
                    >
                      {fact.value}
                    </dd>
                    {fact.detail && (
                      <p
                        className={cn(
                          "mt-0.5 text-2xs [overflow-wrap:anywhere]",
                          fact.tone === "warn" && !fact.empty
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-muted",
                        )}
                      >
                        {fact.detail}
                      </p>
                    )}
                  </div>
                ))}
              </dl>
            )}
            <RowList items={meta} cols={1} />
          </QuietCard>

          <QuietCard
            icon={Truck}
            title="การจัดส่ง"
            action={
              <Button variant="ghost" size="sm">
                {hasShippingInfo(order) ? "แก้ไข" : "เพิ่มที่อยู่"}
              </Button>
            }
          >
            {shipping.length > 0 ? (
              <RowList items={shipping} cols={1} />
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-strong">ยังไม่มีที่อยู่จัดส่ง</p>
                <p className="text-sm text-muted">
                  {order.customer?.address
                    ? "หน้าแก้ไขสามารถเลือกใช้ที่อยู่ลูกค้าได้ทันที"
                    : "เพิ่มผู้รับและที่อยู่ก่อนสร้างใบส่งของ"}
                </p>
              </div>
            )}
            {order.trackingNumber && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-3">
                <div className="min-w-0">
                  <p className="text-2xs uppercase tracking-wide text-muted">
                    เลขพัสดุในออเดอร์
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-medium text-strong [overflow-wrap:anywhere]">
                    {order.trackingNumber}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  ดูการจัดส่ง
                </Button>
              </div>
            )}
          </QuietCard>

          {brand.length > 0 && (
            <QuietCard icon={Palette} title="แบรนด์ลูกค้า">
              <RowList items={brand} cols={1} />
            </QuietCard>
          )}

          <dl className="flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-xs text-muted">
            {timeline.map((item) => (
              <div key={item.label} className="flex min-w-0 flex-wrap gap-x-1.5">
                <dt>{item.label}</dt>
                <dd className="font-medium text-secondary [overflow-wrap:anywhere]">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
