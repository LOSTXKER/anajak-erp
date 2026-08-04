"use client";

// หน้าเปิดงานใหม่ — โหมดเดียว ไม่ถามชนิดออเดอร์ (ระบบ derive จากเนื้อรายการเอง):
// บังคับแค่ลูกค้า — ชื่องานว่างได้ server ตั้งให้เอง · เปิดงานได้ในไม่กี่วินาทีระหว่างถือแชท
// (ด่านฝั่ง server กันให้: ยืนยันออเดอร์ต้องมีรายการ · ปิดงานต้องวางบิลครบ)
//
// รื้อโครง 2026-06-12 (เบสเคาะ): แตก section เป็น component + ลำดับสายตา 1-2-3
// (ลูกค้า&งาน → รายการ&ราคา → ไฟล์&จัดส่ง กางตลอด) + แถบสรุป/ปุ่ม sticky ล่างจอ
//
// UX แบบ B 2026-08-03 (เบสเคาะจาก mockup): เลิก ledger ผิวเดียว → 4 การ์ดแยกบนพื้นเทา
// เหมือนทั้งเว็บ + PageShell กลาง + แถบขั้นตอนกระโดด · ทุกช่องยังกางครบเหมือนเดิม
// ไม่มีพับซ่อน/wizard/สองฝั่ง ตามมติเดิม

import { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Section } from "@/components/ui/section";
import { PageShell } from "@/components/page-shell";
import { isMarketplaceChannel, CHANNEL_LABELS } from "@/lib/order-status";
import { type PaymentTermsValue, PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { type PickerCustomer } from "@/components/customers/customer-picker";
import { calculateFormItemSubtotal, calculateOrderSummary } from "@/lib/pricing";
import { cn, formatCurrency } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ProductPickerDialog,
  type SelectedVariantItem,
} from "@/components/product-picker";
import {
  useOrderItemsForm,
  useOrderFeesForm,
  clearDraft,
  loadHeaderDraft,
  saveHeaderDraft,
} from "@/hooks/use-order-items-form";
import {
  shouldPrefillShippingOnCustomerChange,
  useOrderShippingState,
} from "@/hooks/use-order-shipping";
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
  OrderFeeSection,
  OrderShippingSection,
  OrderPriceSummary,
  OrderCustomerSection,
  OrderDetailFields,
  OrderAttachmentsSection,
} from "@/components/orders/new";
import { useMarginEstimate } from "@/components/orders/new/order-price-summary";
import { Badge } from "@/components/ui/badge";
import { FOCUS_BUTTON, RADIUS, TINT, DISPLAY_AMOUNT } from "@/components/ui/tokens";
import { CONTROL_MIN_H } from "@/components/ui/control-size";

/** id ของ 4 ตอน — ใช้ร่วมกันระหว่างหัวข้อการ์ดกับแถบขั้นตอนที่กดกระโดด */
const STEP_IDS = {
  intake: "new-order-step-intake",
  items: "new-order-step-items",
  pricing: "new-order-step-pricing",
  shipping: "new-order-step-shipping",
} as const;

/* เลขตอนเป็นชิปกลม ไม่ใช่ตัวเลขลอย — เลข 01-04 เดิมเป็นภาษาหัวข้อแบบที่ 3 ของระบบ
   (audit 2026-08-03) · aria-hidden เพราะ <h2> ควรอ่านแค่ชื่อตอน ไม่ต้องอ่าน "01" */
function StepTitle({ number, children }: { number: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-50 text-2xs font-semibold tabular-nums text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
      >
        {number}
      </span>
      <span>{children}</span>
    </span>
  );
}

/* แถบขั้นตอน — ทางลัดกระโดดในฟอร์มยาว 4 จอ ไม่ได้ซ่อนอะไร (ทุกช่องยังกางครบ)
   จุดเขียว = ตอนนั้นมีข้อมูลแล้ว · ป้ายขวา = บอกว่าร่างถูกเก็บอัตโนมัติ
   (ระบบเก็บลงเครื่องอยู่แล้วผ่าน use-order-items-form แต่ไม่เคยบอกผู้ใช้) */
function StepRail({
  steps,
  draftSaved,
}: {
  steps: { id: string; label: string; done: boolean }[];
  draftSaved: boolean;
}) {
  /* เลื่อนไปตอนที่กด — เลื่อน "กล่อง main" ตรงๆ ไม่ใช่ scrollIntoView
     เหตุผล: เครื่องที่ปิด smooth scrolling ไว้ (ตั้งค่าลดการเคลื่อนไหวของ macOS/Chrome)
     สั่ง behavior:"smooth" แล้วจอ "ไม่ขยับเลย" — ปุ่มนี้เป็นตัวนำทาง กดแล้วต้องไปถึงเสมอ
     จึงเช็คหลังสั่งไป 1 จังหวะ ถ้ายังไม่ขยับให้กระโดดทันทีแทน */
  const goTo = useCallback((elId: string) => {
    requestAnimationFrame(() => {
      const target = document.getElementById(elId);
      const scroller = target?.closest("main");
      if (!target || !scroller) return;
      target.focus({ preventScroll: true });

      const top = Math.max(
        0,
        scroller.scrollTop +
          target.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top -
          12
      );
      const before = scroller.scrollTop;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scroller.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      if (reduced) return;
      window.setTimeout(() => {
        if (scroller.scrollTop === before) scroller.scrollTop = top;
      }, 120);
    });
  }, []);

  return (
    <nav
      aria-label="ข้ามไปตอนที่ต้องการ"
      className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-1.5 border-b border-slate-200/70 bg-bg px-1 py-2 dark:border-white/10"
    >
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          onClick={() => goTo(step.id)}
          className={cn(
            CONTROL_MIN_H,
            RADIUS.pill,
            // ไม่มีขอบ — ชิปขาวบนพื้นเทาแยกตัวเองด้วยสีพื้นอยู่แล้ว (รอบ "ลดเส้นทั้งเว็บ")
            "inline-flex items-center gap-2 bg-surface hairline-ring px-3 text-xs text-secondary transition-colors hover:text-strong active:scale-[0.98]",
            FOCUS_BUTTON
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              step.done ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
            )}
          />
          {step.label}
          <span className="sr-only">{step.done ? " — กรอกแล้ว" : " — ยังว่าง"}</span>
        </button>
      ))}
      {draftSaved && (
        <p className="ml-auto hidden items-center gap-1.5 text-2xs text-muted sm:flex">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-500" />
          เก็บร่างอัตโนมัติแล้ว
        </p>
      )}
    </nav>
  );
}

export default function NewOrderPage() {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const utils = trpc.useUtils();

  const [channel, setChannel] = useState("LINE");
  const [externalOrderId, setExternalOrderId] = useState("");

  // หัวฟอร์มรอด refresh เหมือนรายการ — restore จาก header draft (audit ข้อ 6)
  // SSR-safe: init ว่าง (ไม่อ่าน localStorage ตอน render) — โหลด header draft หลัง mount ใน effect ด้านล่าง
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const {
    items, setItems,
    addItem, removeItem, updateItem,
    addPrint, removePrint, updatePrint,
    addAddon, removeAddon, updateAddon,
    hasDraft, dismissDraft,
  } = useOrderItemsForm(undefined, { enableDraft: true });

  const [expandedItemIdx, setExpandedItemIdx] = useState<number | null>(0);

  const { fees, addFee, removeFee, updateFee } = useOrderFeesForm();

  const [platformFee, setPlatformFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  // default 7% — บริษัทจด VAT ทุกการขายต้องมีภาษีขาย (Gate B2 · เบส confirm 2026-07-02)
  // งานยกเว้นภาษี = ผู้ใช้ตั้ง 0 เอง (เดิม default 0 → ภาษีขายขาด เสี่ยงประเมินย้อนหลัง)
  const [taxRate, setTaxRate] = useState(7);

  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [poNumber, setPoNumber] = useState("");

  const {
    includeShipping, setIncludeShipping,
    shippingDirty,
    shipping, updateShipping, replaceShipping,
    validateShipping, shippingMutationInput,
  } = useOrderShippingState();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // hasDraft ของ useOrderItemsForm ดูแค่ "ร่างรายการ" — ถ้าค้างไว้แค่ลูกค้า/ชื่องาน/ข้อความแชท
  // หน้าจะ restore ลูกค้ารายเก่ากลับมาเงียบๆ โดยไม่มีแบนเนอร์บอก แล้วคนคีย์งานให้ลูกค้าผิดคน
  // (บั๊กจาก audit 2026-08-03) → จำไว้ว่า header draft ถูกกู้คืนด้วย แล้ว OR เข้าเงื่อนไขแบนเนอร์
  const [restoredHeaderDraft, setRestoredHeaderDraft] = useState(false);

  // ลูกค้าเลือกผ่าน CustomerPicker (ค้นหา+เพิ่มด่วน) — เก็บ object ที่เลือกไว้ใช้ prefill
  const [selectedCustomer, setSelectedCustomer] = useState<PickerCustomer | null>(null);

  // โหลด header draft หลัง mount เท่านั้น (client) — เรนเดอร์แรกตรงกับ server กัน hydration mismatch
  useEffect(() => {
    const d = loadHeaderDraft();
    if (d?.customerId) setCustomerId(d.customerId);
    if (d?.title) setTitle(d.title);
    if (d?.description) setDescription(d.description);
    if (d?.selectedCustomer) setSelectedCustomer(d.selectedCustomer as PickerCustomer);
    if (d?.customerId || d?.title || d?.description) setRestoredHeaderDraft(true);

    const requestedCustomerId = new URLSearchParams(window.location.search).get("customerId");
    if (!requestedCustomerId || d?.customerId) return;
    let cancelled = false;
    void utils.customer.getById.fetch({ id: requestedCustomerId })
      .then((customer) => {
        if (cancelled || !customer) return;
        setCustomerId(customer.id);
        setSelectedCustomer(customer as unknown as PickerCustomer);
      })
      .catch(() => {
        if (!cancelled) {
          setFormErrors(["เปิดข้อมูลลูกค้าที่เลือกไว้ไม่สำเร็จ — ค้นหาลูกค้าอีกครั้ง"]);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดครั้งเดียวตอน mount
  }, []);

  // เซฟหัวฟอร์มลง draft ทุกครั้งที่เปลี่ยน — ข้ามรอบแรก (mount) กัน save ค่าว่างทับ draft ก่อนโหลด
  const headerSaveSkip = useRef(true);
  useEffect(() => {
    if (headerSaveSkip.current) {
      headerSaveSkip.current = false;
      return;
    }
    saveHeaderDraft({
      customerId: customerId || undefined,
      selectedCustomer: selectedCustomer ?? undefined,
      title: title || undefined,
      description: description || undefined,
    });
  }, [customerId, selectedCustomer, title, description]);

  const { data: printCatalog } = trpc.serviceCatalog.list.useQuery(
    { category: "PRINT", isActive: true },
  );
  const { data: addonCatalog } = trpc.serviceCatalog.list.useQuery(
    { category: "ADDON", isActive: true },
  );
  const { data: feeCatalog } = trpc.serviceCatalog.list.useQuery(
    { category: "FEE", isActive: true },
  );

  const createOrder = trpc.order.create.useMutation({
    onSuccess: (data) => {
      clearDraft();
      utils.order.list.invalidate();
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next === "quote" ? `/quotations/new?orderId=${data.id}` : `/orders/${data.id}`);
    },
  });

  const isMarketplace = isMarketplaceChannel(channel);

  // มีเนื้อรายการจริงไหม — ตัวตัดสินเดียวแทนสวิตช์โหมดเดิม (สอบถาม/ระบุครบ):
  // ไม่มี = เปิดเป็นการสอบถาม (ตีราคาทีหลัง) · มี = validate + ส่งรายการไปคิดเงิน
  const hasItemContent = items.some(itemHasContent);
  useEffect(() => {
    if (!deadline) return;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 3) {
      setPriority("URGENT");
    } else if (daysUntil <= 7) {
      setPriority("HIGH");
    }
  }, [deadline]);

  useEffect(() => {
    if (isMarketplace && !paymentTerms) {
      setPaymentTerms("COD");
    }
  }, [isMarketplace, paymentTerms]);

  // ราคาช่องทาง marketplace (Shopee/Lazada/TikTok) รวม VAT ในตัวแล้ว — default 7%
  // จะบวกภาษีทับซ้ำ · สลับค่าตามช่องทางให้อัตโนมัติ (ฟอร์มนี้ไม่มีช่องให้กรอกภาษีแล้ว)
  useEffect(() => {
    if (isMarketplace && taxRate === 7) setTaxRate(0);
    if (!isMarketplace && taxRate === 0) setTaxRate(7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMarketplace]);

  useEffect(() => {
    // ถ้าผู้ใช้เริ่มระบุที่อยู่จัดส่งแล้ว ให้ถือเป็นที่อยู่ไซต์งานและรักษาไว้แม้เปลี่ยนลูกค้าวางบิล
    // แต่ถ้ายังไม่ได้เลือกใช้ที่อยู่ จึง prefill จากลูกค้ารายใหม่ได้
    if (!shouldPrefillShippingOnCustomerChange(shippingDirty)) return;
    replaceShipping({
      recipientName: selectedCustomer?.name ?? "",
      phone: selectedCustomer?.phone ?? "",
      address: selectedCustomer?.address ?? "",
      subDistrict: "",
      district: "",
      province: "",
      postalCode: "",
    });
    // selectedCustomer ถูก set พร้อม customerId ทุกทางเข้า; ใช้ id เป็น trigger กัน prefill ทับตอนผู้ใช้พิมพ์
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, replaceShipping, shippingDirty]);

  const isCorporateCustomer = selectedCustomer?.customerType === "CORPORATE";
  useEffect(() => {
    // เลขที่ PO ผูกกับลูกค้ารายที่เลือกไว้ตอนนั้น — สลับลูกค้าแล้วค่าเก่าค้างและถูกส่งไปด้วย
    // (บั๊กจาก audit 2026-08-03 · ช่องนี้โผล่เฉพาะนิติบุคคล พอสลับไปบุคคลธรรมดาจะมองไม่เห็นด้วยซ้ำ)
    setPoNumber("");

    if (!selectedCustomer) return;
    if (selectedCustomer.customerType === "CORPORATE") {
      if (selectedCustomer.defaultPaymentTerms && !paymentTerms) {
        setPaymentTerms(selectedCustomer.defaultPaymentTerms);
      }
      // นิติบุคคลต้องมีภาษีขาย — ยกเว้นช่องทางมาร์เก็ตเพลสที่ราคารวม VAT อยู่แล้ว
      // (ถ้าดันกลับเป็น 7 จะบวกภาษีทับซ้ำ · เดิมเงื่อนไขนี้พึ่งการที่ผู้ใช้แตะช่องเอง
      //  พอถอดช่องกรอกออกเลยต้องกันที่ตัวเงื่อนไขตรงๆ)
      if (taxRate === 0 && !isMarketplace) {
        setTaxRate(7);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

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
        expandedItemIdx
      );
      setExpandedItemIdx(targetIdx);
      return merged;
    });
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!customerId) errors.push("กรุณาเลือกลูกค้า");

    if (deadline) {
      const deadlineDate = new Date(deadline + "T23:59:59");
      if (deadlineDate < new Date()) {
        errors.push("กำหนดส่งต้องไม่เป็นวันที่ผ่านมาแล้ว");
      }
    }

    // ของที่พิมพ์ไว้ในกล่องรายการแต่ระบบจะไม่ส่ง (เพราะยังไม่มีตัวรายการจริง) — ห้ามทิ้งเงียบ
    if (!hasItemContent) {
      const hasFeeContent = fees.some((f) => f.name || f.feeType || f.amount > 0);
      const hasItemNotes = items.some((it) => it.notes?.trim());
      if (hasFeeContent || hasItemNotes) {
        errors.push(
          "มีค่าใช้จ่าย/หมายเหตุที่กรอกไว้ แต่ยังไม่มีรายการสินค้า — เพิ่มรายการสินค้า หรือลบข้อมูลนั้นออกก่อนเปิดงาน"
        );
      }
      if (discount > 0) {
        errors.push("ใส่ส่วนลดไว้แต่ยังไม่มีรายการสินค้า — ล้างส่วนลดหรือเพิ่มรายการก่อน");
      }
    }

    if (hasItemContent) {
      items.forEach((item, idx) => {
        const itemErrors = validateOrderItem(item);
        const errMsgs = Object.values(itemErrors).filter(Boolean);
        if (errMsgs.length > 0) {
          errors.push(`รายการ #${idx + 1}: ${errMsgs.join(", ")}`);
        }
        item.products.forEach((prod, pIdx) => {
          const prodErrors = validateOrderItemProduct(prod);
          const prodErrMsgs = Object.values(prodErrors).filter(Boolean);
          if (prodErrMsgs.length > 0) {
            errors.push(`รายการ #${idx + 1} สินค้า #${pIdx + 1}: ${prodErrMsgs.join(", ")}`);
          }
        });
      });

      const subtotal = pricingSummary.subtotalItems + pricingSummary.subtotalFees;
      if (discount > subtotal) {
        errors.push(`ส่วนลด (${formatCurrency(discount)}) มากกว่ายอดรวมก่อนหักส่วนลด (${formatCurrency(subtotal)})`);
      }
    }

    errors.push(...validateShipping());

    return errors;
  };

  const buildMutationInput = () => ({
    channel: channel as "SHOPEE" | "LAZADA" | "TIKTOK" | "LINE" | "WALK_IN" | "PHONE" | "WEBSITE",
    customerId,
    title: title.trim() || undefined,
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
    if (errors.length > 0) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    const totalProducts = items.reduce((s, it) => s + it.products.length, 0);
    const dialogTitle = title.trim()
      ? `เปิดงาน "${title.trim()}"?`
      : `เปิดงานของ ${selectedCustomer?.name ?? "ลูกค้า"}?`;
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

  const showDraftBanner = hasDraft || restoredHeaderDraft;
  const resetDraft = () => {
    dismissDraft();
    clearDraft();
    setRestoredHeaderDraft(false);
    setCustomerId("");
    setSelectedCustomer(null);
    setTitle("");
    setDescription("");
  };

  return (
    <PageShell
      width="wide"
      breadcrumb={[
        { label: "ออเดอร์", href: "/orders" },
        { label: "เปิดงานใหม่" },
      ]}
      title="เปิดงานใหม่"
    >
      {showDraftBanner && (
        <div className={cn(TINT.warning, "flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2 text-xs")}>
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

      <StepRail
        draftSaved={showDraftBanner || !!customerId || hasItemContent}
        steps={[
          { id: STEP_IDS.intake, label: "รับเรื่อง", done: !!customerId },
          { id: STEP_IDS.items, label: "รายการงาน", done: hasItemContent },
          { id: STEP_IDS.pricing, label: "ราคา", done: pricingSummary.grandTotal > 0 },
          { id: STEP_IDS.shipping, label: "จัดส่ง", done: includeShipping },
        ]}
      />

      {/* noValidate: ใช้ validateForm (กล่อง error เดียว) แทน native validation —
          กล่องพับซ่อนด้วย CSS ทำให้ browser validation บน input ที่มองไม่เห็นพัง submit เงียบ */}
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {formErrors.length > 0 && (
          <Alert
            ref={errorSummaryRef}
            variant="error"
            title="กรุณาแก้ไข"
            aria-live="assertive"
            tabIndex={-1}
            className={cn("outline-none", FOCUS_BUTTON)}
          >
            <ul className="list-inside list-disc space-y-1">
              {formErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </Alert>
        )}

        {createOrder.isError && (
          <Alert variant="error">
            {createOrder.error.message}
          </Alert>
        )}

        <div className="space-y-6">
          {/* รับเรื่อง — ลูกค้าเป็นช่องบังคับเพียงช่องเดียว */}
          <Section
            id={STEP_IDS.intake}
            tabIndex={-1}
            title={<StepTitle number="01">รับเรื่อง</StepTitle>}
            description="ที่เหลือเติมทีหลังได้"
            className={cn("scroll-mt-16 outline-none", FOCUS_BUTTON)}
          >
            <div className="space-y-4">
              <OrderCustomerSection
                customerId={customerId}
                selectedCustomer={selectedCustomer}
                onSelect={(id, customer) => {
                  setCustomerId(id);
                  setSelectedCustomer(customer);
                }}
              />
              <OrderDetailFields
                title={title}
                onTitleChange={setTitle}
                deadline={deadline}
                onDeadlineChange={setDeadline}
                priority={priority}
                onPriorityChange={setPriority}
                channel={channel}
                onChannelChange={setChannel}
                isMarketplace={isMarketplace}
                externalOrderId={externalOrderId}
                onExternalOrderIdChange={setExternalOrderId}
                description={description}
                onDescriptionChange={setDescription}
                notes={notes}
                onNotesChange={setNotes}
              />
              <div className="border-t border-slate-200 pt-4 dark:border-white/10">
                <OrderAttachmentsSection
                  images={referenceImages}
                  onImagesChange={setReferenceImages}
                  embedded
                />
              </div>
            </div>
          </Section>

          <Section
            id={STEP_IDS.items}
            tabIndex={-1}
            title={<StepTitle number="02">รายการงาน</StepTitle>}
            action={
              hasItemContent ? (
                <Badge variant="default" size="sm">
                  {items.length} ชุดงาน
                </Badge>
              ) : undefined
            }
            className={cn("scroll-mt-16 outline-none", FOCUS_BUTTON)}
          >
            <div className="space-y-4">
              {/* เลข "รายการที่ N" ขึ้นตั้งแต่ชุดแรก — ไม่ต้องรอกดเพิ่มชุดที่ 2 ถึงจะมีเลข
                  (เบสเคาะจาก mockup 2026-08-04) · เดิมมีโหมด solo ที่ซ่อนเลขตอนมีชุดเดียว
                  ทำให้พอเพิ่มชุดที่ 2 เลขโผล่มาทีหลัง ผู้ใช้ต้องอ่านหน้าใหม่ */}
              <div className="divide-y divide-slate-200/70 dark:divide-white/10">
                {items.map((item, itemIdx) => (
                  <OrderItemCard
                    key={itemIdx}
                    item={item}
                    itemIdx={itemIdx}
                    canRemove={items.length > 1}
                    isExpanded
                    compact
                    appearance="intake"
                    allItems={items}
                    printCatalog={printCatalog}
                    addonCatalog={addonCatalog}
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

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    addItem();
                    setExpandedItemIdx(items.length);
                  }}
                  className="w-full gap-1.5 text-muted sm:w-auto"
                >
                  <Plus />
                  เพิ่มชุดงาน
                </Button>
              </div>
            </div>
          </Section>

          <Section
            id={STEP_IDS.pricing}
            tabIndex={-1}
            title={<StepTitle number="03">ราคาและเงื่อนไข</StepTitle>}
            className={cn("scroll-mt-16 outline-none", FOCUS_BUTTON)}
          >
            <div className="space-y-4">
              <OrderFeeSection
                fees={fees}
                onAddFee={addFee}
                onRemoveFee={removeFee}
                onUpdateFee={updateFee as (idx: number, field: string, value: unknown) => void}
                feeCatalog={feeCatalog}
                embedded
              />

              <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-white/10">
                {/* หัวข้อย่อยชั้นเดียวกับ "ค่าใช้จ่ายเพิ่มเติม"/"สรุปยอด" — เดิมเขียน <h3> เอง
                    ขนาด 14px ต่างจากอีกสองอันที่ 16px ทั้งที่อยู่ชั้นเดียวกัน (audit 2026-08-03) */}
                {/* ไม่มีช่อง "ภาษี (%)" แล้ว (เบสเคาะ 2026-08-04 "vat 7% ไม่ต้องมีให้กรอกก็ได้") —
                    ระบบตั้งให้เอง: ปกติ 7% · ช่องทางมาร์เก็ตเพลสเป็น 0% (ราคารวม VAT อยู่แล้ว)
                    อัตราจริงยังเห็นได้ที่บรรทัด VAT ในสรุปยอด · งานยกเว้นภาษีแก้ที่หน้าออเดอร์
                    (order.updateInfo รับ taxRate อยู่แล้ว — ไม่แตะสูตร ไม่แตะ mutation) */}
                <Section
                  title="เงื่อนไขการขาย"
                  description="ภาษีระบบตั้งให้เอง (ดูอัตราที่บรรทัด VAT) — แก้ได้ที่หน้าออเดอร์"
                  bordered={false}
                  headingLevel={3}
                >
                  <div className="grid gap-3 lg:grid-cols-2">
                    <Field label="เงื่อนไขชำระ" id="order-payment-terms">
                      <Select
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                      >
                        <option value="">ไม่ระบุ</option>
                        {Object.entries(PAYMENT_TERMS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {isCorporateCustomer && (
                      <Field label="เลขที่ PO" id="order-po-number" className="lg:col-span-2">
                        <Input
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                          placeholder="PO Number"
                        />
                      </Field>
                    )}
                  </div>
                </Section>

                <div className="border-t border-slate-200 pt-5 dark:border-white/10">
                  <OrderPriceSummary
                    pricingSummary={pricingSummary}
                    showFeeSections={true}
                    isMarketplace={isMarketplace}
                    channelLabel={CHANNEL_LABELS[channel]}
                    taxRate={taxRate}
                    platformFee={platformFee}
                    discount={discount}
                    onPlatformFeeChange={setPlatformFee}
                    onDiscountChange={setDiscount}
                    marginEstimate={marginEstimate}
                    embedded
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* จัดส่ง — กางตลอด แต่ยังเป็นข้อมูลไม่บังคับ */}
          <OrderShippingSection
            id={STEP_IDS.shipping}
            includeShipping={includeShipping}
            onIncludeShippingChange={setIncludeShipping}
            shipping={shipping}
            onUpdate={updateShipping}
            title={<StepTitle number="04">การจัดส่ง</StepTitle>}
            className={cn("scroll-mt-16 outline-none", FOCUS_BUTTON)}
          />

          {/* แถบยอด+ปุ่มติดขอบล่างจอ — ทึบ + เส้นขอบบน (เดิมโปร่ง 95% + blur จนตัวหนังสือ
              ด้านบนอ่านทะลุกัน) · pb เผื่อแถบขีดกลับหน้าหลักของ iPhone ไม่ให้ทับปุ่ม "เปิดงาน" */}
          <div className="card-surface sticky bottom-0 z-10 -mb-2 flex flex-wrap items-center gap-2 rounded-t-2xl border-t border-slate-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 dark:border-white/10">
            <div className="min-w-0 flex-1">
              {hasItemContent ? (
                <>
                  {/* ชื่อเดียวกับบรรทัดสุดท้ายของ "สรุปยอด" — เดิมเรียก "ยอดรวม" กับ
                      "ยอดรวมทั้งหมด" คนละที่คนละขนาด อ่านแล้วไม่แน่ใจว่าเลขเดียวกันไหม */}
                  <p className="text-2xs text-muted">ยอดรวมทั้งหมด (รวม VAT)</p>
                  <p className={cn("truncate", DISPLAY_AMOUNT)}>
                    {formatCurrency(pricingSummary.grandTotal)}
                  </p>
                </>
              ) : (
                <p className="text-xs leading-snug text-muted">
                  ยังไม่ใส่รายการ/ราคา
                  <br className="sm:hidden" />
                  <span className="hidden sm:inline"> — </span>
                  เปิดเป็นใบสอบถามแล้วเติมทีหลังได้
                </p>
              )}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/orders" aria-disabled={createOrder.isPending}>
                ยกเลิก
              </Link>
            </Button>
            <Button type="submit" size="sm" disabled={createOrder.isPending} className="gap-1.5">
              {createOrder.isPending && <Loader2 className="animate-spin" />}
              {createOrder.isPending ? "กำลังบันทึก..." : "เปิดงาน"}
            </Button>
          </div>
        </div>
      </form>

      <ProductPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectVariants={handleVariantsSelected}
      />
    </PageShell>
  );
}
