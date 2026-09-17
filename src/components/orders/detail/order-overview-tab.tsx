import Link from "next/link";
import {
  Banknote,
  Box,
  Calendar,
  ChevronRight,
  Flag,
  Hash,
  Info,
  MapPin,
  MessageCircle,
  PackageCheck,
  PenLine,
  ReceiptText,
  Plus,
  StickyNote,
  Tag,
  Truck,
  User,
  Wallet,
} from "lucide-react";
import type { CustomerStatus, OrderType } from "@prisma/client";
import { c, CardHead, MiniRing, Prop, StateBox, SubHead, timeText } from "@/components/kit/kit";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { CHANNEL_LABELS, ORDER_TYPE_UI_LABELS, PRIORITY_DAY_HINTS, PRIORITY_LABELS } from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { formatBaht, formatDateCompact } from "@/lib/utils";

/* ============================================================
   แท็บ "ภาพรวม" — ต้นแบบ tabOverview() ทีละชิ้น (รื้อ 2026-09-15)

   ข้อมูลออเดอร์ซ้าย · ม็อกอัพ & ไฟล์ขวา (เบสเคาะ 09-13) — การ์ดซ้ายใบเดียว:
   ช่องข้อมูลหลัก 3 กล่อง (กำหนดส่ง+วงนับวัน / จำนวน / ยอด+แถบชำระ · ไม่มีบรรทัดเล็กใต้ค่า เบส 09-15) →
   ช่องข้อมูลย่อยมีไอคอน → ลูกค้า (กล่องเดียว: พรีวิวกดไปหน้าลูกค้า + ข้อมูลออกบิลพับไว้ · ประวัติซื้อดูหน้าลูกค้า) → การจัดส่ง (ช่องพรีวิว กดไปแท็บจัดส่ง) → ใครเปิด/แก้ล่าสุด
   ของจริงที่ต้องคง: เลขภาษี/ที่อยู่ออกบิล (พับไว้) · เลขพัสดุ (บรรทัดเล็กในพรีวิวจัดส่ง)

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
  const billingFull = [customer?.billingAddress, billingArea].filter(Boolean).join(" ").trim();
  const billingSameAsCustomer = hasBilling && !!customer?.address && billingFull === customer.address.trim();

  // ช่องทางติดต่อรวมบรรทัดเดียวในช่องพรีวิว — กดโทร/แชทจริงอยู่หน้าลูกค้า
  const contactLine = [
    customer?.phone,
    customer?.chatName ? `LINE ${customer.chatName}` : customer?.lineId ? `LINE ${customer.lineId}` : null,
    customer?.email,
  ]
    .filter(Boolean)
    .join(" · ");

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
        <div className={c("facts main")}>
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
                <span
                  className={c("bar")}
                  role="img"
                  aria-label={
                    paidRatio >= 1
                      ? "ชำระครบแล้ว"
                      : paidAmount > 0
                        ? `ชำระแล้ว ${Math.round(paidRatio * 100)}% · ค้าง ${formatBaht(Math.max(0, totalAmount - paidAmount))}`
                        : `ยังไม่ได้รับเงิน${termsLabel ? ` · ${termsLabel}` : ""}`
                  }
                >
                  <i
                    className={c(paidRatio >= 1 ? null : paidRatio > 0 ? "warn" : "bad")}
                    style={{ width: `${Math.max(2, Math.round(paidRatio * 100))}%` }}
                  />
                </span>
              ) : null}
              {/* ยอดศูนย์ทั้งที่มีรายการ = ต้องตรวจราคา — คำเตือนนี้คงไว้ ส่วนบรรทัดชำระแล้ว/ค้างเบสถอด (แถบบอกแทน) */}
              {totalNeedsReview ? <span className={c("sub")}>ยอดเป็นศูนย์ — ตรวจสอบราคา</span> : null}
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
            {/* ช่วงวันของระดับ — ป้ายหัวใบเป็นตัวเตือน ที่นี่คือค่าในช่อง จึงบอกความหมายได้ไม่ซ้ำกัน */}
            {PRIORITY_DAY_HINTS[order.priority] ? <small>{PRIORITY_DAY_HINTS[order.priority]}</small> : null}
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
              {/* ลูกค้า = กล่องเดียว (เบส 09-15): พรีวิว (กดไปหน้าลูกค้า) + ข้อมูลออกบิลพับไว้ แบ่งด้วยเส้น
                  ประวัติซื้อ/วงเงินไปดูที่หน้าลูกค้า ไม่แสดงในใบออเดอร์ */}
              <div className={c("custbox")}>
                {(() => {
                  const body = (
                    <>
                      <span className={c("tx")}>
                        <b>{companyTitle}</b>
                        <span className={c("ln")}>
                          {contactPerson
                            ? `ผู้ติดต่อ ${contactPerson}`
                            : customer.customerType === "CORPORATE"
                              ? "นิติบุคคล"
                              : "บุคคลธรรมดา"}
                        </span>
                        <small>{contactLine || "ยังไม่มีช่องทางติดต่อ"}</small>
                      </span>
                      <span className={c("go")}>
                        ข้อมูลลูกค้า
                        <ChevronRight aria-hidden="true" />
                      </span>
                    </>
                  );
                  return onOpenCustomer ? (
                    <button type="button" className={c("preview")} onClick={onOpenCustomer} aria-label={`เปิดหน้าลูกค้า ${companyTitle}`}>
                      {body}
                    </button>
                  ) : (
                    <Link href={`/customers/${customer.id}`} className={c("preview")} aria-label={`เปิดหน้าลูกค้า ${companyTitle}`}>
                      {body}
                    </Link>
                  );
                })()}

                {/* เลขภาษี/ที่อยู่ออกบิลใช้ตอนออกเอกสาร — พับไว้ หัวพับบอกเลขภาษีหรือเตือนว่ายังไม่มี */}
                <details className={c("billbox")}>
                  <summary>
                    <span className={c("t")}>
                      <ChevronRight className={c("cv")} aria-hidden="true" />
                      ข้อมูลออกบิลของลูกค้า
                    </span>
                    {customer.taxId ? (
                      <span className={c("mono sumtax")}>{customer.taxId}</span>
                    ) : (
                      <span className={c("chip warn")}>ยังไม่มีเลขภาษี</span>
                    )}
                  </summary>
                  <dl className={c("props")}>
                    <Prop icon={Hash} label="เลขผู้เสียภาษี">
                      {customer.taxId ? (
                        <>
                          <span className={c("mono")}>{customer.taxId}</span>
                          {customer.branchNumber ? (
                            <small>{customer.branchNumber === "00000" ? "สำนักงานใหญ่" : `สาขา ${customer.branchNumber}`}</small>
                          ) : null}
                        </>
                      ) : (
                        <span className={c("warnt")}>ยังไม่มี · ออกใบกำกับไม่ได้</span>
                      )}
                    </Prop>
                    <Prop icon={Tag} label="ป้ายลูกค้า" none={customer.tags.length === 0}>
                      {customer.tags.length > 0 ? (
                        <span className={c("tagrow")}>
                          {customer.tags.map((tag) => (
                            <span key={tag} className={c("chip gray")}>
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : (
                        "ไม่มีป้าย"
                      )}
                    </Prop>
                    <Prop icon={MapPin} label="ที่อยู่ลูกค้า" none={!customer.address} wide>
                      {customer.address || "ยังไม่มีที่อยู่ลูกค้า"}
                    </Prop>
                    <Prop icon={ReceiptText} label="ที่อยู่ออกบิล" none={!hasBilling || billingSameAsCustomer} wide>
                      {!hasBilling ? (
                        "ยังไม่มีที่อยู่ออกบิล"
                      ) : billingSameAsCustomer ? (
                        "ใช้ที่อยู่เดียวกับลูกค้า"
                      ) : (
                        <>
                          {customer.billingAddress}
                          {billingArea ? <small>{billingArea}</small> : null}
                        </>
                      )}
                    </Prop>
                    {customer.notes ? (
                      <Prop icon={StickyNote} label="หมายเหตุลูกค้า (ทุกใบ)" wide>
                        {customer.notes}
                      </Prop>
                    ) : null}
                  </dl>
                </details>
              </div>
            </>
          ) : (
            <StateBox icon={User}>ใบนี้ยังไม่ผูกกับลูกค้า</StateBox>
          )}
        </div>

        <div className={c("hr")} />

        <div data-order-overview-card="shipping">
          <SubHead icon={Truck} tone="good" title="การจัดส่ง" />
          {hasShipping ? (
            /* ช่องพรีวิวการจัดส่ง (เบส 09-15) — กดทั้งช่องไปแท็บจัดส่ง แก้ไขที่นั่น */
            <button
              type="button"
              className={c("preview")}
              onClick={onOpenDelivery}
              disabled={!onOpenDelivery}
              aria-label={`ไปแท็บจัดส่ง${order.shippingRecipientName ? ` ${order.shippingRecipientName}` : ""}`}
            >
              <span className={c("tx")}>
                <b>{order.shippingRecipientName || "ยังไม่ระบุผู้รับ"}</b>
                <span className={c("ln")}>
                  {[order.shippingAddress, shippingArea].filter(Boolean).join(" ") || "ยังไม่มีที่อยู่จัดส่ง"}
                </span>
                {order.shippingPhone || order.trackingNumber ? (
                  <small>
                    {[order.shippingPhone, order.trackingNumber ? `พัสดุ ${order.trackingNumber}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                ) : null}
              </span>
              <span className={c("go")}>
                ดูการจัดส่ง
                <ChevronRight aria-hidden="true" />
              </span>
            </button>
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
