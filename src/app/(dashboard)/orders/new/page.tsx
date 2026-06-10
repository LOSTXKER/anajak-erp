"use client";

// หน้าเปิดงานใหม่ — โหมดเดียว ไม่ถามชนิดออเดอร์ (ระบบ derive จากเนื้อรายการเอง):
// การ์ดบน = แกนบังคับ (ลูกค้า/ชื่องาน) เปิดงานได้ใน 15 วินาทีระหว่างถือแชท
// ส่วนที่เหลือ = กล่องพับ ใส่ตอนนี้หรือไปเติมที่หน้าออเดอร์ทีหลังก็ได้
// (ด่านฝั่ง server กันให้: ยืนยันออเดอร์ต้องมีรายการ · ปิดงานต้องวางบิลครบ)

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
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Badge } from "@/components/ui/badge";
import { FilterChip } from "@/components/ui/filter-chip";
import { PageHeader } from "@/components/page-header";
import {
  CHANNEL_LABELS,
  PRIORITY_LABELS,
  isMarketplaceChannel,
} from "@/lib/order-status";
import { PAYMENT_TERMS_LABELS, type PaymentTermsValue } from "@/lib/payment-terms";
import { customerProfileGaps } from "@/lib/customer-gaps";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/customer-picker";
import {
  calculateFormItemSubtotal,
  calculateOrderSummary,
} from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import { Plus, ImageIcon, Upload, X, Loader2, Save } from "lucide-react";
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
import type { ReferenceImage } from "@/types/order-form";
import {
  EMPTY_ITEM,
  EMPTY_PRODUCT,
  PRINT_POSITIONS,
  itemHasContent,
  validateOrderItem,
  validateOrderItemProduct,
} from "@/types/order-form";
import { mapItemsToMutationInput, mapFeesToMutationInput } from "@/lib/order-mapping";
import { toast } from "sonner";
import {
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

  const [channel, setChannel] = useState("LINE");
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

  // ลูกค้าเลือกผ่าน CustomerPicker (ค้นหา+เพิ่มด่วน) — เก็บ object ที่เลือกไว้ใช้ prefill
  const [selectedCustomer, setSelectedCustomer] = useState<PickerCustomer | null>(null);

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
  // (เกณฑ์เดียวกับระบบ draft ใน useOrderItemsForm — แชร์ผ่าน itemHasContent)
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

  // ภาระหนี้เทียบวงเงิน — เตือนตั้งแต่ตอนเลือกลูกค้า (ด่านจริงอยู่ฝั่ง server ตอนยืนยันออเดอร์)
  const creditStatus = trpc.customer.creditStatus.useQuery(
    { customerId },
    { enabled: !!customerId && selectedCustomer?.creditLimit != null }
  );
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
    // (เป็นเงินที่ marketplace หักจากยอดโอน — เก็บไว้เป็นข้อมูลอ้างอิงเท่านั้น)
    const summary = calculateOrderSummary({
      itemSubtotals: items.map((item) => calculateFormItemSubtotal(item)),
      feeAmounts: fees.map((f) => f.amount),
      discount,
      taxRate,
    });
    return { ...summary, platformFee: isMarketplace ? platformFee : 0 };
  }, [items, fees, platformFee, discount, isMarketplace, taxRate, hasItemContent]);

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

    // เปิดงานเบา (ยังไม่มีรายการ) ต้องจดความต้องการไว้ — ไม่งั้นกลับมาดูแล้วไม่รู้ลูกค้าเอาอะไร
    if (!hasItemContent && !description.trim()) {
      errors.push("ยังไม่ใส่รายการสินค้า — กรุณาจดรายละเอียดที่ลูกค้าต้องการไว้ก่อน");
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
    title,
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
    estimatedQuantity: estimatedQuantity ? Number(estimatedQuantity) : undefined,
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
    const ok = await confirmDialog(
      hasItemContent
        ? {
            title: `เปิดงาน "${title}"?`,
            description: `${items.length} รายการ (${totalProducts} สินค้า) · ยอดรวม ${formatCurrency(pricingSummary.grandTotal)}`,
            confirmText: "เปิดงาน",
          }
        : {
            title: `เปิดงาน "${title}"?`,
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
        description="ใส่แค่ลูกค้ากับชื่องานก็เปิดได้ — รายการ/ราคา/ที่อยู่ เติมตอนนี้หรือไปเติมที่หน้าออเดอร์ทีหลัง"
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

      {/* noValidate: ใช้ validateForm (กล่อง error เดียว) แทน native validation —
          กล่องพับซ่อนด้วย CSS ทำให้ browser validation บน input ที่มองไม่เห็นพัง submit เงียบ */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* ============================================================
            แกนบังคับ — เปิดงานได้จากการ์ดนี้การ์ดเดียว
        ============================================================ */}
        <Section title="เริ่มงาน">
          <div className="space-y-3.5">
            <div>
              <label className={sectionLabelClass}>ลูกค้า *</label>
              <CustomerPicker
                value={customerId}
                onChange={(id, customer) => {
                  setCustomerId(id);
                  setSelectedCustomer(customer);
                }}
                required
              />
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
              {selectedCustomer && customerProfileGaps(selectedCustomer).length > 0 && (
                <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                  โปรไฟล์ยังไม่ครบ:{" "}
                  {customerProfileGaps(selectedCustomer)
                    .map((g) => g.label)
                    .join(" · ")}{" "}
                  — ขอจากลูกค้าแล้วเติมได้ที่หน้าลูกค้า
                </p>
              )}
              {creditStatus.data?.available != null && (
                <p
                  className={`mt-1.5 text-[11px] ${
                    creditStatus.data.available < 0
                      ? "font-medium text-red-600 dark:text-red-400"
                      : "text-slate-500"
                  }`}
                >
                  วงเงินเครดิต: ใช้ไป {formatCurrency(creditStatus.data.exposure)} /{" "}
                  {formatCurrency(creditStatus.data.creditLimit ?? 0)}
                  {creditStatus.data.available < 0
                    ? ` — เกินวงเงินแล้ว ${formatCurrency(Math.abs(creditStatus.data.available))}`
                    : ` (ใช้ได้อีก ${formatCurrency(creditStatus.data.available)})`}
                </p>
              )}
            </div>

            <div>
              <label className={sectionLabelClass}>ชื่องาน *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น เสื้อยืดทีม ABC 50 ตัว..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={sectionLabelClass}>กำหนดส่ง</label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <label className={sectionLabelClass}>ความเร่งด่วน</label>
                <NativeSelect
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT")
                  }
                >
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div>
              <label className={sectionLabelClass}>
                รายละเอียดจากแชท
                {!hasItemContent && (
                  <span className="ml-0.5 text-blue-600 dark:text-blue-400">*</span>
                )}
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="จดสิ่งที่ลูกค้าต้องการ — แบบ/สี/จำนวน/งบ..."
                rows={3}
                required={!hasItemContent}
              />
            </div>

            {!hasItemContent && (
              <div>
                <label className={sectionLabelClass}>จำนวนโดยประมาณ (ชิ้น)</label>
                <Input
                  type="number"
                  min={1}
                  value={estimatedQuantity}
                  onChange={(e) =>
                    setEstimatedQuantity(e.target.value ? parseInt(e.target.value) : "")
                  }
                  placeholder="เช่น 50, 100..."
                />
              </div>
            )}

            <div>
              <label className={sectionLabelClass}>ช่องทาง</label>
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
                <div className="mt-2">
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

            <div>
              <label className={sectionLabelClass}>หมายเหตุภายใน</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="หมายเหตุภายใน..."
                rows={2}
              />
            </div>

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

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" disabled={createOrder.isPending} className="flex-1">
                {createOrder.isPending
                  ? "กำลังบันทึก..."
                  : hasItemContent
                    ? `เปิดงาน · ${formatCurrency(pricingSummary.grandTotal)}`
                    : "เปิดงาน (เติมรายละเอียดทีหลัง)"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={createOrder.isPending}
                onClick={handleSaveDraft}
                title="บันทึกร่าง"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Link href="/orders">
                <Button type="button" variant="ghost" size="sm">
                  ยกเลิก
                </Button>
              </Link>
            </div>
          </div>
        </Section>

        {/* ============================================================
            ส่วนเสริม — ใส่ตอนนี้หรือไปเติมที่หน้าออเดอร์ทีหลังก็ได้
        ============================================================ */}
        <CollapsibleSection
          title="รายการสินค้าและราคา"
          defaultOpen={hasDraft}
          summary={
            hasItemContent
              ? `${items.length} รายการ · ยอดรวม ${formatCurrency(pricingSummary.grandTotal)}`
              : "ยังไม่ใส่ — เติมทีหลังที่หน้าออเดอร์ได้"
          }
        >
          <div className="space-y-4">
            <div className="flex justify-end">
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
            </div>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/60 dark:divide-slate-800 dark:border-slate-800/60">
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

            <OrderFeeSection
              fees={fees}
              onAddFee={addFee}
              onRemoveFee={removeFee}
              onUpdateFee={updateFee as (idx: number, field: string, value: unknown) => void}
              feeCatalog={feeCatalog}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div>
                <label className={sectionLabelClass}>ภาษี (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxRate || ""}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
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
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="รูป / ไฟล์อ้างอิงจากแชท"
          defaultOpen={referenceImages.length > 0}
          summary={
            referenceImages.length > 0
              ? `${referenceImages.length} ไฟล์`
              : "แนะนำแนบรูปที่ลูกค้าส่งมา"
          }
        >
          <div className="space-y-3">
            {referenceImages.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {referenceImages.map((img, idx) => (
                  <div key={idx} className="group relative">
                    {img.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
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
        </CollapsibleSection>

        <OrderShippingSection
          showShipping={showShipping}
          onToggleShipping={() => setShowShipping(!showShipping)}
          shipping={shipping}
          onUpdate={updateShipping}
        />
      </form>

      <ProductPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectVariants={handleVariantsSelected}
      />
    </div>
  );
}
