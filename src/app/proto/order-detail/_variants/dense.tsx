"use client";

/**
 * C · แน่นครบจอ
 *
 * วิธีคิด: คนที่เปิดใบงานคือคนที่กำลังคุยโทรศัพท์อยู่ — ต้องหาค่าตอบให้เจอ
 * โดยไม่ต้องเลื่อนหน้า
 * → อัดทุกอย่างลงจอเดียว 3 คอลัมน์ · แถวเป็น "ป้ายซ้าย ค่าขวา" มีเส้นบางทุกแถว
 *   (ตากวาดลงตามคอลัมน์ป้ายได้เร็วกว่าอ่านป้ายบน-ค่าล่างสลับกันไปมา)
 * → ตัวหนังสือเล็กลงหนึ่งขั้น ระยะแน่นขึ้น หัวข้อกลุ่มเป็นแถบเทาบาง ๆ
 *
 * ข้อแลก: แน่นตา อ่านนาน ๆ ล้ากว่าสองแบบบน · ค่าไทยยาว (ที่อยู่ ชื่อบริษัท) จะดัน
 * ให้แถวสูงไม่เท่ากันจนคอลัมน์ดูไม่เรียบ · บนมือถือยุบเหลือคอลัมน์เดียว = ยาวเท่าเดิม
 */

import { ShoppingCart } from "lucide-react";
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

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface overflow-hidden rounded-xl">
      <header className="flex items-center justify-between gap-2 border-b border-divider bg-surface-muted px-3 py-1.5">
        <h2 className="text-2xs font-semibold uppercase tracking-[0.08em] text-secondary">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** ป้ายซ้าย–ค่าขวา · เส้นบางทุกแถว — หัวใจของความหนาแน่นแบบนี้ */
function RowTable({ items }: { items: Row[] }) {
  if (items.length === 0) return null;
  return (
    <dl className="divide-y divide-divider">
      {items.map((row) => (
        <div key={row.key} className="flex gap-3 px-3 py-1.5">
          <dt className="w-28 shrink-0 pt-px text-2xs leading-5 text-muted">{row.label}</dt>
          <dd
            className={cn(
              "min-w-0 flex-1 text-sm leading-5 [overflow-wrap:anywhere]",
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

function TextBlock({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-2 text-sm leading-5 text-secondary [overflow-wrap:anywhere]">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------- หน้า */

export function DenseVariant({ thin, showMoney }: { thin: boolean; showMoney: boolean }) {
  const order = demoOrder(thin);
  const totals = demoTotals(thin);
  const status = demoStatus(thin);
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

  const urgent = order.priority === "URGENT";
  const high = order.priority === "HIGH";

  return (
    <div className="space-y-3">
      {/* หัวใบแถวเดียว — เลขที่ ป้าย ปุ่ม อยู่บรรทัดเดียวกันให้มากที่สุด */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center text-muted"
        >
          <ShoppingCart className="h-4.5 w-4.5" strokeWidth={1.8} />
        </span>
        <h1 className="text-lg font-semibold tabular-nums text-strong">
          {order.orderNumber}
        </h1>
        <span className="min-w-0 flex-1" />
        <Badge variant="accent" size="sm">
          {CUSTOMER_STATUS_LABELS[status.customerStatus]}
        </Badge>
        {(urgent || high) && (
          <Badge variant={urgent ? "destructive" : "warning"} size="sm">
            {PRIORITY_LABELS[order.priority]}
          </Badge>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <ProtoNextStepButton thin={thin} showMoney={showMoney} />
          <ProtoMoreButton />
        </div>
      </header>

      <ProtoStatusRail thin={thin} />

      {/* สี่ข้อเท็จจริงหลัก — เตี้ยแต่ยังเด่นด้วยน้ำหนักตัวอักษร ไม่ใช่ด้วยขนาด */}
      <dl
        className={cn(
          "grid divide-x divide-divider rounded-xl border border-border bg-surface",
          "grid-cols-2",
          facts.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {facts.map((fact) => (
          <div key={fact.key} className="min-w-0 px-3.5 py-2.5">
            <dt className="text-2xs text-muted">{fact.label}</dt>
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

      <ProtoNotices order={order} />
      <ProtoTabBar showMoney={showMoney} pendingTab="production" />

      {/* 3 คอลัมน์ — จัดกลุ่มเองเพื่อให้ความสูงพอ ๆ กัน ไม่ใช่ปล่อยไหลจนเหลื่อม */}
      <div className="grid items-start gap-3 pt-1 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-3">
          <Panel
            title="ลูกค้าและผู้ติดต่อ"
            action={custHref ? <CustomerPageLink href={custHref} /> : undefined}
          >
            {order.customer ? (
              <>
                <div className="flex items-start justify-between gap-2 border-b border-divider px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-strong [overflow-wrap:anywhere]">
                      {order.customer.name}
                    </p>
                    {order.customer.company && (
                      <p className="text-2xs text-secondary [overflow-wrap:anywhere]">
                        {order.customer.company}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" size="sm" className="shrink-0">
                    {order.customer.customerType === "CORPORATE"
                      ? "นิติบุคคล"
                      : "บุคคลธรรมดา"}
                  </Badge>
                </div>
                <RowTable items={[...tax, ...contact]} />
              </>
            ) : (
              <TextBlock>ใบนี้ยังไม่ผูกกับลูกค้า</TextBlock>
            )}
          </Panel>

          {history.length > 0 && (
            <Panel title="ประวัติลูกค้า">
              <RowTable items={history} />
            </Panel>
          )}
        </div>

        <div className="space-y-3">
          {address.length > 0 && (
            <Panel title="ที่อยู่และป้ายกำกับ">
              <RowTable items={address} />
            </Panel>
          )}

          <Panel
            title="การจัดส่ง"
            action={
              <Button variant="ghost" size="sm" className="-my-1">
                {hasShippingInfo(order) ? "แก้ไข" : "เพิ่มที่อยู่"}
              </Button>
            }
          >
            {shipping.length > 0 ? (
              <RowTable items={shipping} />
            ) : (
              <TextBlock>
                ยังไม่มีที่อยู่จัดส่ง —{" "}
                {order.customer?.address
                  ? "หน้าแก้ไขเลือกใช้ที่อยู่ลูกค้าได้ทันที"
                  : "เพิ่มผู้รับและที่อยู่ก่อนสร้างใบส่งของ"}
              </TextBlock>
            )}
            {order.trackingNumber && (
              <div className="flex items-center justify-between gap-2 border-t border-divider px-3 py-1.5">
                <span className="text-2xs text-muted">เลขพัสดุ</span>
                <span className="min-w-0 flex-1 font-mono text-sm font-medium text-strong [overflow-wrap:anywhere]">
                  {order.trackingNumber}
                </span>
                <Button variant="ghost" size="sm" className="-my-1 shrink-0">
                  ดูการจัดส่ง
                </Button>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel
            title="ข้อมูลออเดอร์"
            action={
              <Button
                variant="ghost"
                size="sm"
                className="-my-1"
                aria-label="แก้ไขข้อมูลออเดอร์"
              >
                แก้ไข
              </Button>
            }
          >
            <RowTable items={meta} />
          </Panel>

          {order.description?.trim() && (
            <Panel title="รายละเอียดงาน">
              <TextBlock>{order.description}</TextBlock>
            </Panel>
          )}

          {brand.length > 0 && (
            <Panel title="แบรนด์ลูกค้า">
              <RowTable items={brand} />
            </Panel>
          )}

          <Panel title="เวลา">
            <RowTable
              items={timeline.map((item) => ({
                key: item.label,
                label: item.label,
                value: item.value,
              }))}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
