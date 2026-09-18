"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { InternalStatus } from "@prisma/client";
import {
  AlertTriangle,
  Box,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Ellipsis,
  Eye,
  Factory,
  FileText,
  ImageIcon,
  Link2,
  PenLine,
  Shirt,
  StickyNote,
  Truck,
  Undo2,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm, usePromptText } from "@/components/ui/confirm-dialog";
import {
  INTERNAL_STATUS_LABELS,
  getFlowSteps,
  getNextStatuses,
  canPermsSetStatus,
  canIssueChangeOrder,
  isOrderLocked,
  isRollbackTransition,
  isMarketplaceChannel,
} from "@/lib/order-status";
import { singleBackStatus } from "@/lib/order-status-rail";
import { permAllows } from "@/lib/permissions";
import { canEditOrderWithPricing } from "@/lib/order-access";
import { buildOrderEditHref, type OrderEditFocus } from "@/lib/order-edit-navigation";
import { OrderDeliveryTab } from "@/components/orders/detail/order-delivery-tab";
import { OrderProductionTab } from "@/components/orders/detail/order-production-tab";
import { OrderFilesTab } from "@/components/orders/detail/order-files-tab";
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
import {
  OrderOverviewTab,
  OrderArtworkCard,
  OrderRevisions,
  nextStepBlockers,
  OrderMoneyTab,
} from "@/components/orders/detail";
import { OrderItemsTab } from "@/components/orders/detail/order-items-tab";
import {
  OrderNextStepGuidance,
  resolveNextStepAction,
} from "@/components/orders/detail/order-next-step-action";
import { OrderDetailHead, OrderStatusSteps } from "@/components/orders/detail/order-detail-head";
import { c, Callout } from "@/components/kit/kit";
import { KitTabs } from "@/components/kit/tabs";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { QueryError } from "@/components/ui/query-error";
import { ProblemCallout } from "@/components/orders/orders-ui";
import { describeOrderAttention } from "@/lib/home-orders";
import { describeOrderProgress, isAttentionStatus } from "@/lib/order-progress";
import { billingOverview } from "@/lib/billing-ui";
import { mockupCoverImage } from "@/lib/mockup";
import { printLabelOf } from "@/lib/print-labels";
import { formatDateCompact } from "@/lib/utils";

/* ============================================================
   หน้าใบออเดอร์ — ต้นแบบรอบ 2 detailPage() ทีละชิ้น
   (รื้อเขียนใหม่ 2026-09-15 หลังเบสบอก "UI มันไม่เหมือนกันเลย … รื้อเขียนใหม่ refactor ไปเลย")

   ป้ายแจ้งเตือนบนสุด (เบสสั่ง 09-13) → ตำแหน่งหน้า → หัวใบ (รูป/เลขที่/สถานะ/ลูกค้า + ปุ่ม) →
   รางสถานะ (ขั้นที่ยืนอยู่เป็นแคปซูล) → แท็บ 7 แท็บ → เนื้อหาแท็บ
   ตรรกะเดิมทั้งหมดคงไว้: สิทธิ์เห็นเงิน/แก้ไข/เดินสถานะ · ด่านพร้อมผลิต · ลิงก์ลูกค้า · แท็บใน URL
   ============================================================ */

function OrderDetailSkeleton() {
  return (
    <div className={c("tokens page")} role="status" aria-label="กำลังโหลดออเดอร์">
      <span className={c("sk")} style={{ height: 18, width: 160 }} />
      <span className={c("sk")} style={{ height: 32, width: "40%" }} />
      <span className={c("sk")} style={{ height: 60 }} />
      <span className={c("sk")} style={{ height: 42 }} />
      <div className={c("two")}>
        <span className={c("sk")} style={{ height: 320 }} />
        <span className={c("sk")} style={{ height: 320 }} />
      </div>
    </div>
  );
}

export default function OrderDetailPage({
  params,
  productionV2Enabled,
}: {
  params: Promise<{ id: string }>;
  productionV2Enabled: boolean;
}) {
  return (
    <Suspense fallback={<OrderDetailSkeleton />}>
      <OrderDetailContent params={params} productionV2Enabled={productionV2Enabled} />
    </Suspense>
  );
}

function OrderDetailContent({
  params,
  productionV2Enabled,
}: {
  params: Promise<{ id: string }>;
  productionV2Enabled: boolean;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptText = usePromptText();
  const confirm = useConfirm();
  /* ── แท็บ (เบสเคาะกลับมาใช้ 2026-08-05) ──
     URL เป็นแหล่งความจริงร่วม แต่ state เก็บใน React — เขียน URL ด้วย history API ตรง ๆ
     ไม่ผ่าน router.replace (router จะรีเฟรช RSC ทั้งหน้าจนสลับแท็บกระตุก) */
  const initialTab = normalizeOrderTab(searchParams.get("tab")) ?? ORDER_DEFAULT_TAB;
  const [tab, setTabState] = useState<TabKey>(initialTab);
  // แท็บที่เคยเข้าแล้วคง DOM ไว้ ไม่ให้ query/UI กระพริบตอนสลับกลับ
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => new Set([ORDER_DEFAULT_TAB, initialTab]));

  const changeTab = useCallback((key: string) => {
    const next = normalizeOrderTab(key) ?? ORDER_DEFAULT_TAB;
    setTabState(next);
    setVisitedTabs((current) => {
      if (current.has(next)) return current;
      const updated = new Set(current);
      updated.add(next);
      return updated;
    });
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    url.hash = "";
    window.history.pushState({}, "", url);
  }, []);

  // ปุ่มย้อนกลับของเบราว์เซอร์ต้องพากลับแท็บเดิม ไม่ใช่เด้งออกจากหน้า
  useEffect(() => {
    const onPop = () => {
      const next = normalizeOrderTab(new URL(window.location.href).searchParams.get("tab")) ?? ORDER_DEFAULT_TAB;
      setTabState(next);
      setVisitedTabs((current) => {
        if (current.has(next)) return current;
        const updated = new Set(current);
        updated.add(next);
        return updated;
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function openItemsEditPage() {
    router.push(buildOrderEditHref(id, { tab: "items", returnTab: "items" }));
  }

  function openInfoEditPage(focus: OrderEditFocus, returnTab: TabKey) {
    router.push(buildOrderEditHref(id, { tab: "intake", focus, returnTab }));
  }
  // ANCHOR ของขั้นต่อไป → สลับไปแท็บที่เกี่ยว (แผนที่เดียวกับ tabForAnchor)
  function handleAnchor(target: "billing" | "design" | "production" | "delivery" | "qc") {
    changeTab(tabForAnchor(target) ?? ORDER_DEFAULT_TAB);
  }

  const { data: order, isLoading, isError, refetch } = trpc.order.getById.useQuery({ id });
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  // นโยบาย ⑦: ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย — รอสิทธิ์ก่อนวาดหน้า ไม่ให้ปุ่ม/แท็บโผล่ภายหลัง
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const deniedTab: TabKey | null = tab === "money" && !canSeeMoney ? "money" : null;
  const showDeliverySection = shouldShowDeliverySection(order?.internalStatus ?? "", Boolean(order?.deliveries?.length));
  // ด่านพร้อมผลิต — ยิงเฉพาะสถานะที่ปุ่มขั้นต่อไปอาจโดนบล็อก (CONFIRMED/ON_HOLD)
  const orderContext = trpc.production.orderContext.useQuery(
    { orderId: id },
    { enabled: !!order && ["CONFIRMED", "ON_HOLD"].includes(order.internalStatus) },
  );
  const utils = trpc.useUtils();
  // จำนวนไฟล์บนหัวแท็บ — key เดียวกับการ์ดม็อกอัพ/แท็บไฟล์ (cache ร่วม ไม่ยิงเพิ่ม)
  const attachmentsQuery = trpc.attachment.listByEntity.useQuery({ entityType: "ORDER", entityId: id });
  // "ตอนนี้" ของหน้า — คิดวันถึงกำหนด/อยู่ขั้นนี้กี่วัน ครั้งเดียวต่อการเปิดหน้า
  const [now] = useState(() => new Date());

  const updateStatus = useMutationWithInvalidation(trpc.order.updateStatus, {
    invalidate: [utils.order.getById, utils.order.list],
    // server มีด่านปฏิเสธ (วงเงินเครดิต/ปิดงานก่อนวางบิลครบ) — ผู้ใช้ต้องเห็นเหตุผล
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "เปลี่ยนสถานะไม่สำเร็จ");
    },
  });

  const duplicateOrder = useMutationWithInvalidation(trpc.order.duplicate, {
    invalidate: [utils.order.list],
    onSuccess: (data: { id: string; filmStockCount?: number }) => {
      if (data.filmStockCount && data.filmStockCount > 0) {
        toast.info(`ลูกค้ามีฟิล์มพร้อมรีดค้าง ${data.filmStockCount} รายการ — เช็คที่คลังฟิล์มก่อนเปิดรอบพิมพ์ใหม่`);
      }
      router.push(`/orders/${data.id}`);
    },
  });

  // จองสต๊อคใหม่หลังแก้ต้นเหตุ — server จำกัดช่วงสถานะก่อนเริ่มผลิต
  const retryReserve = useMutationWithInvalidation(trpc.order.retryStockReservation, {
    invalidate: [utils.order.getById],
    onSuccess: () => toast.success("จองสต๊อคสำเร็จ"),
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "จองสต๊อคไม่สำเร็จ");
    },
  });

  // ลิงก์สถานะลูกค้า: ใช้ token เดิมถ้ายังไม่หมดอายุ ไม่งั้นสร้างใหม่ (generate gate salesUp ฝั่ง server)
  const statusLink = trpc.customerStatus.getLink.useQuery({ orderId: id });
  const generateStatusLink = trpc.customerStatus.generateLink.useMutation();
  async function copyStatusLink() {
    try {
      let tok = statusLink.data?.token ?? null;
      const expired = !statusLink.data?.expiresAt || new Date(statusLink.data.expiresAt) < new Date();
      if (!tok || expired) {
        tok = (await generateStatusLink.mutateAsync({ orderId: id })).token;
        statusLink.refetch();
      }
      const url = `${window.location.origin}/status/${tok}`;
      // วิธีสำรอง (textarea + execCommand) — โฟกัส element เอง ไม่ติด "Document is not focused"
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

  // ลิงก์เก่า ?tab=docs → canonicalize เป็น files ครั้งเดียว
  useEffect(() => {
    const raw = new URL(window.location.href).searchParams.get("tab");
    if (!raw) return;
    const normalized = normalizeOrderTab(raw);
    if (!normalized || normalized === raw) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", normalized);
    window.history.replaceState({}, "", url);
  }, []);

  // deep link ที่ไม่มีสิทธิ์ต้องบอกเหตุผลและ canonicalize URL แทนการตกกลับเงียบ ๆ
  useEffect(() => {
    if (meQuery.isLoading || meQuery.isError || !me) return;
    if (tab !== "money" || canSeeMoney) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", ORDER_DEFAULT_TAB);
    window.history.replaceState({}, "", url);
  }, [canSeeMoney, me, meQuery.isError, meQuery.isLoading, tab]);

  if (isLoading || meQuery.isLoading) return <OrderDetailSkeleton />;
  if (isError || !order || meQuery.isError || !me) {
    return (
      <div className={c("tokens page")}>
        <nav className={c("crumbs")} aria-label="ตำแหน่งหน้า">
          <Link href="/orders">ออเดอร์</Link>
          <ChevronRight aria-hidden="true" />
          <span aria-current="page">{order?.orderNumber ?? "ออเดอร์"}</span>
        </nav>
        {/* ใช้ของกลางชุดเดียวกับหน้าแก้ไขออเดอร์/ใบผลิต: เปิดลิงก์ผิดจะได้เห็นสาเหตุ
            และไม่ได้วงกลมสีเขียว (สงวนไว้ให้ "เคลียร์หมดแล้ว") มาคู่กับคำว่าโหลดพัง
            ไม่ห่อ .card ทับ: RecordNotFound พกการ์ดมาเองแล้วจะได้การ์ดซ้อนการ์ด
            ส่วน QueryError วางเปล่าบนผืนหน้าเหมือนที่ PageShell ทำให้ทุกหน้า */}
        {!isError && !order ? (
          <RecordNotFound what="ออเดอร์ใบนี้" backHref="/orders" backLabel="กลับไปรายการออเดอร์" />
        ) : (
          <QueryError
            message={isError ? "โหลดออเดอร์ไม่สำเร็จ" : "โหลดสิทธิ์ผู้ใช้ไม่สำเร็จ จึงยังเปิดคำสั่งของออเดอร์ไม่ได้"}
            onRetry={() => void (isError ? refetch() : meQuery.refetch())}
          />
        )}
      </div>
    );
  }

  // ----------------------------------------------------------
  // ข้อมูลที่คิดจากใบ
  // ----------------------------------------------------------
  const hasV2Production =
    Boolean(order.productionCompletionOwnerId) ||
    (order.productions ?? []).some(
      (production) =>
        Boolean(production.workOrderNumber) ||
        Boolean(production.completionOwnerStepId) ||
        production.steps.some((step) => step.executionEnabled),
    );
  const flowSteps = getFlowSteps(order.orderType);
  const nextStatuses = getNextStatuses(order.orderType, order.internalStatus);
  // ซ่อนปุ่มที่คนนี้กดแล้ว server ปฏิเสธ (ชุดสิทธิ์จริงเดียวกับด่าน server)
  const roleCanSetStatus = (to: string) => {
    const target = to as InternalStatus;
    if (hasV2Production && target !== "COMPLETED") return false;
    return canPermsSetStatus(me.permissions, order.internalStatus, target, productionV2Enabled);
  };
  /* ถอย "พร้อมส่ง → กำลังแพ็ค" ไม่ได้เมื่อมีใบส่งที่ออกไปแล้ว — ด่านเดียวกับ order.updateStatus
     (ของอยู่กับขนส่ง/ถึงลูกค้าแล้ว ต้องตีกลับใบส่งที่ส่วนจัดส่งก่อน) */
  const shippedOutDeliveries = (order.deliveries ?? []).filter(
    (delivery) => delivery.status === "SHIPPED" || delivery.status === "DELIVERED",
  ).length;
  const backToPackingBlocked =
    order.internalStatus === "READY_TO_SHIP" && shippedOutDeliveries > 0;
  const forwardStatuses = nextStatuses.filter(
    (s) =>
      s !== "CANCELLED" &&
      roleCanSetStatus(s) &&
      !(s === "PACKING" && backToPackingBlocked),
  );
  const canCancel = nextStatuses.includes("CANCELLED") && roleCanSetStatus("CANCELLED");
  // เมนูฝั่งขาย (แก้ข้อมูล/รายการ/สำเนา/ออกใบเสนอ) — server เป็น create_sales_docs
  const isSalesUp = permAllows(me.permissions, "create_sales_docs");
  // ฟอร์มแก้ทั้งใบมีราคา — ขาดสิทธิ์เห็นเงินต้องไม่เปิด route นี้
  const canUseEditForm = canEditOrderWithPricing(me.permissions);
  const canEditReceiveTracking =
    !productionV2Enabled && !hasV2Production && permAllows(me.permissions, ["manage_production", "supervise_operations"]);
  const currentStepIndex = flowSteps.indexOf(order.internalStatus);
  const isCompleted = order.internalStatus === "COMPLETED";
  /* ปุ่มย้อนกลับยกออกมาจากเมนู ⋯ (เบสสั่ง 2026-09-18 "จะได้กดได้ง่ายๆ")
     "ถอย" = ขั้นเป้าหมายอยู่ก่อนขั้นที่ยืนอยู่บนเส้นทางเดียวกับราง (ไม่ใช่ทุกสถานะที่ไปได้)
     โผล่เมื่อมีทางถอยทางเดียวเท่านั้น — ส่งแล้วถอยได้ 2 ทาง (พร้อมส่ง/QC) ยังต้องเลือกในเมนู
     ด่านสิทธิ์/ใบผลิต V2 ใช้ roleCanSetStatus ตัวเดียวกับเมนู จึงไม่มีปุ่มที่กดแล้ว server ปฏิเสธ */
  const backStatus = singleBackStatus({
    flowSteps,
    internalStatus: order.internalStatus,
    allowedTargets: forwardStatuses,
  });
  const backLabel =
    backStatus === null
      ? null
      : isCompleted && backStatus === "SHIPPED"
        ? "เปิดงานกลับ (→ จัดส่งแล้ว)"
        : `ย้อนกลับ: ${INTERNAL_STATUS_LABELS[backStatus as keyof typeof INTERNAL_STATUS_LABELS]}`;
  // เมนูไม่ต้องมีรายการเดียวกับปุ่ม — ทางเดียวต่อหนึ่งเรื่อง
  const menuStatuses = forwardStatuses.filter((status) => status !== backStatus);
  const isMarketplace = isMarketplaceChannel(order.channel);

  const totalCost = order.costEntries?.reduce((sum: number, entry: { amount: number }) => sum + entry.amount, 0) ?? 0;
  const hasCostEntries = order.costEntries && order.costEntries.length > 0;
  // ยอดฝั่งขาย — viewer ที่ไม่เห็นเงิน server ส่ง null → คิดเป็น 0 ได้เพราะ render เฉพาะใต้ gate canSeeMoney
  const subtotalItems =
    order.items?.reduce((sum: number, item: { subtotal: number | null }) => sum + (item.subtotal ?? 0), 0) ?? 0;
  const subtotalFees = order.fees?.reduce((sum: number, fee: { amount: number | null }) => sum + (fee.amount ?? 0), 0) ?? 0;
  const discount = order.discount ?? 0;
  const totalAmount = order.totalAmount ?? subtotalItems + subtotalFees - discount;
  const profitMargin = hasCostEntries && totalAmount > 0 ? ((totalAmount - totalCost) / totalAmount) * 100 : null;

  // แก้ตรงก่อนอนุมัติ หรือออก CO ได้ก่อนเริ่มผลิต — กฎกลางเดียวกับ server
  const canEditItems =
    !hasV2Production &&
    (!isOrderLocked(order.internalStatus as InternalStatus) || canIssueChangeOrder(order.internalStatus as InternalStatus));

  // ขั้นต่อไป — logic lib/order-next-step.ts
  const nextStepInput = buildNextStepInput(order);
  const legacyNextStep = getOrderNextStep(nextStepInput);
  const nextStep =
    productionV2Enabled && ["PRODUCTION_QUEUE", "PRODUCING", "QUALITY_CHECK", "PACKING"].includes(order.internalStatus)
      ? {
          title: "งานกำลังเดินในฝ่ายผลิต",
          description: "ดูสถานะและปัญหาที่หน้างานผลิต ส่วนพนักงานลงมือและปิดขั้นในโหมดสถานี",
          buttonLabel: "เปิดงานผลิต",
          action: { type: "ANCHOR" as const, target: "production" as const },
        }
      : legacyNextStep;
  /* แท็บซ่อนได้ตาม "สิทธิ์" เท่านั้น ห้ามซ่อนตามสถานะ (ตำแหน่งแท็บจะขยับใต้มือ) */
  const visibleTabs = ORDER_TAB_DEFS.filter((t) => t.key !== "money" || canSeeMoney);
  const activeTab: TabKey = visibleTabs.some((t) => t.key === tab) ? tab : ORDER_DEFAULT_TAB;
  /* จุดแดงบนหัวแท็บ — ปลายทางของขั้นต่อไปตัวเดียวกัน ไม่มีตรรกะใหม่ */
  const pendingTab: TabKey | null =
    nextStep?.action.type === "ANCHOR"
      ? tabForAnchor(nextStep.action.target)
      : nextStep?.action.type === "EDIT_ITEMS"
        ? "items"
        : null;

  async function handleStatusChange(newStatus: string) {
    const current = order?.internalStatus ?? "";
    // ถอยข้ามเส้น "ของออกจากโรงงาน/ประกาศกับลูกค้า" (พร้อมส่ง/ส่งแล้ว/ปิดแล้ว) — server บังคับเหตุผล+ผู้จัดการ
    // ใช้ตัวตัดสินตัวเดียวกับ server (lib/order-status) ไม่ลอกเงื่อนไขมาไว้ในหน้า
    const isRollback = isRollbackTransition(current as InternalStatus, newStatus as InternalStatus);

    if (newStatus === "CANCELLED") {
      // บิลค้างต้องเห็นก่อนตัดสินใจ (เบสเคาะ 07-06) — เช็คจากข้อมูลสด server มีด่านเดียวกัน
      const fresh = await utils.order.getById.fetch({ id }).catch(() => null);
      const openBills = ((fresh ?? order)?.invoices ?? []).filter(
        (inv) =>
          !inv.isVoided &&
          ["DEPOSIT_INVOICE", "FINAL_INVOICE", "DEBIT_NOTE"].includes(inv.type) &&
          ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(inv.paymentStatus),
      );
      if (openBills.length > 0) {
        const proceed = await confirm({
          title: `มีบิลค้างชำระ ${openBills.length} ใบ (${openBills.map((inv) => inv.invoiceNumber).join(", ")})`,
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
          current === "READY_TO_SHIP"
            ? "งานนี้แพ็คจบรอของออกจากร้านแล้ว — ระบุเหตุผลที่ต้องกลับไปแพ็คใหม่ จะถูกบันทึกในประวัติ"
            : current === "SHIPPED" && newStatus === "QUALITY_CHECK"
              ? // ขั้นนี้ยังไม่เปิดใบผลิต — reopenProductionsForRework ทำงานตอน ตรวจคุณภาพ → กำลังผลิต
                // เท่านั้น คนที่หยุดแค่ขั้นนี้จะได้ออเดอร์ที่ไม่มีงานโผล่ในจอช่างเลย (ไม่มีอะไรบอก)
                "ของตีกลับมาแก้ — ระบุเหตุผล จะถูกบันทึกในประวัติ · ขั้นนี้ยังไม่เปิดใบผลิต ถอยต่ออีกขั้นถึง \"กำลังผลิต\" ช่างถึงจะเห็นงานแก้ในจอ"
              : "งานนี้ประกาศส่งแล้ว/ปิดแล้ว — ระบุเหตุผล (เช่น ของตีกลับ/กดพลาด) จะถูกบันทึกในประวัติ",
        placeholder: "เหตุผล",
        confirmText: "ยืนยันถอยสถานะ",
        destructive: true,
      });
      if (reason === null || reason === "") return;
      updateStatus.mutate({ id, internalStatus: newStatus as never, reason });
    } else if (newStatus === "COMPLETED") {
      const ok = await confirm({
        title: "ปิดงานออเดอร์นี้?",
        description: "ปิดแล้วแก้รายการ/ตัวเงินไม่ได้อีก — เปิดกลับได้เฉพาะผู้จัดการพร้อมเหตุผล",
        confirmText: "ปิดงาน",
      });
      if (!ok) return;
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    } else if (newStatus === "SHIPPED") {
      const ok = await confirm({
        title: "ยืนยันว่าส่งของแล้ว?",
        description: 'แนะนำให้กด "ส่งของ" ที่ใบส่งในส่วนจัดส่งแทน — เลขพัสดุจะติดออเดอร์และสถานะเดินให้เอง',
        confirmText: "ส่งแล้ว",
      });
      if (!ok) return;
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    } else {
      updateStatus.mutate({ id, internalStatus: newStatus as never });
    }
  }

  /** ปุ่มย้อนกลับที่ยกออกมา — ถามยืนยันทุกครั้งเหมือนปุ่มย้อนขั้นในใบผลิต และบอกผลที่ตามมาของขานั้น
   *  ปุ่มเด่นขึ้นแล้วกดพลาดได้ง่ายขึ้นด้วย · ขาที่ server บังคับเหตุผล (ส่งแล้ว/ปิดงาน)
   *  handleStatusChange ถามอยู่แล้ว จึงไม่ถามซ้อนสองชั้น */
  async function handleStepBack(target: string) {
    const from = order?.internalStatus;
    if (!from) return;
    if (!isRollbackTransition(from, target as InternalStatus)) {
      const consequence =
        from === "QUALITY_CHECK" && target === "PRODUCING"
          ? 'ใบผลิตจะถูกเปิดใหม่และเพิ่มขั้น "งานแก้" ให้ช่างติ๊ก ยอดที่จดไว้ยังอยู่'
          : target === "DESIGNING"
            ? "ใบจะกลับมาแก้รายการ/ราคาได้โดยตรง ไม่ต้องออกใบแก้ไขออเดอร์"
            : "สถานะจะถอยกลับหนึ่งขั้น คนที่รับช่วงขั้นนั้นจะเห็นงานกลับมาในคิว";
      const ok = await confirm({
        title: `${backLabel}?`,
        description: consequence,
        confirmText: "ย้อนกลับ",
      });
      if (!ok) return;
    }
    await handleStatusChange(target);
  }

  // เมนู ⋯ มีของให้เลือกจริงไหม — ไม่มีก็ไม่ต้องมีปุ่ม
  const hasOverflowMenu = isSalesUp || menuStatuses.length > 0 || canCancel;
  // ขา "เปิดงานกลับ" (ปิดงาน → จัดส่งแล้ว) ยกไปเป็นปุ่มย้อนกลับบนหัวใบแล้ว เมนูจึงเหลือป้ายสถานะตรงๆ
  const statusItemLabel = (status: string) =>
    INTERNAL_STATUS_LABELS[status as keyof typeof INTERNAL_STATUS_LABELS];

  /* "ต้องจัดการ" — สูตรเดียวกับหน้าแรกและตาราง: lib/order-progress → lib/home-orders */
  const progress = describeOrderProgress(order, now);
  const attention = describeOrderAttention(progress);
  const hasProduction = (order.productions ?? []).length > 0;
  const attentionAction =
    !attention
      ? null
      : attention.kind === "customer"
        ? { label: "ดูม็อกอัพ", icon: ImageIcon, onClick: () => changeTab("files") }
        : attention.kind === "ready"
          ? { label: "ไปส่วนจัดส่ง", icon: Truck, onClick: () => changeTab("delivery") }
          : hasProduction
            ? { label: "ดูงานผลิต", icon: Factory, onClick: () => changeTab("production") }
            : null;
  // ติดด่านพร้อมผลิต = ปุ่มขั้นต่อไปหาย · เหตุผลและทางแก้ต้องขึ้นบนสุดแทน
  const readiness = orderContext.data?.readiness ?? null;
  const blockers = nextStepBlockers(nextStep, readiness);
  const missingChecks = new Set((readiness?.checks ?? []).filter((check) => !check.ok).map((check) => check.key));



  const printLabel = printLabelOf((order.items ?? []).flatMap((item) => (item.prints ?? []).map((print) => print.printType)));
  // รับเงินแล้วเท่าไร — สูตรกลางเดียวกับการ์ดบิล · คิดเฉพาะคนเห็นเงิน
  const paidAmount = canSeeMoney
    ? billingOverview(
        (order.invoices ?? []).map((invoice) => ({
          type: invoice.type,
          totalAmount: Number(invoice.totalAmount ?? 0),
          amount: Number(invoice.amount ?? 0),
          discount: Number(invoice.discount ?? 0),
          tax: Number(invoice.tax ?? 0),
          isVoided: invoice.isVoided,
          paymentStatus: invoice.paymentStatus,
          forPaymentId: invoice.forPaymentId,
          payments: (invoice.payments ?? []).map((payment) => ({
            amount: Number(payment.amount),
            whtAmount: Number(payment.whtAmount),
          })),
        })),
      ).totalPaid
    : null;
  const cover = order.designs?.[0] ? mockupCoverImage(order.designs[0]) : null;
  const tabCounts: Partial<Record<TabKey, number>> = {
    files: (attachmentsQuery.data?.length ?? 0) + (order.designs?.length ?? 0),
    delivery: order.deliveries?.length ?? 0,
    history: order.revisions?.length ?? 0,
  };
  const onEditItems = canUseEditForm && canEditItems ? openItemsEditPage : undefined;
  const guidance = (
    <OrderNextStepGuidance
      nextStep={nextStep}
      readiness={readiness}
      onEditItems={onEditItems}
      onAnchor={handleAnchor}
      canSeeMoney={canSeeMoney}
    />
  );
  const cta = resolveNextStepAction({
    nextStep,
    readiness,
    onStatus: handleStatusChange,
    onEditItems,
    onAnchor: handleAnchor,
    canSeeMoney,
  });
  const showAttention = Boolean(attention && order.internalStatus !== "ON_HOLD" && attention.kind !== "ready");

  const alerts = [
    blockers.length > 0 ? (
      <Callout
        key="blockers"
        tone="danger"
        role="alert"
        icon={AlertTriangle}
        action={
          <>
            <ul className={c("miss")}>
              {(readiness?.checks ?? []).map((check) => (
                <li key={check.key} className={c(check.ok && "ok")}>
                  {check.ok ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                  {check.label}
                  {check.ok ? "" : ` · ${check.detail}${check.waitingOn ? ` — ${check.waitingOn}` : ""}`}
                </li>
              ))}
            </ul>
            {missingChecks.has("payment") && canSeeMoney ? (
              <button type="button" className={c("btn sm")} onClick={() => handleAnchor("billing")}>
                <Wallet aria-hidden="true" />
                ดูเงินและบิล
              </button>
            ) : null}
            {missingChecks.has("materials") ? (
              <button type="button" className={c("btn sm")} onClick={() => handleAnchor("production")}>
                <Shirt aria-hidden="true" />
                ตรวจเสื้อและใบผลิต
              </button>
            ) : null}
            {missingChecks.has("design") ? (
              <button type="button" className={c("btn sm")} onClick={() => handleAnchor("design")}>
                <ImageIcon aria-hidden="true" />
                ดูม็อกอัพและไฟล์
              </button>
            ) : null}
          </>
        }
      >
        <b>ยังเข้าคิวผลิตไม่ได้</b> · ต้องครบก่อน:
      </Callout>
    ) : null,
    showAttention && attention ? (
      <ProblemCallout
        key="attention"
        problem={attention}
        progress={progress}
        action={
          attentionAction ? (
            <button type="button" className={c("btn sm")} onClick={attentionAction.onClick}>
              <attentionAction.icon aria-hidden="true" />
              {attentionAction.label}
            </button>
          ) : undefined
        }
      />
    ) : null,
    // จองสต๊อคพัง — ด่านพร้อมผลิตกั้นไว้แล้ว แต่คนแก้ต้นเหตุคือคนที่เปิดหน้านี้
    order.stockReservationError ? (
      <Callout
        key="stock"
        tone="danger"
        role="alert"
        icon={Box}
        action={
          isSalesUp && ["CONFIRMED", "DESIGNING", "DESIGN_APPROVED", "PRODUCTION_QUEUE"].includes(order.internalStatus) ? (
            <button
              type="button"
              className={c("btn sm")}
              onClick={() => retryReserve.mutate({ id })}
              disabled={retryReserve.isPending}
            >
              {retryReserve.isPending ? "กำลังจอง..." : "จองใหม่"}
            </button>
          ) : undefined
        }
      >
        <b>จองสต๊อคไม่สำเร็จ</b> · {order.stockReservationError}
      </Callout>
    ) : null,
    // blind ship = ห้ามมีชื่อ/เอกสาร Anajak ในกล่อง · พลาดครั้งเดียวเสียลูกค้าขายซ้ำทั้งราย
    order.blindShip ? (
      <Callout key="blind" icon={Eye}>
        <b>ส่งแบบไม่ระบุผู้ส่ง</b> · ชื่อผู้ส่งบนกล่อง: {order.blindShipSenderName || "ยังไม่ระบุ — ต้องกรอกก่อนแพ็ค"}
      </Callout>
    ) : null,
    order.notes?.trim() ? (
      <Callout key="notes" icon={StickyNote} role="note">
        <b>หมายเหตุใบนี้</b> · {order.notes}
      </Callout>
    ) : null,
    order.internalStatus === "CANCELLED" ? (
      <Callout key="cancelled" tone="danger" icon={X}>
        <b>ยกเลิกแล้ว</b>
        {order.cancelledReason ? ` · ${order.cancelledReason}` : ""}
        {order.cancelledAt ? ` · ${formatDateCompact(order.cancelledAt)}` : ""}
      </Callout>
    ) : null,
    deniedTab === "money" ? (
      <Callout key="denied" tone="danger" role="alert" icon={AlertTriangle}>
        <b>เปิดส่วนเงินและบิลไม่ได้</b> · บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลการเงิน ระบบจึงพากลับมาที่ภาพรวม
      </Callout>
    ) : null,
  ].filter(Boolean);

  const panel = (key: TabKey, children: React.ReactNode) =>
    visitedTabs.has(key) ? (
      <div
        key={key}
        role="tabpanel"
        id={`order-panel-${key}`}
        aria-labelledby={`order-tab-${key}`}
        hidden={activeTab !== key}
        className={c("tabpanel")}
      >
        {children}
      </div>
    ) : null;

  return (
    <div className={c("tokens page")}>
      {/* ป้ายแจ้งเตือนอยู่บนสุดของหน้า (เบสสั่ง 09-13) นอกแท็บโดยตั้งใจ — คนแพ็ค/ช่างต้องเห็นโดยไม่สลับแท็บ */}
      {alerts.length > 0 ? <div className={c("alerts")}>{alerts}</div> : null}

      <nav className={c("crumbs")} aria-label="ตำแหน่งหน้า">
        <Link href="/orders">ออเดอร์</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">{order.orderNumber}</span>
      </nav>

      <OrderDetailHead
        orderNumber={order.orderNumber}
        cover={cover}
        internalStatus={order.internalStatus}
        priority={order.priority}
        actions={
          <>
            {/* ของที่ใช้บ่อยเป็นปุ่มจริง (เบสสั่ง 08-30) — จอแคบเหลือไอคอน ชื่ออยู่ใน aria-label */}
            <a
              href={`/print/job-ticket/${id}`}
              target="_blank"
              rel="noreferrer"
              className={c("btn")}
              aria-label="พิมพ์ใบสั่งงาน (เปิดแท็บใหม่)"
            >
              <ClipboardList aria-hidden="true" />
              <span className={c("lbl")}>ใบสั่งงาน</span>
            </a>
            {isSalesUp ? (
              <button
                type="button"
                className={c("btn")}
                onClick={() => void copyStatusLink()}
                disabled={generateStatusLink.isPending}
                aria-label="คัดลอกลิงก์สถานะสำหรับลูกค้า"
              >
                <Link2 aria-hidden="true" />
                <span className={c("lbl")}>ลิงก์ลูกค้า</span>
              </button>
            ) : null}
            {backStatus && backLabel ? (
              <button
                type="button"
                className={c("btn")}
                onClick={() => void handleStepBack(backStatus)}
                disabled={updateStatus.isPending}
                aria-label={backLabel}
              >
                <Undo2 aria-hidden="true" />
                <span className={c("lbl")}>{backLabel}</span>
              </button>
            ) : null}
            {/* ปุ่มขั้นต่อไป — ทางเดียวที่เช็คด่านพร้อมผลิต · ติดด่านปุ่มหาย แล้วป้ายบนสุดบอกแทน */}
            {cta ? (
              <button
                type="button"
                className={c("btn primary")}
                onClick={cta.run}
                disabled={updateStatus.isPending}
                aria-describedby="order-next-step-guidance"
              >
                {cta.label}
                <ChevronRight aria-hidden="true" />
              </button>
            ) : null}
            {hasOverflowMenu ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button type="button" className={c("btn icon")} aria-label="เพิ่มเติม">
                    <Ellipsis aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={6} className={c("tokens dmenu")}>
                    {isSalesUp ? (
                      <>
                        {canUseEditForm ? (
                          <>
                            <DropdownMenu.Item className={c("mi")} onSelect={() => openInfoEditPage("info", activeTab)}>
                              <FileText aria-hidden="true" />
                              แก้ไขข้อมูลออเดอร์
                            </DropdownMenu.Item>
                            {canEditItems ? (
                              <DropdownMenu.Item className={c("mi")} onSelect={openItemsEditPage}>
                                <PenLine aria-hidden="true" />
                                แก้ไขรายการ
                              </DropdownMenu.Item>
                            ) : null}
                          </>
                        ) : null}
                        <DropdownMenu.Item
                          className={c("mi")}
                          onSelect={() => duplicateOrder.mutate({ id })}
                          disabled={duplicateOrder.isPending}
                        >
                          <Copy aria-hidden="true" />
                          สำเนาออเดอร์
                        </DropdownMenu.Item>
                        {["DRAFT", "INQUIRY"].includes(order.internalStatus) ? (
                          // สะพานใบเสนอ: ออกใบเสนอผูกใบนี้ — ลูกค้าตกลงแล้วยืนยันออเดอร์เดิม ไม่สร้างซ้ำ
                          <DropdownMenu.Item className={c("mi")} onSelect={() => router.push(`/quotations/new?orderId=${id}`)}>
                            <ClipboardList aria-hidden="true" />
                            ออกใบเสนอราคา
                          </DropdownMenu.Item>
                        ) : null}
                      </>
                    ) : null}
                    {/* ถอยไม่ได้ก็ต้องรู้ว่าทำไม — ไม่ปล่อยให้ทางถอยหายเงียบจากทั้งปุ่มและเมนู */}
                    {backToPackingBlocked && roleCanSetStatus("PACKING") ? (
                      <DropdownMenu.Item className={c("mi")} disabled>
                        <Undo2 aria-hidden="true" />
                        ย้อนกลับ: กำลังแพ็ค
                        <small>มีใบส่งที่ออกแล้ว {shippedOutDeliveries} ใบ — ตีกลับใบส่งก่อน</small>
                      </DropdownMenu.Item>
                    ) : null}
                    {menuStatuses.length > 0 ? (
                      <>
                        {isSalesUp ? <DropdownMenu.Separator className={c("sep")} /> : null}
                        {menuStatuses.map((status) => (
                          <DropdownMenu.Item
                            key={status}
                            className={c("mi")}
                            onSelect={() => void handleStatusChange(status)}
                            disabled={updateStatus.isPending}
                          >
                            <ChevronRight aria-hidden="true" />
                            {statusItemLabel(status)}
                          </DropdownMenu.Item>
                        ))}
                      </>
                    ) : null}
                    {canCancel ? (
                      <>
                        <DropdownMenu.Separator className={c("sep")} />
                        <DropdownMenu.Item
                          className={c("mi danger")}
                          onSelect={() => void handleStatusChange("CANCELLED")}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle aria-hidden="true" />
                          ยกเลิกออเดอร์
                        </DropdownMenu.Item>
                      </>
                    ) : null}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : null}
          </>
        }
      />

      <OrderStatusSteps
        flowSteps={flowSteps}
        currentStepIndex={currentStepIndex}
        internalStatus={order.internalStatus}
        revisions={order.revisions ?? []}
        cancelledAt={order.cancelledAt}
        cancelledReason={order.cancelledReason}
      />
      {/* คำอธิบายขั้นต่อไปผูกกับปุ่มผ่าน aria-describedby — เบสไม่เอาบรรทัดคำช่วยใต้ราง (09-13) */}
      {blockers.length === 0 ? <div className={c("sr")}>{guidance}</div> : null}

      <KitTabs
        label="ส่วนของออเดอร์"
        idPrefix="order"
        value={activeTab}
        onChange={changeTab}
        tabs={visibleTabs.map((tab) => ({ key: tab.key, label: tab.label, count: tabCounts[tab.key], pending: pendingTab === tab.key }))}
      />

      {panel(
        "overview",
        <>
          <OrderOverviewTab
            order={order}
            showMoney={canSeeMoney}
            totalAmount={totalAmount}
            totalQuantity={sumOrderQuantity(order.items ?? [])}
            dueInDays={isAttentionStatus(order.internalStatus) ? progress.dueInDays : undefined}
            paidAmount={paidAmount}
            printLabel={printLabel}
            onOpenMoney={canSeeMoney ? () => changeTab("money") : undefined}
            onOpenDelivery={() => changeTab("delivery")}
            onEditInfo={canUseEditForm ? (section) => openInfoEditPage(section, "overview") : undefined}
            artwork={
              <OrderArtworkCard
                orderId={id}
                description={order.description}
                orderType={order.orderType}
                brand={order.brandProfile}
                onOpenFiles={() => changeTab("files")}
              />
            }
            isMarketplace={isMarketplace}
          />
        </>,
      )}

      {panel(
        "items",
        <OrderItemsTab
          orderId={id}
          items={order.items ?? []}
          fees={order.fees ?? []}
          onEditItems={onEditItems}
          showMoney={canSeeMoney}
          canEditReceiveTracking={canEditReceiveTracking}
          totals={{ discount, taxRate: order.taxRate, taxAmount: order.taxAmount, totalAmount }}
          onOpenMoney={canSeeMoney ? () => changeTab("money") : undefined}
        />,
      )}

      {panel(
        "production",
        /* สรุปอ่านอย่างเดียว — ตัวจัดการผลิตจริงอยู่ /production (เบสเคาะแยกโมดูล) · V2 ไม่วางรับของ/QC ในหน้านี้ */
        <OrderProductionTab
          orderId={id}
          order={order}
          productionV2Enabled={productionV2Enabled}
          isManagerUp={permAllows(me.permissions, "supervise_operations")}
          canReceive={permAllows(me.permissions, "manage_delivery")}
          canCount={permAllows(me.permissions, "manage_production")}
          onOpenFiles={() => changeTab("files")}
        />,
      )}

      {panel(
        "delivery",
        /* แท็บอยู่เสมอแม้ยังไม่ถึงเฟส (ซ่อนตามสถานะ = ชุดแท็บเปลี่ยนใต้มือ) · ผู้รับซ้าย ใบส่งของขวา */
        <OrderDeliveryTab
          order={order}
          showDeliverySection={showDeliverySection}
          canEditShipping={canUseEditForm}
          onEditShipping={() => openInfoEditPage("shipping", "delivery")}
        />,
      )}

      {/* ไม่มีสิทธิ์ดูเงิน = ไม่ render ทั้งก้อน (แท็บก็ถูกกรองออกจาก visibleTabs) */}
      {canSeeMoney
        ? panel(
            "money",
            <OrderMoneyTab
              order={order}
              subtotalItems={subtotalItems}
              subtotalFees={subtotalFees}
              discount={discount}
              totalAmount={totalAmount}
              totalCost={totalCost}
              hasCostEntries={!!hasCostEntries}
              profitMargin={profitMargin}
            />,
          )
        : null}

      {panel(
        "files",
        <OrderFilesTab
          orderId={id}
          internalStatus={order.internalStatus}
          orderType={order.orderType}
          canSeeMoney={canSeeMoney}
          userId={me.id}
          userRole={me.role}
        />,
      )}

      {panel("history", <OrderRevisions revisions={order.revisions ?? []} />)}
    </div>
  );
}
