import Link from "next/link";
import {
  User,
  Info,
  MapPin,
  Palette,
} from "lucide-react";
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
import { DISPLAY_AMOUNT, DISPLAY_AMOUNT_LABEL, FOCUS_BUTTON } from "@/components/ui/tokens";

/* ============================================================
   แท็บ "ภาพรวม" — ที่รวมของที่ "ไม่ใช่รายการสินค้า" ทั้งหมด
   (เบสสั่ง 2026-08-11: "tab แรกเป็นแบบภาพรวมดีกว่า จะเป็นพวกผู้ติดต่อ
    และอื่นๆ แต่รายการ แยกไปอีก tab นึง")

   ไฟล์นี้เดิมคือคอลัมน์ขวา (order-sidebar) กว้าง 1/3 — พอยุบคอลัมน์ทิ้ง
   เนื้อหาได้ความกว้างเต็มหน้า จึงเลิกจัดแบบ "ป้ายซ้าย–ค่าชิดขวา" ของ sidebar
   (บนการ์ดกว้าง ช่องว่างกลางแถวจะยาวจนสายตาโยงป้ายกับค่าไม่ติด)
   → เปลี่ยนเป็นป้ายเล็กวางบนค่า แล้วเรียงเป็นกริด 2 คอลัมน์

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
  title: string;
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
  // เปิด OrderInfoEditDialog — ไม่ส่งมา = ไม่มีสิทธิ์แก้ ปุ่มไม่ต้องขึ้น
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
      <Icon className="h-4 w-4" />
      {children}
    </span>
  );
}

/** กริดของช่องข้อมูล — 2 คอลัมน์เมื่อการ์ดกว้างพอ
 *  ช่วง md การ์ดถูกบีบเหลือครึ่งหน้า (กริดนอกเป็น 2 คอลัมน์แล้ว) จึงยุบกลับเป็น 1 คอลัมน์
 *  ไม่งั้นค่าจะขึ้นบรรทัดใหม่กลางคำเกือบทุกช่อง */
function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
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
    children !== null && children !== undefined && children !== false && children !== "";

  return (
    <div className={cn("min-w-0 space-y-0.5", wide && "sm:col-span-2 md:col-span-1 lg:col-span-2")}>
      <dt className="text-xs text-muted">{label}</dt>
      {/* ไทยห้าม truncate — ปล่อยตัดบรรทัดได้ทุกตำแหน่ง ดีกว่าจุดไข่ปลาที่ตัดสระทิ้ง */}
      <dd
        className={cn(
          "text-sm [overflow-wrap:anywhere]",
          filled
            ? "font-medium text-strong"
            : emptyTone === "warn"
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted"
        )}
      >
        {/* ว่างเฉยๆ = ขีดเดียว (เบสสั่ง 2026-08-11) — เดิมขึ้น "ยังไม่ระบุ" ทุกช่อง
            ซึ่งดังเท่าข้อมูลจริงและมีหลายช่องพร้อมกัน ตาต้องอ่านทุกแถวก่อนรู้ว่าแถวไหนมีของ
            ยกเว้นช่องที่ "ว่างแล้วมีผลกระทบ" (เลขภาษี/ที่อยู่ส่งของ) ซึ่งส่ง emptyText มาเอง —
            ขีดจะกลืนไปกับช่องว่างธรรมดาแล้วไม่มีใครเห็นว่างานติด */}
        {filled ? children : (emptyText ?? "-")}
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
        divided && "border-t border-slate-100 pt-4 dark:border-slate-800",
        className
      )}
    >
      {label && (
        <p className="text-2xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
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
  onEditInfo,
  channelColor,
  isMarketplace,
}: OrderOverviewTabProps) {
  const customer = order.customer;

  const creatorName =
    typeof order.createdBy === "string" ? order.createdBy : (order.createdBy?.name ?? null);

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
      order.shippingPostalCode
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
      customer?.billingPostalCode
  );
  const billingArea = areaLine([
    customer?.billingSubDistrict ?? null,
    customer?.billingDistrict ?? null,
    customer?.billingProvince ?? null,
    customer?.billingPostalCode ?? null,
  ]);

  /* แต่ละการ์ดมีปุ่มแก้ไขของตัวเอง (เบสสั่ง 2026-08-11) — ปุ่มเดียวบนการ์ดเดียว
     ทำให้คนที่อยากแก้ที่อยู่ต้องเดาว่าปุ่มบนการ์ดอื่นแก้ที่อยู่ได้ด้วย
     ฟอร์มยังเป็นใบเดียวตามเดิม (ยอด/ภาษี/ส่วนลดผูกกันข้ามหัวข้อ) แค่เลื่อนไปหัวข้อที่กดมา */
  const editButton = (section: "info" | "shipping") =>
    onEditInfo ? (
      <Button type="button" variant="ghost" size="sm" onClick={() => onEditInfo(section)}>
        แก้ไข
      </Button>
    ) : undefined;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {/* การ์ด "งานนี้คืออะไร" ถูกถอดออก — เบสสั่ง 2026-08-11 ("ไม่จำเป็น มันรก")
          ถูกแล้ว: ชื่องานขึ้นเป็นบรรทัดใต้เลขออเดอร์บนหัวหน้าอยู่แล้ว การ์ดนี้จึงพูดซ้ำ
          ของข้างในย้ายไปอยู่ที่ที่ถูกกว่า — รายละเอียดงาน → การ์ด "ข้อมูลออเดอร์"
          · ธง blind ship → นอกแท็บ (คนแพ็คทำงานอยู่แท็บจัดส่ง ต้องเห็นโดยไม่ต้องกลับมา) */}

      {/* ① ลูกค้า & ผู้ติดต่อ */}
      <Section
        title={<SectionTitle icon={User}>ลูกค้า &amp; ผู้ติดต่อ</SectionTitle>}
        action={
          customer ? (
            /* ข้อมูลลูกค้าแก้จากใบออเดอร์ไม่ได้ (มันติดตัวลูกค้า ไม่ใช่ของใบนี้)
               ปุ่มจึงพาไปหน้าลูกค้าตรงๆ และเขียนป้ายให้ตรงว่าไปไหน ไม่ใช่คำว่า "แก้ไข" ลอยๆ */
            <Button asChild variant="ghost" size="sm">
              <Link href={`/customers/${customer.id}`}>แก้ที่หน้าลูกค้า</Link>
            </Button>
          ) : undefined
        }
      >
        {customer ? (
          <div className="space-y-4">
            <FieldGrid>
              <Field label="ชื่อลูกค้า">
                <Link
                  href={`/customers/${customer.id}`}
                  className={cn(
                    "inline-flex min-h-11 min-w-11 items-center rounded-lg text-blue-600 hover:underline dark:text-blue-400",
                    FOCUS_BUTTON
                  )}
                >
                  {customer.name}
                </Link>
              </Field>
              <Field label="บริษัท">{customer.company}</Field>
              <Field label="ประเภทลูกค้า">
                {customer.customerType === "CORPORATE" ? "นิติบุคคล" : "บุคคลธรรมดา"}
              </Field>
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
              <Field label="ที่อยู่ลูกค้า" wide>
                {customer.address}
              </Field>
              <Field label="ป้ายลูกค้า" wide>
                {customer.tags.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {customer.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                )}
              </Field>
              <Field label="หมายเหตุลูกค้า (ทุกใบ)" wide>
                {customer.notes}
              </Field>
            </FieldGrid>

            {/* เงินของลูกค้า — ห่อระดับ JSX ไม่ใช่ซ่อนด้วย CSS (แท็บนี้ forceMount) */}
            {showMoney && (
              <Group divided>
                <FieldGrid>
                  <Field label="วงเงินเครดิต">
                    {customer.creditLimit != null && (
                      <span className="tabular-nums">{formatCurrency(customer.creditLimit)}</span>
                    )}
                  </Field>
                  <Field label="ยอดซื้อสะสม">
                    {customer.totalSpent != null && (
                      <span className="tabular-nums">{formatCurrency(customer.totalSpent)}</span>
                    )}
                  </Field>
                  <Field label="สั่งมาแล้ว">
                    {customer.totalOrders > 0 && `${customer.totalOrders.toLocaleString()} ครั้ง`}
                  </Field>
                  <Field label="สั่งล่าสุด">
                    {customer.lastOrderAt && formatDate(customer.lastOrderAt)}
                  </Field>
                </FieldGrid>
              </Group>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            ใบนี้ยังไม่ผูกกับลูกค้า
          </p>
        )}
      </Section>

      {/* ③ ข้อมูลออเดอร์ — เรียงตามที่คนใช้จริงถาม: ส่งเมื่อไหร่ → งานแบบไหน/บิลยังไง → เกิดอะไรมาแล้วบ้าง
          (ของเดิมเรียงตามลำดับที่ข้อมูลถูกสร้าง เลยเอา "วันที่สร้าง" มาก่อน "กำหนดส่ง") */}
      <Section title={<SectionTitle icon={Info}>ข้อมูลออเดอร์</SectionTitle>} action={editButton("info")}>
        <div className="space-y-4">
          {/* รายละเอียดงาน = บรีฟจากลูกค้า ย้ายมาจากการ์ด "งานนี้คืออะไร" ที่เบสสั่งถอด
              (ชื่องานไม่ต้องเอามาด้วย — มันขึ้นใต้เลขออเดอร์บนหัวหน้าอยู่แล้ว) */}
          {order.description?.trim() && (
            <Group label="รายละเอียดงาน">
              <p className="text-sm text-secondary [overflow-wrap:anywhere]">
                {order.description}
              </p>
            </Group>
          )}

          <Group label="งานนี้ต้องส่งเมื่อไหร่" divided={Boolean(order.description?.trim())}>
            <FieldGrid>
              <Field label="กำหนดส่ง">{order.deadline && formatDate(order.deadline)}</Field>
              <Field label="ความเร่งด่วน">
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
              </Field>
              <Field label="จำนวนรวม">
                {totalQuantity > 0
                  ? `${totalQuantity.toLocaleString()} ชิ้น`
                  : order.estimatedQuantity
                    ? `~${order.estimatedQuantity.toLocaleString()} ชิ้น (ประมาณ)`
                    : undefined}
              </Field>
              {showMoney && (
                <div className="min-w-0 space-y-0.5">
                  <dt className={DISPLAY_AMOUNT_LABEL}>ยอดรวม</dt>
                  <dd>
                    {onOpenMoney ? (
                      <button
                        type="button"
                        onClick={onOpenMoney}
                        className={cn(
                          DISPLAY_AMOUNT,
                          "inline-flex min-h-11 min-w-11 items-center rounded-lg text-left hover:underline",
                          FOCUS_BUTTON
                        )}
                      >
                        {formatCurrency(totalAmount)}
                      </button>
                    ) : (
                      <span className={DISPLAY_AMOUNT}>{formatCurrency(totalAmount)}</span>
                    )}
                  </dd>
                </div>
              )}
            </FieldGrid>
          </Group>

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
                    channelColor.text
                  )}
                >
                  {CHANNEL_LABELS[order.channel] ?? order.channel}
                </span>
              </Field>
              <Field label="เลขที่ PO">
                {order.poNumber && <span className="font-mono">{order.poNumber}</span>}
              </Field>
              {/* หมายเลขภายนอกมาได้จากหลายทาง ไม่ใช่แค่มาร์เก็ตเพลส (งานที่ลูกค้าออกเลขเอง
                  แล้วแปะไว้ก็ใช้ช่องนี้) — ผูกกับ isMarketplace เมื่อไหร่ เลขจะหายจากจอทันที */}
              {order.externalOrderId && (
                <Field label="หมายเลขภายนอก">
                  <span className="font-mono">{order.externalOrderId}</span>
                </Field>
              )}
              <Field label="เงื่อนไขชำระ" wide>
                {termsLabel && (
                  <span>
                    {termsLabel}
                    {termsDiffers && (
                      <span className="ml-1.5 text-xs font-normal text-muted">
                        (มาตรฐานลูกค้า: {customerTermsLabel})
                      </span>
                    )}
                  </span>
                )}
              </Field>
              {/* ค่าธรรมเนียมแพลตฟอร์มเหลือแถวเดียว — ไม่คุ้มเป็นการ์ดของตัวเอง
                  (หมายเลขภายนอกย้ายขึ้นไปข้างบน · เลขพัสดุย้ายไปการ์ดที่อยู่) */}
              {isMarketplace && showMoney && (
                <Field label="ค่าธรรมเนียมแพลตฟอร์ม">
                  {order.platformFee != null && (
                    <span className="tabular-nums text-red-600 dark:text-red-400">
                      -{formatCurrency(order.platformFee)}
                    </span>
                  )}
                </Field>
              )}
              <Field label="สถานะที่ลูกค้าเห็น">
                <Badge variant="default" size="sm">
                  {CUSTOMER_STATUS_LABELS[order.customerStatus] ?? order.customerStatus}
                </Badge>
              </Field>
              <Field label="จองสต๊อค">
                {order.stockReservedAt ? (
                  `จองแล้ว ${formatDateTime(order.stockReservedAt)}`
                ) : order.stockReservationError ? (
                  <span className="text-red-600 dark:text-red-400">
                    {order.stockReservationError}
                  </span>
                ) : (
                  "ยังไม่จอง"
                )}
              </Field>
            </FieldGrid>
          </Group>

          {/* เส้นเวลา = ของอ้างอิงย้อนหลัง ไม่ใช่ของที่ใช้ตัดสินใจตอนนี้ → ตัวเล็กลงทั้งกลุ่ม */}
          <Group label="เส้นเวลา" divided className="[&_dd]:text-xs">
            <FieldGrid>
              <Field label="สร้างโดย">{creatorName}</Field>
              <Field label="วันที่สร้าง">{formatDateTime(order.createdAt)}</Field>
              {order.confirmedAt && (
                <Field label="ยืนยันเมื่อ">{formatDateTime(order.confirmedAt)}</Field>
              )}
              {order.completedAt && (
                <Field label="ปิดงานเมื่อ">{formatDateTime(order.completedAt)}</Field>
              )}
              {order.cancelledAt && (
                <Field label="ยกเลิกเมื่อ" wide>
                  <span className="text-red-600 dark:text-red-400">
                    {formatDateTime(order.cancelledAt)}
                    {order.cancelledReason && ` — ${order.cancelledReason}`}
                  </span>
                </Field>
              )}
              <Field label="แก้ไขล่าสุด">{formatDateTime(order.updatedAt)}</Field>
            </FieldGrid>
          </Group>
        </div>
      </Section>

      {/* ④ ที่อยู่ — ส่งของกับออกบิลคนละใบ ต้องอ่านแยกกันได้โดยไม่ต้องเดา */}
      <Section title={<SectionTitle icon={MapPin}>ที่อยู่</SectionTitle>} action={editButton("shipping")}>
        <div className="space-y-4">
          <Group label="ส่งของ">
            {hasShipping ? (
              <FieldGrid>
                <Field label="ผู้รับ">{order.shippingRecipientName}</Field>
                <Field label="เบอร์ผู้รับ">
                  {order.shippingPhone && <PhoneLink phone={order.shippingPhone} />}
                </Field>
                <Field label="ที่อยู่" wide>
                  {order.shippingAddress || shippingArea ? (
                    <span className="block space-y-0.5">
                      {order.shippingAddress && <span className="block">{order.shippingAddress}</span>}
                      {shippingArea && <span className="block">{shippingArea}</span>}
                    </span>
                  ) : undefined}
                </Field>
              </FieldGrid>
            ) : (
              /* ยังไม่กรอก → เอาที่อยู่ลูกค้ามาวางต่อทันที คนกรอกจะได้ก๊อปได้เลย
                 ไม่ต้องเปิดหน้าลูกค้าอีกแท็บแล้วสลับไปมา (ขั้นตอนที่เสียเวลาที่สุดของงานนี้)
                 ลูกค้าไม่มีที่อยู่ด้วย = กล่องก๊อปไม่มีประโยชน์ เหลือขีดเดียวพอ (เบสสั่ง 2026-08-11) */
              customer?.address ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    ยังไม่กรอกที่อยู่ส่งของ
                  </p>
                  <div className="rounded-xl bg-slate-100 p-3 dark:bg-black/25">
                    <p className="mb-1 text-xs text-muted">ที่อยู่ลูกค้า (ก๊อปมาใช้ได้)</p>
                    <p className="text-sm text-strong [overflow-wrap:anywhere]">
                      {customer.address}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">-</p>
              )
            )}
          </Group>

          <Group label="ออกบิล" divided>
            {hasBilling ? (
              <div className="min-w-0 space-y-0.5 text-sm text-strong [overflow-wrap:anywhere]">
                {customer?.billingAddress && <p>{customer.billingAddress}</p>}
                {billingArea && <p>{billingArea}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted">ใช้ที่อยู่ลูกค้า</p>
            )}
          </Group>

          {/* เลขพัสดุไม่ได้มีเฉพาะมาร์เก็ตเพลส — งานส่งเองก็มีเลขขนส่ง ต้องเห็นทุกช่องทาง */}
          <Group divided>
            <FieldGrid>
              <Field label="เลขพัสดุ">
                {order.trackingNumber && <span className="font-mono">{order.trackingNumber}</span>}
              </Field>
            </FieldGrid>
          </Group>
        </div>
      </Section>

      {/* ⑤ แบรนด์ลูกค้า — ใบที่ไม่ได้ผูกแบรนด์ไม่ต้องมีการ์ดว่างมากินที่ */}
      {order.brandProfile && (
        <Section
          className="md:col-span-2"
          title={<SectionTitle icon={Palette}>แบรนด์ลูกค้า</SectionTitle>}
        >
          <FieldGrid>
            <Field label="ชื่อแบรนด์">{order.brandProfile.brandName}</Field>
            <Field label="โลโก้">
              {order.brandProfile.logoUrl && (
                <a
                  href={order.brandProfile.logoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex min-h-11 min-w-11 items-center rounded-lg text-blue-600 hover:underline dark:text-blue-400",
                    FOCUS_BUTTON
                  )}
                >
                  เปิดไฟล์โลโก้
                </a>
              )}
            </Field>
            {/* โชว์เป็นโค้ดตัวอักษรคู่จุดสี — จุดสีอย่างเดียวก๊อปไปใส่โปรแกรมออกแบบไม่ได้ */}
            <Field label="โค้ดสี" wide>
              {order.brandProfile.colorCodes.length > 0 && (
                <span className="flex flex-wrap gap-2">
                  {order.brandProfile.colorCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
              )}
            </Field>
            <Field label="ฟอนต์" wide>
              {order.brandProfile.fonts.length > 0 && order.brandProfile.fonts.join(" · ")}
            </Field>
            <Field label="โน้ตสไตล์" wide>
              {order.brandProfile.styleNotes}
            </Field>
          </FieldGrid>
        </Section>
      )}
    </div>
  );
}
