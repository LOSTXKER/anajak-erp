"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { ORDER_MONEY_ROLES, roleAllows } from "@/lib/roles";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { customerProfileGaps } from "@/lib/customer-gaps";
import { CustomerArtworksCard } from "@/components/customers/customer-artworks-card";
import { CustomerEditDialog } from "@/components/customers/customer-edit-dialog";
import { CustomerCommLogDialog } from "@/components/customers/customer-comm-log-dialog";
import { commChannelLabel } from "@/lib/comm-channels";
import { ArrowLeft, Phone, Mail, MessageCircle, MapPin, ShoppingCart, DollarSign, Building2, User, CreditCard, FileText, Pencil, MessageSquarePlus } from "lucide-react";

// แก้ข้อมูล/จดบันทึกการคุย = ทีมขาย-บัญชี-บริหาร (ตรง customerEditors ฝั่ง server)
const EDITOR_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT", "SALES"];
// วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES แก้ไม่ได้ (ตรง server guard)
const CREDIT_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"];

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [editing, setEditing] = useState(false);
  const [loggingComm, setLoggingComm] = useState(false);
  const { data: me } = trpc.user.me.useQuery();
  const canEdit = !!me && EDITOR_ROLES.includes(me.role);
  // Policy ⑦: ฝ่ายผลิต/กราฟิกไม่เห็นเงินฝั่งขาย — ซ่อนยอดสั่งรวม/ยอดออเดอร์ (server ส่ง null มาอยู่แล้ว)
  const canSeeMoney = roleAllows(me?.role, ORDER_MONEY_ROLES);
  const { data: customer, isLoading, isError, refetch } = trpc.customer.getById.useQuery({ id });
  // ภาระหนี้เทียบวงเงินเครดิต — ขอเฉพาะลูกค้าที่ตั้งวงเงินไว้ · non-money role ยิงไปก็โดน FORBIDDEN
  const { data: credit } = trpc.customer.creditStatus.useQuery(
    { customerId: id },
    { enabled: canSeeMoney && customer?.creditLimit != null }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (!customer) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/customers"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{customer.name}</h1>
            {customer.customerType === "CORPORATE" ? (
              <Badge variant="default" className="gap-1"><Building2 className="h-3 w-3" /> นิติบุคคล</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><User className="h-3 w-3" /> บุคคลธรรมดา</Badge>
            )}
          </div>
          {customer.company && <p className="text-sm text-slate-500">{customer.company}</p>}
          {customerProfileGaps(customer).length > 0 && (
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
              โปรไฟล์ยังไม่ครบ: {customerProfileGaps(customer).map((g) => g.label).join(" · ")}
            </p>
          )}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            แก้ไขข้อมูล
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">ข้อมูลติดต่อ</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {customer.phone && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Phone className="h-4 w-4" /> {customer.phone}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Mail className="h-4 w-4" /> {customer.email}
                </div>
              )}
              {customer.lineId && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <MessageCircle className="h-4 w-4" /> {customer.lineId}
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <MapPin className="h-4 w-4" /> {customer.address}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">สรุป</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-500"><ShoppingCart className="h-4 w-4" /> ออเดอร์ทั้งหมด</span>
                <span className="font-bold tabular-nums">{customer._count.orders}</span>
              </div>
              {canSeeMoney && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-500"><DollarSign className="h-4 w-4" /> ยอดสั่งรวม</span>
                  <span className="font-bold tabular-nums">{formatCurrency(customer.totalSpent ?? 0)}</span>
                </div>
              )}
              {customer.lastOrderAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">สั่งล่าสุด</span>
                  <span className="text-sm">{formatDate(customer.lastOrderAt)}</span>
                </div>
              )}
              {customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {customer.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Corporate/Billing Info — โชว์เมื่อมีข้อมูลจริงด้วย แม้ type เป็นบุคคล
              (review B7: วงเงิน/เลขภาษีค้างหลังสลับประเภทยังบังคับใช้จริง — ห้ามหายจากจอ) */}
          {(customer.customerType === "CORPORATE" ||
            customer.taxId ||
            customer.creditLimit != null ||
            customer.defaultPaymentTerms ||
            customer.billingAddress) && (
            <Card>
              <CardHeader><CardTitle className="text-base">ข้อมูลนิติบุคคล</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {customer.customerType !== "CORPORATE" && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    ลูกค้าเป็นบุคคลธรรมดาแต่มีข้อมูลภาษี/วงเงินค้าง — ยังถูกใช้จริง ถ้าไม่ใช้แล้วกด
                    &quot;แก้ไขข้อมูล&quot; แล้วลบออก
                  </p>
                )}
                {customer.taxId && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <FileText className="h-4 w-4" /> เลขผู้เสียภาษี: {customer.taxId}
                    {customer.branchNumber && <span className="text-slate-400">(สาขา {customer.branchNumber === "00000" ? "สำนักงานใหญ่" : customer.branchNumber})</span>}
                  </div>
                )}
                {customer.creditLimit != null && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <CreditCard className="h-4 w-4" /> วงเงินเครดิต: {formatCurrency(customer.creditLimit)}
                    </div>
                    {credit && credit.available != null && (
                      <p className={`pl-6 text-xs ${credit.available < 0 ? "font-medium text-red-600 dark:text-red-400" : "text-slate-500"}`}>
                        ภาระหนี้ {formatCurrency(credit.exposure)} (ค้างชำระ {formatCurrency(credit.invoiceOutstanding)} + งานยังไม่วางบิล {formatCurrency(credit.unbilled)})
                        {credit.available < 0
                          ? ` — เกินวงเงิน ${formatCurrency(Math.abs(credit.available))}`
                          : ` — ใช้ได้อีก ${formatCurrency(credit.available)}`}
                      </p>
                    )}
                  </div>
                )}
                {customer.defaultPaymentTerms && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <DollarSign className="h-4 w-4" /> เงื่อนไขชำระ: {PAYMENT_TERMS_LABELS[customer.defaultPaymentTerms] ?? customer.defaultPaymentTerms}
                  </div>
                )}
                {customer.billingAddress && (
                  <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="mb-1 text-xs font-semibold text-slate-500">ที่อยู่ออกใบกำกับภาษี</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {customer.billingAddress}
                      {customer.billingSubDistrict && ` ${customer.billingSubDistrict}`}
                      {customer.billingDistrict && ` ${customer.billingDistrict}`}
                      {customer.billingProvince && ` ${customer.billingProvince}`}
                      {customer.billingPostalCode && ` ${customer.billingPostalCode}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Orders & Communication */}
        <div className="space-y-6 lg:col-span-2">
          {/* คลังลายต่อลูกค้า (ก้อน 4 ชิ้น 2) — ลาย+สเปกรีด+สั่งซ้ำ 1 คลิก+ฟิล์มค้าง */}
          <CustomerArtworksCard customerId={id} />

          <Card>
            <CardHeader><CardTitle className="text-base">ออเดอร์ล่าสุด</CardTitle></CardHeader>
            <CardContent>
              {customer.orders.length === 0 ? (
                <p className="text-sm text-slate-400">ยังไม่มีออเดอร์</p>
              ) : (
                <div className="space-y-2">
                  {customer.orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{order.orderNumber}</p>
                        <p className="text-xs text-slate-500">{order.title}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <OrderStatusBadge customerStatus={order.customerStatus} internalStatus={order.internalStatus} />
                        {canSeeMoney && (
                          <span className="text-sm tabular-nums font-medium">{formatCurrency(order.totalAmount ?? 0)}</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">บันทึกการสื่อสาร</CardTitle>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLoggingComm(true)}
                    className="h-9 gap-1 text-xs"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    บันทึกการคุย
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {customer.communicationLogs.length === 0 ? (
                <p className="text-sm text-slate-400">ยังไม่มีบันทึก — คุยอะไรกับลูกค้าจดไว้ ทีมอื่นเห็นด้วย</p>
              ) : (
                <div className="space-y-3">
                  {customer.communicationLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{commChannelLabel(log.channel)}</Badge>
                        <span className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</span>
                        <span className="text-xs text-slate-400">- {log.user.name}</span>
                      </div>
                      {log.subject && <p className="text-sm font-medium mt-1">{log.subject}</p>}
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{log.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {editing && (
        <CustomerEditDialog
          customer={customer}
          canEditCredit={!!me && CREDIT_ROLES.includes(me.role)}
          onClose={() => setEditing(false)}
        />
      )}
      {loggingComm && (
        <CustomerCommLogDialog
          customerId={id}
          customerName={customer.name}
          onClose={() => setLoggingComm(false)}
        />
      )}
    </div>
  );
}
