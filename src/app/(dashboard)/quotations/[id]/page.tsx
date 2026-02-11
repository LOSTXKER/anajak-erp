"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  RefreshCw,
  Pencil,
  User,
  FileText,
  Calendar,
  ExternalLink,
} from "lucide-react";

// ============================================================
// STATUS CONFIG
// ============================================================

const STATUS_BADGE_VARIANT: Record<
  string,
  "secondary" | "default" | "success" | "destructive" | "warning" | "purple"
> = {
  DRAFT: "secondary",
  SENT: "default",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "warning",
  CONVERTED: "purple",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  SENT: "ส่งแล้ว",
  ACCEPTED: "อนุมัติ",
  REJECTED: "ปฏิเสธ",
  EXPIRED: "หมดอายุ",
  CONVERTED: "แปลงเป็นออเดอร์",
};

// ============================================================
// Loading skeleton
// ============================================================

function QuotationDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main page component
// ============================================================

export default function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: quotation, isLoading } = trpc.quotation.getById.useQuery({ id });
  const utils = trpc.useUtils();

  const updateStatus = trpc.quotation.updateStatus.useMutation({
    onSuccess: () => {
      utils.quotation.getById.invalidate({ id });
      utils.quotation.list.invalidate();
    },
  });

  const convertToOrder = trpc.quotation.convertToOrder.useMutation({
    onSuccess: (data) => {
      utils.quotation.getById.invalidate({ id });
      utils.quotation.list.invalidate();
      // Navigate to the new order
      window.location.href = `/orders/${data.id}`;
    },
  });

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (isLoading) return <QuotationDetailSkeleton />;
  if (!quotation) return null;

  // ----------------------------------------------------------
  // Derived data
  // ----------------------------------------------------------
  const subtotal =
    quotation.items?.reduce(
      (sum: number, item: { totalPrice: number }) => sum + item.totalPrice,
      0,
    ) ?? 0;
  const discountAmount = quotation.discount ?? 0;
  const taxAmount = quotation.tax ?? 0;
  const totalAmount = quotation.totalAmount ?? subtotal - discountAmount + taxAmount;

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------
  function handleSendToCustomer() {
    updateStatus.mutate({ id, status: "SENT" });
  }

  function handleAccept() {
    updateStatus.mutate({ id, status: "ACCEPTED" });
  }

  function handleReject() {
    const reason = prompt("เหตุผลที่ปฏิเสธ:");
    if (reason === null) return;
    updateStatus.mutate({ id, status: "REJECTED", rejectedReason: reason || undefined });
  }

  function handleConvertToOrder() {
    if (!confirm("ยืนยันการแปลงใบเสนอราคานี้เป็นออเดอร์?")) return;
    convertToOrder.mutate({ id });
  }

  const isPending = updateStatus.isPending || convertToOrder.isPending;

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ====================================================
          HEADER
      ==================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/quotations">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {quotation.quotationNumber}
              </h1>
              <Badge
                variant={STATUS_BADGE_VARIANT[quotation.status] ?? "secondary"}
              >
                {STATUS_LABELS[quotation.status] ?? quotation.status}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {quotation.title}
            </p>
          </div>
        </div>

        {/* Action buttons based on status */}
        <div className="flex shrink-0 flex-wrap gap-2">
          {/* DRAFT actions */}
          {quotation.status === "DRAFT" && (
            <>
              <Button
                onClick={handleSendToCustomer}
                disabled={isPending}
                className="gap-1.5"
              >
                <Send className="h-4 w-4" />
                ส่งให้ลูกค้า
              </Button>
              <Link href={`/quotations/${id}/edit`}>
                <Button variant="outline" className="gap-1.5">
                  <Pencil className="h-4 w-4" />
                  แก้ไข
                </Button>
              </Link>
            </>
          )}

          {/* SENT actions */}
          {quotation.status === "SENT" && (
            <>
              <Button
                onClick={handleAccept}
                disabled={isPending}
                className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
              >
                <Check className="h-4 w-4" />
                ลูกค้าอนุมัติ
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isPending}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                ลูกค้าปฏิเสธ
              </Button>
            </>
          )}

          {/* ACCEPTED actions */}
          {quotation.status === "ACCEPTED" && (
            <Button
              onClick={handleConvertToOrder}
              disabled={isPending}
              className="gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
            >
              <RefreshCw className="h-4 w-4" />
              แปลงเป็นออเดอร์
            </Button>
          )}
        </div>
      </div>

      {/* Error display */}
      {(updateStatus.isError || convertToOrder.isError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {updateStatus.error?.message || convertToOrder.error?.message}
        </div>
      )}

      {/* Converted order link */}
      {quotation.status === "CONVERTED" && quotation.order && (
        <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950">
          <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <div>
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
              ใบเสนอราคานี้ถูกแปลงเป็นออเดอร์แล้ว
            </p>
            <Link
              href={`/orders/${quotation.order.id}`}
              className="inline-flex items-center gap-1 text-sm text-purple-600 hover:underline dark:text-purple-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              ดูออเดอร์ {quotation.order.orderNumber}
            </Link>
          </div>
        </div>
      )}

      {/* ====================================================
          MAIN GRID: CONTENT + SIDEBAR
      ==================================================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ================================================
            LEFT: MAIN CONTENT (2/3)
        ================================================ */}
        <div className="space-y-6 lg:col-span-2">
          {/* ------------------------------------------
              ITEMS TABLE
          ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                รายการสินค้า ({quotation.items?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-3 pr-4 text-left text-xs font-medium uppercase text-slate-500">
                        #
                      </th>
                      <th className="pb-3 pr-4 text-left text-xs font-medium uppercase text-slate-500">
                        รายการ
                      </th>
                      <th className="pb-3 pr-4 text-right text-xs font-medium uppercase text-slate-500">
                        จำนวน
                      </th>
                      <th className="pb-3 pr-4 text-left text-xs font-medium uppercase text-slate-500">
                        หน่วย
                      </th>
                      <th className="pb-3 pr-4 text-right text-xs font-medium uppercase text-slate-500">
                        ราคา/หน่วย
                      </th>
                      <th className="pb-3 text-right text-xs font-medium uppercase text-slate-500">
                        รวม
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {quotation.items?.map(
                      (
                        item: {
                          id: string;
                          name: string;
                          description?: string | null;
                          quantity: number;
                          unit: string;
                          unitPrice: number;
                          totalPrice: number;
                        },
                        index: number,
                      ) => (
                        <tr key={item.id}>
                          <td className="py-3 pr-4 text-sm text-slate-400">
                            {index + 1}
                          </td>
                          <td className="py-3 pr-4">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-xs text-slate-400">
                                {item.description}
                              </p>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right text-sm tabular-nums text-slate-900 dark:text-white">
                            {item.quantity}
                          </td>
                          <td className="py-3 pr-4 text-sm text-slate-500">
                            {item.unit}
                          </td>
                          <td className="py-3 pr-4 text-right text-sm tabular-nums text-slate-900 dark:text-white">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-3 text-right text-sm tabular-nums font-medium text-slate-900 dark:text-white">
                            {formatCurrency(item.totalPrice)}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {/* Price breakdown */}
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">ยอดรวมสินค้า</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">ส่วนลด</span>
                    <span className="tabular-nums text-red-600 dark:text-red-400">
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">ภาษี</span>
                    <span className="tabular-nums text-slate-900 dark:text-white">
                      +{formatCurrency(taxAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                  <span className="text-base font-semibold text-slate-900 dark:text-white">
                    ยอดรวมทั้งหมด
                  </span>
                  <span className="tabular-nums text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ------------------------------------------
              TERMS & NOTES
          ------------------------------------------ */}
          {(quotation.terms || quotation.notes || quotation.description) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ข้อมูลเพิ่มเติม</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {quotation.description && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-400">
                      รายละเอียด
                    </p>
                    <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                      {quotation.description}
                    </p>
                  </div>
                )}
                {quotation.terms && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-400">
                      เงื่อนไข
                    </p>
                    <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                      {quotation.terms}
                    </p>
                  </div>
                )}
                {quotation.notes && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-400">
                      หมายเหตุ
                    </p>
                    <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                      {quotation.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ================================================
            RIGHT: SIDEBAR (1/3)
        ================================================ */}
        <div className="space-y-6">
          {/* ------------------------------------------
              CUSTOMER INFO
          ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                ลูกค้า
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quotation.customer && (
                <>
                  <Link
                    href={`/customers/${quotation.customer.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {quotation.customer.name}
                  </Link>
                  {quotation.customer.company && (
                    <p className="text-sm text-slate-500">
                      {quotation.customer.company}
                    </p>
                  )}
                  {quotation.customer.phone && (
                    <p className="text-sm text-slate-500">
                      {quotation.customer.phone}
                    </p>
                  )}
                  {quotation.customer.email && (
                    <p className="text-sm text-slate-500">
                      {quotation.customer.email}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------------------
              QUOTATION INFO
          ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                ข้อมูลใบเสนอราคา
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">สถานะ</span>
                <Badge
                  variant={STATUS_BADGE_VARIANT[quotation.status] ?? "secondary"}
                >
                  {STATUS_LABELS[quotation.status] ?? quotation.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">วันที่สร้าง</span>
                <span className="text-slate-900 dark:text-white">
                  {formatDate(quotation.createdAt)}
                </span>
              </div>
              {quotation.validUntil && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ใช้ได้ถึง</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatDate(quotation.validUntil)}
                  </span>
                </div>
              )}
              {quotation.sentAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ส่งเมื่อ</span>
                  <span className="text-slate-900 dark:text-white">
                    {formatDateTime(quotation.sentAt)}
                  </span>
                </div>
              )}
              {quotation.acceptedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">อนุมัติเมื่อ</span>
                  <span className="text-slate-900 dark:text-white">
                    {formatDateTime(quotation.acceptedAt)}
                  </span>
                </div>
              )}
              {quotation.rejectedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ปฏิเสธเมื่อ</span>
                  <span className="text-slate-900 dark:text-white">
                    {formatDateTime(quotation.rejectedAt)}
                  </span>
                </div>
              )}
              {quotation.rejectedReason && (
                <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="mb-1 text-xs text-slate-400">เหตุผลที่ปฏิเสธ</p>
                  <p className="text-slate-500">{quotation.rejectedReason}</p>
                </div>
              )}
              {quotation.createdBy && (
                <div className="flex justify-between">
                  <span className="text-slate-500">สร้างโดย</span>
                  <span className="text-slate-900 dark:text-white">
                    {quotation.createdBy.name}
                  </span>
                </div>
              )}
              {quotation.updatedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">แก้ไขล่าสุด</span>
                  <span className="text-slate-900 dark:text-white">
                    {formatDateTime(quotation.updatedAt)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
