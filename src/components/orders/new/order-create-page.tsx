"use client";

// หน้าเปิดงานใหม่ — โหมดเดียว ไม่ถามชนิดออเดอร์ (ระบบ derive จากเนื้อรายการเอง):
// บังคับแค่ลูกค้า — เปิดงานได้ในไม่กี่วินาทีระหว่างถือแชท
// (ด่านฝั่ง server กันให้: ยืนยันออเดอร์ต้องมีรายการ · ปิดงานต้องวางบิลครบ)
//
// รื้อโครง 2026-06-12 (เบสเคาะ): แตก section เป็น component + ลำดับสายตา 1-2-3
// (ลูกค้า&งาน → รายการ&ราคา → ไฟล์&จัดส่ง กางตลอด) + แถบสรุป/ปุ่ม sticky ล่างจอ
//
// UX แบบ B 2026-08-03 (เบสเคาะจาก mockup): เลิก ledger ผิวเดียว → 4 การ์ดแยกบนพื้นเทา
// เหมือนทั้งเว็บ + PageShell กลาง + แถบขั้นตอนกระโดด · ทุกช่องยังกางครบเหมือนเดิม
// ไม่มีพับซ่อน/wizard/สองฝั่ง ตามมติเดิม

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { InternalStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Section } from "@/components/ui/section";
import {
  Tabs,
  TabsBar,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  ORDER_FORM_TABS,
  ORDER_FORM_DEFAULT_TAB,
  buildOrderFormTabMarks,
  firstErrorTab,
  normalizeOrderFormTab,
  type OrderFormError,
  type OrderFormTabKey,
} from "@/lib/order-form-tabs";
import { PageShell } from "@/components/page-shell";
import { CHANNEL_LABELS } from "@/lib/order-status";
import { type PaymentTermsValue, PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { type PickerCustomer } from "@/components/customers/customer-picker";
import { calculateFormItemSubtotal, calculateOrderSummary } from "@/lib/pricing";
import { cn, formatCurrency } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ProductPickerDialog,
  type SelectedVariantItem,
} from "@/components/product-picker";
import {
  useOrderItemsForm,
  useOrderFeesForm,
  clearOrderDraft,
  loadOrderDraft,
  saveOrderDraft,
  saveOrderDraftIfCurrent,
  ORDER_DRAFT_DEBOUNCE_MS,
  referenceImagesForDraft,
  type OrderDraftData,
} from "@/hooks/use-order-items-form";
import { useOrderHeaderForm } from "@/hooks/use-order-header-form";
import { useOrderShippingState } from "@/hooks/use-order-shipping";
import {
  fillFromCustomer,
  hasAddressContent,
  shouldClearShippingOnCustomerChange,
} from "@/lib/address-fill";
import type { ReferenceImage } from "@/types/order-form";
import {
  itemHasContent,
  validateOrderItem,
  validateOrderItemProduct,
} from "@/types/order-form";
import { mapItemsToMutationInput, mapFeesToMutationInput } from "@/lib/order-mapping";
import { mergeStockVariantsIntoItems } from "@/lib/order-form-stock";
import {
  OrderItemCard,
  OrderItemsListHeader,
  OrderFeeSection,
  OrderShippingSection,
  OrderPriceSummary,
  OrderFormActionBar,
  OrderCatalogAlert,
  OrderCustomerSection,
  OrderDetailFields,
  OrderAttachmentsSection,
} from "@/components/orders/new";
import { useMarginEstimate } from "@/components/orders/new/order-price-summary";
import { FOCUS_BUTTON, RADIUS, SUNK_PANEL, TINT, DISPLAY_AMOUNT } from "@/components/ui/tokens";
import { MoneyInput } from "@/components/ui/number-input";
import {
  buildOrderEditSavePlan,
  getOrderEditBilledFloorState,
  getOrderEditCapability,
  getOrderEditEmptyWorkResiduals,
  requiresOrderEditReason,
  type OrderEditFormSeed,
  type OrderEditFormValues,
} from "@/lib/order-edit-form";
import {
  APP_NAVIGATION_REQUEST_EVENT,
  isAppNavigationRequestEvent,
} from "@/lib/navigation-request";

type OrderFormPageProps =
  | {
      mode?: "create";
      draftScope?: string;
    }
  | {
      mode: "edit";
      orderId: string;
      orderNumber: string;
      internalStatus: InternalStatus;
      initialTab: OrderFormTabKey;
      initialFocus?: "info" | "shipping";
      returnTab?: string;
      orderType: string;
      editSeed: OrderEditFormSeed;
    };

/** id ของ 4 ตอน — เหลือไว้เป็นจุดโฟกัส/scroll-mt ของแต่ละแท็บ
 *  (แถบขั้นตอนที่เคยใช้ id พวกนี้กระโดด ถูกแทนด้วยแท็บแล้ว — เบสสั่ง 2026-08-11) */
const STEP_IDS = {
  intake: "new-order-step-intake",
  items: "new-order-step-items",
  pricing: "new-order-step-pricing",
  attachments: "new-order-step-attachments",
} as const;

export default function OrderFormPage(props: OrderFormPageProps) {
  const isEdit = props.mode === "edit";
  const editSeed = isEdit ? props.editSeed : undefined;
  const draftScope = !isEdit ? props.draftScope : undefined;
  const editOrderId = isEdit ? props.orderId : null;
  const editInitialFocus = isEdit ? props.initialFocus : undefined;
  const editReturnTab = isEdit ? (props.returnTab || "overview") : "overview";
  const canAddPrints =
    !isEdit ||
    props.orderType === "CUSTOM" ||
    ["DRAFT", "INQUIRY"].includes(props.internalStatus);
  const editReturnHref = isEdit
    ? `/orders/${encodeURIComponent(props.orderId)}?tab=${encodeURIComponent(editReturnTab)}`
    : "/orders";
  const router = useRouter();
  const confirmDialog = useConfirm();
  const utils = trpc.useUtils();

  // หัวฟอร์มเป็น state ก้อนเดียวกับ dialog แก้ข้อมูลออเดอร์ — ลดโอกาสเพิ่ม field แล้ว draft หลุด
  const {
    header,
    setField: setHeaderField,
    patch: patchHeader,
    reset: resetHeader,
    isMarketplace,
  } = useOrderHeaderForm(editSeed?.header);
  const {
    customerId,
    channel,
    description,
    deadline,
    notes,
    priority,
    paymentTerms,
    poNumber,
    externalOrderId,
    taxRate,
    discount,
    platformFee,
  } = header;

  const {
    items, setItems,
    addItem, removeItem, updateItem,
    addPrint, removePrint, updatePrint,
    addAddon, removeAddon, updateAddon,
    resetItems,
  } = useOrderItemsForm(editSeed?.items);

  const [expandedItemIdx, setExpandedItemIdx] = useState<number | null>(0);

  const { fees, addFee, removeFee, updateFee, resetFees } = useOrderFeesForm(editSeed?.fees);

  const {
    includeShipping, setIncludeShipping,
    shipping, updateShipping,
    filledFromCustomerId, fillShippingFromCustomer, resetShipping,
    restoreShipping,
    validateShipping, shippingMutationInput,
  } = useOrderShippingState(
    editSeed
      ? {
          includeShipping: editSeed.includeShipping,
          shipping: editSeed.shipping,
        }
      : undefined,
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(
    () => editSeed?.referenceImages ?? [],
  );
  const [formErrors, setFormErrors] = useState<OrderFormError[]>([]);
  const [tab, setTabState] = useState<OrderFormTabKey>(
    () => (isEdit ? props.initialTab : ORDER_FORM_DEFAULT_TAB),
  );
  const [submitted, setSubmitted] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [draftStorageReady, setDraftStorageReady] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const dirtyRef = useRef(false);
  const leavePromptOpenRef = useRef(false);
  const editBackGuardActiveRef = useRef(false);
  const editBackGuardUrlRef = useRef("");
  const pendingEditExitRef = useRef<{
    href: string | null;
    completeNavigation?: () => void;
  } | null>(null);

  const navigateOutOfEdit = useCallback((
    href: string,
    completeNavigation?: () => void,
  ) => {
    dirtyRef.current = false;
    if (editBackGuardActiveRef.current) {
      // ถอยจาก guard entry กลับ entry ฟอร์มฐานก่อน แล้ว onPop ค่อย replace ปลายทาง
      // เพื่อไม่เหลือหน้า edit อยู่ใต้ปุ่ม Back หลังออกจากฟอร์ม
      pendingEditExitRef.current = { href, completeNavigation };
      window.history.back();
      return;
    }
    if (completeNavigation) completeNavigation();
    else router.replace(href);
  }, [router]);

  /* เขียนแท็บลง URL ด้วย history API ตรงๆ ไม่ผ่าน router — router.replace จะรีเฟรช RSC ทั้งหน้า
     (ฟอร์มที่กรอกค้างไว้จะกระตุก) · ใช้ URL เดิมแล้ว set เฉพาะ tab จึงไม่ทับ ?next=quote / ?customerId= */
  const changeTab = useCallback((key: string) => {
    const next = normalizeOrderFormTab(key) ?? ORDER_FORM_DEFAULT_TAB;
    setTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    // หน้าแก้เป็น route ชั่วคราวจากหน้า detail — สลับแท็บต้องไม่กอง edit entries
    // ไว้ข้างหลังจนกดยกเลิกแล้ว Back เด้งกลับเข้าฟอร์มอีก
    if (isEdit) {
      editBackGuardUrlRef.current = url.toString();
      // รักษา state ภายในของ Next และ marker ของ dirty guard ไว้ขณะเปลี่ยนแท็บ
      window.history.replaceState(window.history.state, "", url);
    }
    else window.history.pushState({}, "", url);
    // เนื้อแท็บที่ซ่อนอยู่สูงไม่เท่ากัน — สลับจากแท็บยาวไปแท็บสั้นแล้วจะค้างอยู่กลางจอว่าง
    requestAnimationFrame(() => {
      document.querySelector("main")?.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }, [isEdit]);

  /* อ่านแท็บจาก URL "หลัง mount" ไม่ใช่ตอนตั้งค่าเริ่มต้น — หน้านี้ไม่ได้ห่อด้วย <Suspense>
     (ต่างจากหน้ารายละเอียดออเดอร์) ฝั่ง server จึงมองไม่เห็น searchParams ตอน SSR
     ถ้าอ่านตั้งแต่ตั้งค่าเริ่มต้น server จะได้ "intake" แต่ client ได้ "pricing"
     → hydration mismatch แล้ว React ไม่ patch ให้ = แท็บค้างผิดใบทั้งหน้า (เจอจริง 2026-08-12)
     แลกด้วยการกะพริบ 1 เฟรมตอนเปิดลิงก์ ?tab= ซึ่งเป็นทางเข้าที่ไม่บ่อย */
  useEffect(() => {
    if (isEdit) return;
    const t = normalizeOrderFormTab(new URL(window.location.href).searchParams.get("tab"));
    if (!t) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setTabState(t);
    });
    return () => {
      cancelled = true;
    };
  }, [isEdit]);

  // dirty guard มี history entry URL เดียวกันวางเหนือฟอร์มฐาน: Back ครั้งแรกจึงยังไม่ออก
  // จาก route edit และ Next ไม่มีโอกาส unmount ฟอร์มก่อน dialog ตอบกลับ
  useEffect(() => {
    const onPop = () => {
      const pendingExit = pendingEditExitRef.current;
      if (pendingExit) {
        pendingEditExitRef.current = null;
        editBackGuardActiveRef.current = false;
        if (pendingExit.completeNavigation) pendingExit.completeNavigation();
        else if (pendingExit.href) router.replace(pendingExit.href);
        return;
      }

      const url = new URL(window.location.href);
      if (isEdit && editBackGuardActiveRef.current && dirtyRef.current) {
        const guardUrl = editBackGuardUrlRef.current || url.toString();
        window.history.pushState(
          { ...window.history.state, __orderEditDirtyGuard: editOrderId },
          "",
          guardUrl,
        );
        if (leavePromptOpenRef.current) return;
        leavePromptOpenRef.current = true;
        void confirmDialog({
          title: "ทิ้งการแก้ไขที่ยังไม่ได้บันทึก?",
          description: "หากย้อนกลับตอนนี้ ข้อมูลที่เปลี่ยนในฟอร์มจะหาย",
          confirmText: "ทิ้งการแก้ไข",
          destructive: true,
        }).then((discard) => {
          leavePromptOpenRef.current = false;
          if (!discard) return;
          dirtyRef.current = false;
          editBackGuardActiveRef.current = false;
          // ตอนนี้อยู่ guard entry ที่เพิ่งคืนไว้: ข้ามทั้ง guard + ฟอร์มฐาน
          // ไป history entry ที่ผู้ใช้ตั้งใจกดย้อนกลับหาโดยตรง
          window.history.go(-2);
        });
        return;
      }
      const t = normalizeOrderFormTab(url.searchParams.get("tab"));
      setTabState(t ?? ORDER_FORM_DEFAULT_TAB);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [confirmDialog, editOrderId, isEdit, router]);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // ลูกค้าเลือกผ่าน CustomerPicker (ค้นหา+เพิ่มด่วน) — เก็บ object ที่เลือกไว้ใช้ prefill
  const [selectedCustomer, setSelectedCustomer] = useState<PickerCustomer | null>(
    () => editSeed?.selectedCustomer ?? null,
  );
  // ตอนกู้ draft ห้าม effect "สลับลูกค้า" ล้าง PO ที่เพิ่งกู้กลับมา
  const restoredCustomerIdRef = useRef<string | null>(null);
  const draftStorageReadyRef = useRef(false);
  const skipDraftResaveOnUnmountRef = useRef(false);
  const latestDraftRef = useRef<OrderDraftData | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const draftSaveRevisionRef = useRef(0);
  const cancelPendingDraftSave = useCallback(() => {
    if (draftSaveTimerRef.current === null) return;
    window.clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = null;
  }, []);

  // โหลด draft หลัง mount เท่านั้น — SSR เริ่มด้วยค่ามาตรฐานเหมือน client render แรก
  useEffect(() => {
    if (isEdit) return;
    const draft = loadOrderDraft(draftScope);
    const requestedCustomerId = new URLSearchParams(window.location.search).get("customerId");
    let cancelled = false;
    // localStorage เป็น external source — apply ใน microtask ให้พ้น effect body และ batch state ทุก hook
    queueMicrotask(() => {
      if (cancelled) return;
      if (draft) {
        latestDraftRef.current = draft;
        patchHeader(draft.header);
        setSelectedCustomer(draft.selectedCustomer as PickerCustomer | null);
        setItems(draft.items);
        resetFees(draft.fees);
        restoreShipping({
          includeShipping: draft.includeShipping,
          shipping: draft.shipping,
          filledFromCustomerId: draft.filledFromCustomerId,
        });
        setReferenceImages(draft.referenceImages);
        restoredCustomerIdRef.current = draft.header.customerId || null;
        setRestoredDraft(true);
      }

      draftStorageReadyRef.current = true;
      setDraftStorageReady(true);

      if (!requestedCustomerId || draft?.header.customerId) return;
      void utils.customer.getById.fetch({ id: requestedCustomerId })
        .then((customer) => {
          if (cancelled || !customer) return;
          setHeaderField("customerId", customer.id);
          setSelectedCustomer(customer as unknown as PickerCustomer);
        })
        .catch(() => {
          if (!cancelled) {
            setFormErrors([
              { tab: "intake", message: "เปิดข้อมูลลูกค้าที่เลือกไว้ไม่สำเร็จ — ค้นหาลูกค้าอีกครั้ง" },
            ]);
          }
        });
    });
    return () => {
      cancelled = true;
    };
    // draftScope คงที่ตลอดอายุ route · setter ของ hooks คง identity
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดครั้งเดียวตอน mount
  }, []);

  const draftSnapshot = useMemo<OrderDraftData>(() => ({
    header,
    selectedCustomer,
    items,
    fees,
    includeShipping,
    shipping,
    filledFromCustomerId,
    referenceImages: referenceImagesForDraft(referenceImages),
  }), [
    header,
    selectedCustomer,
    items,
    fees,
    includeShipping,
    shipping,
    filledFromCustomerId,
    referenceImages,
  ]);
  // เซฟทั้งฟอร์มใน envelope เดียว — debounce กัน localStorage เขียนทุก keystroke
  useEffect(() => {
    latestDraftRef.current = draftSnapshot;
    cancelPendingDraftSave();
    if (isEdit) return;
    if (!draftStorageReady || skipDraftResaveOnUnmountRef.current) return;

    const scheduledRevision = ++draftSaveRevisionRef.current;
    const timer = window.setTimeout(() => {
      if (draftSaveTimerRef.current === timer) draftSaveTimerRef.current = null;
      saveOrderDraftIfCurrent(
        draftSnapshot,
        draftScope,
        {
          scheduledRevision,
          currentRevision: draftSaveRevisionRef.current,
          blocked: skipDraftResaveOnUnmountRef.current,
        },
      );
    }, ORDER_DRAFT_DEBOUNCE_MS);
    draftSaveTimerRef.current = timer;

    return () => {
      if (draftSaveTimerRef.current === timer) cancelPendingDraftSave();
      draftSaveRevisionRef.current += 1;
    };
  }, [cancelPendingDraftSave, draftScope, draftSnapshot, draftStorageReady, isEdit]);

  // ปิดแท็บ/กดยกเลิกก่อน debounce ครบก็ต้องเก็บค่าล่าสุด · แต่ success ห้ามชุบ draft กลับหลัง clear
  useEffect(() => () => {
    if (isEdit) return;
    cancelPendingDraftSave();
    draftSaveRevisionRef.current += 1;
    if (
      draftStorageReadyRef.current &&
      !skipDraftResaveOnUnmountRef.current &&
      latestDraftRef.current
    ) {
      saveOrderDraft(latestDraftRef.current, draftScope);
    }
  }, [cancelPendingDraftSave, draftScope, isEdit]);

  const printCatalogQuery = trpc.serviceCatalog.list.useQuery(
    { category: "PRINT", isActive: true },
  );
  const addonCatalogQuery = trpc.serviceCatalog.list.useQuery(
    { category: "ADDON", isActive: true },
  );
  const feeCatalogQuery = trpc.serviceCatalog.list.useQuery(
    { category: "FEE", isActive: true },
  );
  const printCatalog = printCatalogQuery.data;
  const addonCatalog = addonCatalogQuery.data;
  const feeCatalog = feeCatalogQuery.data;
  const catalogError =
    printCatalogQuery.isError ||
    addonCatalogQuery.isError ||
    feeCatalogQuery.isError;

  const createOrder = trpc.order.create.useMutation({
    onSuccess: (data) => {
      skipDraftResaveOnUnmountRef.current = true;
      draftSaveRevisionRef.current += 1;
      cancelPendingDraftSave();
      clearOrderDraft(draftScope);
      utils.order.list.invalidate();
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(
        next === "quote"
          ? `/quotations/new?orderId=${data.id}`
          : `/orders/${data.id}`,
      );
    },
  });

  const saveOrder = trpc.order.saveForm.useMutation({
    onSuccess: (data) => {
      void utils.order.getById.invalidate({ id: data.id });
      void utils.order.list.invalidate();
      void utils.order.changeOrders.invalidate({ id: data.id });
      void utils.attachment.listByEntity.invalidate({
        entityType: "ORDER",
        entityId: data.id,
      });
      if (data.invoicedWarning) {
        toast.warning(
          "ออเดอร์นี้ออกใบกำกับ/มัดจำไปแล้ว — ยอดเปลี่ยน ต้องออกใบลดหนี้/เพิ่มหนี้แยก",
        );
      } else if (data.changeNumber) {
        toast.success(`ออกใบแก้ไขออเดอร์ ${data.changeNumber} แล้ว`);
      } else {
        toast.success("บันทึกการแก้ไขออเดอร์แล้ว");
      }
      navigateOutOfEdit(editReturnHref);
    },
    onError: (error) => {
      toast.error(error.message || "บันทึกการแก้ไขออเดอร์ไม่สำเร็จ");
      requestAnimationFrame(() => {
        errorSummaryRef.current?.scrollIntoView({ block: "center" });
        errorSummaryRef.current?.focus({ preventScroll: true });
      });
    },
  });

  // มีเนื้อรายการจริงไหม — ตัวตัดสินเดียวแทนสวิตช์โหมดเดิม (สอบถาม/ระบุครบ):
  // ไม่มี = เปิดเป็นการสอบถาม (ตีราคาทีหลัง) · มี = validate + ส่งรายการไปคิดเงิน
  const hasItemContent = items.some(itemHasContent);
  useEffect(() => {
    if (isEdit) return;
    if (!deadline) return;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 3) {
      setHeaderField("priority", "URGENT");
    } else if (daysUntil <= 7) {
      setHeaderField("priority", "HIGH");
    }
  }, [deadline, isEdit, setHeaderField]);

  useEffect(() => {
    if (isEdit) return;
    if (isMarketplace && !paymentTerms) {
      setHeaderField("paymentTerms", "COD");
    }
  }, [isEdit, isMarketplace, paymentTerms, setHeaderField]);

  // ราคาช่องทาง marketplace (Shopee/Lazada/TikTok) รวม VAT ในตัวแล้ว — default 7%
  // จะบวกภาษีทับซ้ำ · สลับค่าตามช่องทางให้อัตโนมัติ (ฟอร์มนี้ไม่มีช่องให้กรอกภาษีแล้ว)
  useEffect(() => {
    if (isEdit) return;
    if (isMarketplace && taxRate === 7) setHeaderField("taxRate", 0);
    if (!isMarketplace && taxRate === 0) setHeaderField("taxRate", 7);
  }, [isEdit, isMarketplace, setHeaderField, taxRate]);

  useEffect(() => {
    if (isEdit) return;
    // เลิกเติมที่อยู่ลูกค้าให้เงียบๆ แล้ว (เบสสั่ง 2026-08-12) — เดิมเติมให้แต่ไม่เปิดสวิตช์
    // "จัดส่งตามที่อยู่" ช่องเลยดูเหมือนกรอกแล้วแต่จาง และตอนกดเปิดงานที่อยู่ถูกทิ้งทั้งชุด
    // ไม่มีคำเตือน · ตอนนี้คนกดปุ่ม "ใช้ที่อยู่ลูกค้า" เอง (เห็นชัดว่าที่อยู่มาจากไหน)
    //
    // สิ่งที่ยังต้องกันเหมือนเดิม: ที่อยู่ที่ก๊อปมาจากลูกค้ารายเก่าห้ามค้างเมื่อสลับลูกค้า
    // (ที่อยู่ที่พิมพ์เอง = ที่อยู่ไซต์งาน ยังรักษาไว้)
    if (shouldClearShippingOnCustomerChange(filledFromCustomerId, customerId || null)) {
      resetShipping();
    }
    // customerId เป็น trigger เดียว — filledFromCustomerId เปลี่ยนตอนกดปุ่มเติมเอง ไม่ต้องวิ่งซ้ำ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, isEdit]);

  // ที่อยู่ผู้ติดต่อของลูกค้าที่เลือก — พอก๊อปลงช่องจัดส่งได้ไหม (ปุ่มโผล่เมื่อมีของให้ก๊อปจริง)
  const customerAddressFill = fillFromCustomer(selectedCustomer);
  const canUseCustomerAddress = hasAddressContent(customerAddressFill);

  const isCorporateCustomer = selectedCustomer?.customerType === "CORPORATE";
  useEffect(() => {
    if (isEdit) return;
    if (restoredCustomerIdRef.current === customerId) {
      restoredCustomerIdRef.current = null;
      return;
    }
    // เลขที่ PO ผูกกับลูกค้ารายที่เลือกไว้ตอนนั้น — สลับลูกค้าแล้วค่าเก่าค้างและถูกส่งไปด้วย
    // (บั๊กจาก audit 2026-08-03 · ช่องนี้โผล่เฉพาะนิติบุคคล พอสลับไปบุคคลธรรมดาจะมองไม่เห็นด้วยซ้ำ)
    setHeaderField("poNumber", "");

    if (!selectedCustomer) return;
    if (selectedCustomer.customerType === "CORPORATE") {
      if (selectedCustomer.defaultPaymentTerms && !paymentTerms) {
        setHeaderField("paymentTerms", selectedCustomer.defaultPaymentTerms);
      }
      // นิติบุคคลต้องมีภาษีขาย — ยกเว้นช่องทางมาร์เก็ตเพลสที่ราคารวม VAT อยู่แล้ว
      // (ถ้าดันกลับเป็น 7 จะบวกภาษีทับซ้ำ · เดิมเงื่อนไขนี้พึ่งการที่ผู้ใช้แตะช่องเอง
      //  พอถอดช่องกรอกออกเลยต้องกันที่ตัวเงื่อนไขตรงๆ)
      if (taxRate === 0 && !isMarketplace) {
        setHeaderField("taxRate", 7);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, isEdit]);

  const pricingSummary = useMemo(() => {
    if (!hasItemContent) {
      return { subtotalItems: 0, subtotalFees: 0, platformFee: 0, discount: 0, taxAmount: 0, grandTotal: 0 };
    }
    // สูตร A เดียวกับ server — platformFee ไม่บวกเข้ายอดบิล/ฐาน VAT
    const summary = calculateOrderSummary({
      itemSubtotals: items.map((item) => calculateFormItemSubtotal(item)),
      feeAmounts: fees.map((f) => f.amount),
      discount,
      taxRate,
    });
    return { ...summary, platformFee: isMarketplace ? platformFee : 0 };
  }, [items, fees, platformFee, discount, isMarketplace, taxRate, hasItemContent]);

  const editValues = useMemo<OrderEditFormValues | null>(
    () =>
      isEdit
        ? {
            header,
            items,
            fees,
            includeShipping,
            shipping,
            referenceImages: referenceImages as OrderEditFormValues["referenceImages"],
          }
        : null,
    [fees, header, includeShipping, isEdit, items, referenceImages, shipping],
  );
  const editPlan = useMemo(
    () =>
      isEdit && editValues
        ? buildOrderEditSavePlan(editSeed!.originalSnapshot, editValues)
        : null,
    [editSeed, editValues, isEdit],
  );
  const editCapability = isEdit
    ? getOrderEditCapability(props.internalStatus)
    : "direct";
  const workReadOnly = isEdit && editCapability === "read_only";
  const changeOrderMode = isEdit && editCapability === "change_order";
  const isDirty = Boolean(editPlan?.hasChanges);
  const billedFloorState = isEdit
    ? getOrderEditBilledFloorState({
        capability: editCapability,
        newTotal: pricingSummary.grandTotal,
        billedFloor: editSeed!.billedFloor,
        originalTotal: editSeed!.originalTotal,
      })
    : null;

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (!isEdit) return;

    if (isDirty) {
      if (editBackGuardActiveRef.current) return;
      editBackGuardUrlRef.current = window.location.href;
      window.history.pushState(
        { ...window.history.state, __orderEditDirtyGuard: editOrderId },
        "",
        editBackGuardUrlRef.current,
      );
      editBackGuardActiveRef.current = true;
      return;
    }

    // ผู้ใช้แก้กลับจนเหมือนค่าเดิม: ถอน guard ออกทันที ไม่ให้ Back ครั้งถัดไปดูเหมือนค้าง
    if (
      editBackGuardActiveRef.current &&
      !pendingEditExitRef.current &&
      window.location.pathname.endsWith("/edit")
    ) {
      pendingEditExitRef.current = { href: null };
      window.history.back();
    }
  }, [editOrderId, isDirty, isEdit]);

  useEffect(() => {
    if (!isEdit || !isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, isEdit]);

  const confirmNavigationOutOfEdit = useCallback((
    href: string,
    completeNavigation?: () => void,
  ) => {
    if (leavePromptOpenRef.current) return;
    leavePromptOpenRef.current = true;
    void confirmDialog({
      title: "ทิ้งการแก้ไขที่ยังไม่ได้บันทึก?",
      description: "หากไปหน้าอื่นตอนนี้ ข้อมูลที่เปลี่ยนในฟอร์มจะหาย",
      confirmText: "ทิ้งการแก้ไข",
      destructive: true,
    }).then((discard) => {
      leavePromptOpenRef.current = false;
      if (!discard) return;
      dirtyRef.current = false;
      navigateOutOfEdit(href, completeNavigation);
    });
  }, [confirmDialog, navigateOutOfEdit]);

  // Next <Link> เปลี่ยน route ฝั่ง client จึงไม่ยิง beforeunload — ดัก anchor ภายในแอป
  // ที่ capture phase ให้ครอบทั้ง sidebar/header และลิงก์ในลูก component ของฟอร์ม
  useEffect(() => {
    if (!isEdit || !isDirty) return;
    const onInternalLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      const next = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        next.origin !== current.origin ||
        (next.pathname === current.pathname && next.search === current.search)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      confirmNavigationOutOfEdit(
        `${next.pathname}${next.search}${next.hash}`,
      );
    };
    document.addEventListener("click", onInternalLink, true);
    return () => document.removeEventListener("click", onInternalLink, true);
  }, [confirmNavigationOutOfEdit, isDirty, isEdit]);

  // Command Palette เป็นปุ่มใน portal ไม่ใช่ <a> จึงส่ง request กลางให้ฟอร์ม dirty
  // หยุดไว้ก่อน แล้วค่อย resume หลังผู้ใช้ยืนยันโดยใช้ replace หลังถอน history guard
  useEffect(() => {
    if (!isEdit || !isDirty) return;
    const onNavigationRequest = (event: Event) => {
      if (!isAppNavigationRequestEvent(event)) return;
      const next = new URL(event.detail.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        next.origin !== current.origin ||
        (next.pathname === current.pathname && next.search === current.search)
      ) {
        return;
      }

      event.preventDefault();
      confirmNavigationOutOfEdit(
        `${next.pathname}${next.search}${next.hash}`,
        () => event.detail.proceed("replace"),
      );
    };
    window.addEventListener(APP_NAVIGATION_REQUEST_EVENT, onNavigationRequest);
    return () =>
      window.removeEventListener(APP_NAVIGATION_REQUEST_EVENT, onNavigationRequest);
  }, [confirmNavigationOutOfEdit, isDirty, isEdit]);

  useEffect(() => {
    if (!isEdit || !editInitialFocus) return;
    const frame = requestAnimationFrame(() => {
      const target = document.querySelector(
        `[data-order-edit-focus="${editInitialFocus}"]`,
      );
      target?.scrollIntoView({ block: "start" });
      const control = target?.querySelector<HTMLElement>(
        "input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)",
      );
      control?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [editInitialFocus, isEdit]);

  // กำไรขั้นต้นโดยประมาณ (ก้อน 2 ชิ้น 5b) — เข็มทิศตอนตีราคา เฉพาะ role การเงิน
  // revenue = ฐานก่อน VAT ที่ฟอร์มคำนวณแล้ว (รายการ+ค่าธรรมเนียม−ส่วนลด) — ไม่คิดสูตรใหม่
  // role อื่นโดน FORBIDDEN → ได้ null → ไม่โชว์บล็อกเลย (ไม่มี error UI)
  const marginEstimate = useMarginEstimate(
    items,
    pricingSummary.subtotalItems + pricingSummary.subtotalFees - pricingSummary.discount
  );

  const handleVariantsSelected = (selected: SelectedVariantItem[]) => {
    setItems((prev) => {
      // logic รวมของจากสต๊อกอยู่ที่เดียว (lib/order-form-stock) — ฟอร์มแก้รายการใช้ตัวเดียวกัน
      const { items: merged, targetIdx } = mergeStockVariantsIntoItems(
        prev,
        selected,
        expandedItemIdx,
        { pruneEmpty: !isEdit },
      );
      setExpandedItemIdx(targetIdx);
      return merged;
    });
  };

  /* คืนพร้อม "แท็บที่ต้องไปแก้" — ติดป้ายที่บรรทัด push เดิมทุกจุด ไม่เพิ่มเงื่อนไขใหม่แม้แต่ข้อเดียว
     (กติกาจาก order-form-tabs.ts: จุดแดง/เด้งแท็บ ต้องคิดจากตัวตรวจตัวเดียวกับที่กันบันทึกอยู่แล้ว) */
  const validateForm = (): OrderFormError[] => {
    const errors: OrderFormError[] = [];

    if (isEdit) {
      if (!editPlan?.hasChanges) return errors;

      const emptyWorkResiduals = getOrderEditEmptyWorkResiduals(editPlan, {
        items,
        fees,
        discount,
      });

      if (editPlan.meta?.deadline) {
        const deadlineDate = new Date(`${editPlan.meta.deadline}T23:59:59`);
        if (deadlineDate < new Date()) {
          errors.push({ tab: "intake", message: "กำหนดส่งต้องไม่เป็นวันที่ผ่านมาแล้ว" });
        }
      }
      if (editPlan.shippingChanged) {
        errors.push(
          ...validateShipping().map((message) => ({ tab: "intake" as const, message })),
        );
      }

      if (editPlan.work?.items) {
        const contentItems = items.filter(itemHasContent);
        if (contentItems.length === 0) {
          errors.push({ tab: "items", message: "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ" });
        }
        contentItems.forEach((item, idx) => {
          const itemErrors = validateOrderItem(item);
          const errMsgs = Object.values(itemErrors).filter(Boolean);
          if (errMsgs.length > 0) {
            errors.push({ tab: "items", message: `รายการ #${idx + 1}: ${errMsgs.join(", ")}` });
          }
          item.products.forEach((prod, pIdx) => {
            const prodErrors = validateOrderItemProduct(prod);
            const prodErrMsgs = Object.values(prodErrors).filter(Boolean);
            if (prodErrMsgs.length > 0) {
              errors.push({
                tab: "items",
                message: `รายการ #${idx + 1} สินค้า #${pIdx + 1}: ${prodErrMsgs.join(", ")}`,
              });
            }
          });
        });
      }

      if (emptyWorkResiduals.itemNotes) {
        errors.push({
          tab: "items",
          message:
            "มีหมายเหตุอยู่ในรายการเปล่า — เติมสินค้าให้รายการนั้น หรือลบหมายเหตุก่อนบันทึก",
        });
      }
      if (emptyWorkResiduals.feesWithoutItems) {
        errors.push({
          tab: "pricing",
          message:
            "มีค่าใช้จ่ายที่กรอกไว้ แต่ยังไม่มีรายการสินค้า — เพิ่มรายการสินค้า หรือลบค่าใช้จ่ายก่อนบันทึก",
        });
      }
      if (emptyWorkResiduals.discountWithoutItems) {
        errors.push({
          tab: "pricing",
          message: "ใส่ส่วนลดไว้แต่ยังไม่มีรายการสินค้า — ล้างส่วนลดหรือเพิ่มรายการก่อน",
        });
      }

      if (editPlan.work?.discount !== undefined && hasItemContent) {
        const subtotal = pricingSummary.subtotalItems + pricingSummary.subtotalFees;
        if (discount > subtotal) {
          errors.push({
            tab: "pricing",
            message: `ส่วนลด (${formatCurrency(discount)}) มากกว่ายอดรวมก่อนหักส่วนลด (${formatCurrency(subtotal)})`,
          });
        }
      }
      if (
        !emptyWorkResiduals.itemNotes &&
        !emptyWorkResiduals.feesWithoutItems &&
        !emptyWorkResiduals.discountWithoutItems &&
        requiresOrderEditReason(props.internalStatus, editPlan) &&
        !changeReason.trim()
      ) {
        errors.push({
          tab: "pricing",
          message: "กรุณาระบุเหตุผลการแก้ไขสำหรับใบแก้ไขออเดอร์",
        });
      }
      if (workReadOnly && editPlan.work) {
        errors.push({
          tab: "items",
          message: "สถานะปัจจุบันไม่อนุญาตให้แก้รายการหรือราคา",
        });
      }
      return errors;
    }

    if (!customerId) errors.push({ tab: "intake", message: "กรุณาเลือกลูกค้า" });

    if (deadline) {
      const deadlineDate = new Date(deadline + "T23:59:59");
      if (deadlineDate < new Date()) {
        errors.push({ tab: "intake", message: "กำหนดส่งต้องไม่เป็นวันที่ผ่านมาแล้ว" });
      }
    }

    // ของที่พิมพ์ไว้ในกล่องรายการแต่ระบบจะไม่ส่ง (เพราะยังไม่มีตัวรายการจริง) — ห้ามทิ้งเงียบ
    if (!hasItemContent) {
      const hasFeeContent = fees.some((f) => f.name || f.feeType || f.amount > 0);
      const hasItemNotes = items.some((it) => it.notes?.trim());
      if (hasFeeContent || hasItemNotes) {
        errors.push({
          tab: "pricing",
          message:
            "มีค่าใช้จ่าย/หมายเหตุที่กรอกไว้ แต่ยังไม่มีรายการสินค้า — เพิ่มรายการสินค้า หรือลบข้อมูลนั้นออกก่อนเปิดงาน",
        });
      }
      if (discount > 0) {
        errors.push({
          tab: "pricing",
          message: "ใส่ส่วนลดไว้แต่ยังไม่มีรายการสินค้า — ล้างส่วนลดหรือเพิ่มรายการก่อน",
        });
      }
    }

    if (hasItemContent) {
      items.forEach((item, idx) => {
        const itemErrors = validateOrderItem(item);
        const errMsgs = Object.values(itemErrors).filter(Boolean);
        if (errMsgs.length > 0) {
          errors.push({ tab: "items", message: `รายการ #${idx + 1}: ${errMsgs.join(", ")}` });
        }
        item.products.forEach((prod, pIdx) => {
          const prodErrors = validateOrderItemProduct(prod);
          const prodErrMsgs = Object.values(prodErrors).filter(Boolean);
          if (prodErrMsgs.length > 0) {
            errors.push({
              tab: "items",
              message: `รายการ #${idx + 1} สินค้า #${pIdx + 1}: ${prodErrMsgs.join(", ")}`,
            });
          }
        });
      });

      const subtotal = pricingSummary.subtotalItems + pricingSummary.subtotalFees;
      if (discount > subtotal) {
        errors.push({
          tab: "pricing",
          message: `ส่วนลด (${formatCurrency(discount)}) มากกว่ายอดรวมก่อนหักส่วนลด (${formatCurrency(subtotal)})`,
        });
      }
    }

    // ที่อยู่จัดส่งอยู่ในแท็บรับเรื่อง — ข้อความจาก validateShipping() ใช้ของเดิมทั้งชุด
    errors.push(
      ...validateShipping().map((message) => ({ tab: "intake" as const, message })),
    );

    return errors;
  };

  const buildMutationInput = () => ({
    channel: channel as "SHOPEE" | "LAZADA" | "TIKTOK" | "LINE" | "WALK_IN" | "PHONE" | "WEBSITE",
    customerId,
    description: description || undefined,
    deadline: deadline || undefined,
    notes: notes || undefined,
    externalOrderId: isMarketplace && externalOrderId ? externalOrderId : undefined,
    platformFee: isMarketplace && platformFee ? platformFee : undefined,
    discount,
    isDraft: false,
    priority,
    paymentTerms: (paymentTerms || undefined) as PaymentTermsValue | undefined,
    poNumber: poNumber || undefined,
    taxRate,
    ...(shippingMutationInput() && { shippingAddress: shippingMutationInput() }),
    items: hasItemContent ? mapItemsToMutationInput(items) : [],
    fees: hasItemContent ? mapFeesToMutationInput(fees) : [],
    referenceImages: referenceImages.map((img) => ({
      fileUrl: img.fileUrl,
      fileName: img.fileName,
      fileSize: img.fileSize,
      printPosition: img.printPosition || undefined,
    })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    setFormErrors(errors);
    setSubmitted(true);
    if (errors.length > 0) {
      /* เด้งไปแท็บแรกที่ติดให้เอง — ถ้าไม่ทำ อาการที่คนใช้เจอคือ "กดบันทึกแล้วไม่มีอะไรเกิดขึ้น"
         เพราะข้อความ error ชี้ไปที่ช่องในแท็บที่เขามองไม่เห็น (แย่กว่าฟอร์มเลื่อนยาวแบบเดิม)
         ต้องสลับแท็บ "ก่อน" แล้วรอ 1 เฟรมค่อย focus — เนื้อแท็บที่ซ่อนเป็น display:none จึง focus ไม่ติด */
      const target = firstErrorTab(errors);
      if (target && target !== tab) changeTab(target);
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    if (isEdit) {
      if (!editPlan?.hasChanges || !editOrderId) return;
      const changedGroups = [
        editPlan.headerChanged || editPlan.shippingChanged ? "ข้อมูลออเดอร์" : null,
        editPlan.work ? "รายการและราคา" : null,
        editPlan.referenceImages ? "ไฟล์อ้างอิง" : null,
      ].filter((group): group is string => Boolean(group));
      const ok = await confirmDialog({
        title: changeOrderMode && editPlan.work
          ? `บันทึกและออกใบแก้ไข ${props.orderNumber}?`
          : `บันทึกการแก้ไข ${props.orderNumber}?`,
        description: `ส่วนที่เปลี่ยน: ${changedGroups.join(" · ")}`,
        confirmText: changeOrderMode && editPlan.work
          ? "บันทึกและออกใบแก้ไข"
          : "บันทึกการแก้ไข",
      });
      if (!ok) return;
      saveOrder.mutate({
        id: editOrderId,
        expectedUpdatedAt: editSeed!.expectedUpdatedAt,
        ...(editPlan.work?.items !== undefined
          ? { expectedItemsFingerprint: editSeed!.expectedItemsFingerprint }
          : {}),
        ...(editPlan.work?.fees !== undefined
          ? { expectedFeesFingerprint: editSeed!.expectedFeesFingerprint }
          : {}),
        ...(editPlan.referenceImages !== undefined
          ? {
              expectedReferenceImagesFingerprint:
                editSeed!.expectedReferenceImagesFingerprint,
            }
          : {}),
        ...(editPlan.meta ? { meta: editPlan.meta } : {}),
        ...(editPlan.work ? { work: editPlan.work } : {}),
        ...(editPlan.referenceImages
          ? { referenceImages: editPlan.referenceImages }
          : {}),
        ...(changeOrderMode && editPlan.work
          ? { reason: changeReason.trim() }
          : {}),
      });
      return;
    }

    const totalProducts = items.reduce((s, it) => s + it.products.length, 0);
    const dialogTitle = `เปิดงานของ ${selectedCustomer?.name ?? "ลูกค้า"}?`;
    const ok = await confirmDialog(
      hasItemContent
        ? {
            title: dialogTitle,
            description: `${items.length} รายการ (${totalProducts} สินค้า) · ยอดรวม ${formatCurrency(pricingSummary.grandTotal)}`,
            confirmText: "เปิดงาน",
          }
        : {
            title: dialogTitle,
            description: "ยังไม่ใส่รายการ/ราคา — งานจะเริ่มเป็นการสอบถาม เติมรายละเอียดที่หน้าออเดอร์ได้",
            confirmText: "เปิดงาน",
          }
    );
    if (!ok) return;

    createOrder.mutate(buildMutationInput());
  };

  /* จุดเขียว/จุดแดงบนหัวแท็บ — ค่าบูลีน 4 ตัวชุดเดียวกับแถบขั้นตอนเดิม + ผลจาก validateForm ตัวเดิม
     (ตรรกะรวมอยู่ใน lib/order-form-tabs.ts ที่มีเทสคุม — ห้ามเขียนกฎครบ/ไม่ครบขึ้นใหม่ที่นี่) */
  const tabMarks = buildOrderFormTabMarks({
    filled: {
      intake: !!customerId,
      items: hasItemContent,
      pricing: pricingSummary.grandTotal > 0,
      attachments: referenceImages.length > 0,
    },
    errors: formErrors,
    submitted,
  });

  const showDraftBanner = restoredDraft;
  const resetDraft = () => {
    draftSaveRevisionRef.current += 1;
    cancelPendingDraftSave();
    clearOrderDraft(draftScope);
    latestDraftRef.current = null;
    restoredCustomerIdRef.current = null;
    resetHeader();
    setSelectedCustomer(null);
    resetItems();
    resetFees();
    resetShipping();
    setReferenceImages([]);
    setExpandedItemIdx(0);
    setFormErrors([]);
    setSubmitted(false);
    setRestoredDraft(false);
    setTabState(ORDER_FORM_DEFAULT_TAB);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", ORDER_FORM_DEFAULT_TAB);
    window.history.replaceState({}, "", url);
  };

  const formPending = isEdit ? saveOrder.isPending : createOrder.isPending;
  const handleCancel = async () => {
    if (formPending) return;
    if (isEdit && isDirty) {
      const discard = await confirmDialog({
        title: "ทิ้งการแก้ไขที่ยังไม่ได้บันทึก?",
        description: "ข้อมูลที่เปลี่ยนในหน้านี้จะหาย และออเดอร์จะยังคงข้อมูลเดิม",
        confirmText: "ทิ้งการแก้ไข",
        destructive: true,
      });
      if (!discard) return;
    }
    if (isEdit) navigateOutOfEdit(editReturnHref);
    else router.push(editReturnHref);
  };

  return (
    <PageShell
      width="wide"
      breadcrumb={isEdit
        ? [
            { label: "ออเดอร์" },
            { label: props.orderNumber },
            { label: "แก้ไข" },
          ]
        : [
            { label: "ออเดอร์", href: "/orders" },
            { label: "เปิดงานใหม่" },
          ]}
      title={isEdit ? `แก้ไข ${props.orderNumber}` : "เปิดงานใหม่"}
      action={isEdit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={formPending}
          onClick={() => void handleCancel()}
          className="gap-1.5"
        >
          <ArrowLeft aria-hidden="true" />
          กลับหน้าออเดอร์
        </Button>
      ) : undefined}
    >
      {!isEdit && showDraftBanner && (
        <div className={cn(TINT.warning, "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-xs")}>
          <span>
            พบข้อมูลร่างที่ยังไม่ได้บันทึก — กรอกต่อจากเดิมหรือเริ่มใหม่?
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetDraft}
            className="ml-auto"
          >
            เริ่มใหม่
          </Button>
        </div>
      )}

      {changeOrderMode && (
        <Alert variant="warning" title="การแก้รายการหรือราคาจะออกใบแก้ไขออเดอร์">
          ข้อมูลรับเรื่องและจัดส่งยังบันทึกได้ตามปกติ ส่วนรายการ ค่าใช้จ่าย และส่วนลดต้องระบุเหตุผลก่อนบันทึก
        </Alert>
      )}
      {workReadOnly && (
        <Alert variant="warning" title="รายการและราคาถูกล็อกตามสถานะงาน">
          ยังแก้รายละเอียด หมายเหตุ ที่อยู่จัดส่ง และไฟล์อ้างอิงได้
        </Alert>
      )}

      {/* noValidate: ใช้ validateForm (กล่อง error เดียว) แทน native validation —
          ยิ่งสำคัญตอนเป็นแท็บ เพราะตอนนี้มี input ที่ display:none จริงๆ แล้ว
          (TabsContent ซ่อนด้วย CSS ไม่ถอด DOM — ของที่พิมพ์ค้างจึงไม่หายตอนสลับแท็บ)

          form ต้องครอบ <Tabs> ทั้งก้อน ไม่ใช่ครอบทีละ TabsContent — ไม่งั้นปุ่มบันทึก
          ที่อยู่นอกแท็บ (แถบล่าง sticky) จะไม่ผูกกับฟอร์ม */}
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {formErrors.length > 0 && (
          <Alert
            ref={errorSummaryRef}
            variant="error"
            title={`กรุณาแก้ไข ${formErrors.length} จุด`}
            aria-live="assertive"
            tabIndex={-1}
            className={cn("outline-none", FOCUS_BUTTON)}
          >
            {/* ทุกข้อมีปุ่มพาไปแท็บที่ต้องแก้ — ข้อความอย่างเดียวไม่พอแล้วเมื่อเนื้อหาถูกซ่อน */}
            <ul className="list-inside list-disc space-y-1">
              {formErrors.map((error, i) => (
                <li key={`${error.tab}-${i}`}>
                  {error.message}
                  {error.tab !== tab && (
                    <button
                      type="button"
                      onClick={() => changeTab(error.tab)}
                      className={cn(
                        "ml-2 rounded text-xs font-medium underline underline-offset-2",
                        FOCUS_BUTTON,
                      )}
                    >
                      ไปแก้ที่แท็บ{ORDER_FORM_TABS.find((t) => t.key === error.tab)?.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {(isEdit ? saveOrder.isError : createOrder.isError) && (
          <Alert variant="error">
            {isEdit ? saveOrder.error?.message : createOrder.error?.message}
          </Alert>
        )}

        <OrderCatalogAlert
          hasError={catalogError}
          onRetry={() => {
            if (printCatalogQuery.isError) void printCatalogQuery.refetch();
            if (addonCatalogQuery.isError) void addonCatalogQuery.refetch();
            if (feeCatalogQuery.isError) void feeCatalogQuery.refetch();
          }}
        />

        <Tabs value={tab} onValueChange={changeTab}>
          {/* sticky — เลื่อนลงไปลึกแค่ไหนก็ยังสลับแท็บได้ (ที่เดียวกับที่แถบขั้นตอนเดิมอยู่)
              TabsBar = พื้นรองที่ทำให้เนื้อหาไม่วิ่งทะลุขึ้นมาอยู่ข้างแท็บ */}
          <TabsBar>
            <TabsList aria-label={isEdit ? "ตอนของฟอร์มแก้ออเดอร์" : "ตอนของฟอร์มเปิดงาน"}>
              {tabMarks.map((t) => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  hasPending={t.red}
                  aria-label={
                    t.red
                      ? `${t.label} — มี ${t.errors.length} จุดต้องแก้`
                      : t.green
                        ? `${t.label} — กรอกแล้ว`
                        : undefined
                  }
                >
                  {t.label}
                  {/* จุดเขียว = มีข้อมูลแล้ว · จุดแดงมาจาก hasPending ของ TabsTrigger (แดงชนะเขียว) */}
                  {t.green && !t.red && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </TabsBar>

          <TabsContent value="intake" keepMounted className="mt-6 space-y-4">
          {/* รับเรื่อง — ลูกค้าเป็นช่องบังคับเพียงช่องเดียว */}
          <Section
            id={STEP_IDS.intake}
            tabIndex={-1}
            className={cn("scroll-mt-16 outline-none", FOCUS_BUTTON)}
          >
            <div className="space-y-4">
              <OrderCustomerSection
                customerId={customerId}
                selectedCustomer={selectedCustomer}
                invalid={submitted && !customerId}
                lockedReason={isEdit ? "ลูกค้าผูกกับออเดอร์และประวัติเดิมแล้ว — หากเลือกผิดให้ยกเลิกใบและเปิดใหม่" : undefined}
                onSelect={(id, customer) => {
                  setHeaderField("customerId", id);
                  setSelectedCustomer(customer);
                }}
              />
              <div data-order-edit-focus="info" className="scroll-mt-24">
                <OrderDetailFields
                  deadline={deadline}
                  onDeadlineChange={(value) => setHeaderField("deadline", value)}
                  priority={priority}
                  onPriorityChange={(value) => setHeaderField("priority", value)}
                  channel={channel}
                  onChannelChange={(value) => setHeaderField("channel", value)}
                  channelLockedReason={isEdit ? "ช่องทางผูกกับเลขออเดอร์และสูตรภาษีเดิม จึงเปลี่ยนไม่ได้" : undefined}
                  isMarketplace={isMarketplace}
                  externalOrderId={externalOrderId}
                  onExternalOrderIdChange={(value) => setHeaderField("externalOrderId", value)}
                  description={description}
                  onDescriptionChange={(value) => setHeaderField("description", value)}
                  notes={notes}
                  onNotesChange={(value) => setHeaderField("notes", value)}
                  showGuidance={false}
                />
              </div>
            </div>
          </Section>

          {/* ที่อยู่ยังอยู่ในแท็บรับเรื่องตาม flow สนทนากับลูกค้า แต่เป็นคนละก้อนงาน
              จึงแยกเป็น sibling card ให้สแกน/เลื่อนไปแก้ได้ชัดทั้ง create และ edit */}
          <div data-order-edit-focus="shipping" className="scroll-mt-24">
            <OrderShippingSection
              includeShipping={includeShipping}
              onIncludeShippingChange={setIncludeShipping}
              shipping={shipping}
              onUpdate={updateShipping}
              showGuidance={false}
              collapseWhenInactive
              onUseCustomerAddress={
                canUseCustomerAddress
                  ? () => fillShippingFromCustomer(customerAddressFill, customerId || null)
                  : undefined
              }
            />
          </div>
          </TabsContent>

          <TabsContent value="items" keepMounted className="mt-6">
          <fieldset
            id={STEP_IDS.items}
            disabled={workReadOnly}
            tabIndex={-1}
            aria-labelledby="new-order-items-heading"
            className={cn("m-0 min-w-0 scroll-mt-16 space-y-4 border-0 p-0 outline-none", FOCUS_BUTTON)}
          >
            <OrderItemsListHeader
              headingId="new-order-items-heading"
              itemIdPrefix="new-order-item"
              title="รายการงาน"
              count={items.length}
              onAdd={() => {
                addItem();
                setExpandedItemIdx(items.length);
              }}
            />

            {/* หนึ่งรายการต่อหนึ่ง card — ไม่มี outer card ครอบ list ซ้ำ */}
            <div role="list" className="space-y-4">
              {items.map((item, itemIdx) => (
                <OrderItemCard
                  key={itemIdx}
                  cardId={`new-order-item-${itemIdx + 1}`}
                  item={item}
                  itemIdx={itemIdx}
                  canRemove={items.length > 1}
                  isExpanded
                  compact
                  allItems={items}
                  printCatalog={printCatalog}
                  addonCatalog={addonCatalog}
                  showPrints={canAddPrints}
                  showAddons={canAddPrints}
                  onUpdateItem={updateItem}
                  onRemoveItem={(idx) => { removeItem(idx); if (expandedItemIdx === idx) setExpandedItemIdx(null); else if (expandedItemIdx != null && expandedItemIdx > idx) setExpandedItemIdx(expandedItemIdx - 1); }}
                  onAddPrint={addPrint}
                  onRemovePrint={removePrint}
                  onUpdatePrint={updatePrint}
                  onAddAddon={addAddon}
                  onRemoveAddon={removeAddon}
                  onUpdateAddon={updateAddon}
                  onOpenPicker={() => setPickerOpen(true)}
                  // setter ตรง — updater(items) แบบ eager ทำ multi-update ใน tick เดียวทับกันเอง
                  onSetItems={setItems}
                />
              ))}
            </div>
          </fieldset>
          </TabsContent>

          <TabsContent value="pricing" keepMounted className="mt-6">
          <Section
            id={STEP_IDS.pricing}
            tabIndex={-1}
            className={cn("scroll-mt-16 outline-none", FOCUS_BUTTON)}
          >
            {/* เรียงลงคอลัมน์เดียว (เบสเคาะ 2026-08-04 "ไม่ต้องแบ่ง 2 ฝั่งละ") —
                ลองแบ่งซ้าย/ขวามา 3 รอบแล้วไม่ลงตัว เลิกแบ่ง แต่คงของที่ดีขึ้นไว้ทั้งหมด:
                ไม่มีเส้นคั่นสักเส้น · ส่วนลดท้ายบิลอยู่ฝั่งช่องกรอก · สรุปยอดเป็นก้อนพื้นจมปิดท้าย */}
            <div className="space-y-6">
              <div className="space-y-6">
                <fieldset disabled={workReadOnly} className="m-0 min-w-0 border-0 p-0">
                  <OrderFeeSection
                    fees={fees}
                    onAddFee={addFee}
                    onRemoveFee={removeFee}
                    onUpdateFee={updateFee as (idx: number, field: string, value: unknown) => void}
                    feeCatalog={feeCatalog}
                    embedded
                  />
                </fieldset>

                {/* ไม่มีช่อง "ภาษี (%)" แล้ว (เบสเคาะ 2026-08-04 "vat 7% ไม่ต้องมีให้กรอกก็ได้") —
                    ระบบตั้งให้เอง: ปกติ 7% · ช่องทางมาร์เก็ตเพลสเป็น 0% (ราคารวม VAT อยู่แล้ว)
                    อัตราจริงยังเห็นได้ที่บรรทัด VAT ในสรุปยอด · งานยกเว้นภาษีแก้ที่หน้าออเดอร์ */}
                <Section title="เงื่อนไขการขาย" bordered={false} headingLevel={3}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="เงื่อนไขชำระ" id="order-payment-terms">
                      <Select
                        value={paymentTerms}
                        onChange={(e) => setHeaderField("paymentTerms", e.target.value)}
                        disabled={isEdit && editCapability !== "direct"}
                      >
                        <option value="">ไม่ระบุ</option>
                        {Object.entries(PAYMENT_TERMS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {/* ส่วนลดท้ายบิลเป็น "ช่องกรอก" — ย้ายมาอยู่ฝั่งช่องกรอก
                        (เดิมแอบอยู่ในรายการตัวเลขอ่านอย่างเดียวของสรุปยอด คนไม่รู้ว่ากรอกได้) */}
                    <Field label="ส่วนลดท้ายบิล" id="order-discount">
                      <MoneyInput
                        id="order-discount"
                        value={discount}
                        onValueChange={(value) => setHeaderField("discount", value)}
                        disabled={workReadOnly}
                      />
                    </Field>
                    {isEdit && (
                      <Field
                        label="ภาษีมูลค่าเพิ่ม (%)"
                        id="order-tax-rate"
                        description={editCapability !== "direct" ? "แก้ไม่ได้หลังอนุมัติรายการ" : "คงอัตราเดิมไว้ เว้นแต่งานนี้ได้รับการยกเว้นภาษี"}
                      >
                        <Input
                          id="order-tax-rate"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={taxRate}
                          onChange={(e) => setHeaderField("taxRate", Number(e.target.value) || 0)}
                          disabled={editCapability !== "direct"}
                        />
                      </Field>
                    )}
                    {isMarketplace && (
                      <Field
                        label={`ค่าธรรมเนียม ${CHANNEL_LABELS[channel]}`}
                        id="order-platform-fee"
                        help="หักจากยอดโอนเข้าร้านและไม่รวมในยอดบิล"
                      >
                        <MoneyInput
                          id="order-platform-fee"
                          value={platformFee}
                          onValueChange={(value) => setHeaderField("platformFee", value)}
                          disabled={isEdit && editCapability !== "direct"}
                        />
                      </Field>
                    )}
                    {isCorporateCustomer && (
                      <Field label="เลขที่ PO" id="order-po-number">
                        <Input
                          value={poNumber}
                          onChange={(e) => setHeaderField("poNumber", e.target.value)}
                          placeholder="PO Number"
                        />
                      </Field>
                    )}
                  </div>
                </Section>

                {changeOrderMode && (
                  <Field
                    label="เหตุผลการแก้ไขออเดอร์"
                    id="order-change-reason"
                    required={Boolean(editPlan?.work)}
                    description="ใช้ประกอบใบแก้ไขและประวัติการเปลี่ยนแปลง เมื่อมีการแก้รายการ ค่าใช้จ่าย หรือส่วนลด"
                  >
                    <Textarea
                      id="order-change-reason"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      rows={3}
                      placeholder="เช่น ลูกค้าเพิ่มจำนวนและเปลี่ยนตำแหน่งพิมพ์"
                    />
                  </Field>
                )}
                {billedFloorState && (
                  <Alert variant="warning" className="text-xs font-medium">
                    {billedFloorState === "credit_note"
                      ? `ยอดใหม่ ${formatCurrency(pricingSummary.grandTotal)} ต่ำกว่ายอดบิลที่ออกแล้ว ${formatCurrency(editSeed!.billedFloor)} — ออกใบแก้ไขได้ แต่ต้องออกใบลดหนี้ตามให้ยอดบิลตรงยอดจริง`
                      : `ยอดใหม่ ${formatCurrency(pricingSummary.grandTotal)} ต่ำกว่ายอดบิลที่ออกแล้ว ${formatCurrency(editSeed!.billedFloor)} — บันทึกไม่ผ่าน ต้องยกเลิกบิลเดิมและออกใหม่ตามยอดที่ถูกก่อนลดยอด`}
                  </Alert>
                )}
              </div>

              {/* สรุปยอดเป็นก้อนพื้นจม — อ่านออกทันทีว่านี่คือผลลัพธ์ ไม่ใช่ช่องให้กรอกต่อ */}
              <div className={cn(RADIUS.surface, SUNK_PANEL, "p-5")}>
                <OrderPriceSummary
                  pricingSummary={pricingSummary}
                  showFeeSections={true}
                  isMarketplace={isMarketplace}
                  channelLabel={CHANNEL_LABELS[channel]}
                  taxRate={taxRate}
                  platformFee={platformFee}
                  discount={discount}
                  marginEstimate={marginEstimate}
                  embedded
                />
              </div>
            </div>
          </Section>
          </TabsContent>

          {/* ไฟล์แนบเป็นแท็บสุดท้าย (เดิมอยู่ล่างสุดของฟอร์ม เบสสั่ง 2026-08-04)
              — เป็นของที่แนบทีหลังได้เสมอ ไม่ควรขวางทางระหว่างกรอกลูกค้า→รายการ→ราคา */}
          <TabsContent value="attachments" keepMounted className="mt-6">
          <OrderAttachmentsSection
            id={STEP_IDS.attachments}
            images={referenceImages}
            onImagesChange={setReferenceImages}
            className={cn("scroll-mt-16 outline-none", FOCUS_BUTTON)}
          />
          </TabsContent>
        </Tabs>

          {/* อยู่ท้ายฟอร์มตาม flow ทุกขนาด — sticky bottom เคยรับ pointer แทน field ที่เลื่อน
              อยู่ด้านหลังทั้ง desktop/mobile และ padding เพิ่มก็แก้การวางทับระหว่างเลื่อนไม่ได้ */}
          <OrderFormActionBar
            data-order-submit-bar=""
            summary={
              hasItemContent ? (
                <>
                  {/* ชื่อเดียวกับบรรทัดสุดท้ายของ "สรุปยอด" — เดิมเรียก "ยอดรวม" กับ
                      "ยอดรวมทั้งหมด" คนละที่คนละขนาด อ่านแล้วไม่แน่ใจว่าเลขเดียวกันไหม */}
                  <p className="text-xs text-muted">
                    ยอดรวมทั้งหมด{taxRate > 0 ? " (รวม VAT)" : ""}
                  </p>
                  <p className={cn("truncate", DISPLAY_AMOUNT)}>
                    {formatCurrency(pricingSummary.grandTotal)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">
                  ยังไม่ใส่รายการ/ราคา
                </p>
              )
            }
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={formPending}
              onClick={() => void handleCancel()}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={formPending || (isEdit && !isDirty)}
              className="gap-1.5"
            >
              {formPending && <Loader2 className="animate-spin" />}
              {formPending
                ? "กำลังบันทึก..."
                : isEdit
                  ? changeOrderMode && editPlan?.work
                    ? "บันทึกและออกใบแก้ไข"
                    : "บันทึกการแก้ไข"
                  : "เปิดงาน"}
            </Button>
          </OrderFormActionBar>
      </form>

      <ProductPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectVariants={handleVariantsSelected}
      />
    </PageShell>
  );
}
