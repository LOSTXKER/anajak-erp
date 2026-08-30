"use client";

/**
 * "เนื้อหาของใบงาน" แยกออกจาก "หน้าตา" — ทั้ง 4 ทางในหน้าลองอ่านจากที่นี่ที่เดียว
 *
 * ทำแบบนี้เพราะกฎ "เอาของมาให้ครบ": ถ้าปล่อยให้แต่ละทางเขียนช่องเอง ทางที่ทำทีหลัง
 * จะตกช่องไปเงียบ ๆ แล้วเบสตัดสินจากของที่ไม่เท่ากัน · ที่นี่จึงเป็นแหล่งเดียวของ
 * "ใบนี้มีข้อมูลอะไรบ้าง" ส่วนแต่ละทางตัดสินแค่ว่า "วางยังไงให้อ่านง่าย/สวย"
 *
 * ค่าที่ว่างจะถูกตัดออกตั้งแต่ที่นี่ (เหมือน <Field> ของจริงที่ไม่ render แถว "-")
 */

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChatLink } from "@/components/customers/chat-link";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  CUSTOMER_STATUS_LABELS,
  ORDER_TYPE_UI_LABELS,
  PRIORITY_LABELS,
} from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import type { DemoOrder } from "./_data";

export type Row = {
  key: string;
  label: string;
  value: React.ReactNode;
  /** ค่ายาว (ที่อยู่ · หมายเหตุ) — กินเต็มแถว ไม่บีบครึ่งคอลัมน์ */
  wide?: boolean;
  /** ว่างแล้วมีผลจริง (ไม่มีเลขภาษี = ออกใบกำกับไม่ได้) — ใช้โทนเตือนแทนสีจาง */
  tone?: "warn";
  /** ค่านี้เป็นตัวเลข/รหัส — จัดฟอนต์ให้อ่านเทียบกันได้ */
  mono?: boolean;
};

/** ยอมรับผลของสำนวน `cond && {...}` ตรง ๆ (ได้ "" / null / false ปนมา) แล้วกรองทิ้ง */
type MaybeRow = Row | null | undefined | false | "" | 0;
const rows = (list: MaybeRow[]): Row[] =>
  list.filter((r): r is Row => typeof r === "object" && r !== null);

/** เบอร์โทรต้องกดโทรได้ — href เหลือแต่ตัวเลข ไม่งั้นเบอร์ที่มีขีด/ต่อ โทรไม่ออกบางเครื่อง */
export function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      className={cn(
        "inline-flex items-center rounded-md text-blue-600 hover:underline dark:text-blue-400",
        FOCUS_BUTTON,
      )}
    >
      {phone}
    </a>
  );
}

function areaLine(parts: (string | null)[]) {
  const line = parts.filter(Boolean).join(" ").trim();
  return line || null;
}

/* ============================================================
   ① สี่ข้อเท็จจริงหลักที่ทุกคนเปิดใบงานมาหา
   ============================================================ */

export type Fact = {
  key: string;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  /** ค่ายังไม่ถูกกรอก — ทุกทางต้องแสดงให้จางกว่าและไม่ทำเป็นตัวใหญ่ */
  empty?: boolean;
  tone?: "warn";
};

export function buildFacts(
  order: DemoOrder,
  totals: { totalAmount: number; totalQuantity: number },
  showMoney: boolean,
): Fact[] {
  const hasPricedWork = totals.totalAmount !== 0 || totals.totalQuantity > 0;
  const totalNeedsReview = totals.totalQuantity > 0 && totals.totalAmount === 0;

  const list: Fact[] = [
    {
      key: "customer",
      label: "ลูกค้า",
      value: order.customer ? order.customer.name : "ยังไม่ผูกลูกค้า",
      detail: order.customer?.company || undefined,
      empty: !order.customer,
    },
    {
      key: "deadline",
      label: "กำหนดส่ง",
      value: order.deadline ? formatDate(order.deadline) : "ยังไม่กำหนดส่ง",
      empty: !order.deadline,
      tone: order.deadline ? undefined : "warn",
      detail: (
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
      ),
    },
    {
      key: "qty",
      label: "จำนวนรวม",
      value:
        totals.totalQuantity > 0
          ? `${totals.totalQuantity.toLocaleString()} ชิ้น`
          : order.estimatedQuantity
            ? `~${order.estimatedQuantity.toLocaleString()} ชิ้น`
            : "ยังไม่มีรายการ",
      empty: totals.totalQuantity === 0 && !order.estimatedQuantity,
      detail:
        totals.totalQuantity === 0 && order.estimatedQuantity
          ? "ตัวเลขประมาณจากตอนสอบถาม"
          : undefined,
    },
  ];

  // เงินต้องตัดที่ระดับ JSX ไม่ใช่ซ่อนด้วย CSS — ช่าง/กราฟิกเปิด DOM ต้องไม่เจอตัวเลข
  if (showMoney) {
    list.push({
      key: "total",
      label: "ยอดรวม",
      value: hasPricedWork ? formatCurrency(totals.totalAmount) : "ยังไม่ตีราคา",
      empty: !hasPricedWork,
      detail: totalNeedsReview ? "ยอดเป็นศูนย์ — ตรวจสอบราคา" : undefined,
      tone: totalNeedsReview ? "warn" : undefined,
    });
  }

  return list;
}

/* ============================================================
   ② ข้อมูลประกอบของใบงาน
   ============================================================ */

export function buildOrderMeta(order: DemoOrder, showMoney: boolean): Row[] {
  const termsLabel = order.paymentTerms
    ? (PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms)
    : null;
  const customerTerms = order.customer?.defaultPaymentTerms ?? null;
  const termsDiffers = !!customerTerms && customerTerms !== order.paymentTerms;
  const customerTermsLabel = customerTerms
    ? (PAYMENT_TERMS_LABELS[customerTerms] ?? customerTerms)
    : null;

  return rows([
    {
      key: "type",
      label: "ประเภทงาน",
      value: (
        <Badge variant={order.orderType === "CUSTOM" ? "accent" : "default"} size="sm">
          {ORDER_TYPE_UI_LABELS[order.orderType]}
        </Badge>
      ),
    },
    {
      key: "channel",
      label: "ช่องทาง",
      value: CHANNEL_LABELS[order.channel] ?? order.channel,
    },
    {
      key: "customerStatus",
      label: "สถานะที่ลูกค้าเห็น",
      value: (
        <Badge variant="default" size="sm">
          {CUSTOMER_STATUS_LABELS[order.customerStatus] ?? order.customerStatus}
        </Badge>
      ),
    },
    termsLabel && {
      key: "terms",
      label: "เงื่อนไขชำระ",
      value: (
        <span>
          {termsLabel}
          {termsDiffers && (
            <span className="mt-0.5 block text-xs font-normal text-muted">
              มาตรฐานลูกค้า: {customerTermsLabel}
            </span>
          )}
        </span>
      ),
    },
    order.poNumber && {
      key: "po",
      label: "เลขที่ PO",
      value: order.poNumber,
      mono: true,
    },
    order.externalOrderId && {
      key: "external",
      label: "หมายเลขภายนอก",
      value: order.externalOrderId,
      mono: true,
    },
    showMoney &&
      order.platformFee != null && {
        key: "platformFee",
        label: "ค่าธรรมเนียมแพลตฟอร์ม",
        value: (
          <span className="tabular-nums text-red-600 dark:text-red-400">
            -{formatCurrency(order.platformFee)}
          </span>
        ),
      },
    order.stockReservedAt && {
      key: "stock",
      label: "จองสต๊อกแล้ว",
      value: formatDateTime(order.stockReservedAt),
    },
  ]);
}

/** บรรทัดเวลาแบบอ้างอิง — เงียบที่สุดในหน้า */
export function buildTimeline(order: DemoOrder): { label: string; value: string }[] {
  const creatorName =
    typeof order.createdBy === "string" ? order.createdBy : (order.createdBy?.name ?? null);

  const list: { label: string; value: string }[] = [];
  if (creatorName) list.push({ label: "เปิดโดย", value: creatorName });
  list.push({ label: "เปิดเมื่อ", value: formatDateTime(order.createdAt) });
  if (order.confirmedAt)
    list.push({ label: "ยืนยันเมื่อ", value: formatDateTime(order.confirmedAt) });
  if (order.completedAt)
    list.push({ label: "ปิดงานเมื่อ", value: formatDateTime(order.completedAt) });
  if (order.cancelledAt)
    list.push({
      label: "ยกเลิกเมื่อ",
      value:
        formatDateTime(order.cancelledAt) +
        (order.cancelledReason ? ` — ${order.cancelledReason}` : ""),
    });
  list.push({ label: "แก้ล่าสุด", value: formatDateTime(order.updatedAt) });
  return list;
}

/* ============================================================
   ③ ลูกค้าและผู้ติดต่อ
   ============================================================ */

export function buildCustomerTax(order: DemoOrder): Row[] {
  const c = order.customer;
  if (!c) return [];
  return rows([
    {
      key: "taxId",
      label: "เลขผู้เสียภาษี",
      tone: c.taxId ? undefined : "warn",
      mono: Boolean(c.taxId),
      value: c.taxId ? (
        <span>
          {c.taxId}
          {c.branchNumber && (
            <span className="ml-1.5 font-sans text-xs font-normal text-muted">
              (สาขา {c.branchNumber === "00000" ? "สำนักงานใหญ่" : c.branchNumber})
            </span>
          )}
        </span>
      ) : (
        "ยังไม่มีเลขภาษี — ออกใบกำกับไม่ได้"
      ),
    },
  ]);
}

export function buildCustomerContact(order: DemoOrder): Row[] {
  const c = order.customer;
  if (!c) return [];
  return rows([
    c.phone && { key: "phone", label: "โทรศัพท์", value: <PhoneLink phone={c.phone} /> },
    (c.chatName || c.chatUrl) && {
      key: "chat",
      label: "ห้องแชท",
      value: <ChatLink name={c.chatName} url={c.chatUrl} wrap className="text-sm" />,
    },
    c.lineId && { key: "line", label: "LINE ID", value: c.lineId },
    c.email && { key: "email", label: "อีเมล", value: c.email },
  ]);
}

export function buildCustomerAddress(order: DemoOrder): Row[] {
  const c = order.customer;
  if (!c) return [];
  const billingArea = areaLine([
    c.billingSubDistrict,
    c.billingDistrict,
    c.billingProvince,
    c.billingPostalCode,
  ]);
  const hasBilling = Boolean(
    c.billingAddress ||
      c.billingSubDistrict ||
      c.billingDistrict ||
      c.billingProvince ||
      c.billingPostalCode,
  );

  return rows([
    {
      key: "address",
      label: "ที่อยู่ลูกค้า",
      wide: true,
      tone: c.address ? undefined : "warn",
      value: c.address ?? "ยังไม่มีที่อยู่ลูกค้า",
    },
    hasBilling
      ? {
          key: "billing",
          label: "ที่อยู่ออกบิล",
          wide: true,
          value: (
            <span className="block space-y-0.5">
              {c.billingAddress && <span className="block">{c.billingAddress}</span>}
              {billingArea && <span className="block">{billingArea}</span>}
            </span>
          ),
        }
      : c.address
        ? { key: "billing", label: "ที่อยู่ออกบิล", wide: true, value: "ใช้ที่อยู่ลูกค้า" }
        : null,
    c.tags.length > 0 && {
      key: "tags",
      label: "ป้ายลูกค้า",
      wide: true,
      value: (
        <span className="flex flex-wrap gap-1.5">
          {c.tags.map((tag) => (
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
      ),
    },
    c.notes && {
      key: "customerNotes",
      label: "หมายเหตุลูกค้า (ทุกใบ)",
      wide: true,
      value: c.notes,
    },
  ]);
}

export function buildCustomerHistory(order: DemoOrder, showMoney: boolean): Row[] {
  const c = order.customer;
  if (!c || !showMoney) return [];
  return rows([
    c.creditLimit != null && {
      key: "credit",
      label: "วงเงินเครดิต",
      value: <span className="tabular-nums">{formatCurrency(c.creditLimit)}</span>,
    },
    c.totalSpent != null && {
      key: "spent",
      label: "ยอดซื้อสะสม",
      value: <span className="tabular-nums">{formatCurrency(c.totalSpent)}</span>,
    },
    c.totalOrders > 0 && {
      key: "orders",
      label: "สั่งมาแล้ว",
      value: `${c.totalOrders.toLocaleString()} ครั้ง`,
    },
    c.lastOrderAt && {
      key: "last",
      label: "สั่งล่าสุด",
      value: formatDate(c.lastOrderAt),
    },
  ]);
}

export function customerLink(order: DemoOrder) {
  return order.customer ? `/customers/${order.customer.id}` : null;
}

/* ============================================================
   ④ การจัดส่ง
   ============================================================ */

export function hasShippingInfo(order: DemoOrder) {
  return Boolean(
    order.shippingRecipientName ||
      order.shippingPhone ||
      order.shippingAddress ||
      order.shippingSubDistrict ||
      order.shippingDistrict ||
      order.shippingProvince ||
      order.shippingPostalCode,
  );
}

export function buildShipping(order: DemoOrder): Row[] {
  if (!hasShippingInfo(order)) return [];
  const shippingArea = areaLine([
    order.shippingSubDistrict,
    order.shippingDistrict,
    order.shippingProvince,
    order.shippingPostalCode,
  ]);

  return rows([
    order.shippingRecipientName && {
      key: "recipient",
      label: "ผู้รับ",
      value: order.shippingRecipientName,
    },
    order.shippingPhone && {
      key: "recipientPhone",
      label: "เบอร์ผู้รับ",
      value: <PhoneLink phone={order.shippingPhone} />,
    },
    {
      key: "shipAddress",
      label: "ที่อยู่จัดส่ง",
      wide: true,
      tone: order.shippingAddress || shippingArea ? undefined : "warn",
      value:
        order.shippingAddress || shippingArea ? (
          <span className="block space-y-0.5">
            {order.shippingAddress && <span className="block">{order.shippingAddress}</span>}
            {shippingArea && <span className="block">{shippingArea}</span>}
          </span>
        ) : (
          "ยังไม่มีที่อยู่จัดส่ง"
        ),
    },
  ]);
}

/* ============================================================
   ⑤ แบรนด์ลูกค้า
   ============================================================ */

export function buildBrand(order: DemoOrder): Row[] {
  const b = order.brandProfile;
  if (!b) return [];
  return rows([
    { key: "brandName", label: "ชื่อแบรนด์", value: b.brandName },
    b.logoUrl && {
      key: "logo",
      label: "โลโก้",
      value: (
        <a
          href={b.logoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center rounded-md text-blue-600 hover:underline dark:text-blue-400",
            FOCUS_BUTTON,
          )}
        >
          เปิดไฟล์โลโก้
        </a>
      ),
    },
    b.colorCodes.length > 0 && {
      key: "colors",
      label: "โค้ดสี",
      wide: true,
      value: (
        <span className="flex flex-wrap gap-2">
          {b.colorCodes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 font-mono text-xs text-secondary"
            >
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-border"
                style={{ backgroundColor: code }}
              />
              {code}
            </span>
          ))}
        </span>
      ),
    },
    b.fonts.length > 0 && {
      key: "fonts",
      label: "ฟอนต์",
      wide: true,
      value: b.fonts.join(" · "),
    },
    b.styleNotes && {
      key: "styleNotes",
      label: "โน้ตสไตล์",
      wide: true,
      value: b.styleNotes,
    },
  ]);
}

/* ============================================================
   ชิ้นส่วนเล็กที่ทุกทางใช้ร่วม (ปุ่มลิงก์ไปหน้าลูกค้า)
   ============================================================ */

export function CustomerPageLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md text-sm font-medium text-blue-600 hover:underline dark:text-blue-400",
        FOCUS_BUTTON,
      )}
    >
      เปิดหน้าลูกค้า
    </Link>
  );
}
