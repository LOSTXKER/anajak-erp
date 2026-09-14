import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Box,
  Calendar,
  CalendarClock,
  ChevronRight,
  CreditCard,
  Flag,
  Hash,
  Info,
  Mail,
  MessageCircle,
  PackageCheck,
  PenLine,
  Phone,
  Plus,
  Repeat2,
  Tag,
  Truck,
  User,
  Wallet,
} from "lucide-react";
import type { CustomerStatus, OrderType } from "@prisma/client";
import { safeChatUrl } from "@/components/customers/chat-link";
import { avatarLetter, c, CardHead, MiniRing, Prop, Rw, StateBox, SubHead, timeText } from "@/components/orders/orders-ui";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { CHANNEL_LABELS, ORDER_TYPE_UI_LABELS, PRIORITY_LABELS } from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { formatBaht, formatDate, formatDateCompact } from "@/lib/utils";

/* ============================================================
   แท็บ "ภาพรวม" — ต้นแบบ tabOverview() ทีละชิ้น (รื้อ 2026-09-15)

   ข้อมูลออเดอร์ซ้าย · ม็อกอัพ & ไฟล์ขวา (เบสเคาะ 09-13) — การ์ดซ้ายใบเดียว:
   ช่องข้อมูลหลัก 3 ช่อง (วงเวลากำหนดส่ง / จำนวน+ไซซ์ / ยอด+แถบชำระ) → ช่องข้อมูลย่อยมีไอคอน →
   ลูกค้าและผู้ติดต่อ (กดโทร/แชท/อีเมลได้) → การจัดส่ง → ใครเปิด/แก้ล่าสุด
   ของจริงที่ต้นแบบไม่มีแต่ต้องคง: ประวัติลูกค้า (เห็นเงินเท่านั้น) · เลขภาษี/ที่อยู่ออกบิล (พับไว้) · เลขพัสดุ

   ⚠️ แท็บถูกคง DOM ไว้ตอนสลับ → เงินต้อง gate ด้วย {showMoney && ...} ที่ JSX เท่านั้น ห้ามซ่อนด้วยคลาส
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
  // ยังไม่มีใน schema — ประกาศ optional ไว้ให้ "ยืนยันเมื่อ" ทำงานทันทีวันที่เพิ่มจริง
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
  // นโยบาย ⑦: ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย — false = ไม่มียอด/ปุ่มเงินใน DOM เลย (ห้ามโชว์ ฿0)
  showMoney: boolean;
  totalAmount: number;
  totalQuantity: number;
  /** วันถึงกำหนดส่งตามปฏิทินไทย · ไม่ส่ง = งานจบแล้ว ไม่วาดวงเวลา */
  dueInDays?: number | null;
  sizeBreakdown?: readonly { size: string; quantity: number }[];
  /** ยอดที่รับชำระแล้วจากสูตรกลาง billingOverview — ส่งมาเฉพาะคนเห็นเงิน */
  paidAmount?: number | null;
  /** ชนิดงานพิมพ์ของทั้งใบ เช่น DTF · สกรีน · ผสม */
  printLabel?: string | null;
  onOpenMoney?: () => void;
  // เลขพัสดุเป็นข้อมูลของงานจัดส่ง — กดแล้วไปดู delivery จริงทุกใบ
  onOpenDelivery?: () => void;
  // เปิดฟอร์มแก้เต็มหน้าโดยโฟกัสส่วนที่กด — ไม่ส่งมา = ไม่มีสิทธิ์แก้ ปุ่มไม่ต้องขึ้น
  onEditInfo?: (section: "info" | "shipping") => void;
  onOpenCustomer?: () => void;
  /** การ์ด "ม็อกอัพ & ไฟล์" คอลัมน์ขวา — หน้าแม่ส่งชิ้นสำเร็จเข้ามา (การ์ดนั้นยิง query เอง) */
  artwork?: React.ReactNode;
  /** คงไว้ให้ผู้เรียกเดิม — หน้าตาใหม่ใช้ชิป LINE ของต้นแบบ */
  channelColor?: { bg: string; text: string };
  isMarketplace: boolean;
}

function areaLine(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" ").trim() || null;
}

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
  isMarketplace,
}: OrderOverviewTabProps) {
  const customer = order.customer;
  const creatorName = typeof order.createdBy === "string" ? order.createdBy : (order.createdBy?.name ?? null);
  const typeLabel = ORDER_TYPE_UI_LABELS[order.orderType];
  const tech = printLabel ?? (order.orderType === "READY_MADE" ? "สำเร็จรูป" : null);

  const termsLabel = order.paymentTerms ? (PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms) : null;
  const customerTerms = customer?.defaultPaymentTerms ?? null;
  // ต่างจากมาตรฐานลูกค้า = ตั้งใจให้ใบนี้พิเศษ ต้องบอกว่ามาตรฐานคืออะไรด้วย
  const termsDiffers = !!customerTerms && customerTerms !== order.paymentTerms;
  const customerTermsLabel = customerTerms ? (PAYMENT_TERMS_LABELS[customerTerms] ?? customerTerms) : null;

  const shippingArea = areaLine([
    order.shippingSubDistrict,
    order.shippingDistrict,
    order.shippingProvince,
    order.shippingPostalCode,
  ]);
  const hasShipping = Boolean(order.shippingRecipientName || order.shippingPhone || order.shippingAddress || shippingArea);
  const billingArea = areaLine([
    customer?.billingSubDistrict,
    customer?.billingDistrict,
    customer?.billingProvince,
    customer?.billingPostalCode,
  ]);
  const hasBilling = Boolean(customer?.billingAddress || billingArea);

  const chatUrl = safeChatUrl(customer?.chatUrl);
  const hasChat = Boolean(customer?.chatName || chatUrl);
  const hasCustomerContact = Boolean(customer?.phone || hasChat || customer?.lineId || customer?.email);
  const hasCustomerHistory = Boolean(
    customer &&
      (customer.creditLimit != null || customer.totalSpent != null || customer.totalOrders > 0 || customer.lastOrderAt),
  );
  /* ประวัติลูกค้า = สี่ค่าที่คนถามตอนเปิดใบงาน · ช่องไหนไม่มีค่าก็หายทั้งช่อง · gate เงินครอบทั้งก้อน */
  const customerHistoryCells = customer
    ? [
        customer.totalSpent != null ? { key: "spent", label: "ซื้อสะสม", value: formatBaht(customer.totalSpent), icon: Wallet } : null,
        customer.totalOrders > 0
          ? { key: "orders", label: "สั่งมาแล้ว", value: `${customer.totalOrders.toLocaleString("th-TH")} ครั้ง`, icon: Repeat2 }
          : null,
        customer.lastOrderAt ? { key: "last", label: "สั่งล่าสุด", value: formatDate(customer.lastOrderAt), icon: CalendarClock } : null,
        customer.creditLimit != null
          ? { key: "credit", label: "วงเงินเครดิต", value: formatBaht(customer.creditLimit), icon: CreditCard }
          : null,
      ].filter((cell): cell is NonNullable<typeof cell> => cell !== null)
    : [];

  const hasPricedWork = totalAmount !== 0 || totalQuantity > 0;
  const totalNeedsReview = totalQuantity > 0 && totalAmount === 0;

  // วงเวลา: วันที่ใช้ไปนับจากวันเปิดงานถึงกำหนดส่ง (วันปฏิทินไทยทั้งคู่)
  const leadDays = order.deadline ? Math.max(1, differenceInBangkokDays(order.deadline, order.createdAt) ?? 1) : null;
  const dueTone = dueInDays == null ? "" : dueInDays < 0 ? "bad" : dueInDays <= 2 ? "warn" : "";
  const usedDays = dueInDays != null && leadDays != null ? Math.min(Math.max(0, leadDays - dueInDays), leadDays) : null;

  const paidRatio =
    showMoney && paidAmount != null && totalAmount > 0 ? Math.min(1, Math.max(0, paidAmount / totalAmount)) : null;

  const companyTitle = customer ? customer.company?.trim() || customer.name : null;
  const contactPerson = customer?.company?.trim() && customer.name !== customer.company ? customer.name : null;

  const stockProp = order.stockReservationError ? (
    <Prop icon={Box} label="จองสต๊อก">
      <span className={c("chip bad")}>จองไม่สำเร็จ</span>
    </Prop>
  ) : order.stockReservedAt ? (
    <Prop icon={Box} label="จองสต๊อก">
      <span className={c("chip good")}>
        {totalQuantity > 0 ? `จองแล้ว ${totalQuantity.toLocaleString("th-TH")} ตัว` : "จองแล้ว"}
      </span>
    </Prop>
  ) : null;

  const left = (
    <section className={c("card")} aria-labelledby="ov-info" data-order-overview-card="summary">
      <CardHead
        icon={Info}
        tone="blue"
        id="ov-info"
        title="ข้อมูลออเดอร์"
        right={
          onEditInfo ? (
            <button
              type="button"
              className={c("btn ghost sm")}
              aria-label="แก้ไขข้อมูลออเดอร์"
              onClick={() => onEditInfo("info")}
            >
              <PenLine aria-hidden="true" />
              แก้ไข
            </button>
          ) : undefined
        }
      />
      <div className={c("cb")}>
        <div className={c("facts")}>
          <div className={c("fact rich", dueTone)}>
            {dueInDays != null && leadDays != null ? (
              <MiniRing
                pct={(usedDays ?? 0) / leadDays}
                tone={dueTone}
                label={
                  dueInDays < 0 ? `-${-dueInDays}` : dueInDays === 0 ? <span className={c("sm")}>วันนี้</span> : String(dueInDays)
                }
              />
            ) : null}
            <span className={c("t")}>
              <span className={c("k")}>
                <Calendar aria-hidden="true" />
                กำหนดส่ง
              </span>
              <span className={c("v")}>
                {order.deadline ? formatDateCompact(order.deadline) : <span className={c("soft")}>ยังไม่กำหนด</span>}
              </span>
              {dueInDays != null ? (
                <span className={c("sub")}>
                  {dueInDays < 0 ? `เลยกำหนด ${-dueInDays} วัน` : dueInDays === 0 ? "ส่งวันนี้" : `เหลือ ${dueInDays} วัน`}
                  {usedDays != null && leadDays != null ? ` · ใช้ไป ${usedDays}/${leadDays} วัน` : ""}
                </span>
              ) : null}
            </span>
          </div>

          <div className={c("fact")}>
            <span className={c("k")}>
              <PackageCheck aria-hidden="true" />
              จำนวน
            </span>
            <span className={c("v")}>
              {totalQuantity > 0 ? (
                <>
                  {totalQuantity.toLocaleString("th-TH")}
                  <small>ตัว</small>
                </>
              ) : order.estimatedQuantity ? (
                <>
                  ~{order.estimatedQuantity.toLocaleString("th-TH")}
                  <small>ตัว</small>
                </>
              ) : (
                <small>ยังไม่มีรายการ</small>
              )}
            </span>
            {sizeBreakdown && sizeBreakdown.length > 0 ? (
              <span className={c("sub")}>
                {sizeBreakdown.map((row) => `${row.size} ${row.quantity.toLocaleString("th-TH")}`).join(" · ")}
              </span>
            ) : null}
          </div>

          {/* เงินต้อง gate ระดับ JSX เพราะแท็บคง DOM ไว้ — ห้ามซ่อนด้วย CSS */}
          {showMoney && (
            <div className={c("fact")}>
              <span className={c("k")}>
                <Banknote aria-hidden="true" />
                ยอดรวม
              </span>
              <span className={c("v mono")}>
                {onOpenMoney ? (
                  <button type="button" className={c("vbtn")} onClick={onOpenMoney}>
                    {hasPricedWork ? formatBaht(totalAmount) : "ยังไม่ตีราคา"}
                  </button>
                ) : hasPricedWork ? (
                  formatBaht(totalAmount)
                ) : (
                  "ยังไม่ตีราคา"
                )}
              </span>
              {paidRatio != null && paidAmount != null && !totalNeedsReview ? (
                <span className={c("bar")} aria-hidden="true">
                  <i
                    className={c(paidRatio >= 1 ? null : paidRatio > 0 ? "warn" : "bad")}
                    style={{ width: `${Math.max(2, Math.round(paidRatio * 100))}%` }}
                  />
                </span>
              ) : null}
              {totalNeedsReview ? (
                <span className={c("sub")}>ยอดเป็นศูนย์ — ตรวจสอบราคา</span>
              ) : paidRatio != null && paidAmount != null ? (
                <span className={c("sub")}>
                  {paidRatio >= 1
                    ? "ชำระครบแล้ว"
                    : paidAmount > 0
                      ? `ชำระแล้ว ${Math.round(paidRatio * 100)}% · ค้าง ${formatBaht(Math.max(0, totalAmount - paidAmount))}`
                      : `ยังไม่ได้รับเงิน${termsLabel ? ` · ${termsLabel}` : ""}`}
                </span>
              ) : null}
            </div>
          )}
          {!showMoney && (
            <div className={c("fact")}>
              <span className={c("k")}>
                <Tag aria-hidden="true" />
                วิธีพิมพ์
              </span>
              <span className={c("v")}>{tech ?? typeLabel}</span>
            </div>
          )}
        </div>

        <dl className={c("props top")}>
          <Prop icon={Tag} label="ประเภทงาน">
            {tech && tech !== typeLabel ? `${typeLabel} · ${tech}` : typeLabel}
          </Prop>
          <Prop icon={MessageCircle} label="ช่องทาง">
            {order.channel === "LINE" ? (
              <span className={c("chip lineapp")}>LINE</span>
            ) : (
              (CHANNEL_LABELS[order.channel] ?? order.channel)
            )}
          </Prop>
          {showMoney && termsLabel ? (
            <Prop icon={Wallet} label="เงื่อนไขชำระ">
              {termsLabel}
              {termsDiffers ? <small>มาตรฐานลูกค้า: {customerTermsLabel}</small> : null}
            </Prop>
          ) : null}
          {order.poNumber ? (
            <Prop icon={Hash} label="เลขที่ PO">
              <span className={c("mono")}>{order.poNumber}</span>
            </Prop>
          ) : null}
          <Prop icon={Flag} label="ความเร่งด่วน">
            {order.priority === "URGENT" || order.priority === "HIGH" ? (
              <span className={c("chip", order.priority === "URGENT" ? "bad" : "warn")}>
                {PRIORITY_LABELS[order.priority] ?? order.priority}
              </span>
            ) : (
              (PRIORITY_LABELS[order.priority] ?? order.priority)
            )}
          </Prop>
          {stockProp}
          {order.externalOrderId ? (
            <Prop icon={Hash} label="หมายเลขภายนอก">
              <span className={c("mono")}>{order.externalOrderId}</span>
            </Prop>
          ) : null}
          {isMarketplace && showMoney && order.platformFee != null ? (
            <Prop icon={Banknote} label="ค่าธรรมเนียมแพลตฟอร์ม">
              -{formatBaht(order.platformFee)}
            </Prop>
          ) : null}
        </dl>

        <div className={c("hr")} />

        <div data-order-overview-card="customer">
          <SubHead icon={User} tone="blue" title="ลูกค้าและผู้ติดต่อ" />
          {customer ? (
            <>
              <div className={c("person")}>
                <span className={c("av")} aria-hidden="true">
                  {avatarLetter(companyTitle ?? customer.name)}
                </span>
                <span className={c("nm")}>
                  <b>{companyTitle}</b>
                  <small>{contactPerson ?? (customer.customerType === "CORPORATE" ? "นิติบุคคล" : "บุคคลธรรมดา")}</small>
                </span>
                {onOpenCustomer ? (
                  <button type="button" className={c("btn sm")} onClick={onOpenCustomer} aria-label="เปิดหน้าลูกค้า">
                    ข้อมูลลูกค้า
                    <ArrowRight aria-hidden="true" />
                  </button>
                ) : (
                  <Link href={`/customers/${customer.id}`} className={c("btn sm")} aria-label="เปิดหน้าลูกค้า">
                    ข้อมูลลูกค้า
                    <ArrowRight aria-hidden="true" />
                  </Link>
                )}
              </div>

              {/* gate เงินครอบทั้งก้อน — ช่างไม่เห็นแม้แต่หัวข้อ */}
              {showMoney && hasCustomerHistory && customerHistoryCells.length > 0 && (
                <dl className={c("facts four hist")}>
                  {customerHistoryCells.map((cell) => (
                    <div key={cell.key} className={c("fact")}>
                      <dt className={c("k")}>
                        <cell.icon aria-hidden="true" />
                        {cell.label}
                      </dt>
                      <dd className={c("v")}>{cell.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className={c("rows")}>
                {customer.phone ? (
                  <Rw
                    href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`}
                    icon={Phone}
                    title={customer.phone}
                    sub="โทรหาผู้ติดต่อ"
                    arrow="external"
                  />
                ) : null}
                {hasChat ? (
                  <Rw
                    href={chatUrl ?? undefined}
                    icon={MessageCircle}
                    tone="lineapp"
                    title={customer.chatName || "เปิดแชท"}
                    sub={`ห้องแชท LINE${customer.lineId ? ` · ${customer.lineId}` : ""}`}
                    arrow="external"
                  />
                ) : customer.lineId ? (
                  <Rw icon={MessageCircle} tone="lineapp" title={customer.lineId} sub="LINE ID" />
                ) : null}
                {customer.email ? (
                  <Rw href={`mailto:${customer.email}`} icon={Mail} title={customer.email} sub="อีเมล" arrow="external" />
                ) : null}
                {!hasCustomerContact ? (
                  <Rw icon={User} title={<span className={c("soft")}>ยังไม่มีช่องทางติดต่อ</span>} />
                ) : null}
              </div>

              {/* เลขภาษี/ที่อยู่ออกบิลใช้ตอนออกเอกสาร ไม่ใช่ทุกครั้งที่เปิดใบ — พับไว้ แต่ขาดเลขภาษีต้องเห็นจากหัวพับ */}
              <details className={c("more")}>
                <summary>
                  <ChevronRight aria-hidden="true" />
                  ข้อมูลออกบิลของลูกค้า
                  {!customer.taxId ? <span className={c("chip warn")}>ยังไม่มีเลขภาษี</span> : null}
                </summary>
                <dl className={c("props top")}>
                  <Prop icon={Hash} label="เลขผู้เสียภาษี" none={!customer.taxId}>
                    {customer.taxId ? (
                      <>
                        <span className={c("mono")}>{customer.taxId}</span>
                        {customer.branchNumber ? (
                          <small>สาขา {customer.branchNumber === "00000" ? "สำนักงานใหญ่" : customer.branchNumber}</small>
                        ) : null}
                      </>
                    ) : (
                      "ยังไม่มีเลขภาษี — ออกใบกำกับไม่ได้"
                    )}
                  </Prop>
                  <Prop label="ที่อยู่ลูกค้า" none={!customer.address}>
                    {customer.address || "ยังไม่มีที่อยู่ลูกค้า"}
                  </Prop>
                  {hasBilling ? (
                    <Prop label="ที่อยู่ออกบิล">
                      {customer.billingAddress}
                      {billingArea ? <small>{billingArea}</small> : null}
                    </Prop>
                  ) : null}
                  {customer.tags.length > 0 ? (
                    <Prop label="ป้ายลูกค้า">
                      <span className={c("sizes")}>
                        {customer.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </span>
                    </Prop>
                  ) : null}
                  {customer.notes ? <Prop label="หมายเหตุลูกค้า (ทุกใบ)">{customer.notes}</Prop> : null}
                </dl>
              </details>
            </>
          ) : (
            <StateBox icon={User}>ใบนี้ยังไม่ผูกกับลูกค้า</StateBox>
          )}
        </div>

        <div className={c("hr")} />

        <div data-order-overview-card="shipping">
          <SubHead
            icon={Truck}
            tone="good"
            title="การจัดส่ง"
            right={
              hasShipping && onEditInfo ? (
                <button
                  type="button"
                  className={c("btn ghost sm")}
                  aria-label="แก้ไขที่อยู่จัดส่ง"
                  onClick={() => onEditInfo("shipping")}
                >
                  <PenLine aria-hidden="true" />
                  แก้ไข
                </button>
              ) : undefined
            }
          />
          {hasShipping ? (
            <address className={c("addr")}>
              {order.shippingRecipientName ? <b>{order.shippingRecipientName}</b> : null}
              {order.shippingAddress}
              {order.shippingAddress && shippingArea ? <br /> : null}
              {shippingArea}
              {!order.shippingAddress && !shippingArea ? <span className={c("muted")}>ยังไม่มีที่อยู่จัดส่ง</span> : null}
              {order.shippingPhone ? (
                <>
                  <br />
                  <span className={c("muted")}>
                    <a href={`tel:${order.shippingPhone.replace(/[^\d+]/g, "")}`}>{order.shippingPhone}</a>
                  </span>
                </>
              ) : null}
            </address>
          ) : (
            <StateBox
              icon={Truck}
              action={
                onEditInfo ? (
                  <button
                    type="button"
                    className={c("btn sm")}
                    aria-label="เพิ่มที่อยู่จัดส่ง"
                    onClick={() => onEditInfo("shipping")}
                  >
                    <Plus aria-hidden="true" />
                    ใส่ที่อยู่
                  </button>
                ) : undefined
              }
            >
              ยังไม่ระบุที่อยู่จัดส่ง
            </StateBox>
          )}
          {order.trackingNumber ? (
            <div className={c("rows top")}>
              <Rw
                onClick={onOpenDelivery}
                icon={Truck}
                title={<span className={c("mono")}>{order.trackingNumber}</span>}
                sub="เลขพัสดุในออเดอร์ · ดูการจัดส่ง"
              />
            </div>
          ) : null}
        </div>

        <div className={c("ref")}>
          <span>
            {creatorName ? (
              <>
                เปิดโดย <b>{creatorName}</b> · {formatDateCompact(order.createdAt)}
              </>
            ) : (
              <>
                เปิดเมื่อ <b>{formatDateCompact(order.createdAt)}</b>
              </>
            )}
          </span>
          {order.confirmedAt ? (
            <span>
              ยืนยันเมื่อ <b>{formatDateCompact(order.confirmedAt)}</b>
            </span>
          ) : null}
          {order.completedAt ? (
            <span>
              ปิดงานเมื่อ <b>{formatDateCompact(order.completedAt)}</b>
            </span>
          ) : null}
          {order.cancelledAt ? (
            <span>
              ยกเลิกเมื่อ <b>{formatDateCompact(order.cancelledAt)}</b>
              {order.cancelledReason ? ` · ${order.cancelledReason}` : ""}
            </span>
          ) : null}
          <span>
            แก้ล่าสุด{" "}
            <b>
              {formatDateCompact(order.updatedAt)} {timeText(order.updatedAt)}
            </b>
          </span>
        </div>
      </div>
    </section>
  );

  return (
    <div className={c("two")}>
      {left}
      {artwork}
    </div>
  );
}
