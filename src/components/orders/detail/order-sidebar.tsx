import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { OrderType } from "@prisma/client";
import {
  CHANNEL_LABELS,
  ORDER_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PAYMENT_TERMS_LABELS,
} from "@/lib/order-status";
import {
  User,
  FileText,
  Truck,
  Tag,
  DollarSign,
  BarChart3,
  Store,
  Hash,
} from "lucide-react";
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
  taxAmount: number;
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

export function OrderSidebar({
  order,
  subtotalItems,
  subtotalFees,
  discount,
  totalAmount,
  totalCost,
  hasCostEntries,
  profitMargin,
  channelColor,
  isMarketplace,
}: OrderSidebarProps) {
  return (
    <div className="space-y-6">
      {/* CUSTOMER INFO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            ลูกค้า
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.customer && (
            <>
              <Link
                href={`/customers/${order.customer.id}`}
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {order.customer.name}
              </Link>
              {order.customer.company && (
                <p className="text-sm text-slate-500">{order.customer.company}</p>
              )}
              {order.customer.phone && (
                <p className="text-sm text-slate-500">{order.customer.phone}</p>
              )}
              {order.customer.email && (
                <p className="text-sm text-slate-500">{order.customer.email}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ORDER INFO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            ข้อมูลออเดอร์
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">ประเภท</span>
            <Badge variant={order.orderType === "CUSTOM" ? "purple" : "default"}>
              {ORDER_TYPE_LABELS[order.orderType]}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">ช่องทาง</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${channelColor.bg} ${channelColor.text}`}>
              {CHANNEL_LABELS[order.channel] ?? order.channel}
            </span>
          </div>
          {order.createdBy && (
            <div className="flex justify-between">
              <span className="text-slate-500">สร้างโดย</span>
              <span className="text-slate-900 dark:text-white">
                {typeof order.createdBy === "string" ? order.createdBy : order.createdBy.name}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">วันที่สร้าง</span>
            <span className="text-slate-900 dark:text-white">{formatDate(order.createdAt)}</span>
          </div>
          {order.updatedAt && (
            <div className="flex justify-between">
              <span className="text-slate-500">แก้ไขล่าสุด</span>
              <span className="text-slate-900 dark:text-white">{formatDateTime(order.updatedAt)}</span>
            </div>
          )}
          {order.deadline && (
            <div className="flex justify-between">
              <span className="text-slate-500">กำหนดส่ง</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatDate(order.deadline)}</span>
            </div>
          )}
          {order.estimatedQuantity && (
            <div className="flex justify-between">
              <span className="text-slate-500">จำนวนโดยประมาณ</span>
              <span className="font-medium text-slate-900 dark:text-white">
                ~{order.estimatedQuantity.toLocaleString()} ชิ้น
              </span>
            </div>
          )}
          {order.priority && order.priority !== "NORMAL" && (
            <div className="flex justify-between">
              <span className="text-slate-500">ความเร่งด่วน</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[order.priority]?.bg ?? ""} ${PRIORITY_COLORS[order.priority]?.text ?? ""}`}>
                {PRIORITY_LABELS[order.priority] ?? order.priority}
              </span>
            </div>
          )}
          {order.paymentTerms && (
            <div className="flex justify-between">
              <span className="text-slate-500">เงื่อนไขชำระ</span>
              <span className="text-slate-900 dark:text-white">
                {PAYMENT_TERMS_LABELS[order.paymentTerms] ?? order.paymentTerms}
              </span>
            </div>
          )}
          {order.poNumber && (
            <div className="flex justify-between">
              <span className="text-slate-500">เลขที่ PO</span>
              <span className="font-mono text-slate-900 dark:text-white">{order.poNumber}</span>
            </div>
          )}
          {order.description && (
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-slate-500">{order.description}</p>
            </div>
          )}
          {order.notes && (
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="mb-1 text-xs text-slate-400">หมายเหตุ</p>
              <p className="text-slate-500">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SHIPPING ADDRESS */}
      {order.shippingRecipientName && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" />
              ที่อยู่จัดส่ง
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium text-slate-900 dark:text-white">{order.shippingRecipientName}</p>
            {order.shippingPhone && <p className="text-slate-500">{order.shippingPhone}</p>}
            {order.shippingAddress && <p className="text-slate-500">{order.shippingAddress}</p>}
            <p className="text-slate-500">
              {[order.shippingSubDistrict, order.shippingDistrict, order.shippingProvince, order.shippingPostalCode]
                .filter(Boolean)
                .join(" ")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* MARKETPLACE INFO */}
      {isMarketplace && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4" />
              ข้อมูล Marketplace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {order.externalOrderId && (
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-slate-500">
                  <Hash className="h-3.5 w-3.5" />
                  หมายเลขภายนอก
                </span>
                <span className="font-mono text-xs text-slate-900 dark:text-white">{order.externalOrderId}</span>
              </div>
            )}
            {order.platformFee != null && (
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-slate-500">
                  <Tag className="h-3.5 w-3.5" />
                  ค่าธรรมเนียมแพลตฟอร์ม
                </span>
                <span className="tabular-nums font-medium text-red-600 dark:text-red-400">
                  -{formatCurrency(order.platformFee)}
                </span>
              </div>
            )}
            {order.trackingNumber && (
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-slate-500">
                  <Truck className="h-3.5 w-3.5" />
                  เลขพัสดุ
                </span>
                <span className="font-mono text-xs text-slate-900 dark:text-white">{order.trackingNumber}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PRICE BREAKDOWN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            สรุปราคา
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">ยอดรวมสินค้า</span>
            <span className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(subtotalItems)}</span>
          </div>
          {subtotalFees > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">ค่าธรรมเนียม</span>
              <span className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(subtotalFees)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">ส่วนลด</span>
              <span className="tabular-nums text-red-600 dark:text-red-400">-{formatCurrency(discount)}</span>
            </div>
          )}
          {order.taxRate > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">VAT ({order.taxRate}%)</span>
              <span className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(order.taxAmount ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              ยอดรวมทั้งหมด {order.taxRate > 0 ? "(รวม VAT)" : ""}
            </span>
            <span className="tabular-nums text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalAmount)}</span>
          </div>

          {/* Cost tracking */}
          {hasCostEntries && (
            <div className="border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <BarChart3 className="h-3.5 w-3.5" />
                ต้นทุน
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">ต้นทุนรวม</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">กำไร</span>
                  <span className="tabular-nums font-medium text-slate-900 dark:text-white">{formatCurrency(totalAmount - totalCost)}</span>
                </div>
                {profitMargin != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">อัตรากำไร</span>
                    <span
                      className={`tabular-nums font-bold ${
                        profitMargin >= 30
                          ? "text-green-600 dark:text-green-400"
                          : profitMargin >= 15
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {profitMargin.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BILLING SECTION */}
      <OrderBillingSection
        orderId={order.id}
        customerId={order.customerId}
        totalAmount={totalAmount}
        internalStatus={order.internalStatus}
      />
    </div>
  );
}
