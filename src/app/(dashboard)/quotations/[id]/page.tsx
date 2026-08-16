"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_VARIANTS } from "@/lib/status-config";
import type { QuotationStatus } from "@/lib/quotation-status";
import { PageHeader } from "@/components/page-header";
import {
  Share2,
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
import { RecordNotFound } from "@/components/ui/record-not-found";

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
  const router = useRouter();

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

  const prepareShare = trpc.quotation.prepareShare.useMutation({
    onSuccess: () => {
      utils.quotation.getById.invalidate({ id });
      utils.quotation.list.invalidate();
    },
  });

  const convertToOrder = trpc.quotation.convertToOrder.useMutation({
    onSuccess: (data) => {
      utils.quotation.getById.invalidate({ id });
      utils.quotation.list.invalidate();
      router.push(`/orders/${data.id}`);
    },
  });

  // action เดียวที่ server ทำ DRAFT → SENT + เตรียม token แล้วคืน public path
  // จึงไม่มีช่วงกึ่งกลางที่สถานะขึ้น “ส่งแล้ว” แต่คัดลอกลิงก์ไม่ได้
  async function prepareAndCopyShareLink() {
    try {
      const prepared = await prepareShare.mutateAsync({
        id,
        expectedStatus: quotation?.status as QuotationStatus | undefined,
      });
      const url = new URL(prepared.sharePath, window.location.origin).toString();
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
      toast.success(copied ? "คัดลอกลิงก์ใบเสนอแล้ว — พร้อมแชร์ให้ลูกค้า" : `ลิงก์ใบเสนอ: ${url}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เตรียมลิงก์แชร์ไม่สำเร็จ");
    }
  }

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (me && !canView) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="ใบเสนอราคา"
        />
        <p className="text-sm text-slate-400">
          หน้านี้เปิดเฉพาะทีมขาย ผู้จัดการ และบัญชี
        </p>
      </div>
    );
  }
  if (isLoading) return <QuotationDetailSkeleton />;
  if (isError)
    return (
      <div className="space-y-6">
        <PageHeader
          back={{ href: "/quotations", label: "กลับไปรายการใบเสนอราคา" }}
          title="ใบเสนอราคา"
        />
        <QueryError onRetry={() => refetch()} />
      </div>
    );
  if (!quotation)
    return (
      <div className="space-y-6">
        <PageHeader
          back={{ href: "/quotations", label: "กลับไปรายการใบเสนอราคา" }}
          title="ใบเสนอราคา"
        />
        <RecordNotFound what="ใบเสนอราคาใบนี้" backHref="/quotations" backLabel="กลับไปรายการใบเสนอราคา" />
      </div>
    );

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

  const isPending = updateStatus.isPending || convertToOrder.isPending || prepareShare.isPending;

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/quotations", label: "กลับไปรายการใบเสนอราคา" }}
        title={quotation.quotationNumber}
        titleBadge={
          <Badge
            variant={QUOTATION_STATUS_VARIANTS[quotation.status as keyof typeof QUOTATION_STATUS_VARIANTS] ?? "secondary"}
          >
            {QUOTATION_STATUS_LABELS[quotation.status as keyof typeof QUOTATION_STATUS_LABELS] ?? quotation.status}
          </Badge>
        }
        description={quotation.title}
        action={
          <>
          {/* DRAFT actions */}
          {canManageQuotation && quotation.status === "DRAFT" && (
            <>
              <Button
                onClick={prepareAndCopyShareLink}
                disabled={isPending}
                className="gap-1.5"
              >
                <Share2 />
                คัดลอก/แชร์ใบเสนอ
              </Button>
              <Button variant="outline" asChild className="gap-1.5">
                <Link href={`/quotations/new?edit=${id}`}>
                  <Pencil />
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
                onClick={prepareAndCopyShareLink}
                disabled={isPending}
                className="gap-1.5"
                title="คัดลอกลิงก์ให้ลูกค้ายืนยันเอง (ไม่ต้อง login)"
              >
                <Link2 />
                คัดลอก/แชร์ใบเสนอ
              </Button>
              <Button
                variant="default"
                onClick={handleAccept}
                disabled={isPending}
                className="gap-1.5"
              >
                <Check />
                ลูกค้าอนุมัติ
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isPending}
                className="gap-1.5"
              >
                <X />
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
              <RefreshCw />
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
              <Undo2 />
              ดึงกลับเป็นร่าง
            </Button>
          )}

          {canPrintQuotation && (
            <Button variant="outline" asChild className="gap-1.5">
              <Link href={`/print/quotation/${id}`} target="_blank" rel="noreferrer">
                <Printer />
                พิมพ์ / PDF
              </Link>
            </Button>
          )}
          </>
        }
      />

      {/* Error display */}
      {(updateStatus.isError || convertToOrder.isError || prepareShare.isError) && (
        <Alert variant="error">
          {prepareShare.error?.message || updateStatus.error?.message || convertToOrder.error?.message}
        </Alert>
      )}

      {/* Converted order link */}
      {quotation.status === "CONVERTED" && quotation.order && (
        <Alert variant="info" icon={RefreshCw}>
          <Link
            href={`/orders/${quotation.order.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline dark:text-blue-300"
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
              <DataTable.Root bordered={false}>
                <DataTable.Head>
                  <tr>
                    <DataTable.Th>#</DataTable.Th>
                    <DataTable.Th>รายการ</DataTable.Th>
                    <DataTable.Th align="right">จำนวน</DataTable.Th>
                    <DataTable.Th>หน่วย</DataTable.Th>
                    <DataTable.Th align="right">ราคา/หน่วย</DataTable.Th>
                    <DataTable.Th align="right">รวม</DataTable.Th>
                  </tr>
                </DataTable.Head>
                <DataTable.Body>
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
                      <DataTable.Row key={item.id}>
                        <DataTable.Td className="text-slate-400">
                          {index + 1}
                        </DataTable.Td>
                        <DataTable.Td>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs text-slate-400">
                              {item.description}
                            </p>
                          )}
                        </DataTable.Td>
                        <DataTable.Td align="right" className="tabular-nums text-slate-900 dark:text-white">
                          {item.quantity}
                        </DataTable.Td>
                        <DataTable.Td className="text-muted">
                          {item.unit}
                        </DataTable.Td>
                        <DataTable.Td align="right" className="tabular-nums text-slate-900 dark:text-white">
                          {formatCurrency(item.unitPrice)}
                        </DataTable.Td>
                        <DataTable.Td align="right" className="tabular-nums font-medium text-slate-900 dark:text-white">
                          {formatCurrency(item.totalPrice)}
                        </DataTable.Td>
                      </DataTable.Row>
                    ),
                  )}
                </DataTable.Body>
              </DataTable.Root>

              {/* Price breakdown */}
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">ยอดรวมสินค้า</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">ส่วนลด</span>
                    <span className="tabular-nums text-red-600 dark:text-red-400">
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">ภาษี</span>
                    <span className="tabular-nums text-slate-900 dark:text-white">
                      +{formatCurrency(taxAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                  <span className="text-base font-semibold text-slate-900 dark:text-white">
                    ยอดรวมทั้งหมด
                  </span>
                  <span className="tabular-nums text-lg font-semibold text-blue-600 dark:text-blue-400">
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
                    <p className="text-sm text-muted">
                      {quotation.customer.company}
                    </p>
                  )}
                  {quotation.customer.phone && (
                    <p className="text-sm text-muted">
                      {quotation.customer.phone}
                    </p>
                  )}
                  {quotation.customer.email && (
                    <p className="text-sm text-muted">
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
                <span className="text-muted">สถานะ</span>
                <Badge
                  variant={QUOTATION_STATUS_VARIANTS[quotation.status as keyof typeof QUOTATION_STATUS_VARIANTS] ?? "secondary"}
                >
                  {QUOTATION_STATUS_LABELS[quotation.status as keyof typeof QUOTATION_STATUS_LABELS] ?? quotation.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">วันที่สร้าง</span>
                <span className="text-slate-900 dark:text-white">
                  {formatDate(quotation.createdAt)}
                </span>
              </div>
              {quotation.validUntil && (
                <div className="flex justify-between">
                  <span className="text-muted">ใช้ได้ถึง</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatDate(quotation.validUntil)}
                  </span>
                </div>
              )}
              {quotation.sentAt && (
                <div className="flex justify-between">
                  <span className="text-muted">ส่งเมื่อ</span>
                  <span className="text-slate-900 dark:text-white">
                    {formatDateTime(quotation.sentAt)}
                  </span>
                </div>
              )}
              {quotation.acceptedAt && (
                <div className="flex justify-between">
                  <span className="text-muted">อนุมัติเมื่อ</span>
                  <span className="text-slate-900 dark:text-white">
                    {formatDateTime(quotation.acceptedAt)}
                  </span>
                </div>
              )}
              {quotation.rejectedAt && (
                <div className="flex justify-between">
                  <span className="text-muted">ปฏิเสธเมื่อ</span>
                  <span className="text-slate-900 dark:text-white">
                    {formatDateTime(quotation.rejectedAt)}
                  </span>
                </div>
              )}
              {quotation.rejectedReason && (
                <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="mb-1 text-xs text-slate-400">เหตุผลที่ปฏิเสธ</p>
                  <p className="text-muted">{quotation.rejectedReason}</p>
                </div>
              )}
              {quotation.createdBy && (
                <div className="flex justify-between">
                  <span className="text-muted">สร้างโดย</span>
                  <span className="text-slate-900 dark:text-white">
                    {quotation.createdBy.name}
                  </span>
                </div>
              )}
              {quotation.updatedAt && (
                <div className="flex justify-between">
                  <span className="text-muted">แก้ไขล่าสุด</span>
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
