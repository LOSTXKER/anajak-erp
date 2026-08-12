"use client";

import { Suspense, use, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { PageHeader } from "@/components/page-header";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  INTERNAL_STATUS_LABELS,
  CHANNEL_COLORS,
  getFlowSteps,
  getNextStatuses,
  canPermsSetStatus,
  isMarketplaceChannel,
} from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";
import { permAllows } from "@/lib/permissions";
import {
  FileText,
  ChevronRight,
  XCircle,
  Edit3,
  Copy,
  MoreHorizontal,
  ClipboardList,
  AlertTriangle,
  Share2,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MENU_SEPARATOR, OVERLAY_PANEL, TINT } from "@/components/ui/tokens";

import { OrderDesignSection } from "@/components/orders/order-design-section";
import { ProductionSummaryCard } from "@/components/orders/production-summary-card";
import { OrderDeliverySection } from "@/components/orders/order-delivery-section";
import { OrderItemsEditor } from "@/components/orders/order-items-editor";
import { OrderInfoEditDialog } from "@/components/orders/order-info-edit-dialog";
import { OrderGoodsReceiptSection } from "@/components/goods-receipt/order-goods-receipt-section";
import { OrderQcSection } from "@/components/qc/order-qc-section";
import { getOrderNextStep } from "@/lib/order-next-step";
import { shouldShowDeliverySection } from "@/lib/delivery-ui";
import { sumOrderQuantity } from "@/lib/pricing";
import {
  normalizeOrderTab,
  buildNextStepInput,
  tabForAnchor,
  ORDER_TAB_DEFS,
  ORDER_DEFAULT_TAB,
  type TabKey,
} from "@/lib/order-tabs";
import { Tabs, TabsBar, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Section } from "@/components/ui/section";
import { AddCard } from "@/components/ui/add-card";
import {
  OrderItemsDisplay,
  OrderStatusBar,
  OrderOverviewTab,
  OrderFilesCard,
  OrderRevisions,
  OrderChangeOrders,
  OrderNextStepAction,
  nextStepBlockers,
  OrderMoneyTab,
} from "@/components/orders/detail";
import { RecordNotFound } from "@/components/ui/record-not-found";


// ============================================================
// Loading skeleton
// ============================================================

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <Skeleton className="h-20 rounded-xl" />
      {/* โครงต้องตรงกับของจริง (แถบแท็บ + เนื้อหาเต็มความกว้าง) ไม่งั้นจอกระโดดตอนโหลดเสร็จ */}
      <Skeleton className="h-11 w-96 max-w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl md:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ============================================================
// Main page component
// ============================================================

export default function OrderDetailPage({
  params,
  ordersBasePath = "/orders",
  stickyActionsOffset = "default",
}: {
  params: Promise<{ id: string }>;
  ordersBasePath?: string;
  stickyActionsOffset?: "default" | "v2";
}) {
  return (
    <Suspense fallback={<OrderDetailSkeleton />}>
      <OrderDetailContent
        params={params}
        ordersBasePath={ordersBasePath}
        stickyActionsOffset={stickyActionsOffset}
      />
    </Suspense>
  );
}

function OrderDetailContent({
  params,
  ordersBasePath,
  stickyActionsOffset,
}: {
  params: Promise<{ id: string }>;
  ordersBasePath: string;
  stickyActionsOffset: "default" | "v2";
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptText = usePromptText();
  const confirm = useConfirm();
  // แก้รายการ = ฟอร์มเต็มแสดง inline ตรงส่วนรายการสินค้า (เบสเคาะ: ไม่เอา popup)
  const [editingItems, setEditingItems] = useState(false);
  const [showInfoEditDialog, setShowInfoEditDialog] = useState(false);
  // แต่ละการ์ดบนแท็บภาพรวมมีปุ่มแก้ไขของตัวเอง (เบสสั่ง 2026-08-11) — ฟอร์มใบเดียวเหมือนเดิม
  // แต่จำว่ากดมาจากการ์ดไหน เพื่อเลื่อนไปหัวข้อนั้นให้ ไม่ต้องเลื่อนหาเอง
  const [editSection, setEditSection] = useState<"info" | "shipping">("info");
  /* ── แท็บ (เบสเคาะกลับมาใช้ 2026-08-05) ────────────────────────────────
     URL เป็นแหล่งความจริงร่วม แต่ตัว state เก็บใน React — เขียน URL ด้วย
     history API ตรงๆ ไม่ผ่าน router.replace เพราะ router จะรีเฟรช RSC ทั้งหน้า
     ทำให้สลับแท็บกระตุก · ผลคือ refresh/back/ส่งลิงก์ให้กันได้แท็บเดิม */
  const initialTab = normalizeOrderTab(searchParams.get("tab")) ?? ORDER_DEFAULT_TAB;
  const [tab, setTabState] = useState<TabKey>(initialTab);

  const changeTab = useCallback((key: string) => {
    const next = normalizeOrderTab(key) ?? ORDER_DEFAULT_TAB;
    setTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    url.hash = "";
    window.history.pushState({}, "", url);
  }, []);

  // ปุ่มย้อนกลับของเบราว์เซอร์ต้องพากลับแท็บเดิม ไม่ใช่เด้งออกจากหน้า
  useEffect(() => {
    const onPop = () => {
      const t = normalizeOrderTab(new URL(window.location.href).searchParams.get("tab"));
      setTabState(t ?? ORDER_DEFAULT_TAB);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function openItemsEditor() {
    setEditingItems(true);
    changeTab("items");
  }
  // ANCHOR ของแถบขั้นต่อไป → สลับไปแท็บที่เกี่ยว (แผนที่เดียวกับ tabForAnchor ไม่มีตรรกะใหม่)
  function handleAnchor(target: "billing" | "design" | "production" | "delivery" | "qc") {
    changeTab(tabForAnchor(target) ?? ORDER_DEFAULT_TAB);
  }

  const { data: order, isLoading, isError, refetch } = trpc.order.getById.useQuery({ id });
  const attachmentsQuery = trpc.attachment.listByEntity.useQuery({
    entityType: "ORDER",
    entityId: id,
  });
  const attachmentsLoading =
    !attachmentsQuery.data &&
    (attachmentsQuery.isLoading || attachmentsQuery.isFetching);
  const attachmentsError =
    !attachmentsQuery.data && attachmentsQuery.isError;
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  // นโยบาย ⑦: ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย — ระหว่าง me โหลด permAllows คืน false = ซ่อนไว้ก่อน
  // (safe default ตาม B12) · คุมทั้งแท็บ "เงิน/บิล" + ยอดใน sidebar (UX6) · ห้ามใช้ isSalesUp — ชุดนั้นไม่มี ACCOUNTANT
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const permissionsReady = !meQuery.isLoading;
  const showDeliverySection = shouldShowDeliverySection(
    order?.internalStatus ?? "",
    Boolean(order?.deliveries?.length),
  );
  // ด่านพร้อมผลิต (เงิน/แบบ/ของ) — ใช้บอก "ติดอะไร" บนแถบขั้นต่อไป (query ที่มีอยู่ ไม่เพิ่ม endpoint)
  // ยิงเฉพาะสถานะที่แถบอาจบล็อก STATUS→PRODUCTION_QUEUE (CONFIRMED/ON_HOLD) — สถานะอื่น/terminal ไม่ใช้ readiness
  const orderContext = trpc.production.orderContext.useQuery(
    { orderId: id },
    { enabled: !!order && ["CONFIRMED", "ON_HOLD"].includes(order.internalStatus) }
  );
  const utils = trpc.useUtils();

  const updateStatus = useMutationWithInvalidation(trpc.order.updateStatus, {
    invalidate: [utils.order.getById, utils.order.list],
    // server มีด่านปฏิเสธ (วงเงินเครดิต/ปิดงานก่อนวางบิลครบ) — เงียบไม่ได้ ผู้ใช้ต้องเห็นเหตุผล
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "เปลี่ยนสถานะไม่สำเร็จ");
    },
  });

  const duplicateOrder = useMutationWithInvalidation(trpc.order.duplicate, {
    invalidate: [utils.order.list],
    onSuccess: (data: { id: string; filmStockCount?: number }) => {
      // เช็คฟิล์มค้างตอนสั่งซ้ำ (ก้อน 4 ชิ้น 2) — เตือนให้เห็น การหยิบใช้ยัง manual
      if (data.filmStockCount && data.filmStockCount > 0) {
        toast.info(
          `ลูกค้ามีฟิล์มพร้อมรีดค้าง ${data.filmStockCount} รายการ — เช็คที่คลังฟิล์มก่อนเปิดรอบพิมพ์ใหม่`
        );
      }
      router.push(`${ordersBasePath}/${data.id}`);
    },
  });

  // จองสต๊อคใหม่หลังแก้ต้นเหตุ (ของไม่พอ/ท่อล่ม) — server จำกัดช่วงสถานะก่อนเริ่มผลิต
  const retryReserve = useMutationWithInvalidation(trpc.order.retryStockReservation, {
    invalidate: [utils.order.getById],
    onSuccess: () => toast.success("จองสต๊อคสำเร็จ"),
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "จองสต๊อคไม่สำเร็จ");
    },
  });

  // ลิงก์สถานะลูกค้า (ก้อน 4 — portal) — คัดลอกลิงก์: ใช้ token เดิมถ้ายังไม่หมดอายุ
  // ไม่งั้นสร้างใหม่ (getLink protected · generate gate salesUp ฝั่ง server)
  const statusLink = trpc.customerStatus.getLink.useQuery({ orderId: id });
  const generateStatusLink = trpc.customerStatus.generateLink.useMutation();
  async function copyStatusLink() {
    try {
      let tok = statusLink.data?.token ?? null;
      const expired =
        !statusLink.data?.expiresAt ||
        new Date(statusLink.data.expiresAt) < new Date();
      if (!tok || expired) {
        // สร้าง token (await network) — เมนู ⋯ ปิด + โฟกัสหลุด → clipboard API อาจโดนบล็อก
        tok = (await generateStatusLink.mutateAsync({ orderId: id })).token;
        statusLink.refetch();
      }
      const url = `${window.location.origin}/status/${tok}`;
      // วิธีสำรอง (textarea + execCommand) — โฟกัส element เอง เลยไม่ติด "Document is not focused"
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
      toast.success(copied ? "คัดลอกลิงก์สถานะลูกค้าแล้ว" : `ลิงก์สถานะ: ${url}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "สร้างลิงก์ไม่สำเร็จ");
    }
  }

  // ลิงก์เก่า ?tab=docs → canonicalize เป็น files ครั้งเดียว (normalizeOrderTab แปลงให้แล้ว
  // ตอนอ่าน แต่ URL ยังเป็นของเก่า — เขียนทับให้ตรงกัน เผื่อคนก๊อป URL ต่อ)
  useEffect(() => {
    const raw = new URL(window.location.href).searchParams.get("tab");
    if (!raw) return;
    const normalized = normalizeOrderTab(raw);
    if (!normalized || normalized === raw) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", normalized);
    window.history.replaceState({}, "", url);
  }, []);

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (isLoading) return <OrderDetailSkeleton />;
  if (isError)
    return (
      <div className="space-y-6">
        <PageHeader breadcrumb={[{ label: "ออเดอร์", href: ordersBasePath }]} title="ออเดอร์" />
        <QueryError onRetry={() => refetch()} />
      </div>
    );
  if (!order)
    return (
      <div className="space-y-6">
        <PageHeader breadcrumb={[{ label: "ออเดอร์", href: ordersBasePath }]} title="ออเดอร์" />
        <RecordNotFound what="ออเดอร์ใบนี้" backHref={ordersBasePath} backLabel="กลับไปรายการออเดอร์" />
      </div>
    );

  // ----------------------------------------------------------
  // Derived data
  // ----------------------------------------------------------
  const flowSteps = getFlowSteps(order.orderType);
  const nextStatuses = getNextStatuses(order.orderType, order.internalStatus);
  // ซ่อนปุ่มที่คนนี้กดแล้ว server ปฏิเสธ (PERM4: ชุดสิทธิ์จริงเดียวกับด่าน server — audit ข้อ 29)
  const roleCanSetStatus = (to: string) =>
    canPermsSetStatus(me?.permissions, order.internalStatus, to as InternalStatus);
  const forwardStatuses = nextStatuses.filter((s) => s !== "CANCELLED" && roleCanSetStatus(s));
  const canCancel = nextStatuses.includes("CANCELLED") && roleCanSetStatus("CANCELLED");
  // เมนูฝั่งขาย (แก้ข้อมูล/รายการ/สำเนา/ออกใบเสนอ) — server เป็น create_sales_docs
  const isSalesUp = !!me && permAllows(me.permissions, "create_sales_docs");

  const currentStepIndex = flowSteps.indexOf(order.internalStatus);

  const isCompleted = order.internalStatus === "COMPLETED";

  const isMarketplace = isMarketplaceChannel(order.channel);

  const totalCost =
    order.costEntries?.reduce(
      (sum: number, c: { amount: number }) => sum + c.amount,
      0,
    ) ?? 0;
  const hasCostEntries = order.costEntries && order.costEntries.length > 0;

  // ยอดฝั่งขาย — viewer ที่ไม่เห็นเงิน (นโยบาย ⑦) server ส่ง null มา → คิดเป็น 0
  // ได้เพราะผลลัพธ์ถูก render เฉพาะใน section ที่ gate ด้วย canSeeMoney แล้วเท่านั้น
  const subtotalItems =
    order.items?.reduce(
      (sum: number, item: { subtotal: number | null }) => sum + (item.subtotal ?? 0),
      0,
    ) ?? 0;
  const subtotalFees =
    order.fees?.reduce(
      (sum: number, fee: { amount: number | null }) => sum + (fee.amount ?? 0),
      0,
    ) ?? 0;
  const discount = order.discount ?? 0;
  const totalAmount = order.totalAmount ?? subtotalItems + subtotalFees - discount;

  const profitMargin =
    hasCostEntries && totalAmount > 0
      ? ((totalAmount - totalCost) / totalAmount) * 100
      : null;

  // ON_HOLD ปิดปุ่มแก้ให้ตรง server (B10 — แก้งานพักต้องปลดพักก่อน · next-step card ชี้ทางปลดพัก)
  const canEditItems = ![
    "PRODUCING", "QUALITY_CHECK", "PACKING", "READY_TO_SHIP",
    "SHIPPED", "COMPLETED", "CANCELLED", "ON_HOLD",
  ].includes(order.internalStatus);

  // แถบ "ขั้นต่อไป" — ระบบจำว่างานนี้ต้องทำอะไรต่อ (logic lib/order-next-step.ts) แทนให้ผู้ใช้ไล่เดาจากการ์ด
  const nextStepInput = buildNextStepInput(order);
  const nextStep = getOrderNextStep(nextStepInput);
  /* แท็บที่คนนี้เห็น — ซ่อนได้ตาม "สิทธิ์" เท่านั้น ห้ามซ่อนตามสถานะ
     (สิทธิ์ผูกกับคน = ชุดแท็บคงที่ตลอดการใช้งาน · สถานะเดินหลายรอบต่อวัน
      ถ้าซ่อนตามสถานะ ตำแหน่งแท็บจะขยับใต้มือ) */
  const visibleTabs = ORDER_TAB_DEFS.filter((t) => t.key !== "money" || canSeeMoney);

  /* deep link ไปแท็บที่ตัวเองไม่มีสิทธิ์ → ตกกลับแท็บเริ่มต้นเงียบๆ ไม่ขึ้น error */
  const activeTab: TabKey = visibleTabs.some((t) => t.key === tab) ? tab : ORDER_DEFAULT_TAB;

  /* จุดแดงบนหัวแท็บ — ใช้ปลายทางของแถบ "ขั้นต่อไป" ตัวเดียวกัน ไม่มีตรรกะใหม่
     (ถ้าเขียนกฎใหม่ จุดแดงกับแถบขั้นต่อไปจะเพี้ยนกันวันที่แก้ข้างใดข้างหนึ่ง) */
  const pendingTab: TabKey | null =
    nextStep?.action.type === "ANCHOR"
      ? tabForAnchor(nextStep.action.target)
      : nextStep?.action.type === "EDIT_ITEMS"
        ? "items"
        : null;

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------
  async function handleStatusChange(newStatus: string) {
    const current = order?.internalStatus ?? "";
    // ถอยจากจุดที่ประกาศกับลูกค้าแล้ว (ส่งแล้ว/ปิดแล้ว) — server บังคับเหตุผล+ผู้จัดการ
    const isRollback =
      current === "COMPLETED" ||
      (current === "SHIPPED" && ["READY_TO_SHIP", "QUALITY_CHECK"].includes(newStatus));

    if (newStatus === "CANCELLED") {
      // บิลค้างต้องเห็นก่อนตัดสินใจ (เบสเคาะ 2026-07-06) — เตือน+ชี้ทาง ไม่บังคับแข็ง
      // (เคสรับเงินแล้ว void ใบไม่ได้ ต้องใช้ใบลดหนี้/คืนเงินตาม) · server มีด่านเดียวกัน
      // เช็คจากข้อมูลสด — cache ค้างจะทำ dialog ไม่โผล่ทั้งที่ server จะปฏิเสธ (review จับ)
      const fresh = await utils.order.getById.fetch({ id }).catch(() => null);
      const openBills = ((fresh ?? order)?.invoices ?? []).filter(
        (inv) =>
          !inv.isVoided &&
          ["DEPOSIT_INVOICE", "FINAL_INVOICE", "DEBIT_NOTE"].includes(inv.type) &&
          ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(inv.paymentStatus)
      );
      if (openBills.length > 0) {
        const proceed = await confirm({
          title: `มีบิลค้างชำระ ${openBills.length} ใบ (${openBills
            .map((inv) => inv.invoiceNumber)
            .join(", ")})`,
          description:
            "แนะนำยกเลิกบิล/ออกใบลดหนี้ที่การ์ด บิล/การชำระเงิน ก่อน — ไม่งั้นยอดค้างจะโผล่ในรายงานลูกหนี้ทั้งที่งานถูกยกเลิก และอาจทวงลูกค้าผิด",
          confirmText: "ยกเลิกทั้งที่บิลค้าง",
        });
        if (!proceed) return;
      }
      const reason = await promptText({
        title: "ยกเลิกออเดอร์นี้?",
        description: "ระบุเหตุผลที่ยกเลิก — จะถูกบันทึกในประวัติออเดอร์",
        placeholder: "เหตุผลที่ยกเลิก",
        confirmText: "ยกเลิกออเดอร์",
        destructive: true,
      });
      if (reason === null || reason === "") return;
      updateStatus.mutate({
        id,
        internalStatus: newStatus as never,
        reason,
        confirmOutstandingBilling: openBills.length > 0 ? true : undefined,
      });
    } else if (isRollback) {
      const reason = await promptText({
        title: current === "COMPLETED" ? "เปิดงานกลับ?" : "ถอยสถานะกลับ?",
        description:
          "งานนี้ประกาศส่งแล้ว/ปิดแล้ว — ระบุเหตุผล (เช่น ของตีกลับ/กดพลาด) จะถูกบันทึกในประวัติ",
        placeholder: "เหตุผล",
        confirmText: "ยืนยันถอยสถานะ",
        destructive: true,
      });
      if (reason === null || reason === "") return;
      updateStatus.mutate({ id, internalStatus: newStatus as never, reason });
    } else if (newStatus === "COMPLETED") {
      const ok = await confirm({
        title: "ปิดงานออเดอร์นี้?",
        description:
          "ปิดแล้วแก้รายการ/ตัวเงินไม่ได้อีก — เปิดกลับได้เฉพาะผู้จัดการพร้อมเหตุผล",
        confirmText: "ปิดงาน",
      });
      if (!ok) return;
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    } else if (newStatus === "SHIPPED") {
      const ok = await confirm({
        title: "ยืนยันว่าส่งของแล้ว?",
        description:
          "แนะนำให้กด \"ส่งของ\" ที่ใบส่งในส่วนจัดส่งแทน — เลขพัสดุจะติดออเดอร์และสถานะเดินให้เอง",
        confirmText: "ส่งแล้ว",
      });
      if (!ok) return;
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    } else {
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    }
  }

  const channelColor = CHANNEL_COLORS[order.channel] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  };

  // COMPLETED: ไม่มีปุ่มหลัก — ทางถอย (เปิดงานกลับ) ทั้งหมดอยู่ใน dropdown
  // UX5: ตัดปุ่มสถานะหลักบน header (ไม่เช็ค readiness = ปุ่มที่ server รู้อยู่แล้วว่าจะพัง ขัด B8) —
  // เหลือแถบขั้นต่อไปเป็น CTA เดียว (เช็ค readiness จริง) · ทางเดินสถานะทั้งหมดยังครบใน dropdown ⋯
  const otherNext = forwardStatuses;
  const statusItemLabel = (status: string) =>
    isCompleted && status === "SHIPPED"
      ? "เปิดงานกลับ (→ จัดส่งแล้ว)"
      : INTERNAL_STATUS_LABELS[status as keyof typeof INTERNAL_STATUS_LABELS];
  const dropdownItemClass =
    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900 dark:text-slate-300 dark:data-[highlighted]:bg-slate-800 dark:data-[highlighted]:text-white";

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          { label: "ออเดอร์", href: ordersBasePath },
          { label: order.orderNumber },
        ]}
        title={order.orderNumber}
        description={order.title || undefined}
        action={
          <>
            {/* ปุ่มขั้นต่อไป (เบสสั่งถอดแถบฟ้าออก 2026-08-11 → ย้ายปุ่มมาไว้ตรงนี้)
                ยังเป็นทางเดียวที่เช็คด่านพร้อมผลิตให้ก่อนกด · ติดด่านเมื่อไหร่ปุ่มจะหายไป
                แล้วแถบสถานะจะบอกแทนว่าติดอะไร (กันปุ่มที่กดแล้ว server ปฏิเสธ — B8) */}
            <OrderNextStepAction
              nextStep={nextStep}
              readiness={orderContext.data?.readiness ?? null}
              isPending={updateStatus.isPending}
              onStatus={handleStatusChange}
              // gate เดียวกับปุ่มแก้รายการจุดอื่น — ช่างกดแล้วเจอฟอร์มราคา (0 จาก null)
              // ก่อนไปตาย FORBIDDEN ตอนบันทึก (review ⑦ จับ)
              onEditItems={isSalesUp ? openItemsEditor : undefined}
              onAnchor={handleAnchor}
              canSeeMoney={canSeeMoney}
            />
            {/* dropdown ต้องมีเสมอ — "ใบสั่งงาน" อยู่ในนี้ ทุก role/ทุกสถานะต้องพิมพ์ได้
                (review จับ: เดิม gate ตาม role ทำช่าง/กราฟิกพิมพ์ใบสั่งงานไม่ได้)
                UX5: ปุ่มสถานะหลักบน header ถูกตัด — เลื่อนสถานะผ่านปุ่มขั้นต่อไป (เช็ค readiness) + รายการใน dropdown นี้ */}
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="เพิ่มเติม">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className={cn(OVERLAY_PANEL, "z-50 min-w-[200px] p-1", "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95")}
                  >
                    <DropdownMenu.Item className={dropdownItemClass} asChild>
                      <a href={`/print/job-ticket/${id}`} target="_blank" rel="noreferrer">
                        <ClipboardList className="h-4 w-4" />
                        ใบสั่งงาน (พิมพ์)
                      </a>
                    </DropdownMenu.Item>
                    {isSalesUp && (
                      <>
                        <DropdownMenu.Item
                          className={dropdownItemClass}
                          onSelect={() => {
                            setEditSection("info");
                            setShowInfoEditDialog(true);
                          }}
                        >
                          <FileText className="h-4 w-4" />
                          แก้ไขข้อมูลออเดอร์
                        </DropdownMenu.Item>
                        {canEditItems && (
                          <DropdownMenu.Item
                            className={dropdownItemClass}
                            onSelect={openItemsEditor}
                          >
                            <Edit3 className="h-4 w-4" />
                            แก้ไขรายการ
                          </DropdownMenu.Item>
                        )}
                        <DropdownMenu.Item
                          className={dropdownItemClass}
                          onSelect={() => duplicateOrder.mutate({ id })}
                          disabled={duplicateOrder.isPending}
                        >
                          <Copy className="h-4 w-4" />
                          สำเนาออเดอร์
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className={dropdownItemClass}
                          onSelect={() => copyStatusLink()}
                          disabled={generateStatusLink.isPending}
                        >
                          <Share2 className="h-4 w-4" />
                          คัดลอกลิงก์สถานะลูกค้า
                        </DropdownMenu.Item>
                        {["DRAFT", "INQUIRY"].includes(order.internalStatus) && (
                          // สะพานใบเสนอ: ออกใบเสนอผูกใบนี้ — ลูกค้าตกลงแล้วยืนยันออเดอร์เดิม ไม่สร้างซ้ำ
                          <DropdownMenu.Item
                            className={dropdownItemClass}
                            onSelect={() => router.push(`/quotations/new?orderId=${id}`)}
                          >
                            <FileText className="h-4 w-4" />
                            ออกใบเสนอราคา
                          </DropdownMenu.Item>
                        )}
                      </>
                    )}
                    {otherNext.length > 0 && (
                      <>
                        <DropdownMenu.Separator className={MENU_SEPARATOR} />
                        {otherNext.map((status) => (
                          <DropdownMenu.Item
                            key={status}
                            className={dropdownItemClass}
                            onSelect={() => handleStatusChange(status)}
                            disabled={updateStatus.isPending}
                          >
                            <ChevronRight className="h-4 w-4" />
                            {statusItemLabel(status)}
                          </DropdownMenu.Item>
                        ))}
                      </>
                    )}
                    {canCancel && (
                      <>
                        <DropdownMenu.Separator className={MENU_SEPARATOR} />
                        <DropdownMenu.Item
                          className={cn(
                            dropdownItemClass,
                            "text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-950/40"
                          )}
                          onSelect={() => handleStatusChange("CANCELLED")}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                          ยกเลิกออเดอร์
                        </DropdownMenu.Item>
                      </>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
          </>
        }
      />

      {/* แถบสรุป 3 ช่องบนมือถือ (ลูกค้า/กำหนดส่ง/ความเร่งด่วน) ถูกถอดออก — เบสสั่ง 2026-08-11
          หลังเห็นจอจริง · ทั้งสามอย่างย้ายไปอยู่บนสุดของการ์ด "ข้อมูลออเดอร์" ในแท็บภาพรวม
          (แท็บแรกที่เปิดมาเจอ) จึงไม่ได้หายไปจากหน้า แค่ไม่ต้องมีแถบซ้ำอีกชั้น */}

      {/* revisions = ชุดเดียวกับที่แท็บประวัติใช้ (ไม่ยิง query เพิ่ม) — แถบสถานะเอาไปหาว่า
          งานพัก/ยกเลิกค้างไว้ที่ขั้นไหนของสายงาน เพราะ 2 สถานะนี้ไม่มีที่ยืนใน flow */}
      <OrderStatusBar
        flowSteps={flowSteps}
        currentStepIndex={currentStepIndex}
        internalStatus={order.internalStatus}
        customerStatus={order.customerStatus}
        revisions={order.revisions ?? []}
        cancelledAt={order.cancelledAt}
        cancelledReason={order.cancelledReason}
        // ปุ่มขั้นต่อไปหายไปตอนติดด่าน — เหตุผลต้องมาโผล่ตรงนี้แทน ไม่งั้นปุ่มหายเงียบ
        blockers={nextStepBlockers(nextStep, orderContext.data?.readiness ?? null)}
      />

      {/* จองสต๊อคมีปัญหา — ต้องเห็นทันทีบนหน้าออเดอร์ (ด่านพร้อมผลิตจะกั้นงานไม่ให้เข้าคิวช่างอยู่แล้ว
          แต่คนแก้ต้นเหตุคือคนที่เปิดหน้านี้) · จองสำเร็จดูได้จากประวัติออเดอร์ */}
      {order.stockReservationError && (
        <div className={cn(TINT.error, "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm")}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">จองสต๊อคไม่สำเร็จ:</span> {order.stockReservationError}
          </span>
          {isSalesUp &&
            ["CONFIRMED", "DESIGNING", "DESIGN_APPROVED", "PRODUCTION_QUEUE"].includes(
              order.internalStatus
            ) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryReserve.mutate({ id })}
                disabled={retryReserve.isPending}
              >
                {retryReserve.isPending ? "กำลังจอง..." : "จองใหม่"}
              </Button>
            )}
        </div>
      )}

      {/* หมายเหตุใบนี้อยู่ "นอกแท็บ" โดยตั้งใจ — คนแพ็ค (แท็บจัดส่ง) กับช่าง (แท็บงานผลิต)
          ต้องเห็น "ห้ามพับ / ส่งก่อนบ่าย 3" โดยไม่ต้องสลับกลับมาแท็บภาพรวม พลาดแล้วงานเสีย
          โผล่เฉพาะใบที่มีหมายเหตุ — ใบปกติไม่กินที่เลย */}
      {/* blind ship = ห้ามมีชื่อ/เอกสาร Anajak ในกล่อง · พลาดครั้งเดียวเสียลูกค้าขายซ้ำทั้งราย
          อยู่นอกแท็บเพราะคนแพ็คทำงานอยู่แท็บ "จัดส่ง" — เดิมอยู่ในการ์ดแท็บภาพรวมที่ไม่มีใครกลับไปเปิด
          เขียนเป็นประโยคเต็ม ไม่ใช้ไอคอน/สีล้วน (สีบอกว่า "มีอะไรบางอย่าง" แต่ไม่บอกว่าต้องทำอะไร) */}
      {order.blindShip && (
        <div className={cn(TINT.warning, "flex flex-wrap gap-x-2 gap-y-1 rounded-xl border px-4 py-3 text-sm")}>
          <span className="font-medium">ส่งแบบไม่ระบุผู้ส่ง</span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            ชื่อผู้ส่งบนกล่อง:{" "}
            {order.blindShipSenderName || "ยังไม่ระบุ — ต้องกรอกก่อนแพ็ค"}
          </span>
        </div>
      )}

      {order.notes?.trim() && (
        <div className={cn(TINT.warning, "flex flex-wrap gap-x-2 gap-y-1 rounded-xl border px-4 py-3 text-sm")}>
          <span className="font-medium">หมายเหตุใบนี้</span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{order.notes}</span>
        </div>
      )}

      {/* ====================================================
          แท็บ + เนื้อหา — เต็มความกว้าง ไม่มีคอลัมน์ขวาแล้ว
          คอลัมน์ขวาเดิม (ลูกค้า/ข้อมูลออเดอร์/ที่อยู่) คือของชิ้นเดียวกับแท็บ "ภาพรวม" เป๊ะ
          เก็บไว้ทั้งคู่ = พูดเรื่องเดียวกัน 2 ที่ แล้ววันหลังแก้ที่เดียวอีกที่ค้าง
          ผลพลอยได้: แถบแท็บไม่พาดคลุมของที่กดแล้วไม่เปลี่ยนอีกต่อไป (เบสบ่นเรื่องนี้ตรงๆ)
      ==================================================== */}
      <Tabs value={activeTab} onValueChange={changeTab}>
        {/* sticky — เลื่อนลงไปลึกแค่ไหนก็ยังสลับแท็บได้
            TabsBar = พื้นรองที่ทำให้เนื้อหาไม่วิ่งทะลุขึ้นมาอยู่ข้างแท็บตอนเลื่อน */}
        <TabsBar>
        <TabsList aria-label="ส่วนของออเดอร์">
          {visibleTabs.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              hasPending={t.key === pendingTab}
              aria-label={t.key === pendingTab ? `${t.label} — มีงานค้าง` : undefined}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        </TabsBar>

      <div className="mt-6">
        <div>
          {/* แท็บแรก: ภาพรวม — ผู้ติดต่อ/ข้อมูลงาน/ที่อยู่/แบรนด์ (เบสสั่ง 2026-08-11)
              นี่คือบ้านของสิ่งที่เคยอยู่คอลัมน์ขวา บวกของที่มีในฐานแต่หน้าไม่เคยโชว์ */}
          <TabsContent value="overview" className="space-y-6">
            <OrderOverviewTab
              order={order}
              showMoney={canSeeMoney}
              totalAmount={totalAmount}
              totalQuantity={sumOrderQuantity(order.items ?? [])}
              onOpenMoney={canSeeMoney ? () => changeTab("money") : undefined}
              onEditInfo={
                isSalesUp
                  ? (section) => {
                      setEditSection(section);
                      setShowInfoEditDialog(true);
                    }
                  : undefined
              }
              channelColor={channelColor}
              isMarketplace={isMarketplace}
            />
          </TabsContent>

          <TabsContent value="items" className="space-y-6">
              {editingItems && canEditItems ? (
                <OrderItemsEditor
                  orderId={id}
                  orderType={order.orderType}
                  internalStatus={order.internalStatus}
                  order={order}
                  onDone={() => setEditingItems(false)}
                  onCancel={() => setEditingItems(false)}
                  stickyActionsOffset={stickyActionsOffset}
                />
              ) : (
                <OrderItemsDisplay
                  orderId={id}
                  items={order.items ?? []}
                  fees={order.fees ?? []}
                  onEditItems={canEditItems && isSalesUp ? openItemsEditor : undefined}
                  showMoney={canSeeMoney}
                />
              )}
            <OrderChangeOrders orderId={id} />
          </TabsContent>

          <TabsContent value="production" className="space-y-6">
            <OrderDesignSection
              orderId={id}
              internalStatus={order.internalStatus}
              canSeeMoney={canSeeMoney}
            />

            {/* ของเข้า/ตรวจรับ — เสื้อลูกค้า/เสื้อโรงเย็บ นับจริงต่อไซส์ (ก้อน 1) */}
            <OrderGoodsReceiptSection
              orderId={id}
              itemSources={(order.items ?? []).flatMap((it) =>
                (it.products ?? [])
                  .map((p) => p.itemSource)
                  .filter((s): s is string => s !== null)
              )}
              canReceive={!!me && permAllows(me.permissions, "manage_delivery")}
            />

            {/* ตรวจนับ QC — นับของจุดที่ 2 ก่อนแพ็ค (ก้อน 3): ดีล้วนเด้งแพ็ค · มีเสียถอยกลับผลิต */}
            <OrderQcSection
              orderId={id}
              internalStatus={order.internalStatus}
              canCount={!!me && permAllows(me.permissions, "manage_production")}
            />

            {/* การ์ดสรุปอ่านอย่างเดียว — ตัวจัดการผลิตจริงอยู่ /production/[id] (เบสเคาะแยกโมดูล) */}
            <ProductionSummaryCard
              orderId={id}
              internalStatus={order.internalStatus}
              productions={order.productions ?? []}
              isManagerUp={!!me && permAllows(me.permissions, "supervise_operations")}
            />
          </TabsContent>

          <TabsContent value="delivery" className="space-y-6">
            {showDeliverySection ? (
              <OrderDeliverySection
                orderId={id}
                internalStatus={order.internalStatus}
                customerName={order.customer?.name}
                customerPhone={order.customer?.phone ?? undefined}
                customerHasAddress={!!order.customer?.address}
                customerAddress={order.customer?.address}
                orderShipping={order}
              />
            ) : (
              /* แท็บอยู่เสมอแม้ยังไม่ถึงเฟส — ถ้าซ่อนตามสถานะ ชุดแท็บจะเปลี่ยนใต้มือ
                 ระหว่างวันเดียวกัน (สถานะเดินหลายรอบต่อวัน) ตำแหน่งที่คนจำไว้จะขยับ */
              <Section title="จัดส่ง">
                <AddCard
                  icon={Truck}
                  label="ยังไม่ถึงขั้นจัดส่ง"
                  desc="เปิดใช้เมื่อผลิตและตรวจนับเสร็จ"
                  onClick={() => {}}
                />
              </Section>
            )}
          </TabsContent>

          {/* ไม่มีสิทธิ์ดูเงิน = ไม่ render ทั้งก้อน (แท็บก็ถูกกรองออกจาก visibleTabs)
              — Radix forceMount ทำให้เนื้อหาแท็บอยู่ใน DOM แม้ไม่ได้เปิด ถ้า gate แค่ที่แท็บ
              ข้อมูลเงินจะยังหลุดไปอยู่ในหน้า */}
          {canSeeMoney && (
            <TabsContent value="money" className="space-y-6">
              <OrderMoneyTab
                order={order}
                subtotalItems={subtotalItems}
                subtotalFees={subtotalFees}
                discount={discount}
                totalAmount={totalAmount}
                totalCost={totalCost}
                hasCostEntries={!!hasCostEntries}
                profitMargin={profitMargin}
              />
            </TabsContent>
          )}

          <TabsContent value="files" className="space-y-6">
            {meQuery.isError ? (
              <QueryError
                message="โหลดสิทธิ์ผู้ใช้ไม่สำเร็จ"
                onRetry={() => void meQuery.refetch()}
              />
            ) : !permissionsReady || !me || attachmentsLoading ? (
              <div role="status" aria-label="กำลังโหลดไฟล์แนบออเดอร์">
                <Skeleton className="h-56 rounded-xl" />
              </div>
            ) : attachmentsError ? (
              <QueryError
                message="โหลดไฟล์แนบออเดอร์ไม่สำเร็จ"
                onRetry={() => void attachmentsQuery.refetch()}
              />
            ) : (
              <OrderFilesCard
                orderId={id}
                attachments={attachmentsQuery.data ?? []}
                userId={me?.id}
                userRole={me?.role}
                onGoToDesign={() => changeTab("production")}
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <OrderRevisions revisions={order.revisions ?? []} />
          </TabsContent>
        </div>
      </div>
      </Tabs>

      {/* ====================================================
          EDIT DIALOGS
      ==================================================== */}
      <OrderInfoEditDialog
        open={showInfoEditDialog}
        onOpenChange={setShowInfoEditDialog}
        order={order}
        focusSection={editSection}
      />
    </div>
  );
}
