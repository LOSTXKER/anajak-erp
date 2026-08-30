"use client";

/**
 * A · เรียบอย่างเอกสาร
 *
 * วิธีคิด: ใบงานคือ "เอกสารที่ต้องอ่าน" ไม่ใช่ "แดชบอร์ดที่ต้องสแกน"
 * → ถอดกรอบการ์ดออกทั้งหมด ใช้ที่ว่างกับเส้นบางเป็นตัวแบ่งแทน
 * → ตัวหนังสือใหญ่ขึ้นหนึ่งขั้น ป้ายเล็กลงและเป็นตัวพิมพ์เล็กเว้นระยะ (อ่านเป็น "ป้าย" ทันที)
 * → ทุกอย่างเรียงลงมาทางเดียว ไม่ต้องกวาดตาซ้าย-ขวาสลับการ์ด
 *
 * ข้อแลก: หน้ายาวขึ้น ต้องเลื่อนมากกว่าเดิม · บนจอกว้างจะเหลือที่ว่างด้านข้างเยอะ
 */

import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { demoOrder, demoTotals } from "../_data";
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

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
      {children}
    </h2>
  );
}

function RowList({ items }: { items: Row[] }) {
  if (items.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
      {items.map((row) => (
        <div key={row.key} className={cn("min-w-0", row.wide && "sm:col-span-2")}>
          <dt className="text-xs text-muted">{row.label}</dt>
          <dd
            className={cn(
              "mt-1 text-base leading-6 [overflow-wrap:anywhere]",
              row.mono && "font-mono",
              row.tone === "warn"
                ? "text-amber-700 dark:text-amber-300"
                : "text-strong",
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------- หน้า */

export function CalmVariant({ thin, showMoney }: { thin: boolean; showMoney: boolean }) {
  const order = demoOrder(thin);
  const totals = demoTotals(thin);
  const facts = buildFacts(order, totals, showMoney);
  const meta = buildOrderMeta(order, showMoney);
  const timeline = buildTimeline(order);
  const tax = buildCustomerTax(order);
  const contact = buildCustomerContact(order);
  const address = buildCustomerAddress(order);
  const history = buildCustomerHistory(order, showMoney);
  const shipping = buildShipping(order);
  const brand = buildBrand(order);
  const custHref = customerLink(order);

  return (
    <div className="space-y-6">
      {/* หัวใบ: เลขที่ตัวใหญ่ ชื่องานเป็นบรรทัดอ่านได้จริง ไม่ใช่ meta ตัวจิ๋ว */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center text-muted"
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">ใบงาน</p>
            <h1 className="text-2xl font-semibold tracking-tight text-strong">
              {order.orderNumber}
            </h1>
            <p className="mt-1 max-w-[62ch] text-base leading-6 text-secondary [overflow-wrap:anywhere]">
              {order.title}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProtoNextStepButton thin={thin} showMoney={showMoney} />
          <ProtoMoreButton />
        </div>
      </header>

      <ProtoStatusRail thin={thin} />
      <ProtoNotices order={order} />
      <ProtoTabBar showMoney={showMoney} pendingTab="production" />

      {/* เนื้อหาอ่านเป็นเอกสาร — กว้างพอดีตา ไม่ยืดเต็มจอ */}
      <div className="max-w-[68rem] space-y-10 pt-2">
        {/* ① สี่ข้อเท็จจริงหลัก — แถวเดียว คั่นด้วยเส้นบาง ไม่ทำเป็นการ์ด */}
        <dl
          className={cn(
            "grid gap-y-6 border-y border-divider py-6",
            "grid-cols-2",
            facts.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
            "sm:divide-x sm:divide-divider",
          )}
        >
          {facts.map((fact, i) => (
            <div
              key={fact.key}
              className={cn("min-w-0 px-0 sm:px-6", i === 0 && "sm:pl-0")}
            >
              <dt className="text-xs text-muted">{fact.label}</dt>
              <dd
                className={cn(
                  "mt-1.5 text-xl font-semibold leading-7 [overflow-wrap:anywhere]",
                  fact.empty
                    ? fact.tone === "warn"
                      ? "text-lg font-medium text-amber-700 dark:text-amber-300"
                      : "text-lg font-medium text-muted"
                    : "text-strong",
                )}
              >
                {fact.value}
              </dd>
              {fact.detail && (
                <p
                  className={cn(
                    "mt-1.5 text-xs [overflow-wrap:anywhere]",
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

        {/* ② รายละเอียดงาน — ย่อหน้าจริง ความกว้างพอดีอ่าน */}
        {order.description?.trim() && (
          <section className="space-y-3">
            <GroupHeading>รายละเอียดงาน</GroupHeading>
            <p className="max-w-[68ch] text-base leading-7 text-secondary [overflow-wrap:anywhere]">
              {order.description}
            </p>
          </section>
        )}

        {/* ③ ข้อมูลประกอบ */}
        <section className="space-y-4 border-t border-divider pt-8">
          <div className="flex items-center justify-between gap-3">
            <GroupHeading>ข้อมูลออเดอร์</GroupHeading>
            <Button variant="ghost" size="sm" aria-label="แก้ไขข้อมูลออเดอร์">
              แก้ไข
            </Button>
          </div>
          <RowList items={meta} />
        </section>

        {/* ④ ลูกค้า */}
        <section className="space-y-6 border-t border-divider pt-8">
          <div className="flex items-center justify-between gap-3">
            <GroupHeading>ลูกค้าและผู้ติดต่อ</GroupHeading>
            {custHref && <CustomerPageLink href={custHref} />}
          </div>

          {order.customer ? (
            <div className="space-y-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-strong [overflow-wrap:anywhere]">
                    {order.customer.name}
                  </p>
                  {order.customer.company && (
                    <p className="mt-0.5 text-sm text-secondary [overflow-wrap:anywhere]">
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
                <div className="space-y-4">
                  <p className="text-xs text-muted">ช่องทางติดต่อ</p>
                  <RowList items={contact} />
                </div>
              )}
              {address.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs text-muted">ที่อยู่และป้ายกำกับ</p>
                  <RowList items={address} />
                </div>
              )}
              {history.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs text-muted">ประวัติลูกค้า</p>
                  <RowList items={history} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-base text-muted">ใบนี้ยังไม่ผูกกับลูกค้า</p>
          )}
        </section>

        {/* ⑤ จัดส่ง */}
        <section className="space-y-4 border-t border-divider pt-8">
          <div className="flex items-center justify-between gap-3">
            <GroupHeading>การจัดส่ง</GroupHeading>
            <Button variant="ghost" size="sm">
              {hasShippingInfo(order) ? "แก้ไข" : "เพิ่มที่อยู่"}
            </Button>
          </div>
          {shipping.length > 0 ? (
            <RowList items={shipping} />
          ) : (
            <div className="space-y-1">
              <p className="text-base font-medium text-strong">ยังไม่มีที่อยู่จัดส่ง</p>
              <p className="text-sm text-muted">
                {order.customer?.address
                  ? "หน้าแก้ไขสามารถเลือกใช้ที่อยู่ลูกค้าได้ทันที"
                  : "เพิ่มผู้รับและที่อยู่ก่อนสร้างใบส่งของ"}
              </p>
            </div>
          )}
          {order.trackingNumber && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
              <div className="min-w-0">
                <p className="text-xs text-muted">เลขพัสดุในออเดอร์</p>
                <p className="mt-1 font-mono text-base font-medium text-strong [overflow-wrap:anywhere]">
                  {order.trackingNumber}
                </p>
              </div>
              <Button variant="ghost" size="sm">
                ดูการจัดส่ง
              </Button>
            </div>
          )}
        </section>

        {/* ⑥ แบรนด์ */}
        {brand.length > 0 && (
          <section className="space-y-4 border-t border-divider pt-8">
            <GroupHeading>แบรนด์ลูกค้า</GroupHeading>
            <RowList items={brand} />
          </section>
        )}

        {/* ⑦ เวลา — เงียบที่สุด อยู่ท้ายสุด */}
        <dl className="flex flex-wrap gap-x-6 gap-y-1.5 border-t border-divider pt-6 text-xs text-muted">
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
  );
}
