import Link from "next/link";
import { User, Info, Truck, Palette, ArrowRight, FileText } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChatLink } from "@/components/customers/chat-link";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { OrderType, CustomerStatus } from "@prisma/client";
import {
  CHANNEL_LABELS,
  CUSTOMER_STATUS_LABELS,
  ORDER_TYPE_UI_LABELS,
  PRIORITY_LABELS,
} from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { DISPLAY_AMOUNT, FOCUS_BUTTON } from "@/components/ui/tokens";

/* ============================================================
   แท็บ "ภาพรวม" — ที่รวมของที่ "ไม่ใช่รายการสินค้า" ทั้งหมด
   (เบสสั่ง 2026-08-11: "tab แรกเป็นแบบภาพรวมดีกว่า จะเป็นพวกผู้ติดต่อ
    และอื่นๆ แต่รายการ แยกไปอีก tab นึง")

   หลังย้ายการแก้ไขไปหน้าเต็ม หน้านี้เป็น read surface: สรุปข้อมูลตัดสินใจก่อน
   แล้วค่อยแยกลูกค้า/การจัดส่งตามเจ้าของข้อมูล · optional ที่ไม่มีค่าหายทั้งแถว
   แทนการจำลองฟอร์มอ่านอย่างเดียวด้วยช่อง "-" จำนวนมาก

   ── หน้าตารอบ 2026-08-30 (เบสเคาะจากหน้าลอง /proto/order-detail แบบ B) ──
   เดิมเป็นการ์ดใหญ่ "สรุปออเดอร์" เต็มความกว้างบนสุด แล้วค่อยการ์ดลูกค้า/จัดส่ง
   ทุกการ์ดหัวข้อตัวหนาเท่ากันหมด อ่านแล้วไม่รู้ว่าอะไรสำคัญกว่าอะไร

   ตอนนี้: **หัวใบ** (ใน order-detail-page.tsx) เป็นจุดเดียวที่เสียงดัง — เลขที่
   สถานะ ปุ่มขั้นต่อไป · แท็บนี้จึง "เงียบ" ทั้งหมด หัวข้อการ์ดเป็น
   `compact` (ตัวเล็กสีจาง) ไม่แข่งกับหัวใบ

   สิ่งที่ต้องรู้ก่อนแก้ต่อ:
   - เบสสั่งเอง 2026-08-30 ว่าหัวใบ "มีแค่สถานะกับ CTA ก็พอ" → กำหนดส่ง/จำนวน/ยอด
     ที่เคยอยู่บนหัวย้ายมาอยู่บนสุดของการ์ด "ข้อมูลออเดอร์" **ห้ามลบทิ้ง**
     สามค่านี้ไม่มีที่อยู่อื่นในทั้งหน้า (ลูกค้าไม่ต้องย้ายมา — การ์ดลูกค้าบอกอยู่แล้ว)
   - คอลัมน์สรุปถูกวางไว้ **ก่อน** ในลำดับ DOM แล้วค่อยดันไปอยู่ขวาด้วย grid
     บนจอกว้าง — เพื่อให้มือถือ (ที่ซ้อนตามลำดับ DOM) เห็นกำหนดส่ง/ยอด
     ก่อนต้องเลื่อนผ่านรายละเอียดงานกับการ์ดลูกค้าที่ยาว

   ⚠️ TabsContent ของหน้านี้ forceMount เสมอ (ซ่อนด้วย CSS ไม่ถอด DOM)
   → ข้อมูลเงินต้อง gate ด้วย {showMoney && ...} ระดับ JSX เท่านั้น
   ห้ามซ่อนด้วยคลาส และห้าม fallback เป็น ฿0/— เพราะช่างจะเปิด DOM เห็นตัวเลขจริง
   ============================================================ */

interface OverviewCustomer {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  chatName: string | null;
  chatUrl: string | null;
  address: string | null;
  taxId: string | null;
  branchNumber: string | null;
  customerType: string;
  notes: string | null;
  tags: string[];
  defaultPaymentTerms: string | null;
  billingAddress: string | null;
  billingSubDistrict: string | null;
  billingDistrict: string | null;
  billingProvince: string | null;
  billingPostalCode: string | null;
  totalOrders: number;
  lastOrderAt: Date | string | null;
  // null เมื่อ viewer ไม่เห็นเงินฝั่งขาย (นโยบาย ⑦ — server ปิดมาให้แล้ว)
  creditLimit: number | null;
  totalSpent: number | null;
}

interface OverviewOrder {
  id: string;
  description: string | null;
  notes: string | null;
  orderType: OrderType;
  channel: string;
  customerStatus: CustomerStatus;
  priority: string;
  paymentTerms: string | null;
  poNumber: string | null;
  deadline: Date | string | null;
  estimatedQuantity: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt: Date | string | null;
  cancelledAt: Date | string | null;
  cancelledReason: string | null;
  // ยังไม่มีใน schema (ห้ามแตะ prisma) — ประกาศ optional ไว้ให้แถว "ยืนยันเมื่อ"
  // ทำงานได้ทันทีวันที่ฟิลด์นี้ถูกเพิ่มจริง · วันนี้ไม่มีค่า = ไม่ render แถว
  confirmedAt?: Date | string | null;
  blindShip: boolean;
  blindShipSenderName: string | null;
  stockReservedAt: Date | string | null;
  stockReservationError: string | null;
  shippingRecipientName: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null;
  shippingSubDistrict: string | null;
  shippingDistrict: string | null;
  shippingProvince: string | null;
  shippingPostalCode: string | null;
  externalOrderId: string | null;
  platformFee: number | null;
  trackingNumber: string | null;
  customer: OverviewCustomer | null;
  brandProfile: {
    id: string;
    brandName: string;
    logoUrl: string | null;
    colorCodes: string[];
    fonts: string[];
    styleNotes: string | null;
  } | null;
  createdBy: { name: string | null } | string | null;
}

interface OrderOverviewTabProps {
  order: OverviewOrder;
  // นโยบาย ⑦: ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย — false = ไม่โชว์ยอด/ปุ่มเงินเลย (ห้ามโชว์ ฿0)
  showMoney: boolean;
  totalAmount: number;
  totalQuantity: number;
  // การ์ดบิล+สรุปราคาอยู่แท็บ "เงิน/บิล" — ที่นี่โชว์ยอดรวมบรรทัดเดียว กดแล้วเด้งไปแท็บนั้น
  onOpenMoney?: () => void;
  // เลขพัสดุเป็นข้อมูลของงานจัดส่ง ไม่ใช่ฟอร์มที่อยู่ — กดแล้วไปดู delivery จริงทุกใบ
  onOpenDelivery?: () => void;
  // เปิดฟอร์มแก้เต็มหน้าโดยโฟกัสการ์ดที่กด — ไม่ส่งมา = ไม่มีสิทธิ์แก้ ปุ่มไม่ต้องขึ้น
  onEditInfo?: (section: "info" | "shipping") => void;
  channelColor: { bg: string; text: string };
  isMarketplace: boolean;
}

// ============================================================
// ชิ้นส่วนหน้าตา
// ============================================================

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

/** กริดของช่องข้อมูลรอง — การ์ดล่างค่อยแยก 2 คอลัมน์เมื่อพื้นที่พอ */
function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {children}
    </dl>
  );
}

/** ช่องข้อมูลหนึ่งช่อง — ป้ายเล็กกว่าค่าเสมอ · ค่าว่างจางกว่าข้อมูลจริง
 *  (ถ้าป้ายกับค่าน้ำหนักเท่ากัน สายตาจะไล่หาข้อมูลจริงไม่เจอเวลาช่องเยอะๆ) */
function Field({
  label,
  children,
  wide,
  emptyText,
  emptyTone,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  /** ค่ายาว (รายละเอียด/ที่อยู่/หมายเหตุ) — กินเต็มแถว ไม่ต้องบีบครึ่งคอลัมน์ */
  wide?: boolean;
  emptyText?: string;
  /** ว่างแล้วมีผลกระทบจริง (เช่นไม่มีเลขภาษี = ออกใบกำกับไม่ได้) — ใช้โทนเตือนแทนสีจาง */
  emptyTone?: "warn";
}) {
  const filled =
    children !== null &&
    children !== undefined &&
    children !== false &&
    children !== "";

  // optional ที่ไม่มีค่าไม่ใช่ข้อมูล — ถอดทั้ง label/value ออกแทนการสร้างแถว "-"
  if (!filled && !emptyText) return null;

  return (
    <div className={cn("min-w-0 space-y-0.5", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted">{label}</dt>
      {/* ไทยห้าม truncate — ปล่อยตัดบรรทัดได้ทุกตำแหน่ง ดีกว่าจุดไข่ปลาที่ตัดสระทิ้ง */}
      <dd
        className={cn(
          "text-sm [overflow-wrap:anywhere]",
          filled
            ? "font-medium text-strong"
            : emptyTone === "warn"
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted",
        )}
      >
        {filled ? children : emptyText}
      </dd>
    </div>
  );
}

/** ข้อเท็จจริงหลักของใบงาน — ค่าต้องเด่นกว่าป้าย แต่ไม่ทำเป็นการ์ดย่อยซ้อนการ์ด */
function SummaryFact({
  label,
  children,
  detail,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-lg font-semibold text-strong [overflow-wrap:anywhere]">
        <span className="block min-w-0 [overflow-wrap:anywhere]">
          {children}
        </span>
        {detail && (
          <span className="mt-1 block min-w-0 text-xs font-normal text-muted [overflow-wrap:anywhere]">
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}

/** metadata ระดับอ้างอิง — วางเป็นบรรทัดเงียบ ไม่แข่งกับข้อเท็จจริงหลัก */
function ReferenceItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-1.5">
      <dt>{label}</dt>
      <dd className="font-medium text-secondary [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

/** กลุ่มย่อยในการ์ด — หัวกลุ่มเป็นคำถามที่คนถามจริง ไม่ใช่ชื่อตารางในฐานข้อมูล
 *  divided = ขึ้นกลุ่มใหม่ คั่นด้วยเส้นบาง (การ์ดไม่มีขอบ เส้นในนี้คือตัวแบ่งจังหวะอ่าน) */
function Group({
  label,
  divided,
  className,
  children,
}: {
  label?: React.ReactNode;
  divided?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-3",
        divided && "border-t border-divider pt-4",
        className,
      )}
    >
      {label && (
        <p className="text-xs font-semibold text-muted">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

/** เบอร์โทรต้องกดโทรได้ — บนมือถือหน้างานคือการกระทำที่ใช้บ่อยที่สุดของการ์ดผู้ติดต่อ
 *  href ต้องเหลือแต่ตัวเลข/+ ไม่งั้นเบอร์ที่พิมพ์เว้นวรรค/ขีดจะโทรไม่ออกบางเครื่อง */
function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center rounded-lg text-blue-600 hover:underline dark:text-blue-400",
        FOCUS_BUTTON,
      )}
    >
      {phone}
    </a>
  );
}

/** ตำบล-อำเภอ-จังหวัด-รหัสไปรษณีย์ ต่อกันเป็นบรรทัดเดียว (ช่องไหนว่างก็ข้ามไป) */
function areaLine(parts: (string | null)[]) {
  const line = parts.filter(Boolean).join(" ").trim();
  return line || null;
}

// ============================================================

export function OrderOverviewTab({
  order,
  showMoney,
  totalAmount,
  totalQuantity,
  onOpenMoney,
  onOpenDelivery,
  onEditInfo,
  channelColor,
  isMarketplace,
}: OrderOverviewTabProps) {
  const customer = order.customer;

  const creatorName =
    typeof order.createdBy === "string"
      ? order.createdBy
      : (order.createdBy?.name ?? null);

  const termsLabel = order.paymentTerms
    ? (PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms)
    : null;
  const customerTerms = customer?.defaultPaymentTerms ?? null;
  // ต่างจากมาตรฐานลูกค้า = ตั้งใจให้ใบนี้พิเศษ ต้องบอกว่ามาตรฐานคืออะไรด้วย
  // ไม่งั้นคนอ่านไม่รู้ว่ากำลังดู "ข้อยกเว้น" อยู่ แล้วเผลอเอาไปอ้างเป็นเทอมประจำ
  const termsDiffers = !!customerTerms && customerTerms !== order.paymentTerms;
  const customerTermsLabel = customerTerms
    ? (PAYMENT_TERMS_LABELS[customerTerms] ?? customerTerms)
    : null;

  const hasShipping = Boolean(
    order.shippingRecipientName ||
    order.shippingPhone ||
    order.shippingAddress ||
    order.shippingSubDistrict ||
    order.shippingDistrict ||
    order.shippingProvince ||
    order.shippingPostalCode,
  );
  const shippingArea = areaLine([
    order.shippingSubDistrict,
    order.shippingDistrict,
    order.shippingProvince,
    order.shippingPostalCode,
  ]);

  const hasBilling = Boolean(
    customer?.billingAddress ||
    customer?.billingSubDistrict ||
    customer?.billingDistrict ||
    customer?.billingProvince ||
    customer?.billingPostalCode,
  );
  const billingArea = areaLine([
    customer?.billingSubDistrict ?? null,
    customer?.billingDistrict ?? null,
    customer?.billingProvince ?? null,
    customer?.billingPostalCode ?? null,
  ]);

  const hasCustomerContact = Boolean(
    customer?.phone ||
    customer?.chatName ||
    customer?.chatUrl ||
    customer?.lineId ||
    customer?.email,
  );
  const hasCustomerHistory = Boolean(
    customer &&
    (customer.creditLimit != null ||
      customer.totalSpent != null ||
      customer.totalOrders > 0 ||
      customer.lastOrderAt),
  );
  const hasPricedWork = totalAmount !== 0 || totalQuantity > 0;
  const totalNeedsReview = totalQuantity > 0 && totalAmount === 0;

  /* แต่ละการ์ดมีปุ่มแก้ไขของตัวเอง (เบสสั่ง 2026-08-11) — ปุ่มเดียวบนการ์ดเดียว
     ทำให้คนที่อยากแก้ที่อยู่ต้องเดาว่าปุ่มบนการ์ดอื่นแก้ที่อยู่ได้ด้วย
     ฟอร์มยังเป็นใบเดียวตามเดิม (ยอด/ภาษี/ส่วนลดผูกกันข้ามหัวข้อ) แค่เลื่อนไปหัวข้อที่กดมา */
  const editButton = (
    section: "info" | "shipping",
    accessibleLabel: string,
    visibleLabel = "แก้ไข",
  ) =>
    onEditInfo ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={accessibleLabel}
        onClick={() => onEditInfo(section)}
      >
        {visibleLabel}
      </Button>
    ) : undefined;

  return (
    <div className="space-y-5">
      {/* คอลัมน์สรุปอยู่ "ก่อน" ในลำดับ DOM แล้วดันไปขวาด้วย col-start บนจอกว้าง
          — มือถือซ้อนตามลำดับ DOM จึงเห็นกำหนดส่ง/ยอดก่อน ไม่ต้องเลื่อนผ่าน
          รายละเอียดงานกับการ์ดลูกค้าที่ยาวกว่ามาก */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5 xl:col-start-2 xl:row-start-1">
          <Section
            data-order-overview-card="summary"
            compact
            title={<SectionTitle icon={Info}>ข้อมูลออเดอร์</SectionTitle>}
            action={editButton("info", "แก้ไขข้อมูลออเดอร์")}
          >
            <div className="space-y-5">
              {/* สามค่าที่คนเปิดใบงานมาหาบ่อยที่สุด — เคยอยู่บนหัวหน้า
                  ย้ายลงมาที่นี่ตอนเบสสั่งให้หัวใบเหลือแค่สถานะกับปุ่ม (2026-08-30) */}
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
                  {totalQuantity > 0 ? (
                    `${totalQuantity.toLocaleString()} ชิ้น`
                  ) : order.estimatedQuantity ? (
                    `~${order.estimatedQuantity.toLocaleString()} ชิ้น`
                  ) : (
                    <span className="text-base font-medium text-muted">
                      ยังไม่มีรายการ
                    </span>
                  )}
                </SummaryFact>

                {/* เงินต้อง gate ระดับ JSX เพราะแท็บ keepMounted — ห้ามซ่อนด้วย CSS */}
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
                    {onOpenMoney ? (
                      <button
                        type="button"
                        onClick={onOpenMoney}
                        className={cn(
                          "inline-flex min-h-11 min-w-11 items-center rounded-lg text-left hover:underline",
                          hasPricedWork
                            ? DISPLAY_AMOUNT
                            : "text-base font-medium text-muted",
                          FOCUS_BUTTON,
                        )}
                      >
                        {hasPricedWork
                          ? formatCurrency(totalAmount)
                          : "ยังไม่ตีราคา"}
                      </button>
                    ) : (
                      <span
                        className={
                          hasPricedWork
                            ? DISPLAY_AMOUNT
                            : "text-base font-medium text-muted"
                        }
                      >
                        {hasPricedWork
                          ? formatCurrency(totalAmount)
                          : "ยังไม่ตีราคา"}
                      </span>
                    )}
                  </SummaryFact>
                )}
              </dl>

              <Group divided>
                <FieldGrid>
                  <Field label="ประเภทงาน">
                    <Badge
                      variant={order.orderType === "CUSTOM" ? "accent" : "default"}
                      size="sm"
                    >
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
                      {CUSTOMER_STATUS_LABELS[order.customerStatus] ??
                        order.customerStatus}
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
                  {isMarketplace && showMoney && order.platformFee != null && (
                    <Field label="ค่าธรรมเนียมแพลตฟอร์ม">
                      <span className="tabular-nums text-red-600 dark:text-red-400">
                        -{formatCurrency(order.platformFee)}
                      </span>
                    </Field>
                  )}
                  {order.stockReservedAt && (
                    <Field label="จองสต๊อกแล้ว">
                      {formatDateTime(order.stockReservedAt)}
                    </Field>
                  )}
                </FieldGrid>
              </Group>
            </div>
          </Section>

          <Section
            data-order-overview-card="shipping"
            compact
            title={<SectionTitle icon={Truck}>การจัดส่ง</SectionTitle>}
            action={editButton(
              "shipping",
              hasShipping ? "แก้ไขที่อยู่จัดส่ง" : "เพิ่มที่อยู่จัดส่ง",
              hasShipping ? "แก้ไข" : "เพิ่มที่อยู่",
            )}
          >
            <div className="space-y-5">
              {hasShipping ? (
                <FieldGrid>
                  <Field label="ผู้รับ">{order.shippingRecipientName}</Field>
                  <Field label="เบอร์ผู้รับ">
                    {order.shippingPhone && (
                      <PhoneLink phone={order.shippingPhone} />
                    )}
                  </Field>
                  <Field
                    label="ที่อยู่จัดส่ง"
                    wide
                    emptyTone="warn"
                    emptyText="ยังไม่มีที่อยู่จัดส่ง"
                  >
                    {order.shippingAddress || shippingArea ? (
                      <span className="block space-y-0.5">
                        {order.shippingAddress && (
                          <span className="block">{order.shippingAddress}</span>
                        )}
                        {shippingArea && (
                          <span className="block">{shippingArea}</span>
                        )}
                      </span>
                    ) : undefined}
                  </Field>
                </FieldGrid>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-strong">
                    ยังไม่มีที่อยู่จัดส่ง
                  </p>
                  <p className="text-sm text-muted">
                    {customer?.address && onEditInfo
                      ? "หน้าแก้ไขสามารถเลือกใช้ที่อยู่ลูกค้าได้ทันที"
                      : "เพิ่มผู้รับและที่อยู่ก่อนสร้างใบส่งของ"}
                  </p>
                </div>
              )}

              {order.trackingNumber && (
                <Group label="เลขพัสดุในออเดอร์" divided>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-mono text-sm font-medium text-strong [overflow-wrap:anywhere]">
                      {order.trackingNumber}
                    </span>
                    {onOpenDelivery && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onOpenDelivery}
                      >
                        ดูการจัดส่ง
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </Group>
              )}
            </div>
          </Section>

          {/* ใบที่ไม่ได้ผูกแบรนด์ไม่ต้องมีการ์ดว่างกินพื้นที่ */}
          {order.brandProfile && (
            <Section
              data-order-overview-card="brand"
              compact
              title={<SectionTitle icon={Palette}>แบรนด์ลูกค้า</SectionTitle>}
            >
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

          {/* เวลาเป็นข้อมูลอ้างอิง ไม่ใช่หัวใจของการตัดสินใจ จึงอยู่ท้ายสุดแบบไม่มีการ์ด */}
          <dl className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-muted">
            {creatorName && (
              <ReferenceItem label="เปิดโดย">{creatorName}</ReferenceItem>
            )}
            <ReferenceItem label="เปิดเมื่อ">
              {formatDateTime(order.createdAt)}
            </ReferenceItem>
            {order.confirmedAt && (
              <ReferenceItem label="ยืนยันเมื่อ">
                {formatDateTime(order.confirmedAt)}
              </ReferenceItem>
            )}
            {order.completedAt && (
              <ReferenceItem label="ปิดงานเมื่อ">
                {formatDateTime(order.completedAt)}
              </ReferenceItem>
            )}
            {order.cancelledAt && (
              <ReferenceItem label="ยกเลิกเมื่อ">
                <span className="text-red-600 dark:text-red-400">
                  {formatDateTime(order.cancelledAt)}
                  {order.cancelledReason && ` — ${order.cancelledReason}`}
                </span>
              </ReferenceItem>
            )}
            <ReferenceItem label="แก้ล่าสุด">
              {formatDateTime(order.updatedAt)}
            </ReferenceItem>
          </dl>
        </div>

        <div className="space-y-5 xl:col-start-1 xl:row-start-1">
          {order.description?.trim() && (
            <Section
              data-order-overview-card="description"
              compact
              title={<SectionTitle icon={FileText}>รายละเอียดงาน</SectionTitle>}
            >
              <p className="max-w-[75ch] text-sm leading-6 text-secondary [overflow-wrap:anywhere]">
                {order.description}
              </p>
            </Section>
          )}

          <Section
            data-order-overview-card="customer"
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
                  </div>
                  <Badge variant="secondary" size="sm">
                    {customer.customerType === "CORPORATE"
                      ? "นิติบุคคล"
                      : "บุคคลธรรมดา"}
                  </Badge>
                </div>

                <FieldGrid>
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
                            (สาขา{" "}
                            {customer.branchNumber === "00000"
                              ? "สำนักงานใหญ่"
                              : customer.branchNumber}
                            )
                          </span>
                        )}
                      </span>
                    )}
                  </Field>
                </FieldGrid>

                <Group label="ช่องทางติดต่อ" divided>
                  {hasCustomerContact ? (
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
                    </FieldGrid>
                  ) : (
                    <p className="text-sm text-muted">ยังไม่มีช่องทางติดต่อ</p>
                  )}
                </Group>

                <Group label="ที่อยู่ลูกค้าและออกบิล" divided>
                  <FieldGrid>
                    <Field
                      label="ที่อยู่ลูกค้า"
                      wide
                      emptyText="ยังไม่มีที่อยู่ลูกค้า"
                    >
                      {customer.address}
                    </Field>
                    {hasBilling ? (
                      <Field label="ที่อยู่ออกบิล" wide>
                        <span className="block space-y-0.5">
                          {customer.billingAddress && (
                            <span className="block">
                              {customer.billingAddress}
                            </span>
                          )}
                          {billingArea && (
                            <span className="block">{billingArea}</span>
                          )}
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

                {/* เงินของลูกค้า — ห่อระดับ JSX ไม่ใช่ซ่อนด้วย CSS (แท็บนี้ forceMount) */}
                {showMoney && hasCustomerHistory && (
                  <Group label="ประวัติลูกค้า" divided>
                    <FieldGrid>
                      {customer.creditLimit != null && (
                        <Field label="วงเงินเครดิต">
                          <span className="tabular-nums">
                            {formatCurrency(customer.creditLimit)}
                          </span>
                        </Field>
                      )}
                      {customer.totalSpent != null && (
                        <Field label="ยอดซื้อสะสม">
                          <span className="tabular-nums">
                            {formatCurrency(customer.totalSpent)}
                          </span>
                        </Field>
                      )}
                      {customer.totalOrders > 0 && (
                        <Field label="สั่งมาแล้ว">
                          {customer.totalOrders.toLocaleString()} ครั้ง
                        </Field>
                      )}
                      {customer.lastOrderAt && (
                        <Field label="สั่งล่าสุด">
                          {formatDate(customer.lastOrderAt)}
                        </Field>
                      )}
                    </FieldGrid>
                  </Group>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">ใบนี้ยังไม่ผูกกับลูกค้า</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
