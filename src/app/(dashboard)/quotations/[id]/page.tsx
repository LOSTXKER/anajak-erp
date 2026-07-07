"use client";

import { use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_VARIANTS } from "@/lib/status-config";
import type { QuotationStatus } from "@/lib/quotation-status";
import { PageHeader } from "@/components/page-header";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  RefreshCw,
  Printer,
  User,
  FileText,
  Calendar,
  ExternalLink,
  Pencil,
  Link2,
  Undo2,
} from "lucide-react";

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

  const { data: me } = trpc.user.me.useQuery();
  // ใบเสนอทั้งหน้าเป็นเรื่องราคาขาย — ช่าง/กราฟิกห้ามเห็น (Policy ⑦ · ตรงกับ requireRole ฝั่ง server)
  const canView = me ? permAllows(me.permissions, "see_order_money") : true;
  const { data: quotation, isLoading, isError, refetch } = trpc.quotation.getById.useQuery(
    { id },
    { enabled: canView }
  );
  // จัดการใบเสนอ (ส่ง/อนุมัติ/แก้ไข/แปลง) = สิทธิ์ขาย (server salesUp) · พิมพ์ = สิทธิ์เห็นเงินออเดอร์
  const canManageQuotation = permAllows(me?.permissions, "create_sales_docs");
  const canPrintQuotation = permAllows(me?.permissions, "see_order_money");
  const utils = trpc.useUtils();
  const confirmDialog = useConfirm();
  const promptText = usePromptText();

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

  // ลิงก์ยืนยันใบเสนอให้ลูกค้า (ก้อน 4) — ใช้ token เดิมถ้ามี ไม่งั้นสร้างใหม่ (gate salesUp + SENT
  // ที่ server) · token ไม่มีหมดอายุแยก — gate ด้วย validUntil ของใบเสนอ
  // ยิงเฉพาะตอน SENT (ปุ่มลิงก์โผล่เฉพาะ SENT) — getLink gate salesUp ไม่ต้อง 403 ใส่ role อื่น/สถานะอื่น
  const confirmLink = trpc.quotationConfirm.getLink.useQuery(
    { quotationId: id },
    { enabled: quotation?.status === "SENT", retry: false }
  );
  const generateConfirmLink = trpc.quotationConfirm.generateLink.useMutation();
  async function copyConfirmLink() {
    try {
      let tok = confirmLink.data?.token ?? null;
      if (!tok) {
        tok = (await generateConfirmLink.mutateAsync({ quotationId: id })).token;
        confirmLink.refetch();
      }
      const url = `${window.location.origin}/quote/${tok}`;
      // วิธีสำรอง (textarea + execCommand) — กัน "Document is not focused" ตอน await สร้าง token
      const fallbackCopy = () => {
        try {
          const ta = document.createElement("textarea");
          ta.value = url;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          return ok;
        } catch {
          return false;
        }
      };
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        copied = fallbackCopy();
      }
      toast.success(copied ? "คัดลอกลิงก์ยืนยันใบเสนอแล้ว" : `ลิงก์ยืนยัน: ${url}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "สร้างลิงก์ไม่สำเร็จ");
    }
  }

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="ใบเสนอราคา"
          description="จัดการใบเสนอราคาทั้งหมด"
        />
        <p className="text-sm text-slate-400">
          หน้านี้เปิดเฉพาะทีมขาย ผู้จัดการ และบัญชี
        </p>
      </div>
    );
  }
  if (isLoading) return <QuotationDetailSkeleton />;
  if (isError) return <QueryError onRetry={() => refetch()} />;
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
  // ทุกปุ่มส่ง expectedStatus = สถานะที่จอเห็นตอนกด — จอค้าง (เช่น ลูกค้าเพิ่งกดยืนยัน
  // ผ่านลิงก์) server จะปฏิเสธพร้อมบอกให้รีเฟรช แทนที่จะทับการตัดสินล่าสุดเงียบๆ
  function handleSendToCustomer() {
    if (!quotation) return;
    updateStatus.mutate({ id, status: "SENT", expectedStatus: quotation.status as QuotationStatus });
  }

  function handleAccept() {
    if (!quotation) return;
    updateStatus.mutate({ id, status: "ACCEPTED", expectedStatus: quotation.status as QuotationStatus });
  }

  async function handleReject() {
    const reason = await promptText({
      title: "ปฏิเสธใบเสนอราคา?",
      placeholder: "เหตุผลที่ปฏิเสธ (ไม่บังคับ)",
      confirmText: "ปฏิเสธ",
      required: false,
      destructive: true,
    });
    if (reason === null || !quotation) return;
    updateStatus.mutate({
      id,
      status: "REJECTED",
      rejectedReason: reason || undefined,
      expectedStatus: quotation.status as QuotationStatus,
    });
  }

  async function handlePullBackToDraft() {
    if (!quotation) return;
    // ใบที่ลูกค้าตกลงแล้ว — ดึงกลับ = ล้างการยืนยันเดิม ต้องตั้งใจจริง
    if (quotation.status === "ACCEPTED") {
      const ok = await confirmDialog({
        title: "ดึงใบที่ลูกค้าตกลงแล้วกลับเป็นร่าง?",
        description:
          "การยืนยันของลูกค้าจะถูกล้าง — หลังแก้เสร็จต้องส่งให้ลูกค้ายืนยันใหม่อีกรอบ",
        confirmText: "ดึงกลับเป็นร่าง",
        destructive: true,
      });
      if (!ok) return;
    }
    updateStatus.mutate({ id, status: "DRAFT", expectedStatus: quotation.status as QuotationStatus });
  }

  async function handleConvertToOrder() {
    const ok = await confirmDialog({
      title: "แปลงใบเสนอราคานี้เป็นออเดอร์?",
      description: "ระบบจะสร้างออเดอร์ใหม่จากรายการในใบเสนอราคา และล็อกใบเสนอราคานี้เป็นสถานะแปลงแล้ว",
      confirmText: "แปลงเป็นออเดอร์",
    });
    if (!ok) return;
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
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                {quotation.quotationNumber}
              </h1>
              <Badge
                variant={QUOTATION_STATUS_VARIANTS[quotation.status as keyof typeof QUOTATION_STATUS_VARIANTS] ?? "secondary"}
              >
                {QUOTATION_STATUS_LABELS[quotation.status as keyof typeof QUOTATION_STATUS_LABELS] ?? quotation.status}
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
          {canManageQuotation && quotation.status === "DRAFT" && (
            <>
              <Button
                onClick={handleSendToCustomer}
                disabled={isPending}
                className="gap-1.5"
              >
                <Send className="h-4 w-4" />
                ส่งให้ลูกค้า
              </Button>
              <Button variant="outline" asChild className="gap-1.5">
                <Link href={`/quotations/new?edit=${id}`}>
                  <Pencil className="h-4 w-4" />
                  แก้ไข
                </Link>
              </Button>
            </>
          )}

          {/* SENT actions */}
          {canManageQuotation && quotation.status === "SENT" && (
            <>
              <Button
                variant="outline"
                onClick={copyConfirmLink}
                disabled={isPending || generateConfirmLink.isPending}
                className="gap-1.5"
                title="คัดลอกลิงก์ให้ลูกค้ายืนยันเอง (ไม่ต้อง login)"
              >
                <Link2 className="h-4 w-4" />
                ลิงก์ยืนยันลูกค้า
              </Button>
              <Button
                variant="default"
                onClick={handleAccept}
                disabled={isPending}
                className="gap-1.5"
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
          {canManageQuotation && quotation.status === "ACCEPTED" && (
            <Button
              onClick={handleConvertToOrder}
              disabled={isPending}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              แปลงเป็นออเดอร์
            </Button>
          )}

          {/* ดึงกลับร่างเพื่อแก้ — คู่กับ server ที่ล็อกแก้เฉพาะร่าง (Gate A3) ·
              REJECTED/EXPIRED = เปิดแก้รอบใหม่ (เดิมเป็นทางตัน เหลือแค่ปุ่มพิมพ์) ·
              ACCEPTED = ได้แต่มี confirm (ล้างการยืนยันลูกค้า) */}
          {canManageQuotation && ["SENT", "ACCEPTED", "REJECTED", "EXPIRED"].includes(quotation.status) && (
            <Button
              variant="outline"
              onClick={handlePullBackToDraft}
              disabled={isPending}
              className="gap-1.5"
              title="กลับเป็นฉบับร่างเพื่อแก้รายการ/ราคา/วันหมดอายุ แล้วส่งใหม่"
            >
              <Undo2 className="h-4 w-4" />
              ดึงกลับเป็นร่าง
            </Button>
          )}

          {canPrintQuotation && (
            <Button variant="outline" asChild className="gap-1.5">
              <a href={`/print/quotation/${id}`} target="_blank" rel="noreferrer">
                <Printer className="h-4 w-4" />
                พิมพ์ / PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Error display */}
      {(updateStatus.isError || convertToOrder.isError) && (
        <Alert variant="error">
          {updateStatus.error?.message || convertToOrder.error?.message}
        </Alert>
      )}

      {/* Converted order link */}
      {quotation.status === "CONVERTED" && quotation.order && (
        <Alert variant="info" icon={RefreshCw}>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            ใบเสนอราคานี้ถูกแปลงเป็นออเดอร์แล้ว
          </p>
          <Link
            href={`/orders/${quotation.order.id}`}
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-blue-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            ดูออเดอร์ {quotation.order.orderNumber}
          </Link>
        </Alert>
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
                  variant={QUOTATION_STATUS_VARIANTS[quotation.status as keyof typeof QUOTATION_STATUS_VARIANTS] ?? "secondary"}
                >
                  {QUOTATION_STATUS_LABELS[quotation.status as keyof typeof QUOTATION_STATUS_LABELS] ?? quotation.status}
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
