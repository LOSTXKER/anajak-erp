"use client";

// หน้าเปิดงานใหม่ — โหมดเดียว ไม่ถามชนิดออเดอร์ (ระบบ derive จากเนื้อรายการเอง):
// บังคับแค่ลูกค้า — ชื่องานว่างได้ server ตั้งให้เอง · เปิดงานได้ในไม่กี่วินาทีระหว่างถือแชท
// (ด่านฝั่ง server กันให้: ยืนยันออเดอร์ต้องมีรายการ · ปิดงานต้องวางบิลครบ)
//
// รื้อโครง 2026-06-12 (เบสเคาะ): แตก section เป็น component + ลำดับสายตา 1-2-3
// (ลูกค้า&งาน → รายการ&ราคา กางตลอด → ไฟล์&จัดส่ง พับ) + แถบสรุป/ปุ่ม sticky ล่างจอ

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/page-header";
import { isMarketplaceChannel, CHANNEL_LABELS } from "@/lib/order-status";
import { type PaymentTermsValue, PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { type PickerCustomer } from "@/components/customers/customer-picker";
import { calculateFormItemSubtotal, calculateOrderSummary } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import { Plus, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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
import { useOrderShippingState } from "@/hooks/use-order-shipping";
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

const labelClass = "mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400";

// เลขกำกับหัวข้อ 1-2-3 — ลำดับสายตาชัดว่ากรอกอะไรก่อนหลัง
function SectionNumber({ n }: { n: number }) {
  return (
    <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 align-text-bottom text-[11px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      {n}
    </span>
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
    showShipping, setShowShipping,
    shipping, updateShipping,
    validateShipping, shippingMutationInput,
  } = useOrderShippingState();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // ลูกค้าเลือกผ่าน CustomerPicker (ค้นหา+เพิ่มด่วน) — เก็บ object ที่เลือกไว้ใช้ prefill
  const [selectedCustomer, setSelectedCustomer] = useState<PickerCustomer | null>(null);

  // โหลด header draft หลัง mount เท่านั้น (client) — เรนเดอร์แรกตรงกับ server กัน hydration mismatch
  useEffect(() => {
    const d = loadHeaderDraft();
    if (!d) return;
    if (d.customerId) setCustomerId(d.customerId);
    if (d.title) setTitle(d.title);
    if (d.description) setDescription(d.description);
    if (d.selectedCustomer) setSelectedCustomer(d.selectedCustomer as PickerCustomer);
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
      router.push(`/orders/${data.id}`);
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
  // จะบวกภาษีทับซ้ำ · สลับเฉพาะค่า default (7↔0) ไม่ทับค่าที่ผู้ใช้พิมพ์เอง
  const taxRateTouched = useRef(false);
  useEffect(() => {
    if (taxRateTouched.current) return;
    if (isMarketplace && taxRate === 7) setTaxRate(0);
    if (!isMarketplace && taxRate === 0) setTaxRate(7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMarketplace]);

  useEffect(() => {
    if (selectedCustomer?.address && !shipping.address && !shipping.recipientName) {
      updateShipping("recipientName", selectedCustomer.name);
      updateShipping("phone", selectedCustomer.phone ?? "");
      updateShipping("address", selectedCustomer.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const isCorporateCustomer = selectedCustomer?.customerType === "CORPORATE";
  useEffect(() => {
    if (!selectedCustomer) return;
    if (selectedCustomer.customerType === "CORPORATE") {
      if (selectedCustomer.defaultPaymentTerms && !paymentTerms) {
        setPaymentTerms(selectedCustomer.defaultPaymentTerms);
      }
      if (taxRate === 0) {
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

    if (taxRate < 0 || taxRate > 100) {
      errors.push("ภาษีต้องอยู่ระหว่าง 0–100%");
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

  const buildMutationInput = (isDraft: boolean) => ({
    channel: channel as "SHOPEE" | "LAZADA" | "TIKTOK" | "LINE" | "WALK_IN" | "PHONE" | "WEBSITE",
    customerId,
    title: title.trim() || undefined,
    description: description || undefined,
    deadline: deadline || undefined,
    notes: notes || undefined,
    externalOrderId: isMarketplace && externalOrderId ? externalOrderId : undefined,
    platformFee: isMarketplace && platformFee ? platformFee : undefined,
    discount,
    isDraft,
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
    if (errors.length > 0) return;

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

    createOrder.mutate(buildMutationInput(false));
  };

  const handleSaveDraft = () => {
    const errors = validateForm();
    setFormErrors(errors);
    if (errors.length > 0) return;
    createOrder.mutate(buildMutationInput(true));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        breadcrumb={[
          { label: "ออเดอร์", href: "/orders" },
          { label: "เปิดงานใหม่" },
        ]}
        title="เปิดงานใหม่"
        description="เลือกลูกค้าอย่างเดียวก็เปิดได้ — ที่เหลือเติมตอนนี้หรือไปเติมที่หน้าออเดอร์ทีหลัง"
      />

      {hasDraft && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-50/60 px-3 py-1.5 text-[12px] dark:bg-amber-950/20">
          <span className="text-amber-800 dark:text-amber-200">
            พบข้อมูลร่างที่ยังไม่ได้บันทึก — กรอกต่อจากเดิมหรือเริ่มใหม่?
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              dismissDraft();
              clearDraft();
              setCustomerId("");
              setSelectedCustomer(null);
              setTitle("");
              setDescription("");
            }}
            className="ml-auto"
          >
            เริ่มใหม่
          </Button>
        </div>
      )}

      {/* noValidate: ใช้ validateForm (กล่อง error เดียว) แทน native validation —
          กล่องพับซ่อนด้วย CSS ทำให้ browser validation บน input ที่มองไม่เห็นพัง submit เงียบ */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* ============ 1 · ลูกค้า & งาน — แกนบังคับ (ลูกค้าช่องเดียว) ============ */}
        <Section
          title={
            <>
              <SectionNumber n={1} />
              ลูกค้า & งาน
            </>
          }
        >
          <div className="space-y-3.5">
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
          </div>
        </Section>

        {/* ============ 2 · รายการสินค้า & ราคา — กางตลอด (หัวใจของออเดอร์)
            ไม่กรอก = เปิดเป็นใบสอบถาม ตีราคาทีหลังได้ ============ */}
        <Section
          title={
            <>
              <SectionNumber n={2} />
              รายการสินค้า & ราคา
            </>
          }
          description="ไม่ใส่ตอนนี้ = เปิดเป็นใบสอบถาม แล้วไปเติมที่หน้าออเดอร์ได้"
        >
          <div className="space-y-4">
            {/* รายการเดียว = โหมด solo ไม่มีชั้น "รายการ #1" — ชุดเดียวกับฟอร์มแก้รายการ */}
            {items.length === 1 ? (
              <OrderItemCard
                item={items[0]}
                itemIdx={0}
                canRemove={false}
                isExpanded
                solo
                compact
                onToggleExpand={() => {}}
                allItems={items}
                printCatalog={printCatalog}
                addonCatalog={addonCatalog}
                onUpdateItem={updateItem}
                onRemoveItem={() => {}}
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
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/70 dark:divide-slate-800 dark:border-slate-800/60">
                {items.map((item, itemIdx) => (
                  <OrderItemCard
                    key={itemIdx}
                    item={item}
                    itemIdx={itemIdx}
                    canRemove={items.length > 1}
                    isExpanded
                    compact
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
                    onSetItems={setItems}
                  />
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                addItem();
                setExpandedItemIdx(items.length);
              }}
              className="w-full gap-1 text-slate-500"
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่มรายการงานอีกชุด (ลาย/เงื่อนไขต่างจากชุดแรก)
            </Button>

            <OrderFeeSection
              fees={fees}
              onAddFee={addFee}
              onRemoveFee={removeFee}
              onUpdateFee={updateFee as (idx: number, field: string, value: unknown) => void}
              feeCatalog={feeCatalog}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div>
                <label className={labelClass}>ภาษี (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxRate || ""}
                  onChange={(e) => {
                    taxRateTouched.current = true; // ผู้ใช้แตะเอง — เลิกสลับ default ตามช่องทาง
                    setTaxRate(parseFloat(e.target.value) || 0);
                  }}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelClass}>เงื่อนไขชำระ</label>
                <NativeSelect
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {Object.entries(PAYMENT_TERMS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {isCorporateCustomer && (
                <div>
                  <label className={labelClass}>เลขที่ PO</label>
                  <Input
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="PO Number"
                  />
                </div>
              )}
            </div>

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
            />
          </div>
        </Section>

        {/* ============ 3 · ไฟล์อ้างอิง & จัดส่ง — ของไม่บังคับ พับไว้ ============ */}
        <OrderAttachmentsSection
          title={
            <>
              <SectionNumber n={3} />
              รูป / ไฟล์อ้างอิงจากแชท
            </>
          }
          images={referenceImages}
          onImagesChange={setReferenceImages}
        />

        <OrderShippingSection
          showShipping={showShipping}
          onToggleShipping={() => setShowShipping(!showShipping)}
          shipping={shipping}
          onUpdate={updateShipping}
        />

        {formErrors.length > 0 && (
          <div className="rounded-xl bg-red-50/70 p-3 dark:bg-red-950/20">
            <p className="mb-1 text-[12px] font-medium text-red-700 dark:text-red-300">
              กรุณาแก้ไข
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-[12px] text-red-600 dark:text-red-400">
              {formErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {createOrder.isError && (
          <div className="rounded-xl bg-red-50/70 p-3 text-[12px] text-red-700 dark:bg-red-950/20 dark:text-red-300">
            {createOrder.error.message}
          </div>
        )}

        {/* แถบสรุป+ปุ่ม sticky ล่างจอ — มือถือกดถึงเสมอ (pattern เดียวกับฟอร์มแก้รายการ) */}
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95">
          <div className="min-w-0 flex-1">
            {hasItemContent ? (
              <>
                <p className="text-[11px] text-slate-400">ยอดรวม</p>
                <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(pricingSummary.grandTotal)}
                </p>
              </>
            ) : (
              <p className="text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                ยังไม่ใส่รายการ/ราคา
                <br className="sm:hidden" />
                <span className="hidden sm:inline"> — </span>
                เปิดเป็นใบสอบถามแล้วเติมทีหลังได้
              </p>
            )}
          </div>
          <Link href="/orders">
            <Button type="button" variant="ghost" size="sm" disabled={createOrder.isPending}>
              ยกเลิก
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={createOrder.isPending}
            onClick={handleSaveDraft}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            ร่าง
          </Button>
          <Button type="submit" disabled={createOrder.isPending} className="gap-1.5">
            {createOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {createOrder.isPending ? "กำลังบันทึก..." : "เปิดงาน"}
          </Button>
        </div>
      </form>

      <ProductPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectVariants={handleVariantsSelected}
      />
    </div>
  );
}
