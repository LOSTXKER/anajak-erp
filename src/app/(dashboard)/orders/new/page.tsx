"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { FilterChip } from "@/components/ui/filter-chip";
import { PageHeader } from "@/components/page-header";
import {
  CHANNEL_LABELS,
  PRIORITY_LABELS,
  isMarketplaceChannel,
} from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS, type PaymentTermsValue } from "@/lib/payment-terms";
import {
  calculateFormItemSubtotal,
  calculateOrderSummary,
} from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  RefreshCw,
  Save,
  Zap,
  ListChecks,
  ImageIcon,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import {
  ProductPickerDialog,
  type SelectedVariantItem,
} from "@/components/product-picker";
import { uploadFile } from "@/lib/supabase";
import {
  useOrderItemsForm,
  useOrderFeesForm,
  clearDraft,
} from "@/hooks/use-order-items-form";
import { useOrderShippingState } from "@/hooks/use-order-shipping";
import type { OrderItemForm, ReferenceImage } from "@/types/order-form";
import {
  EMPTY_ITEM,
  EMPTY_PRODUCT,
  PRINT_POSITIONS,
  validateOrderItem,
  validateOrderItemProduct,
} from "@/types/order-form";
import { mapItemsToMutationInput, mapFeesToMutationInput } from "@/lib/order-mapping";
import { toast } from "sonner";
import {
  OrderTypeSelector,
  OrderItemCard,
  OrderFeeSection,
  OrderShippingSection,
  OrderPriceSummary,
} from "@/components/orders/new";

const CHANNELS = Object.keys(CHANNEL_LABELS) as string[];

const sectionLabelClass =
  "mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400";

export default function NewOrderPage() {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const utils = trpc.useUtils();

  const [typeSelected, setTypeSelected] = useState(false);
  const [customMode, setCustomMode] = useState<"quick" | "full">("quick");

  const [channel, setChannel] = useState("LINE");
  const [orderType, setOrderType] = useState<"READY_MADE" | "CUSTOM">("CUSTOM");
  const [externalOrderId, setExternalOrderId] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedQuantity, setEstimatedQuantity] = useState<number | "">("");

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
  const [taxRate, setTaxRate] = useState(0);

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
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const { data: customers } = trpc.customer.list.useQuery({ limit: 100 });

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

  const isCustom = orderType === "CUSTOM";
  const isMarketplace = isMarketplaceChannel(channel);
  const isQuickInquiry = isCustom && customMode === "quick";

  const showFeeSections = isCustom && customMode === "full";
  const showItemsSection = !isQuickInquiry;

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

  const selectedCustomer = customers?.customers.find(c => c.id === customerId);
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
    if (isQuickInquiry) {
      return { subtotalItems: 0, subtotalFees: 0, platformFee: 0, discount: 0, taxAmount: 0, grandTotal: 0 };
    }
    // สูตร A เดียวกับ server — platformFee ไม่บวกเข้ายอดบิล/ฐาน VAT
    // (เป็นเงินที่ marketplace หักจากยอดโอน — เก็บไว้เป็นข้อมูลอ้างอิงเท่านั้น)
    const summary = calculateOrderSummary({
      itemSubtotals: items.map((item) => calculateFormItemSubtotal(item)),
      feeAmounts: fees.map((f) => f.amount),
      discount,
      taxRate,
    });
    return { ...summary, platformFee: isMarketplace ? platformFee : 0 };
  }, [items, fees, platformFee, discount, isMarketplace, taxRate, isQuickInquiry]);

  const handleVariantsSelected = (selected: SelectedVariantItem[]) => {
    setItems((prev) => {
      const filtered = prev.filter(
        (it) => it.description || it.notes || it.prints.length > 0 || it.addons.length > 0
          || it.products.some((p) => p.description || p.productId || p.itemSource || p.variants.some((v) => v.size || v.color)),
      );
      const result = filtered.length > 0 ? [...filtered] : [structuredClone(EMPTY_ITEM)];
      const targetIdx = expandedItemIdx !== null && expandedItemIdx < result.length ? expandedItemIdx : 0;

      const targetItem = result[targetIdx];
      const updatedProducts = [...targetItem.products];

      for (const v of selected) {
        const dupIdx = updatedProducts.findIndex(
          (p) => p.productId === v.productId && p.itemSource === "FROM_STOCK"
            && p.variants[0]?.size === v.size && p.variants[0]?.color === v.color,
        );

        if (dupIdx >= 0) {
          const ep = updatedProducts[dupIdx];
          const newVariants = [...ep.variants];
          newVariants[0] = { ...newVariants[0], quantity: newVariants[0].quantity + v.quantity };
          updatedProducts[dupIdx] = { ...ep, variants: newVariants };
        } else {
          const isEmptyFirst = updatedProducts.length === 1
            && !updatedProducts[0].productId && !updatedProducts[0].description && !updatedProducts[0].itemSource;
          const newProd: typeof EMPTY_PRODUCT = {
            ...structuredClone(EMPTY_PRODUCT),
            productId: v.productId,
            itemSource: "FROM_STOCK",
            productType: v.productType,
            description: v.name,
            baseUnitPrice: v.basePrice,
            variants: [{ size: v.size, color: v.color, quantity: v.quantity }],
            productImageUrl: v.imageUrl,
            productSku: v.sku,
            productName: v.name,
            stockAvailable: v.stock,
          };
          if (isEmptyFirst) {
            updatedProducts[0] = newProd;
          } else {
            updatedProducts.push(newProd);
          }
        }
      }

      result[targetIdx] = { ...targetItem, products: updatedProducts };
      setExpandedItemIdx(targetIdx);
      return result;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxFiles = 5 - referenceImages.length;
    const filesToUpload = Array.from(files).slice(0, maxFiles);

    setUploading(true);
    try {
      for (const file of filesToUpload) {
        if (file.size > 10 * 1024 * 1024) {
          toast.warning(`ไฟล์ "${file.name}" มีขนาดเกิน 10MB — ข้ามไฟล์นี้`);
          continue;
        }

        const preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });

        const ext = file.name.split(".").pop() || "file";
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const path = `orders/references/${uniqueName}`;
        const url = await uploadFile("designs", path, file);

        setReferenceImages((prev) => [
          ...prev,
          { fileUrl: url, fileName: file.name, fileSize: file.size, preview },
        ]);
      }
    } catch {
      // Upload error - silently continue with already uploaded images
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeReferenceImage = (idx: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!customerId) errors.push("กรุณาเลือกลูกค้า");
    if (!title.trim()) errors.push("กรุณาระบุชื่องาน");

    if (deadline) {
      const deadlineDate = new Date(deadline + "T23:59:59");
      if (deadlineDate < new Date()) {
        errors.push("กำหนดส่งต้องไม่เป็นวันที่ผ่านมาแล้ว");
      }
    }

    if (!isQuickInquiry) {
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
    orderType,
    channel: channel as "SHOPEE" | "LAZADA" | "TIKTOK" | "LINE" | "WALK_IN" | "PHONE" | "WEBSITE",
    customerId,
    title,
    description: description || undefined,
    deadline: deadline || undefined,
    notes: notes || undefined,
    externalOrderId: isMarketplace && externalOrderId ? externalOrderId : undefined,
    platformFee: isMarketplace && platformFee ? platformFee : undefined,
    discount,
    isDraft,
    isQuickInquiry,
    priority,
    paymentTerms: (paymentTerms || undefined) as PaymentTermsValue | undefined,
    poNumber: poNumber || undefined,
    taxRate,
    estimatedQuantity: estimatedQuantity ? Number(estimatedQuantity) : undefined,
    ...(shippingMutationInput() && { shippingAddress: shippingMutationInput() }),
    items: isQuickInquiry ? [] : mapItemsToMutationInput(items),
    fees: showFeeSections ? mapFeesToMutationInput(fees) : [],
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
    const ok = await confirmDialog(
      isQuickInquiry
        ? { title: `สร้างการสอบถาม "${title}"?`, confirmText: "สร้างการสอบถาม" }
        : {
            title: `สร้างออเดอร์ "${title}"?`,
            description: `${items.length} รายการ (${totalProducts} สินค้า) · ยอดรวม ${formatCurrency(pricingSummary.grandTotal)}`,
            confirmText: "สร้างออเดอร์",
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

  const handleSelectType = (type: "READY_MADE" | "CUSTOM") => {
    setOrderType(type);
    setTypeSelected(true);
  };

  // ============================================================
  // TYPE SELECTION SCREEN
  // ============================================================

  if (!typeSelected) {
    return <OrderTypeSelector onSelect={handleSelectType} />;
  }

  // ============================================================
  // MAIN FORM
  // ============================================================

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={[
          { label: "ออเดอร์", href: "/orders" },
          { label: "สร้างใหม่" },
        ]}
        title="สร้างออเดอร์ใหม่"
        description={
          isQuickInquiry
            ? "บันทึกข้อมูลเบื้องต้น — รายละเอียดเพิ่มเติมภายหลัง"
            : "กรอกรายละเอียดออเดอร์"
        }
        action={
          <>
            {isCustom && (
              <div className="inline-flex gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800/60">
                <button
                  type="button"
                  onClick={() => setCustomMode("quick")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    customMode === "quick"
                      ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  สอบถาม
                </button>
                <button
                  type="button"
                  onClick={() => setCustomMode("full")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    customMode === "full"
                      ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  ระบุครบ
                </button>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTypeSelected(false)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              เปลี่ยนประเภท
            </Button>
          </>
        }
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
            onClick={dismissDraft}
            className="ml-auto"
          >
            เริ่มใหม่
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        {/* ============================================================ */}
        {/* LEFT COLUMN — Items + Images + Fees                          */}
        {/* ============================================================ */}
        <div className="space-y-6">
          {/* Product Lines */}
          {showItemsSection && (
            <Section
              title="รายการสินค้า"
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    addItem();
                    setExpandedItemIdx(items.length);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  รายการงานพิมพ์ใหม่
                </Button>
              }
              flush
            >
              <div className="divide-y divide-slate-100 px-5 dark:divide-slate-800">
                  {items.map((item, itemIdx) => (
                    <OrderItemCard
                      key={itemIdx}
                      item={item}
                      itemIdx={itemIdx}
                      canRemove={items.length > 1}
                      isExpanded={expandedItemIdx === itemIdx}
                      onToggleExpand={() => setExpandedItemIdx(expandedItemIdx === itemIdx ? null : itemIdx)}
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
                      onSetItems={(updater) => setItems(updater(items))}
                    />
                  ))}
              </div>
            </Section>
          )}

          {/* Reference Images */}
          <Section
            title={
              <span className="flex items-center gap-2">
                ภาพอ้างอิง / ไฟล์แบบ
                {isQuickInquiry && (
                  <span className="text-xs font-normal text-blue-600 dark:text-blue-400">
                    (แนะนำ)
                  </span>
                )}
              </span>
            }
          >
            <div className="space-y-3">
                {referenceImages.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {referenceImages.map((img, idx) => (
                      <div key={idx} className="group relative">
                        {img.preview ? (
                          <img src={img.preview} alt={img.fileName} className="h-24 w-24 rounded-xl border border-slate-200/60 object-cover dark:border-slate-700/60" />
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800"><ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" /></div>
                        )}
                        <button type="button" onClick={() => removeReferenceImage(idx)} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-600"><X className="h-3 w-3" /></button>
                        <NativeSelect value={img.printPosition || ""} onChange={(e) => { setReferenceImages((prev) => prev.map((im, i) => i === idx ? { ...im, printPosition: e.target.value || undefined } : im)); }} className="mt-1.5 h-7 w-24 px-1.5 py-0 text-[11px]">
                          <option value="">ทั่วไป</option>
                          {Object.entries(PRINT_POSITIONS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                        </NativeSelect>
                      </div>
                    ))}
                  </div>
                )}
                {referenceImages.length < 5 && (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-4 py-6 text-[13px] text-slate-500 transition-colors hover:border-blue-400 hover:bg-white hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:border-blue-500">
                    <input type="file" accept="image/*,.pdf,.ai,.psd" multiple onChange={handleImageUpload} className="hidden" disabled={uploading} />
                    {uploading ? (<><Loader2 className="h-4 w-4 animate-spin" />กำลังอัปโหลด...</>) : (<><Upload className="h-4 w-4" />อัปโหลดภาพอ้างอิง (สูงสุด 5 ภาพ)</>)}
                  </label>
                )}
            </div>
          </Section>

          {/* Order Fees */}
          {showFeeSections && (
            <OrderFeeSection
              fees={fees}
              onAddFee={addFee}
              onRemoveFee={removeFee}
              onUpdateFee={updateFee as (idx: number, field: string, value: unknown) => void}
              feeCatalog={feeCatalog}
            />
          )}
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN — Info + Price + Shipping + Actions (sticky)    */}
        {/* ============================================================ */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Channel */}
          <Section title="ช่องทาง" compact>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map((ch) => (
                  <FilterChip
                    key={ch}
                    selected={channel === ch}
                    onClick={() => setChannel(ch)}
                  >
                    {CHANNEL_LABELS[ch]}
                  </FilterChip>
                ))}
              </div>
              {isMarketplace && (
                <div>
                  <label className={sectionLabelClass}>
                    เลขออเดอร์ {CHANNEL_LABELS[channel]}
                  </label>
                  <Input
                    value={externalOrderId}
                    onChange={(e) => setExternalOrderId(e.target.value)}
                    placeholder="เช่น 2502120001234"
                  />
                </div>
              )}
            </div>
          </Section>

          {/* Basic Info */}
          <Section title="ข้อมูลทั่วไป" compact>
            <div className="space-y-3">
              <div>
                <label className={sectionLabelClass}>ลูกค้า *</label>
                <NativeSelect
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                >
                  <option value="">-- เลือกลูกค้า --</option>
                  {customers?.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ""}
                      {c.customerType === "CORPORATE" ? " [นิติบุคคล]" : ""}
                    </option>
                  ))}
                </NativeSelect>
                {selectedCustomer && isCorporateCustomer && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Badge variant="accent" size="sm">
                      นิติบุคคล
                    </Badge>
                    {selectedCustomer.taxId && (
                      <span className="text-[11px] text-slate-500">
                        Tax ID: {selectedCustomer.taxId}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className={sectionLabelClass}>ชื่องาน *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isQuickInquiry
                      ? "เช่น เสื้อยืดทีมฟุตบอล..."
                      : "เช่น เสื้อยืดทีม ABC..."
                  }
                  required
                />
              </div>
              <div>
                <label className={sectionLabelClass}>กำหนดส่ง</label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <label className={sectionLabelClass}>
                  รายละเอียด
                  {isQuickInquiry && (
                    <span className="ml-0.5 text-blue-600 dark:text-blue-400">
                      *
                    </span>
                  )}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    isQuickInquiry
                      ? "บันทึกสิ่งที่ลูกค้าต้องการ..."
                      : "รายละเอียดเพิ่มเติม..."
                  }
                  rows={isQuickInquiry ? 3 : 2}
                  required={isQuickInquiry}
                />
              </div>

              {isQuickInquiry && (
                <div>
                  <label className={sectionLabelClass}>
                    จำนวนโดยประมาณ (ชิ้น)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={estimatedQuantity}
                    onChange={(e) =>
                      setEstimatedQuantity(
                        e.target.value ? parseInt(e.target.value) : ""
                      )
                    }
                    placeholder="เช่น 50, 100..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={sectionLabelClass}>ความเร่งด่วน</label>
                  <NativeSelect
                    value={priority}
                    onChange={(e) =>
                      setPriority(
                        e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT"
                      )
                    }
                  >
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {!isQuickInquiry && (
                  <div>
                    <label className={sectionLabelClass}>ภาษี (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={taxRate || ""}
                      onChange={(e) =>
                        setTaxRate(parseFloat(e.target.value) || 0)
                      }
                      placeholder="0"
                    />
                  </div>
                )}
              </div>

              {!isQuickInquiry && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={sectionLabelClass}>เงื่อนไขชำระ</label>
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
                      <label className={sectionLabelClass}>เลขที่ PO</label>
                      <Input
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder="PO Number"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={sectionLabelClass}>หมายเหตุ</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="หมายเหตุภายใน..."
                  rows={2}
                />
              </div>
            </div>
          </Section>

          {/* Shipping Address */}
          {!isQuickInquiry && (
            <OrderShippingSection
              showShipping={showShipping}
              onToggleShipping={() => setShowShipping(!showShipping)}
              shipping={shipping}
              onUpdate={updateShipping}
            />
          )}

          {/* Price Summary */}
          {!isQuickInquiry && (
            <OrderPriceSummary
              pricingSummary={pricingSummary}
              showFeeSections={showFeeSections}
              isMarketplace={isMarketplace}
              channelLabel={CHANNEL_LABELS[channel]}
              taxRate={taxRate}
              platformFee={platformFee}
              discount={discount}
              onPlatformFeeChange={setPlatformFee}
              onDiscountChange={setDiscount}
            />
          )}

          {/* Validation Errors */}
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

          {/* Actions */}
          <div className="flex flex-col gap-1.5 pt-2">
            <Button
              type="submit"
              disabled={createOrder.isPending}
              className="w-full"
            >
              {createOrder.isPending ? "กำลังบันทึก..." : isQuickInquiry ? "บันทึกการสอบถาม" : "สร้างออเดอร์"}
            </Button>
            <div className="flex items-center justify-center gap-1 text-[12px]">
              {!isQuickInquiry && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={createOrder.isPending}
                    onClick={handleSaveDraft}
                  >
                    <Save className="h-3.5 w-3.5" />
                    บันทึกร่าง
                  </Button>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                </>
              )}
              <Link href="/orders">
                <Button type="button" variant="ghost" size="sm">
                  ยกเลิก
                </Button>
              </Link>
            </div>
          </div>

          {createOrder.isError && (
            <div className="rounded-xl bg-red-50/70 p-3 text-[12px] text-red-700 dark:bg-red-950/20 dark:text-red-300">
              {createOrder.error.message}
            </div>
          )}
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
