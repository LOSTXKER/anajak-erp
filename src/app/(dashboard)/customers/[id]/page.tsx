"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { ArrowLeft, Phone, Mail, MessageCircle, MapPin, ShoppingCart, DollarSign, Building2, User, CreditCard, FileText } from "lucide-react";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: customer, isLoading } = trpc.customer.getById.useQuery({ id });

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

  if (!customer) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{customer.name}</h1>
            {customer.customerType === "CORPORATE" ? (
              <Badge variant="default" className="gap-1"><Building2 className="h-3 w-3" /> นิติบุคคล</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><User className="h-3 w-3" /> บุคคลธรรมดา</Badge>
            )}
          </div>
          {customer.company && <p className="text-sm text-slate-500">{customer.company}</p>}
        </div>
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
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-500"><DollarSign className="h-4 w-4" /> ยอดสั่งรวม</span>
                <span className="font-bold tabular-nums">{formatCurrency(customer.totalSpent)}</span>
              </div>
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

          {/* Corporate/Billing Info */}
          {customer.customerType === "CORPORATE" && (
            <Card>
              <CardHeader><CardTitle className="text-base">ข้อมูลนิติบุคคล</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {customer.taxId && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <FileText className="h-4 w-4" /> เลขผู้เสียภาษี: {customer.taxId}
                    {customer.branchNumber && <span className="text-slate-400">(สาขา {customer.branchNumber === "00000" ? "สำนักงานใหญ่" : customer.branchNumber})</span>}
                  </div>
                )}
                {customer.creditLimit != null && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <CreditCard className="h-4 w-4" /> วงเงินเครดิต: {formatCurrency(customer.creditLimit)}
                  </div>
                )}
                {customer.defaultPaymentTerms && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <DollarSign className="h-4 w-4" /> เงื่อนไขชำระ: {customer.defaultPaymentTerms}
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
                        <span className="text-sm tabular-nums font-medium">{formatCurrency(order.totalAmount)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">บันทึกการสื่อสาร</CardTitle></CardHeader>
            <CardContent>
              {customer.communicationLogs.length === 0 ? (
                <p className="text-sm text-slate-400">ยังไม่มีบันทึก</p>
              ) : (
                <div className="space-y-3">
                  {customer.communicationLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{log.channel}</Badge>
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
    </div>
  );
}
