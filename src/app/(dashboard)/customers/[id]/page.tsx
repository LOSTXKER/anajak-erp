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
import { permAllows } from "@/lib/permissions";
import { canCreateOrderWithPricing } from "@/lib/v2-order-access";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { customerProfileGaps } from "@/lib/customer-gaps";
import { CustomerArtworksCard } from "@/components/customers/customer-artworks-card";
import { CustomerEditDialog } from "@/components/customers/customer-edit-dialog";
import { CustomerCommLogDialog } from "@/components/customers/customer-comm-log-dialog";
import { commChannelLabel } from "@/lib/comm-channels";
import { PageHeader } from "@/components/page-header";
import { Phone, Mail, MessageCircle, MapPin, ShoppingCart, DollarSign, Building2, User, CreditCard, FileText, Pencil, MessageSquarePlus, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { RecordNotFound } from "@/components/ui/record-not-found";

// แก้ข้อมูล/จดบันทึกการคุย = ทีมขาย-บัญชี-บริหาร (ตรง customerEditors ฝั่ง server)

// วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES แก้ไม่ได้ (ตรง server guard)


export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [editing, setEditing] = useState(false);
  const [loggingComm, setLoggingComm] = useState(false);
  const { data: me } = trpc.user.me.useQuery();
  const canEdit = !!me && permAllows(me.permissions, "manage_customers");
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);
  // Policy ⑦: ฝ่ายผลิต/กราฟิกไม่เห็นเงินฝั่งขาย — ซ่อนยอดสั่งรวม/ยอดออเดอร์ (server ส่ง null มาอยู่แล้ว)
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const { data: customer, isLoading, isError, refetch } = trpc.customer.getById.useQuery({ id });
  // ภาระหนี้ + ยอดค้างชำระ — เปิดเสมอเมื่อเห็นเงิน (ลูกค้าไม่ตั้งวงเงินก็ต้องเห็นยอดค้าง
  // ในการ์ดสรุป — ธุรกิจเครดิตเทอมถามก่อนว่า "ค้างเท่าไร") · non-money role ยิงไปก็โดน FORBIDDEN
  const creditQuery = trpc.customer.creditStatus.useQuery(
    { customerId: id },
    { enabled: canSeeMoney }
  );
  const credit = creditQuery.data;
  const creditLoading =
    canSeeMoney &&
    !credit &&
    (creditQuery.isLoading || creditQuery.isFetching);
  const creditError = canSeeMoney && !credit && creditQuery.isError;

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
  if (!customer)
    return <RecordNotFound what="ลูกค้ารายนี้" backHref="/customers" backLabel="กลับไปรายการลูกค้า" />;

  return (
    <div className="space-y-6">
      {/* โทร/LINE/อีเมล/บันทึกการคุย ไม่อยู่ header — ซ้ำกับการ์ดข้อมูลติดต่อ+บันทึกการสื่อสารด้านล่าง */}
      <PageHeader
        breadcrumb={[
          { label: "ลูกค้า", href: "/customers" },
          { label: customer.name },
        ]}
        title={customer.name}
        description={customer.company || undefined}
        action={
          <>
            {customer.customerType === "CORPORATE" ? (
              <Badge variant="default" className="gap-1.5"><Building2 className="h-3 w-3" /> นิติบุคคล</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5"><User className="h-3 w-3" /> บุคคลธรรมดา</Badge>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setEditing(true)}
              >
                <Pencil /> แก้ไขข้อมูล
              </Button>
            )}
            {canCreateOrder && (
              <Button asChild size="sm" className="w-full sm:w-auto">
                <Link href={`/orders/new?customerId=${id}`}>
                  <Plus /> เปิดงานใหม่
                </Link>
              </Button>
            )}
          </>
        }
      >
        {customerProfileGaps(customer).length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            โปรไฟล์ยังไม่ครบ: {customerProfileGaps(customer).map((g) => g.label).join(" · ")}
          </p>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">ข้อมูลติดต่อ</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex min-h-11 items-center gap-2 rounded-lg text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">
                  <Phone className="h-4 w-4" /> {customer.phone}
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex min-h-11 items-center gap-2 rounded-lg text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">
                  <Mail className="h-4 w-4" /> {customer.email}
                </a>
              )}
              {customer.lineId && (
                <a
                  href={`https://line.me/R/ti/p/~${encodeURIComponent(customer.lineId)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center gap-2 rounded-lg text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300"
                >
                  <MessageCircle className="h-4 w-4" /> {customer.lineId}
                </a>
              )}
              {/* เดิมมีแต่ไอคอนหมุด ไม่มีป้าย — คนอ่านเดาไม่ออกว่านี่ที่อยู่อะไร (ส่งของ? ออกบิล?)
                  ต้องเรียกชื่อเดียวกับฟอร์มที่กรอกค่านี้ = "ที่อยู่ผู้ติดต่อ" (เบสสั่ง 2026-08-12) */}
              {customer.address && (
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs text-muted">ที่อยู่ผู้ติดต่อ</span>
                    <span className="block [overflow-wrap:anywhere]">{customer.address}</span>
                  </span>
                </div>
              )}
              {/* ลูกค้าที่ยังไม่กรอกช่องทางติดต่อเลย — เดิมการ์ดนี้เหลือแต่หัวข้อ ข้างในโล่ง
                  คนอ่านแยกไม่ออกว่า "ยังไม่ได้กรอก" กับ "หน้าโหลดไม่ครบ" */}
              {!customer.phone && !customer.email && !customer.lineId && !customer.address && (
                <p className="text-slate-500 dark:text-slate-400">
                  ยังไม่ได้กรอกช่องทางติดต่อ
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">สรุป</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted"><ShoppingCart className="h-4 w-4" /> ออเดอร์ทั้งหมด</span>
                <span className="font-semibold tabular-nums">{customer._count.orders}</span>
              </div>
              {canSeeMoney && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted"><DollarSign className="h-4 w-4" /> ยอดสั่งรวม</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(customer.totalSpent ?? 0)}</span>
                </div>
              )}
              {creditLoading && (
                <div
                  role="status"
                  aria-label="กำลังโหลดสถานะเครดิต"
                  className="space-y-3"
                >
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                </div>
              )}
              {creditError && (
                <Alert variant="error" className="text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>โหลดสถานะเครดิตไม่สำเร็จ</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void creditQuery.refetch()}
                    >
                      ลองใหม่
                    </Button>
                  </div>
                </Alert>
              )}
              {canSeeMoney && !creditLoading && !creditError && !credit && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ยังไม่มีข้อมูลสถานะเครดิต
                </p>
              )}
              {canSeeMoney && credit && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted"><FileText className="h-4 w-4" /> ค้างชำระ</span>
                  <span
                    className={`text-base font-semibold tabular-nums ${
                      credit.invoiceOutstanding > 0 ? "text-red-600 dark:text-red-400" : ""
                    }`}
                  >
                    {formatCurrency(credit.invoiceOutstanding)}
                  </span>
                </div>
              )}
              {canSeeMoney && credit && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted"><ShoppingCart className="h-4 w-4" /> งานยังไม่ปิด</span>
                  <span className="font-semibold tabular-nums">
                    {credit.openOrders > 0 ? `${credit.openOrders} งาน` : "—"}
                  </span>
                </div>
              )}
              {customer.lastOrderAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">สั่งล่าสุด</span>
                  <span className="text-sm">{formatDate(customer.lastOrderAt)}</span>
                </div>
              )}
              {customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
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
                  <Alert variant="warning" className="text-xs">
                    ลูกค้าเป็นบุคคลธรรมดาแต่มีข้อมูลภาษี/วงเงินค้าง — ยังถูกใช้จริง ถ้าไม่ใช้แล้วกด
                    &quot;แก้ไขข้อมูล&quot; แล้วลบออก
                  </Alert>
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
                    {creditLoading && (
                      <div role="status" aria-label="กำลังโหลดภาระหนี้" className="pl-6 pt-1">
                        <Skeleton className="h-3.5 w-full" />
                      </div>
                    )}
                    {creditError && (
                      <p className="pl-6 text-xs text-red-700 dark:text-red-300">
                        โหลดภาระหนี้ไม่สำเร็จ — ลองใหม่ได้จากการ์ดสรุป
                      </p>
                    )}
                    {credit && credit.available != null && (
                      <p className={`pl-6 text-xs ${credit.available < 0 ? "font-medium text-red-600 dark:text-red-400" : "text-slate-500"}`}>
                        ภาระหนี้ {formatCurrency(credit.exposure)} (ค้างชำระ {formatCurrency(credit.invoiceOutstanding)} + งานยังไม่วางบิล {formatCurrency(credit.unbilled)})
                        {credit.available < 0
                          ? ` — เกินวงเงิน ${formatCurrency(Math.abs(credit.available))}`
                          : ` — ใช้ได้อีก ${formatCurrency(credit.available)}`}
                      </p>
                    )}
                    {canSeeMoney &&
                      !creditLoading &&
                      !creditError &&
                      credit?.available == null && (
                        <p className="pl-6 text-xs text-slate-500 dark:text-slate-400">
                          ยังไม่มีข้อมูลภาระหนี้
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
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="mb-1 text-xs font-semibold text-muted">ที่อยู่ออกใบกำกับภาษี</p>
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
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{order.orderNumber}</p>
                        <p className="text-xs text-muted">{order.title}</p>
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
                    className="gap-1.5"
                  >
                    <MessageSquarePlus />
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
          canEditCredit={!!me && me.role !== "SALES"}
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
