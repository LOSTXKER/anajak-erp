"use client";

/**
 * B · ลายคู่ข้อมูล — "ภาพรวมตอบ 3 คำถาม: ทำอะไร · ให้ใคร · ส่งเมื่อไหร่/เท่าไร"
 *
 * ซ้ายบนสุดกลายเป็นการ์ด "งานนี้พิมพ์อะไร" (รูปม็อกอัพใหญ่ + ด้านอื่นเรียงข้าง +
 * รายละเอียดงาน + ไฟล์) เพราะสองอย่างนี้พูดเรื่องเดียวกัน — เดิมรายละเอียดงานลอยเป็น
 * การ์ดตัวหนังสือล้วนที่ไม่มีภาพประกอบ
 *
 * การ์ดลูกค้าถูกย่อ: ประวัติลูกค้า 4 ช่อง (วงเงิน/ยอดสะสม/จำนวนครั้ง/สั่งล่าสุด) ยุบเป็น
 * บรรทัดเดียว — ค่าเดิมยังอยู่ครบทุกตัว ไม่ได้ตัดทิ้ง แค่ไม่กินสี่ช่องแยกกัน
 *
 * คอลัมน์ขวา (ข้อมูลออเดอร์ · จัดส่ง · แบรนด์ · บรรทัดเวลา) เหมือนของจริงทุกช่อง
 */

import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Info,
  Palette,
  Shirt,
  Truck,
  User,
} from "lucide-react";

import { ChatLink } from "@/components/customers/chat-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { DISPLAY_AMOUNT, FOCUS_BUTTON } from "@/components/ui/tokens";
import {
  CHANNEL_COLORS,
  CHANNEL_LABELS,
  CUSTOMER_STATUS_LABELS,
  ORDER_TYPE_UI_LABELS,
  PRIORITY_LABELS,
} from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

import { demoOrder, demoTotals } from "../../order-detail/_data";
import { demoMockups, demoPrintFiles, demoRawFiles } from "../_artwork";
import {
  ArtworkHero,
  Field,
  FieldGrid,
  FileCountLine,
  Group,
  MockupStatusBadge,
  NoMockupNote,
  PhoneLink,
  SectionTitle,
  SummaryFact,
  areaLine,
} from "../_ui";

export function PairVariant({
  thin,
  showMoney,
}: {
  thin: boolean;
  showMoney: boolean;
}) {
  const order = demoOrder(thin);
  const totals = demoTotals(thin);
  const customer = order.customer;
  const mockups = demoMockups(thin);
  const latest = mockups[0];
  const rawFiles = demoRawFiles(thin);
  const printFiles = demoPrintFiles(thin);

  const channelColor = CHANNEL_COLORS[order.channel] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-secondary",
  };

  const termsLabel = order.paymentTerms
    ? (PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms)
    : null;
  const customerTerms = customer?.defaultPaymentTerms ?? null;
  const termsDiffers = !!customerTerms && customerTerms !== order.paymentTerms;
  const customerTermsLabel = customerTerms
    ? (PAYMENT_TERMS_LABELS[customerTerms] ?? customerTerms)
    : null;

  const hasShipping = Boolean(
    order.shippingRecipientName || order.shippingAddress || order.shippingProvince,
  );
  const shippingArea = areaLine([
    order.shippingSubDistrict,
    order.shippingDistrict,
    order.shippingProvince,
    order.shippingPostalCode,
  ]);
  const billingArea = areaLine([
    customer?.billingSubDistrict ?? null,
    customer?.billingDistrict ?? null,
    customer?.billingProvince ?? null,
    customer?.billingPostalCode ?? null,
  ]);
  const hasBilling = Boolean(customer?.billingAddress || billingArea);

  const hasPricedWork = totals.totalAmount !== 0 || totals.totalQuantity > 0;
  const totalNeedsReview = totals.totalQuantity > 0 && totals.totalAmount === 0;

  /* ประวัติลูกค้าเป็นบรรทัดเดียว — ค่าครบเหมือนเดิม แค่ไม่กิน 4 ช่อง */
  const historyBits = customer
    ? [
        showMoney && customer.totalSpent != null
          ? `ซื้อสะสม ${formatCurrency(customer.totalSpent)}`
          : null,
        customer.totalOrders > 0 ? `${customer.totalOrders} ครั้ง` : null,
        customer.lastOrderAt ? `ล่าสุด ${formatDate(customer.lastOrderAt)}` : null,
        showMoney && customer.creditLimit != null
          ? `วงเงิน ${formatCurrency(customer.creditLimit)}`
          : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* คอลัมน์สรุปอยู่ก่อนใน DOM แล้วดันไปขวา — มือถือจึงเห็นกำหนดส่ง/ยอดก่อน
          (กติกาเดียวกับของจริง ห้ามกลับด้าน) */}
      <div className="space-y-5 xl:col-start-2 xl:row-start-1">
        <Section compact title={<SectionTitle icon={Info}>ข้อมูลออเดอร์</SectionTitle>} action={<Button variant="ghost" size="sm">แก้ไข</Button>}>
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-5 lg:grid-cols-3">
              <SummaryFact
                label="กำหนดส่ง"
                detail={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>ความเร่งด่วน</span>
                    <Badge
                      variant={
                        order.priority === "URGENT"
                          ? "destructive"
                          : order.priority === "HIGH"
                            ? "warning"
                            : "default"
                      }
                      size="sm"
                    >
                      {PRIORITY_LABELS[order.priority] ?? order.priority}
                    </Badge>
                  </span>
                }
              >
                {order.deadline ? (
                  formatDate(order.deadline)
                ) : (
                  <span className="text-base font-medium text-amber-700 dark:text-amber-300">
                    ยังไม่กำหนดส่ง
                  </span>
                )}
              </SummaryFact>

              <SummaryFact label="จำนวนรวม">
                {totals.totalQuantity > 0 ? (
                  `${totals.totalQuantity.toLocaleString()} ชิ้น`
                ) : order.estimatedQuantity ? (
                  `~${order.estimatedQuantity.toLocaleString()} ชิ้น`
                ) : (
                  <span className="text-base font-medium text-muted">ยังไม่มีรายการ</span>
                )}
              </SummaryFact>

              {showMoney && (
                <SummaryFact
                  label="ยอดรวม"
                  detail={
                    totalNeedsReview ? (
                      <span className="text-amber-700 dark:text-amber-300">
                        ยอดเป็นศูนย์ — ตรวจสอบราคา
                      </span>
                    ) : undefined
                  }
                >
                  <span
                    className={
                      hasPricedWork ? DISPLAY_AMOUNT : "text-base font-medium text-muted"
                    }
                  >
                    {hasPricedWork ? formatCurrency(totals.totalAmount) : "ยังไม่ตีราคา"}
                  </span>
                </SummaryFact>
              )}
            </dl>

            <Group divided>
              <FieldGrid>
                <Field label="ประเภทงาน">
                  <Badge variant={order.orderType === "CUSTOM" ? "accent" : "default"} size="sm">
                    {ORDER_TYPE_UI_LABELS[order.orderType]}
                  </Badge>
                </Field>
                <Field label="ช่องทาง">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      channelColor.bg,
                      channelColor.text,
                    )}
                  >
                    {CHANNEL_LABELS[order.channel] ?? order.channel}
                  </span>
                </Field>
                <Field label="สถานะที่ลูกค้าเห็น">
                  <Badge variant="default" size="sm">
                    {CUSTOMER_STATUS_LABELS[order.customerStatus] ?? order.customerStatus}
                  </Badge>
                </Field>
                {termsLabel && (
                  <Field label="เงื่อนไขชำระ">
                    <span>
                      {termsLabel}
                      {termsDiffers && (
                        <span className="mt-0.5 block text-xs font-normal text-muted">
                          มาตรฐานลูกค้า: {customerTermsLabel}
                        </span>
                      )}
                    </span>
                  </Field>
                )}
                {order.poNumber && (
                  <Field label="เลขที่ PO">
                    <span className="font-mono">{order.poNumber}</span>
                  </Field>
                )}
                {order.externalOrderId && (
                  <Field label="หมายเลขภายนอก">
                    <span className="font-mono">{order.externalOrderId}</span>
                  </Field>
                )}
                {order.stockReservedAt && (
                  <Field label="จองสต๊อกแล้ว">{formatDateTime(order.stockReservedAt)}</Field>
                )}
              </FieldGrid>
            </Group>
          </div>
        </Section>

        <Section
          compact
          title={<SectionTitle icon={Truck}>การจัดส่ง</SectionTitle>}
          action={<Button variant="ghost" size="sm">{hasShipping ? "แก้ไข" : "เพิ่มที่อยู่"}</Button>}
        >
          <div className="space-y-5">
            {hasShipping ? (
              <FieldGrid>
                <Field label="ผู้รับ">{order.shippingRecipientName}</Field>
                <Field label="เบอร์ผู้รับ">
                  {order.shippingPhone && <PhoneLink phone={order.shippingPhone} />}
                </Field>
                <Field label="ที่อยู่จัดส่ง" wide emptyTone="warn" emptyText="ยังไม่มีที่อยู่จัดส่ง">
                  {order.shippingAddress || shippingArea ? (
                    <span className="block space-y-0.5">
                      {order.shippingAddress && <span className="block">{order.shippingAddress}</span>}
                      {shippingArea && <span className="block">{shippingArea}</span>}
                    </span>
                  ) : undefined}
                </Field>
              </FieldGrid>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-strong">ยังไม่มีที่อยู่จัดส่ง</p>
                <p className="text-sm text-muted">เพิ่มผู้รับและที่อยู่ก่อนสร้างใบส่งของ</p>
              </div>
            )}

            {order.trackingNumber && (
              <Group label="เลขพัสดุในออเดอร์" divided>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-sm font-medium text-strong [overflow-wrap:anywhere]">
                    {order.trackingNumber}
                  </span>
                  <Button variant="ghost" size="sm">
                    ดูการจัดส่ง
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </Group>
            )}
          </div>
        </Section>

        {order.brandProfile && (
          <Section compact title={<SectionTitle icon={Palette}>แบรนด์ลูกค้า</SectionTitle>}>
            <FieldGrid>
              <Field label="ชื่อแบรนด์">{order.brandProfile.brandName}</Field>
              {order.brandProfile.logoUrl && (
                <Field label="โลโก้">
                  <a
                    href={order.brandProfile.logoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex min-h-11 min-w-11 items-center rounded-lg text-blue-600 hover:underline dark:text-blue-400",
                      FOCUS_BUTTON,
                    )}
                  >
                    เปิดไฟล์โลโก้
                  </a>
                </Field>
              )}
              {order.brandProfile.colorCodes.length > 0 && (
                <Field label="โค้ดสี" wide>
                  <span className="flex flex-wrap gap-2">
                    {order.brandProfile.colorCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-secondary dark:bg-slate-800"
                      >
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-300 dark:ring-white/20"
                          style={{ backgroundColor: code }}
                        />
                        {code}
                      </span>
                    ))}
                  </span>
                </Field>
              )}
              {order.brandProfile.fonts.length > 0 && (
                <Field label="ฟอนต์" wide>
                  {order.brandProfile.fonts.join(" · ")}
                </Field>
              )}
              {order.brandProfile.styleNotes && (
                <Field label="โน้ตสไตล์" wide>
                  {order.brandProfile.styleNotes}
                </Field>
              )}
            </FieldGrid>
          </Section>
        )}

        <dl className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-muted">
          <div className="flex min-w-0 flex-wrap gap-x-1.5">
            <dt>เปิดโดย</dt>
            <dd className="font-medium text-secondary">{order.createdBy.name}</dd>
          </div>
          <div className="flex min-w-0 flex-wrap gap-x-1.5">
            <dt>เปิดเมื่อ</dt>
            <dd className="font-medium text-secondary">{formatDateTime(order.createdAt)}</dd>
          </div>
          {order.confirmedAt && (
            <div className="flex min-w-0 flex-wrap gap-x-1.5">
              <dt>ยืนยันเมื่อ</dt>
              <dd className="font-medium text-secondary">{formatDateTime(order.confirmedAt)}</dd>
            </div>
          )}
          <div className="flex min-w-0 flex-wrap gap-x-1.5">
            <dt>แก้ล่าสุด</dt>
            <dd className="font-medium text-secondary">{formatDateTime(order.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      {/* ───────── คอลัมน์ซ้าย: ลาย → ลูกค้า ───────── */}
      <div className="space-y-5 xl:col-start-1 xl:row-start-1">
        <Section
          compact
          title={<SectionTitle icon={Shirt}>งานนี้พิมพ์อะไร</SectionTitle>}
          action={
            <Button variant="ghost" size="sm">
              ม็อกอัพ &amp; ไฟล์
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          }
        >
          <div className="space-y-4">
            {latest ? (
              <>
                <ArtworkHero version={latest} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  <MockupStatusBadge version={latest} />
                  <span className="font-medium text-strong">ม็อกอัพ v{latest.versionNumber}</span>
                  <span className="text-muted">
                    {latest.approvedAt
                      ? `ลูกค้าอนุมัติ ${formatDate(latest.approvedAt)}`
                      : `ส่งให้ลูกค้า ${formatDate(latest.createdAt)}`}
                    {mockups.length > 1 && ` · แก้มาแล้ว ${mockups.length - 1} รอบ`}
                  </span>
                </div>
              </>
            ) : (
              <NoMockupNote rawCount={rawFiles.length} />
            )}

            {order.description?.trim() && (
              <Group label="รายละเอียดงาน" divided>
                <p className="max-w-[75ch] text-sm leading-6 text-secondary [overflow-wrap:anywhere]">
                  {order.description}
                </p>
              </Group>
            )}

            {/* ไฟล์เป็นบรรทัดสรุป ไม่กางรายชื่อ — บ้านจริงของไฟล์คือแท็บ "ม็อกอัพ & ไฟล์"
                (กางรายชื่อ 5 ไฟล์แล้วการ์ดนี้ยาวขึ้นอีกครึ่งจอ โดยที่คนส่วนใหญ่แค่อยากรู้ว่ามีไหม) */}
            <Group divided>
              {rawFiles.length + printFiles.length > 0 ? (
                <FileCountLine rawCount={rawFiles.length} printCount={printFiles.length} />
              ) : (
                <p className="text-sm text-muted">ยังไม่มีไฟล์แนบ</p>
              )}
            </Group>
          </div>
        </Section>

        <Section
          compact
          title={<SectionTitle icon={User}>ลูกค้าและผู้ติดต่อ</SectionTitle>}
          action={
            customer ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/customers/${customer.id}`}>เปิดหน้าลูกค้า</Link>
              </Button>
            ) : undefined
          }
        >
          {customer ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-strong [overflow-wrap:anywhere]">
                    {customer.name}
                  </p>
                  {customer.company && (
                    <p className="text-sm text-secondary [overflow-wrap:anywhere]">
                      {customer.company}
                    </p>
                  )}
                  {/* ประวัติลูกค้ายุบเป็นบรรทัดเดียวใต้ชื่อ — เดิมกิน 4 ช่องท้ายการ์ด */}
                  {historyBits.length > 0 && (
                    <p className="mt-1 text-xs text-muted">{historyBits.join(" · ")}</p>
                  )}
                </div>
                <Badge variant="secondary" size="sm">
                  {customer.customerType === "CORPORATE" ? "นิติบุคคล" : "บุคคลธรรมดา"}
                </Badge>
              </div>

              <FieldGrid>
                <Field label="โทรศัพท์">
                  {customer.phone && <PhoneLink phone={customer.phone} />}
                </Field>
                <Field label="ห้องแชท">
                  {(customer.chatName || customer.chatUrl) && (
                    <ChatLink
                      name={customer.chatName}
                      url={customer.chatUrl}
                      wrap
                      className="min-h-11 min-w-11 text-sm"
                    />
                  )}
                </Field>
                <Field label="LINE ID">{customer.lineId}</Field>
                <Field label="อีเมล">{customer.email}</Field>
                <Field
                  label="เลขผู้เสียภาษี"
                  emptyTone="warn"
                  emptyText="ยังไม่มีเลขภาษี — ออกใบกำกับไม่ได้"
                >
                  {customer.taxId && (
                    <span className="font-mono">
                      {customer.taxId}
                      {customer.branchNumber && (
                        <span className="ml-1.5 font-sans text-xs font-normal text-muted">
                          (สาขา
                          {customer.branchNumber === "00000" ? "สำนักงานใหญ่" : customer.branchNumber})
                        </span>
                      )}
                    </span>
                  )}
                </Field>
              </FieldGrid>

              <Group label="ที่อยู่ลูกค้าและออกบิล" divided>
                <FieldGrid>
                  <Field label="ที่อยู่ลูกค้า" wide emptyText="ยังไม่มีที่อยู่ลูกค้า">
                    {customer.address}
                  </Field>
                  {hasBilling ? (
                    <Field label="ที่อยู่ออกบิล" wide>
                      <span className="block space-y-0.5">
                        {customer.billingAddress && (
                          <span className="block">{customer.billingAddress}</span>
                        )}
                        {billingArea && <span className="block">{billingArea}</span>}
                      </span>
                    </Field>
                  ) : customer.address ? (
                    <Field label="ที่อยู่ออกบิล" wide>
                      ใช้ที่อยู่ลูกค้า
                    </Field>
                  ) : null}
                  {customer.tags.length > 0 && (
                    <Field label="ป้ายลูกค้า" wide>
                      <span className="flex flex-wrap gap-1.5">
                        {customer.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            size="sm"
                            className="max-w-full whitespace-normal [overflow-wrap:anywhere]"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    </Field>
                  )}
                  {customer.notes && (
                    <Field label="หมายเหตุลูกค้า (ทุกใบ)" wide>
                      {customer.notes}
                    </Field>
                  )}
                </FieldGrid>
              </Group>
            </div>
          ) : (
            <p className="text-sm text-muted">ใบนี้ยังไม่ผูกกับลูกค้า</p>
          )}
        </Section>

        {!order.description?.trim() && !latest && (
          <Section compact title={<SectionTitle icon={FileText}>รายละเอียดงาน</SectionTitle>}>
            <p className="text-sm text-muted">ยังไม่มีรายละเอียดงาน</p>
          </Section>
        )}
      </div>
    </div>
  );
}
