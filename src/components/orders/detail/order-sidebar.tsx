import Link from "next/link";
import { User, Info, MapPin, Store, Calculator } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { OrderType } from "@prisma/client";
import {
  CHANNEL_LABELS,
  ORDER_TYPE_LABELS,
  PRIORITY_LABELS,
} from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { OrderBillingSection } from "@/components/orders/order-billing-section";

interface OrderSidebarOrder {
  id: string;
  customerId: string;
  orderType: OrderType;
  channel: string;
  internalStatus: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deadline: Date | string | null;
  priority: string;
  paymentTerms: string | null;
  poNumber: string | null;
  description: string | null;
  notes: string | null;
  estimatedQuantity: number | null;
  taxRate: number;
  // null เมื่อ viewer ไม่เห็นเงินฝั่งขาย (นโยบาย ⑦ — server ปิดมาแล้ว)
  taxAmount: number | null;
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
  customer: {
    id: string;
    name: string;
    company: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  createdBy: { name: string | null } | string | null;
}

interface OrderSidebarProps {
  order: OrderSidebarOrder;
  // นโยบาย ⑦: ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย — false = ไม่ render การ์ดสรุปราคาเลย (ห้ามโชว์ ฿0)
  showMoney: boolean;
  subtotalItems: number;
  subtotalFees: number;
  discount: number;
  totalAmount: number;
  totalCost: number;
  hasCostEntries: boolean;
  profitMargin: number | null;
  channelColor: { bg: string; text: string };
  isMarketplace: boolean;
}

// หัวข้อ sidebar = ไอคอน + ชื่อ เข้าชุดกับการ์ดฝั่งซ้าย/การ์ดบิล (กลมกลืนทั้งหน้า)
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

function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <div className="text-right text-sm font-medium text-slate-900 dark:text-white">
        {children}
      </div>
    </div>
  );
}

export function OrderSidebar({
  order,
  showMoney,
  subtotalItems,
  subtotalFees,
  discount,
  totalAmount,
  totalCost,
  hasCostEntries,
  profitMargin,
  isMarketplace,
}: OrderSidebarProps) {
  return (
    <div className="space-y-4">
      {/* Customer */}
      <Section title={<SectionTitle icon={User}>ลูกค้า</SectionTitle>}>
        {order.customer && (
          <div className="space-y-1.5">
            <Link
              href={`/customers/${order.customer.id}`}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {order.customer.name}
            </Link>
            {order.customer.company && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {order.customer.company}
              </p>
            )}
            {order.customer.phone && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {order.customer.phone}
              </p>
            )}
            {order.customer.email && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {order.customer.email}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Order info */}
      <Section title={<SectionTitle icon={Info}>ข้อมูลออเดอร์</SectionTitle>}>
        <div className="space-y-2.5">
          <Row label="ประเภท">
            <Badge variant={order.orderType === "CUSTOM" ? "accent" : "default"} size="sm">
              {ORDER_TYPE_LABELS[order.orderType]}
            </Badge>
          </Row>
          <Row label="ช่องทาง">
            <span className="text-sm text-slate-900 dark:text-white">
              {CHANNEL_LABELS[order.channel] ?? order.channel}
            </span>
          </Row>
          {order.createdBy && (
            <Row label="สร้างโดย">
              {typeof order.createdBy === "string"
                ? order.createdBy
                : order.createdBy.name}
            </Row>
          )}
          <Row label="วันที่สร้าง">{formatDate(order.createdAt)}</Row>
          {order.updatedAt && (
            <Row label="แก้ไขล่าสุด">{formatDateTime(order.updatedAt)}</Row>
          )}
          {order.deadline && (
            <Row label="กำหนดส่ง">{formatDate(order.deadline)}</Row>
          )}
          {order.estimatedQuantity && (
            <Row label="จำนวนโดยประมาณ">
              ~{order.estimatedQuantity.toLocaleString()} ชิ้น
            </Row>
          )}
          {order.priority && order.priority !== "NORMAL" && (
            <Row label="ความเร่งด่วน">
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
            </Row>
          )}
          {order.paymentTerms && (
            <Row label="เงื่อนไขชำระ">
              {PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms}
            </Row>
          )}
          {order.poNumber && (
            <Row label="เลขที่ PO">
              <span className="font-mono">{order.poNumber}</span>
            </Row>
          )}
          {order.description && (
            <p className="border-t border-slate-100 pt-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {order.description}
            </p>
          )}
          {order.notes && (
            <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                หมายเหตุ
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {order.notes}
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* Shipping */}
      {order.shippingRecipientName && (
        <Section title={<SectionTitle icon={MapPin}>ที่อยู่จัดส่ง</SectionTitle>}>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-slate-900 dark:text-white">
              {order.shippingRecipientName}
            </p>
            {order.shippingPhone && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {order.shippingPhone}
              </p>
            )}
            {order.shippingAddress && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {order.shippingAddress}
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {[
                order.shippingSubDistrict,
                order.shippingDistrict,
                order.shippingProvince,
                order.shippingPostalCode,
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
          </div>
        </Section>
      )}

      {/* Marketplace */}
      {isMarketplace && (
        <Section title={<SectionTitle icon={Store}>ข้อมูล Marketplace</SectionTitle>}>
          <div className="space-y-2.5">
            {order.externalOrderId && (
              <Row label="หมายเลขภายนอก">
                <span className="font-mono text-xs">{order.externalOrderId}</span>
              </Row>
            )}
            {order.platformFee != null && (
              <Row label="ค่าธรรมเนียม">
                <span className="tabular-nums text-red-600 dark:text-red-400">
                  -{formatCurrency(order.platformFee)}
                </span>
              </Row>
            )}
            {order.trackingNumber && (
              <Row label="เลขพัสดุ">
                <span className="font-mono text-xs">{order.trackingNumber}</span>
              </Row>
            )}
          </div>
        </Section>
      )}

      {/* Price breakdown — ยังไม่ตีราคา = ไม่โชว์การ์ด ฿0 ซ้ำซ้อน (redesign 2026-06-11)
          แต่ถ้ามีต้นทุนบันทึกแล้ว (เช่นส่ง outsource ก่อนตีราคา) ต้องเห็น — เงินจริงห้ามหายจากตา
          · viewer ที่ไม่เห็นเงิน (นโยบาย ⑦) ตัดการ์ดทิ้งทั้งใบ ไม่ใช่โชว์ ฿0 */}
      {showMoney &&
        (totalAmount > 0 || subtotalItems > 0 || subtotalFees > 0 || hasCostEntries) && (
      <Section title={<SectionTitle icon={Calculator}>สรุปราคา</SectionTitle>}>
        <div className="space-y-2.5">
          <Row label="ยอดรวมสินค้า">
            <span className="tabular-nums">{formatCurrency(subtotalItems)}</span>
          </Row>
          {subtotalFees > 0 && (
            <Row label="ค่าธรรมเนียม">
              <span className="tabular-nums">{formatCurrency(subtotalFees)}</span>
            </Row>
          )}
          {discount > 0 && (
            <Row label="ส่วนลด">
              <span className="tabular-nums text-red-600 dark:text-red-400">
                -{formatCurrency(discount)}
              </span>
            </Row>
          )}
          {order.taxRate > 0 && (
            <Row label={`VAT (${order.taxRate}%)`}>
              <span className="tabular-nums">
                {formatCurrency(order.taxAmount ?? 0)}
              </span>
            </Row>
          )}
          <div className="flex items-baseline justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              ยอดรวมทั้งหมด
            </span>
            <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          {hasCostEntries && (
            <div className="space-y-2.5 border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                ต้นทุน
              </p>
              <Row label="ต้นทุนรวม">
                <span className="tabular-nums">{formatCurrency(totalCost)}</span>
              </Row>
              <Row label="กำไร">
                <span className="tabular-nums">
                  {formatCurrency(totalAmount - totalCost)}
                </span>
              </Row>
              {profitMargin != null && (
                <Row label="อัตรากำไร">
                  <span
                    className={`tabular-nums font-semibold ${
                      profitMargin >= 30
                        ? "text-green-600 dark:text-green-400"
                        : profitMargin >= 15
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {profitMargin.toFixed(1)}%
                  </span>
                </Row>
              )}
            </div>
          )}
        </div>
      </Section>
      )}

      <div id="order-section-billing" className="scroll-mt-20">
        <OrderBillingSection
          orderId={order.id}
          customerId={order.customerId}
          totalAmount={totalAmount}
          internalStatus={order.internalStatus}
        />
      </div>
    </div>
  );
}
