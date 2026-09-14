import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Info,
  Mail,
  MessageCircle,
  Package,
  Palette,
  Phone,
  Repeat2,
  Truck,
  User,
  Wallet,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChatLink } from "@/components/customers/chat-link";
import { HomeIconTile, type HomeTone } from "@/components/dashboard/home/home-card";
import { cn, formatBaht, formatDate, formatDateTime } from "@/lib/utils";
import { differenceInBangkokDays } from "@/lib/date-utils";
import type { OrderType, CustomerStatus } from "@prisma/client";
import { CHANNEL_LABELS, ORDER_TYPE_UI_LABELS, PRIORITY_LABELS } from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED, RADIUS } from "@/components/ui/tokens";
import { VISUAL_TONE_CLASSES, type VisualTone } from "@/lib/visual-tone";

/* ============================================================
   แท็บ "ภาพรวม" ของหน้าออเดอร์ (ต้นแบบรอบ 2 · เบส "โอเคทำจริงเลย" 2026-09-14)

   โครง: ข้อมูลออเดอร์ซ้าย · ม็อกอัพ & ไฟล์ขวา (เบสเคาะ 2026-09-13)
   การ์ดซ้ายใบเดียวเรียงตามที่คนเปิดใบงานถาม: กำหนดส่ง/จำนวน/ยอด → ประเภท/ช่องทาง/เงื่อนไข →
   ลูกค้า (ติดต่อได้ทันที) → การจัดส่ง → ใครเปิด/แก้ล่าสุด
   ช่องข้อมูลหลักมีภาพช่วยอ่าน: วงเวลาที่ใช้ไปของกำหนดส่ง, ไซซ์แยก, แถบรับเงินแล้ว

   ⚠️ TabsContent ของหน้านี้ keepMounted (ซ่อนด้วย CSS ไม่ถอด DOM)
   → ข้อมูลเงินต้อง gate ด้วย {showMoney && ...} ระดับ JSX เท่านั้น ห้ามซ่อนด้วยคลาส
   และห้าม fallback เป็น ฿0/— เพราะช่างจะเปิด DOM เห็นตัวเลขจริง
   ============================================================ */

/** ช่องหนึ่งช่องของ "ประวัติลูกค้า" (แบบ B · สีบอกหมวด เบสเคาะ 2026-08-31) */
type CustomerHistoryCell = {
  key: string;
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: VisualTone;
};

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
  /** วันถึงกำหนดส่งตามปฏิทินไทย (หน้าแม่คิดจาก "ตอนนี้") · ไม่ส่ง = ไม่วาดวงเวลา (เช่นงานที่จบแล้ว) */
  dueInDays?: number | null;
  /** จำนวนแยกไซซ์ของทั้งใบ */
  sizeBreakdown?: readonly { size: string; quantity: number }[];
  /** ยอดที่รับชำระแล้วจากสูตรกลาง billingOverview — ส่งมาเฉพาะคนเห็นเงิน */
  paidAmount?: number | null;
  /** ชนิดงานพิมพ์ของทั้งใบ เช่น DTF · สกรีน · ผสม */
  printLabel?: string | null;
  // การ์ดบิล+สรุปราคาอยู่แท็บ "เงิน/บิล" — ที่นี่โชว์ยอดรวม กดแล้วเด้งไปแท็บนั้น
  onOpenMoney?: () => void;
  // เลขพัสดุเป็นข้อมูลของงานจัดส่ง ไม่ใช่ฟอร์มที่อยู่ — กดแล้วไปดู delivery จริงทุกใบ
  onOpenDelivery?: () => void;
  // เปิดฟอร์มแก้เต็มหน้าโดยโฟกัสส่วนที่กด — ไม่ส่งมา = ไม่มีสิทธิ์แก้ ปุ่มไม่ต้องขึ้น
  onEditInfo?: (section: "info" | "shipping") => void;
  onOpenCustomer?: () => void;
  /* การ์ด "ม็อกอัพ & ไฟล์" คอลัมน์ขวา — ส่งเข้ามาเป็นชิ้นสำเร็จ เพราะแท็บนี้เป็น read surface
     ที่รับ props ล้วน ไม่ยิง query เอง ส่วนการ์ดนั้นต้องยิง (ม็อกอัพ/ไฟล์อยู่คนละตาราง) */
  artwork?: React.ReactNode;
  channelColor: { bg: string; text: string };
  isMarketplace: boolean;
}

// ============================================================
// ชิ้นส่วนหน้าตา
// ============================================================

function TileTitle({ icon, tone = "neutral", children }: { icon: LucideIcon; tone?: HomeTone; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <HomeIconTile icon={icon} tone={tone} />
      {children}
    </span>
  );
}

function SubHeading({ icon, tone, children }: { icon: LucideIcon; tone?: HomeTone; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-strong">
      <HomeIconTile icon={icon} tone={tone} size="sm" />
      {children}
    </h3>
  );
}

/** กริดของช่องข้อมูลรอง — แยก 2 คอลัมน์เมื่อพื้นที่พอ */
function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">{children}</dl>;
}

/** ช่องข้อมูลหนึ่งช่อง — ป้ายเล็กกว่าค่าเสมอ · ค่าว่างจางกว่าข้อมูลจริง */
function Field({
  label,
  children,
  wide,
  emptyText,
  emptyTone,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  /** ค่ายาว (ที่อยู่/หมายเหตุ) — กินเต็มแถว */
  wide?: boolean;
  emptyText?: string;
  /** ว่างแล้วมีผลกระทบจริง (เช่นไม่มีเลขภาษี = ออกใบกำกับไม่ได้) — ใช้โทนเตือนแทนสีจาง */
  emptyTone?: "warn";
}) {
  const filled = children !== null && children !== undefined && children !== false && children !== "";

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

const FACT_TONE = {
  neutral: "text-strong",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
} as const;
type FactTone = keyof typeof FACT_TONE;

/** ข้อเท็จจริงหลักของใบงาน — ช่องจมหนึ่งช่อง ค่าเด่นกว่าป้าย มีภาพช่วยอ่านทางซ้ายได้ */
function SummaryFact({
  label,
  icon: Icon,
  tone = "neutral",
  visual,
  detail,
  children,
}: {
  label: React.ReactNode;
  icon?: LucideIcon;
  tone?: FactTone;
  visual?: React.ReactNode;
  detail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-surface-muted px-3.5 py-3">
      {visual}
      <div className="min-w-0 flex-1">
        <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
          {label}
        </dt>
        <dd className={cn("mt-0.5 min-w-0 text-lg font-semibold tabular-nums [overflow-wrap:anywhere]", FACT_TONE[tone])}>
          {children}
          {detail ? <span className="mt-1 block text-xs font-normal text-muted">{detail}</span> : null}
        </dd>
      </div>
    </div>
  );
}

const RING_TONE: Record<FactTone, string> = {
  neutral: "stroke-blue-600 dark:stroke-blue-400",
  warning: "stroke-amber-500",
  danger: "stroke-red-500",
};

/** วงเวลาของกำหนดส่ง — ส่วนที่ทึบ = เวลาที่ใช้ไปแล้วนับจากวันเปิดงาน · ตัวเลข = วันที่เหลือ */
function DueRing({ used, label, tone }: { used: number; label: string; tone: FactTone }) {
  const circumference = 2 * Math.PI * 16;
  const ratio = Math.min(1, Math.max(0, used));
  return (
    <span className="relative h-11 w-11 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r="16" className="fill-none stroke-border" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r="16"
          className={cn("fill-none", RING_TONE[tone])}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xs font-semibold tabular-nums text-strong">
        {label}
      </span>
    </span>
  );
}

const CONTACT_ROW = "flex min-h-11 min-w-0 items-center gap-3 rounded-xl border border-divider px-2.5 py-2";

/** ช่องทางติดต่อหนึ่งแถว — ต้องดูออกว่ากดได้ (เบสทัก 2026-09-13 "ผู้ติดต่อซ่อนเกินไป") */
function ContactRow({
  href,
  icon: Icon,
  sub,
  children,
}: {
  href?: string;
  icon: LucideIcon;
  sub?: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-secondary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-strong [overflow-wrap:anywhere]">{children}</span>
        {sub ? <span className="block text-xs text-muted">{sub}</span> : null}
      </span>
      {href ? <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> : null}
    </>
  );
  return href ? (
    <a href={href} className={cn(CONTACT_ROW, FOCUS_BUTTON, INTERACTIVE_PRESSED)}>
      {body}
    </a>
  ) : (
    <div className={CONTACT_ROW}>{body}</div>
  );
}

/** metadata ระดับอ้างอิง — บรรทัดเงียบ ไม่แข่งกับข้อเท็จจริงหลัก */
function ReferenceItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-1.5">
      <dt>{label}</dt>
      <dd className="font-medium text-secondary [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** เบอร์โทรต้องกดโทรได้ — href เหลือแต่ตัวเลข/+ ไม่งั้นเบอร์ที่มีขีด/เว้นวรรคโทรไม่ออกบางเครื่อง */
function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      className={cn("inline-flex min-h-11 min-w-11 items-center rounded-lg text-blue-700 underline decoration-blue-200 underline-offset-4 dark:text-blue-300 dark:decoration-blue-800", FOCUS_BUTTON)}
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
  dueInDays,
  sizeBreakdown,
  paidAmount,
  printLabel,
  onOpenMoney,
  onOpenDelivery,
  onEditInfo,
  onOpenCustomer,
  artwork,
  channelColor,
  isMarketplace,
}: OrderOverviewTabProps) {
  const customer = order.customer;

  const creatorName = typeof order.createdBy === "string" ? order.createdBy : (order.createdBy?.name ?? null);

  const termsLabel = order.paymentTerms ? (PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms) : null;
  const customerTerms = customer?.defaultPaymentTerms ?? null;
  // ต่างจากมาตรฐานลูกค้า = ตั้งใจให้ใบนี้พิเศษ ต้องบอกว่ามาตรฐานคืออะไรด้วย
  const termsDiffers = !!customerTerms && customerTerms !== order.paymentTerms;
  const customerTermsLabel = customerTerms ? (PAYMENT_TERMS_LABELS[customerTerms] ?? customerTerms) : null;

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

  const hasChat = Boolean(customer?.chatName || customer?.chatUrl);
  const hasCustomerContact = Boolean(customer?.phone || hasChat || customer?.lineId || customer?.email);
  const hasCustomerHistory = Boolean(
    customer &&
      (customer.creditLimit != null || customer.totalSpent != null || customer.totalOrders > 0 || customer.lastOrderAt),
  );
  /* ประวัติลูกค้า = สี่ค่าที่คนถามจริงตอนเปิดใบงาน แต่ละช่องได้สีประจำหมวดของมันเอง
     ช่องไหนไม่มีค่าก็หายไปทั้งช่อง · gate เงินยังครอบทั้งก้อนเหมือนเดิม */
  const customerHistoryCells: CustomerHistoryCell[] = customer
    ? ([
        customer.totalSpent != null
          ? { key: "spent", label: "ซื้อสะสม", value: formatBaht(customer.totalSpent), icon: Wallet, tone: "finance" }
          : null,
        customer.totalOrders > 0
          ? { key: "orders", label: "สั่งมาแล้ว", value: `${customer.totalOrders.toLocaleString()} ครั้ง`, icon: Repeat2, tone: "brand" }
          : null,
        customer.lastOrderAt
          ? { key: "last", label: "สั่งล่าสุด", value: formatDate(customer.lastOrderAt), icon: CalendarClock, tone: "system" }
          : null,
        customer.creditLimit != null
          ? { key: "credit", label: "วงเงินเครดิต", value: formatBaht(customer.creditLimit), icon: CreditCard, tone: "finance" }
          : null,
      ].filter(Boolean) as CustomerHistoryCell[])
    : [];

  const hasPricedWork = totalAmount !== 0 || totalQuantity > 0;
  const totalNeedsReview = totalQuantity > 0 && totalAmount === 0;

  // วงเวลา: สัดส่วนวันที่ใช้ไปนับจากวันเปิดงานถึงกำหนดส่ง (วันปฏิทินไทยทั้งคู่)
  const leadDays = order.deadline ? differenceInBangkokDays(order.deadline, order.createdAt) : null;
  const dueTone: FactTone =
    dueInDays == null ? "neutral" : dueInDays < 0 ? "danger" : dueInDays <= 1 ? "warning" : "neutral";
  const dueRing =
    dueInDays != null && leadDays != null && leadDays > 0 ? (
      <DueRing used={(leadDays - dueInDays) / leadDays} label={String(dueInDays)} tone={dueTone} />
    ) : null;
  const dueDetail =
    dueInDays == null ? null : dueInDays < 0 ? `เลยกำหนด ${-dueInDays} วัน` : dueInDays === 0 ? "ส่งวันนี้" : `อีก ${dueInDays} วัน`;

  const paidRatio =
    showMoney && paidAmount != null && totalAmount > 0 ? Math.min(1, Math.max(0, paidAmount / totalAmount)) : null;

  /* แต่ละส่วนมีปุ่มแก้ไขของตัวเอง (เบสสั่ง 2026-08-11) — ฟอร์มยังเป็นใบเดียว
     แค่เลื่อนไปหัวข้อที่กดมา · ไม่มีสิทธิ์แก้ = ไม่มีปุ่ม */
  const editButton = (section: "info" | "shipping", accessibleLabel: string, visibleLabel = "แก้ไข") =>
    onEditInfo ? (
      <Button type="button" variant="ghost" size="sm" aria-label={accessibleLabel} onClick={() => onEditInfo(section)}>
        {visibleLabel}
      </Button>
    ) : undefined;

  const factsGrid = (
    <dl className={cn("grid gap-2.5", showMoney ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      <SummaryFact label="กำหนดส่ง" icon={CalendarDays} tone={dueTone} visual={dueRing} detail={dueDetail}>
        {order.deadline ? (
          formatDate(order.deadline)
        ) : (
          <span className="text-base font-medium text-amber-700 dark:text-amber-300">ยังไม่กำหนดส่ง</span>
        )}
      </SummaryFact>

      <SummaryFact
        label="จำนวน"
        icon={Package}
        detail={
          sizeBreakdown && sizeBreakdown.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {sizeBreakdown.map((row) => (
                <span key={row.size} className="rounded-md bg-surface px-1.5 tabular-nums text-secondary">
                  {row.size} <span className="font-semibold text-strong">{row.quantity.toLocaleString()}</span>
                </span>
              ))}
            </span>
          ) : undefined
        }
      >
        {totalQuantity > 0 ? (
          <>
            {totalQuantity.toLocaleString()} <span className="text-sm font-normal text-muted">ตัว</span>
          </>
        ) : order.estimatedQuantity ? (
          `~${order.estimatedQuantity.toLocaleString()} ตัว`
        ) : (
          <span className="text-base font-medium text-muted">ยังไม่มีรายการ</span>
        )}
      </SummaryFact>

      {/* เงินต้อง gate ระดับ JSX เพราะแท็บ keepMounted — ห้ามซ่อนด้วย CSS */}
      {showMoney && (
        <SummaryFact
          label="ยอดรวม"
          icon={Banknote}
          detail={
            totalNeedsReview ? (
              <span className="text-amber-700 dark:text-amber-300">ยอดเป็นศูนย์ — ตรวจสอบราคา</span>
            ) : paidRatio != null && paidAmount != null ? (
              <>
                <span aria-hidden="true" className="mb-1 block h-1.5 overflow-hidden rounded-full bg-border">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      paidRatio >= 1 ? "bg-green-600 dark:bg-green-400" : paidRatio > 0 ? "bg-amber-500" : "bg-transparent",
                    )}
                    style={{ width: `${Math.round(paidRatio * 100)}%` }}
                  />
                </span>
                {paidRatio >= 1
                  ? "รับเงินครบแล้ว"
                  : paidAmount > 0
                    ? `รับแล้ว ${formatBaht(paidAmount)} (${Math.round(paidRatio * 100)}%)`
                    : "ยังไม่ได้รับเงิน"}
              </>
            ) : undefined
          }
        >
          {onOpenMoney ? (
            <button type="button" onClick={onOpenMoney} className={cn("rounded-lg text-left", FOCUS_BUTTON)}>
              {hasPricedWork ? formatBaht(totalAmount) : "ยังไม่ตีราคา"}
            </button>
          ) : (
            <span>{hasPricedWork ? formatBaht(totalAmount) : "ยังไม่ตีราคา"}</span>
          )}
        </SummaryFact>
      )}
    </dl>
  );

  const orderFields = (
    <FieldGrid>
      <Field label="ประเภทงาน">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge variant={order.orderType === "CUSTOM" ? "accent" : "default"} size="sm">
            {ORDER_TYPE_UI_LABELS[order.orderType]}
          </Badge>
          {printLabel ? (
            <Badge variant="default" size="sm">
              {printLabel}
            </Badge>
          ) : null}
        </span>
      </Field>
      <Field label="ช่องทาง">
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", channelColor.bg, channelColor.text)}>
          {CHANNEL_LABELS[order.channel] ?? order.channel}
        </span>
      </Field>
      <Field label="ความเร่งด่วน">
        <Badge
          variant={order.priority === "URGENT" ? "destructive" : order.priority === "HIGH" ? "warning" : "default"}
          size="sm"
        >
          {PRIORITY_LABELS[order.priority] ?? order.priority}
        </Badge>
      </Field>
      {termsLabel && (
        <Field label="เงื่อนไขชำระ">
          <span>
            {termsLabel}
            {termsDiffers && (
              <span className="mt-0.5 block text-xs font-normal text-muted">มาตรฐานลูกค้า: {customerTermsLabel}</span>
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
          <span className="tabular-nums text-red-600 dark:text-red-400">-{formatBaht(order.platformFee)}</span>
        </Field>
      )}
      {order.stockReservedAt && <Field label="จองสต๊อกแล้ว">{formatDateTime(order.stockReservedAt)}</Field>}
    </FieldGrid>
  );

  const customerGroup = (
    <div data-order-overview-card="customer" className="space-y-3 border-t border-divider pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubHeading icon={User} tone="brand">
          ลูกค้าและผู้ติดต่อ
        </SubHeading>
        {customer ? (
          onOpenCustomer ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenCustomer} aria-label="เปิดหน้าลูกค้า">
              ข้อมูลลูกค้า
              <ArrowRight />
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={`/customers/${customer.id}`} aria-label="เปิดหน้าลูกค้า">
                ข้อมูลลูกค้า
                <ArrowRight />
              </Link>
            </Button>
          )
        ) : null}
      </div>

      {customer ? (
        <>
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
            >
              {customer.name.trim().slice(0, 1) || "?"}
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-strong [overflow-wrap:anywhere]">{customer.name}</p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
                {customer.company ? <span className="[overflow-wrap:anywhere]">{customer.company}</span> : null}
                <Badge variant="accent" size="sm">
                  {customer.customerType === "CORPORATE" ? "นิติบุคคล" : "บุคคลธรรมดา"}
                </Badge>
              </p>
            </div>
          </div>

          {/* gate เงินครอบทั้งก้อน — ช่างไม่เห็นแม้แต่หัวข้อ (TabsContent keepMounted → gate ที่ JSX) */}
          {showMoney && hasCustomerHistory && customerHistoryCells.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {customerHistoryCells.map((cell) => (
                <div key={cell.key} className={cn("px-3 py-2", RADIUS.inner, VISUAL_TONE_CLASSES[cell.tone].soft)}>
                  <dt className="flex items-center gap-1.5 text-xs">
                    <cell.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {cell.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">{cell.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {hasCustomerContact ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {customer.phone ? (
                <ContactRow href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} icon={Phone} sub="โทรหาผู้ติดต่อ">
                  {customer.phone}
                </ContactRow>
              ) : null}
              {hasChat ? (
                <div className={CONTACT_ROW}>
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <ChatLink name={customer.chatName} url={customer.chatUrl} wrap className="text-sm font-medium" />
                    <span className="block text-xs text-muted">
                      ห้องแชท{customer.lineId ? ` · LINE ${customer.lineId}` : ""}
                    </span>
                  </span>
                </div>
              ) : customer.lineId ? (
                <ContactRow icon={MessageCircle} sub="LINE ID">
                  {customer.lineId}
                </ContactRow>
              ) : null}
              {customer.email ? (
                <ContactRow href={`mailto:${customer.email}`} icon={Mail} sub="อีเมล">
                  {customer.email}
                </ContactRow>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">ยังไม่มีช่องทางติดต่อ</p>
          )}

          <FieldGrid>
            <Field label="เลขผู้เสียภาษี" emptyTone="warn" emptyText="ยังไม่มีเลขภาษี — ออกใบกำกับไม่ได้">
              {customer.taxId && (
                <span className="font-mono">
                  {customer.taxId}
                  {customer.branchNumber && (
                    <span className="ml-1.5 font-sans text-xs font-normal text-muted">
                      (สาขา {customer.branchNumber === "00000" ? "สำนักงานใหญ่" : customer.branchNumber})
                    </span>
                  )}
                </span>
              )}
            </Field>
            {customer.notes && (
              <Field label="หมายเหตุลูกค้า (ทุกใบ)" wide>
                {customer.notes}
              </Field>
            )}
          </FieldGrid>

          {/* ที่อยู่ลูกค้า/ออกบิล/ป้าย ใช้ตอนออกเอกสาร ไม่ใช่ทุกครั้งที่เปิดใบ — พับไว้ กดดูได้ */}
          {customer.address || hasBilling || customer.tags.length > 0 ? (
            <details className="group">
              <summary
                className={cn(
                  FOCUS_BUTTON,
                  "flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-secondary [&::-webkit-details-marker]:hidden",
                )}
              >
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
                ที่อยู่ลูกค้าและออกบิล
              </summary>
              <div className="pt-3">
                <FieldGrid>
                  <Field label="ที่อยู่ลูกค้า" wide emptyText="ยังไม่มีที่อยู่ลูกค้า">
                    {customer.address}
                  </Field>
                  {hasBilling ? (
                    <Field label="ที่อยู่ออกบิล" wide>
                      <span className="block space-y-0.5">
                        {customer.billingAddress && <span className="block">{customer.billingAddress}</span>}
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
                            className={cn("max-w-full whitespace-normal [overflow-wrap:anywhere]", VISUAL_TONE_CLASSES.system.soft)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    </Field>
                  )}
                </FieldGrid>
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted">ใบนี้ยังไม่ผูกกับลูกค้า</p>
      )}
    </div>
  );

  const shippingGroup = (
    <div data-order-overview-card="shipping" className="space-y-3 border-t border-divider pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubHeading icon={Truck} tone="success">
          การจัดส่ง
        </SubHeading>
        {editButton("shipping", hasShipping ? "แก้ไขที่อยู่จัดส่ง" : "เพิ่มที่อยู่จัดส่ง", hasShipping ? "แก้ไข" : "เพิ่มที่อยู่")}
      </div>
      {hasShipping ? (
        <address className="text-sm not-italic leading-6 text-strong [overflow-wrap:anywhere]">
          {order.shippingRecipientName && <span className="block font-medium">{order.shippingRecipientName}</span>}
          {order.shippingAddress && <span className="block">{order.shippingAddress}</span>}
          {shippingArea && <span className="block">{shippingArea}</span>}
          {!order.shippingAddress && !shippingArea && (
            <span className="block text-amber-700 dark:text-amber-300">ยังไม่มีที่อยู่จัดส่ง</span>
          )}
          {order.shippingPhone && <PhoneLink phone={order.shippingPhone} />}
        </address>
      ) : (
        <p className="text-sm text-muted">
          {customer?.address && onEditInfo
            ? "ยังไม่มีที่อยู่จัดส่ง — หน้าแก้ไขเลือกใช้ที่อยู่ลูกค้าได้ทันที"
            : "ยังไม่มีที่อยู่จัดส่ง — เพิ่มผู้รับและที่อยู่ก่อนสร้างใบส่งของ"}
        </p>
      )}
      {order.trackingNumber && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2">
          <span className="min-w-0 text-sm">
            <span className="block text-xs text-muted">เลขพัสดุในออเดอร์</span>
            <span className="font-mono font-medium text-strong [overflow-wrap:anywhere]">{order.trackingNumber}</span>
          </span>
          {onOpenDelivery && (
            <Button type="button" variant="ghost" size="sm" onClick={onOpenDelivery}>
              ดูการจัดส่ง
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const referenceSection = (
    <dl className="flex flex-wrap gap-x-5 gap-y-1 border-t border-divider pt-3 text-xs text-muted">
      {creatorName && <ReferenceItem label="เปิดโดย">{creatorName}</ReferenceItem>}
      <ReferenceItem label="เปิดเมื่อ">{formatDateTime(order.createdAt)}</ReferenceItem>
      {order.confirmedAt && <ReferenceItem label="ยืนยันเมื่อ">{formatDateTime(order.confirmedAt)}</ReferenceItem>}
      {order.completedAt && <ReferenceItem label="ปิดงานเมื่อ">{formatDateTime(order.completedAt)}</ReferenceItem>}
      {order.cancelledAt && (
        <ReferenceItem label="ยกเลิกเมื่อ">
          <span className="text-red-600 dark:text-red-400">
            {formatDateTime(order.cancelledAt)}
            {order.cancelledReason && ` — ${order.cancelledReason}`}
          </span>
        </ReferenceItem>
      )}
      <ReferenceItem label="แก้ล่าสุด">{formatDateTime(order.updatedAt)}</ReferenceItem>
    </dl>
  );

  const brandSection = order.brandProfile && (
    <Section data-order-overview-card="brand" title={<TileTitle icon={Palette}>แบรนด์ลูกค้า</TileTitle>}>
      <div className="space-y-4">
        {order.brandProfile.colorCodes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {order.brandProfile.colorCodes.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-2 py-1 font-mono text-xs text-secondary"
              >
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-slate-300 dark:ring-white/20"
                  style={{ backgroundColor: code }}
                />
                {code}
              </span>
            ))}
          </div>
        )}
        <FieldGrid>
          <Field label="ชื่อแบรนด์">{order.brandProfile.brandName}</Field>
          {order.brandProfile.logoUrl && (
            <Field label="โลโก้">
              <a
                href={order.brandProfile.logoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex min-h-11 min-w-11 items-center rounded-lg text-blue-700 underline decoration-blue-200 underline-offset-4 dark:text-blue-300 dark:decoration-blue-800",
                  FOCUS_BUTTON,
                )}
              >
                เปิดไฟล์โลโก้
              </a>
            </Field>
          )}
          {order.brandProfile.fonts.length > 0 && <Field label="ฟอนต์">{order.brandProfile.fonts.join(", ")}</Field>}
          {order.brandProfile.styleNotes && (
            <Field label="โน้ตสไตล์" wide>
              {order.brandProfile.styleNotes}
            </Field>
          )}
        </FieldGrid>
      </div>
    </Section>
  );

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Section
        data-order-overview-card="summary"
        title={
          <TileTitle icon={Info} tone="brand">
            ข้อมูลออเดอร์
          </TileTitle>
        }
        action={editButton("info", "แก้ไขข้อมูลออเดอร์")}
      >
        <div className="space-y-5">
          {factsGrid}
          {orderFields}
          {customerGroup}
          {shippingGroup}
          {referenceSection}
        </div>
      </Section>
      <div className="min-w-0 space-y-4">
        {artwork}
        {brandSection}
      </div>
    </div>
  );
}
