"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { MoreMenu } from "@/components/ui/more-menu";
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneMark } from "@/components/ui/section";
import { StatusLabel, toneFromBadgeVariant } from "@/components/ui/status-label";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_VARIANTS } from "@/lib/status-config";
import type { QuotationStatus } from "@/lib/quotation-status";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { PageShell } from "@/components/page-shell";
import { c, Prop } from "@/components/kit/kit";
import {
  History,
  Check,
  X,
  RefreshCw,
  Printer,
  User,
  UserRound,
  Building2,
  Wallet,
  FileText,
  ClipboardList,
  CalendarClock,
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
    <div className="space-y-4">
      <Skeleton className="h-12 rounded-xl" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <div className="space-y-3.5 lg:col-span-7">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="space-y-3.5 lg:col-span-5">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// แถบสถานะใต้หัวข้อ (ต้นแบบ .statusbar — เบสเคาะ 2026-09-16)
// สถานะอยู่ที่เดียวบนหน้า แล้วต่อด้วยประโยคว่า "ตอนนี้รออะไร/จบด้วยอะไร"
// ประโยคประกอบจากเวลาจริงในฐานเท่านั้น (sentAt/acceptedAt/rejectedAt/validUntil)
// ============================================================

/** จุดสีของไทม์ไลน์ (ต้นแบบ .tline .dot) — ใช้โทนชุดเดียวกับจุดสถานะของ kit */
const DOT_TONE = {
  danger: "bad",
  success: "good",
  info: "blue",
  muted: "gray",
} as const;

/** ระยะเวลาแบบคน — ใช้กับวันหมดอายุที่ต้องตัดสินใจว่าจะตามต่อไหม */
function daysText(days: number): string {
  if (days === 0) return "วันนี้";
  if (days > 0) return `อีก ${days.toLocaleString("th-TH")} วัน`;
  return `เลยมา ${(-days).toLocaleString("th-TH")} วัน`;
}

type StatusStorySource = {
  status: string;
  sentAt: Date | string | null;
  acceptedAt: Date | string | null;
  rejectedAt: Date | string | null;
  validUntil: Date | string | null;
  order: { orderNumber: string } | null;
};

function statusStory(quotation: StatusStorySource, now: number): string {
  const expiryDays =
    quotation.validUntil !== null ? differenceInBangkokDays(quotation.validUntil, now) : null;
  switch (quotation.status) {
    case "DRAFT":
      return "ยังไม่ได้ส่งให้ลูกค้า";
    case "SENT": {
      const parts: string[] = [];
      if (quotation.sentAt) parts.push(`ส่งให้ลูกค้าแล้ว ${formatDate(quotation.sentAt)}`);
      if (expiryDays !== null) parts.push(`หมดอายุ ${daysText(expiryDays)}`);
      return parts.length > 0 ? parts.join(" · ") : "รอลูกค้าตอบกลับ";
    }
    case "ACCEPTED":
      return quotation.acceptedAt
        ? `ลูกค้าอนุมัติเมื่อ ${formatDateTime(quotation.acceptedAt)} — เปิดออเดอร์ได้เลย`
        : "ลูกค้าอนุมัติแล้ว — เปิดออเดอร์ได้เลย";
    case "REJECTED":
      return quotation.rejectedAt
        ? `ลูกค้าปฏิเสธเมื่อ ${formatDateTime(quotation.rejectedAt)}`
        : "ลูกค้าปฏิเสธใบนี้";
    case "EXPIRED":
      return quotation.validUntil
        ? `เลยวันยืนราคา ${formatDate(quotation.validUntil)} แล้ว — ดึงกลับเป็นร่างเพื่อเสนอใหม่ได้`
        : "เลยวันยืนราคาแล้ว — ดึงกลับเป็นร่างเพื่อเสนอใหม่ได้";
    case "CONVERTED":
      return quotation.order
        ? `เปิดเป็นออเดอร์ ${quotation.order.orderNumber} แล้ว`
        : "เปิดเป็นออเดอร์แล้ว";
    default:
      return "";
  }
}

function QuotationStatusBar({
  quotation,
  now,
}: {
  quotation: StatusStorySource;
  now: number;
}) {
  const story = statusStory(quotation, now);
  return (
    <div className="card-surface flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-4 py-2.5">
      <StatusLabel
        label={
          QUOTATION_STATUS_LABELS[quotation.status as keyof typeof QUOTATION_STATUS_LABELS] ??
          quotation.status
        }
        tone={toneFromBadgeVariant(
          QUOTATION_STATUS_VARIANTS[quotation.status as keyof typeof QUOTATION_STATUS_VARIANTS],
        )}
        emphasize
      />
      {story && (
        <>
          <span aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />
          <span className="text-sm text-secondary">{story}</span>
        </>
      )}
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
  const {
    data: quotation,
    isLoading,
    isError,
    refetch,
    dataUpdatedAt,
  } = trpc.quotation.getById.useQuery({ id }, { enabled: canView });
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
      title: "เปิดออเดอร์จากใบเสนอราคานี้?",
      description: "ระบบจะสร้างออเดอร์ใหม่จากรายการในใบเสนอราคา และล็อกใบเสนอราคานี้เป็นสถานะแปลงแล้ว",
      confirmText: "เปิดออเดอร์",
    });
    if (!ok) return;
    convertToOrder.mutate({ id });
  }

  const isPending = updateStatus.isPending || convertToOrder.isPending || prepareShare.isPending;

  // ----------------------------------------------------------
  // Derived data
  // ----------------------------------------------------------
  const subtotal =
    quotation?.items?.reduce(
      (sum: number, item: { totalPrice: number }) => sum + item.totalPrice,
      0,
    ) ?? 0;
  const discountAmount = quotation?.discount ?? 0;
  const taxAmount = quotation?.tax ?? 0;
  const totalAmount = quotation?.totalAmount ?? subtotal - discountAmount + taxAmount;

  const customer = quotation?.customer ?? null;
  const customerTitle = customer ? customer.company || customer.name : "";
  // ผู้ติดต่อ = ชื่อคนที่คุยด้วย — ซ้ำกับชื่อลูกค้าเมื่อไม่มีชื่อนิติบุคคล จึงไม่ซ้ำอีกรอบ
  const contactName = customer?.company ? customer.name : null;
  const hasContact = Boolean(contactName || customer?.phone || customer?.email);
  const termsLabel = quotation?.terms
    ? PAYMENT_TERMS_LABELS[quotation.terms] ?? quotation.terms
    : null;

  // ประวัติของใบ — เวลาจริงจากฐานข้อมูล ไม่เดา (ต้นแบบ .tline)
  const timeline = quotation
    ? [
        quotation.rejectedAt
          ? { key: "rejected", label: "ลูกค้าปฏิเสธ", at: quotation.rejectedAt, tone: "danger" as const, by: null }
          : null,
        quotation.acceptedAt
          ? { key: "accepted", label: "ลูกค้าอนุมัติ", at: quotation.acceptedAt, tone: "success" as const, by: null }
          : null,
        quotation.sentAt
          ? { key: "sent", label: "ส่งให้ลูกค้า", at: quotation.sentAt, tone: "info" as const, by: null }
          : null,
        {
          key: "created",
          label: "สร้างใบเสนอราคา",
          at: quotation.createdAt,
          tone: "muted" as const,
          by: quotation.createdBy?.name ?? null,
        },
      ].filter((event) => event !== null)
    : [];

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <PageShell
      back={{ href: "/quotations", label: "ใบเสนอราคาทั้งหมด" }}
      title={quotation?.quotationNumber ?? "ใบเสนอราคา"}
      meta={
        quotation && customer
          ? `${customerTitle} · เสนอเมื่อ ${formatDate(quotation.createdAt)}`
          : undefined
      }
      loading={isLoading}
      skeleton={<QuotationDetailSkeleton />}
      error={
        isError
          ? { message: "โหลดใบเสนอราคาไม่สำเร็จ", onRetry: () => void refetch() }
          : null
      }
      denied={
        !!me && !canView && { description: "หน้านี้เปิดเฉพาะทีมขาย ผู้จัดการ และบัญชี" }
      }
      action={
        quotation ? (
          <>
            {/* ปุ่มรองอยู่ซ้าย ปุ่มหลักของสถานะอยู่ขวาสุด (ต้นแบบ: พิมพ์ → ลิงก์ → เปิดออเดอร์) */}
            {canPrintQuotation && (
              <Button
                variant="outline"
                asChild
                className="gap-1.5"
                title="เปิดหน้าเอกสารสำหรับสั่งพิมพ์หรือบันทึกเป็น PDF"
              >
                <Link href={`/print/quotation/${id}`} target="_blank" rel="noreferrer">
                  <Printer />
                  พิมพ์
                </Link>
              </Button>
            )}

            {/* DRAFT — แก้ต่อได้ และปุ่มหลักคือส่งลิงก์ให้ลูกค้า (ส่งแล้วใบจะเป็น "รอลูกค้าตอบ") */}
            {canManageQuotation && quotation.status === "DRAFT" && (
              <>
                <Button variant="outline" asChild className="gap-1.5">
                  <Link href={`/quotations/new?edit=${id}`}>
                    <Pencil />
                    แก้ไข
                  </Link>
                </Button>
                <Button
                  onClick={prepareAndCopyShareLink}
                  disabled={isPending}
                  className="gap-1.5"
                  title="คัดลอกลิงก์ให้ลูกค้ายืนยันเอง (ไม่ต้อง login) — ใบนี้จะเปลี่ยนเป็น “รอลูกค้าตอบ”"
                >
                  <Link2 />
                  ลิงก์ให้ลูกค้ายืนยัน
                </Button>
              </>
            )}

            {/* SENT — ยังคัดลอกลิงก์ซ้ำได้ ปุ่มหลักคือบันทึกว่าลูกค้าตอบรับ */}
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
                  ลิงก์ให้ลูกค้ายืนยัน
                </Button>
                <Button onClick={handleAccept} disabled={isPending} className="gap-1.5">
                  <Check />
                  ลูกค้าอนุมัติ
                </Button>
              </>
            )}

            {/* ACCEPTED */}
            {canManageQuotation && quotation.status === "ACCEPTED" && (
              <Button onClick={handleConvertToOrder} disabled={isPending} className="gap-1.5">
                <RefreshCw />
                เปิดออเดอร์
              </Button>
            )}

            {/* ดึงกลับร่างเพื่อแก้ — คู่กับ server ที่ล็อกแก้เฉพาะร่าง (Gate A3) ·
                REJECTED/EXPIRED = เปิดแก้รอบใหม่ (เดิมเป็นทางตัน เหลือแค่ปุ่มพิมพ์) ·
                ACCEPTED = ได้แต่มี confirm (ล้างการยืนยันลูกค้า) */}
            {canManageQuotation && ["REJECTED", "EXPIRED"].includes(quotation.status) && (
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

            {canManageQuotation && ["SENT", "ACCEPTED"].includes(quotation.status) ? (
              <MoreMenu items={[
                ...(quotation.status === "SENT" ? [{ key: "reject", label: "ลูกค้าปฏิเสธ", icon: X, danger: true, disabled: isPending, onSelect: () => void handleReject() }] : []),
                { key: "draft", label: "ดึงกลับเป็นร่าง", icon: Undo2, danger: quotation.status === "ACCEPTED", disabled: isPending, onSelect: () => void handlePullBackToDraft() },
              ]} />
            ) : null}
          </>
        ) : undefined
      }
    >
      {!quotation ? (
        <RecordNotFound
          what="ใบเสนอราคาใบนี้"
          backHref="/quotations"
          backLabel="กลับไปรายการใบเสนอราคา"
        />
      ) : (
        <>
          {/* สถานะอยู่ที่เดียว: แถบใต้หัวข้อ + ประโยคว่าตอนนี้รออะไร (ต้นแบบ) */}
          <QuotationStatusBar quotation={quotation} now={dataUpdatedAt} />

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
                className="inline-flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                ดูออเดอร์ {quotation.order.orderNumber}
              </Link>
            </Alert>
          )}

          {/* ซ้าย 7 : ขวา 5 (ต้นแบบ .split2) — ชุดกริดเดียวกับหน้าออเดอร์ */}
          <div className={c("two")}>
            <div className={c("stack")}>
              {/* --------------------------------------
                  รายการ + สรุปยอด (ต้นแบบรวมไว้การ์ดเดียว)
              -------------------------------------- */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ToneMark icon={ClipboardList} tone="product" />
                    รายการ
                  </CardTitle>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {(quotation.items?.length ?? 0).toLocaleString("th-TH")} รายการ
                  </span>
                </CardHeader>
                <CardContent>
                  <ul aria-label="รายการสินค้าในใบเสนอราคา" className="divide-y divide-divider sm:hidden">
                    {quotation.items?.map((item) => (
                      <li key={item.id} className="space-y-2 py-3 first:pt-0">
                        <p className="font-medium text-strong">{item.name}</p>
                        {item.description && <p className="text-sm text-secondary">{item.description}</p>}
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="text-secondary">{item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}</span>
                          <span className="font-semibold tabular-nums text-strong">{formatCurrency(item.totalPrice)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {/* 4 คอลัมน์ตามต้นแบบ — หน่วยไปอยู่ในเซลล์จำนวน ("250 ชิ้น") ไม่ทิ้งข้อมูล */}
                  <DataTable.Root bordered={false} cellPadding="compact" className="hidden sm:block">
                    <DataTable.Head>
                      <tr>
                        <DataTable.Th>รายการ</DataTable.Th>
                        <DataTable.Th align="right">จำนวน</DataTable.Th>
                        <DataTable.Th align="right">ราคา/หน่วย</DataTable.Th>
                        <DataTable.Th align="right">รวม</DataTable.Th>
                      </tr>
                    </DataTable.Head>
                    <DataTable.Body>
                      {quotation.items?.map(
                        (item: {
                          id: string;
                          name: string;
                          description?: string | null;
                          quantity: number;
                          unit: string;
                          unitPrice: number;
                          totalPrice: number;
                        }) => (
                          <DataTable.Row key={item.id}>
                            <DataTable.Td className="min-w-48">
                              <div className={c("who")}>
                                <div className={c("t")}>
                                  <div className={c("id")}>
                                    <span className="truncate">{item.name}</span>
                                  </div>
                                  {item.description && <div className={c("cu")}>{item.description}</div>}
                                </div>
                              </div>
                            </DataTable.Td>
                            <DataTable.Td align="right" className="whitespace-nowrap tabular-nums text-strong">
                              {item.quantity.toLocaleString("th-TH")} {item.unit}
                            </DataTable.Td>
                            <DataTable.Td align="right" className="tabular-nums text-strong">
                              {formatCurrency(item.unitPrice)}
                            </DataTable.Td>
                            <DataTable.Td align="right" className="tabular-nums font-medium text-strong">
                              {formatCurrency(item.totalPrice)}
                            </DataTable.Td>
                          </DataTable.Row>
                        ),
                      )}
                    </DataTable.Body>
                  </DataTable.Root>

                  {/* กล่องสรุปยอดท้ายการ์ด (ต้นแบบ .sumbox/.srow) — บรรทัดภาษีโชว์เสมอ
                      เพราะเป็นข้อความทางบัญชีบนเอกสาร · ไม่เขียน "7%" ตายตัวเพราะของจริง
                      กรอกภาษีเป็นจำนวนเงิน (ปุ่ม VAT 7% เป็นแค่ทางลัดในฟอร์ม) */}
                  <div className="mt-4 border-t border-divider pt-2">
                    <div className={c("srow")}>
                      <span>ยอดก่อนภาษี</span>
                      <b>{formatCurrency(subtotal)}</b>
                    </div>
                    {discountAmount > 0 && (
                      <div className={c("srow")}>
                        <span>ส่วนลด</span>
                        <b className={c("neg")}>-{formatCurrency(discountAmount)}</b>
                      </div>
                    )}
                    <div className={c("srow")}>
                      <span>ภาษีมูลค่าเพิ่ม</span>
                      <b>{formatCurrency(taxAmount)}</b>
                    </div>
                    <div className={c("srow total")}>
                      <span>ยอดสุทธิ</span>
                      <b>{formatCurrency(totalAmount)}</b>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* --------------------------------------
                  ข้อความอิสระบนเอกสาร — ต้นแบบไม่มีการ์ดนี้ แต่ของจริงมีข้อมูล
                  ที่ต้องมีที่อยู่ (ชื่องาน/หมายเหตุที่พิมพ์ลงใบ)
              -------------------------------------- */}
              {(quotation.notes || quotation.description) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ToneMark icon={FileText} tone="system" />
                      ข้อความในเอกสาร
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    {quotation.description && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted">ชื่องาน</p>
                        <p className="whitespace-pre-wrap text-secondary">
                          {quotation.description}
                        </p>
                      </div>
                    )}
                    {quotation.notes && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted">
                          หมายเหตุ (พิมพ์ลงใบเสนอราคาที่ลูกค้าได้รับ)
                        </p>
                        <p className="whitespace-pre-wrap text-secondary">
                          {quotation.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className={c("stack")}>
              {/* --------------------------------------
                  ลูกค้าและเงื่อนไข (ต้นแบบ dl.props.one) — ทุกบรรทัดมีป้ายกำกับ
              -------------------------------------- */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ToneMark icon={User} tone="brand" />
                    ลูกค้า
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className={c("props one")}>
                    <Prop icon={Building2} label="ชื่อลูกค้า" none={!customer}>
                      {customer ? (
                        <Link
                          href={`/customers/${customer.id}`}
                          className="text-blue-700 dark:text-blue-300"
                        >
                          {customerTitle}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Prop>
                    <Prop icon={UserRound} label="ผู้ติดต่อ" none={!hasContact}>
                      {hasContact ? (
                        <>
                          {contactName ?? customer?.name}
                          {customer?.phone && <small>{customer.phone}</small>}
                          {customer?.email && <small>{customer.email}</small>}
                        </>
                      ) : (
                        "ยังไม่ได้บันทึกผู้ติดต่อ"
                      )}
                    </Prop>
                    <Prop icon={Wallet} label="เงื่อนไขชำระ" none={!termsLabel}>
                      {termsLabel ? (
                        <span className="whitespace-pre-wrap">{termsLabel}</span>
                      ) : (
                        "ยังไม่ได้ระบุ"
                      )}
                    </Prop>
                    <Prop icon={CalendarClock} label="ยืนราคาถึง" none={!quotation.validUntil}>
                      {quotation.validUntil ? formatDate(quotation.validUntil) : "ยังไม่ได้กำหนด"}
                    </Prop>
                  </dl>
                </CardContent>
              </Card>

              {/* --------------------------------------
                  ความเคลื่อนไหว (ต้นแบบ .tline) — เวลาจริงจากฐานข้อมูล ไม่เดา
              -------------------------------------- */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ToneMark icon={History} tone="system" />
                    ความเคลื่อนไหว
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol>
                    {timeline.map((event, index) => (
                      <li key={event.key} className="relative flex gap-3 py-2 pl-1">
                        {index < timeline.length - 1 && (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 left-[8.5px] top-6 w-px bg-divider"
                          />
                        )}
                        {/* จุดสีชุดเดียวกับป้ายสถานะ (.d ของ kit) — สลับธีมแล้วสีตามไปเอง */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "relative mt-1.5 size-2.5 shrink-0 rounded-full",
                            c("d", DOT_TONE[event.tone]),
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-strong">{event.label}</span>
                          <span className="block text-xs text-muted">
                            {formatDateTime(event.at)}
                            {event.by ? ` · โดย ${event.by}` : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  {quotation.rejectedReason && (
                    <div className="mt-3 border-t border-divider pt-3">
                      <p className="mb-1 text-xs text-muted">เหตุผลที่ปฏิเสธ</p>
                      <p className="whitespace-pre-wrap text-sm text-secondary">
                        {quotation.rejectedReason}
                      </p>
                    </div>
                  )}
                  {quotation.updatedAt && (
                    <p className="mt-3 border-t border-divider pt-3 text-xs text-muted">
                      แก้ไขล่าสุด {formatDateTime(quotation.updatedAt)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
