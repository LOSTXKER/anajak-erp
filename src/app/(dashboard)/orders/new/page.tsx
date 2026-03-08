"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CHANNEL_LABELS,
  ORDER_TYPE_LABELS,
  PRIORITY_LABELS,
  PAYMENT_TERMS_LABELS,
  isMarketplaceChannel,
} from "@/lib/order-status";
import {
  calculateItemSubtotal,
  calculateTotalQuantity,
} from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Search,
  Package,
  Palette,
  ShoppingBag,
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
import type { OrderItemForm, ReferenceImage } from "@/types/order-form";
import {
  EMPTY_ITEM,
  PRINT_POSITIONS,
  deriveProcessingType,
  validateOrderItem,
} from "@/types/order-form";
import { toast } from "sonner";
import {
  OrderTypeSelector,
  OrderItemCard,
  OrderFeeSection,
  OrderShippingSection,
  OrderPriceSummary,
} from "@/components/orders/new";

const CHANNELS = Object.keys(CHANNEL_LABELS) as string[];

const selectClass =
  "flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const sectionLabelClass =
  "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300";

export default function NewOrderPage() {
  const router = useRouter();
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

  const [showShipping, setShowShipping] = useState(false);
  const [shippingRecipientName, setShippingRecipientName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddr, setShippingAddr] = useState("");
  const [shippingSubDistrict, setShippingSubDistrict] = useState("");
  const [shippingDistrict, setShippingDistrict] = useState("");
  const [shippingProvince, setShippingProvince] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");

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
    if (selectedCustomer?.address && !shippingAddr && !shippingRecipientName) {
      setShippingRecipientName(selectedCustomer.name);
      setShippingPhone(selectedCustomer.phone ?? "");
      setShippingAddr(selectedCustomer.address);
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
    const subtotalItems = items.reduce((sum, item) => {
      const totalQuantity = calculateTotalQuantity(item.variants);
      return (
        sum +
        calculateItemSubtotal({
          baseUnitPrice: item.baseUnitPrice,
          totalQuantity,
          prints: item.prints,
          addons: item.addons,
        })
      );
    }, 0);
    const subtotalFees = fees.reduce((sum, f) => sum + f.amount, 0);
    const pf = isMarketplace ? platformFee : 0;
    const subtotalBeforeTax = subtotalItems + subtotalFees + pf - discount;
    const taxAmount = taxRate > 0 ? subtotalBeforeTax * (taxRate / 100) : 0;
    const grandTotal = Math.max(0, subtotalBeforeTax + taxAmount);
    return { subtotalItems, subtotalFees, platformFee: pf, discount, taxAmount, grandTotal };
  }, [items, fees, platformFee, discount, isMarketplace, taxRate, isQuickInquiry]);

  const handleVariantsSelected = (selected: SelectedVariantItem[]) => {
    const grouped = new Map<string, { product: SelectedVariantItem; variants: { size: string; color: string; quantity: number }[]; totalStock: number }>();
    for (const v of selected) {
      const existing = grouped.get(v.productId);
      if (existing) {
        existing.variants.push({ size: v.size, color: v.color, quantity: v.quantity });
        existing.totalStock += v.stock;
      } else {
        grouped.set(v.productId, {
          product: v,
          variants: [{ size: v.size, color: v.color, quantity: v.quantity }],
          totalStock: v.stock,
        });
      }
    }

    const newItems: OrderItemForm[] = Array.from(grouped.values()).map(({ product, variants, totalStock }) => ({
      ...structuredClone(EMPTY_ITEM),
      productId: product.productId,
      itemSource: "FROM_STOCK",
      productType: product.productType,
      description: product.name,
      baseUnitPrice: product.basePrice,
      variants,
      productImageUrl: product.imageUrl,
      productSku: product.productSku,
      productName: product.name,
      stockAvailable: totalStock,
    }));

    setItems((prev) => {
      const filtered = prev.filter(
        (it) => it.description || it.productId || it.variants.some((vr) => vr.size),
      );
      const result = filtered.length > 0 ? [...filtered, ...newItems] : newItems;
      setExpandedItemIdx(result.length - newItems.length);
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
      });

      const subtotal = pricingSummary.subtotalItems + pricingSummary.subtotalFees;
      if (discount > subtotal) {
        errors.push(`ส่วนลด (${formatCurrency(discount)}) มากกว่ายอดรวมก่อนหักส่วนลด (${formatCurrency(subtotal)})`);
      }
    }

    if (showShipping) {
      if (!shippingRecipientName.trim()) errors.push("กรุณาระบุชื่อผู้รับ (ที่อยู่จัดส่ง)");
      if (!shippingAddr.trim()) errors.push("กรุณาระบุที่อยู่จัดส่ง");
      if (shippingPhone && !/^0\d{8,9}$/.test(shippingPhone)) {
        errors.push("เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก");
      }
      if (shippingPostalCode && !/^\d{5}$/.test(shippingPostalCode)) {
        errors.push("รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก");
      }
    }

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
    paymentTerms: paymentTerms || undefined,
    poNumber: poNumber || undefined,
    taxRate,
    estimatedQuantity: estimatedQuantity ? Number(estimatedQuantity) : undefined,
    ...(showShipping && shippingRecipientName && {
      shippingAddress: {
        recipientName: shippingRecipientName,
        phone: shippingPhone,
        address: shippingAddr,
        subDistrict: shippingSubDistrict || undefined,
        district: shippingDistrict || undefined,
        province: shippingProvince || undefined,
        postalCode: shippingPostalCode || undefined,
      },
    }),
    items: isQuickInquiry
      ? []
      : items.map((item) => ({
          productId: item.productId,
          productType: item.productType,
          description: item.description,
          material: item.material || undefined,
          baseUnitPrice: item.baseUnitPrice,
          itemSource: (item.itemSource || undefined) as "FROM_STOCK" | "CUSTOM_MADE" | "CUSTOMER_PROVIDED" | undefined,
          fabricType: item.fabricType || undefined,
          fabricWeight: item.fabricWeight || undefined,
          fabricColor: item.fabricColor || undefined,
          processingType: deriveProcessingType(item.itemSource, item.needsPrinting) as "PRINT_ONLY" | "CUT_AND_SEW_PRINT" | "CUT_AND_SEW_ONLY" | "PACK_ONLY" | "FULL_PRODUCTION",
          variants: item.variants.map((v) => ({
            size: v.size,
            color: v.color || undefined,
            quantity: v.quantity,
          })),
          prints: item.needsPrinting
            ? item.prints.map((p) => ({
                position: p.position,
                printType: p.printType,
                colorCount: p.colorCount || undefined,
                printSize: p.printSize || undefined,
                width: p.width || undefined,
                height: p.height || undefined,
                designNote: p.designNote || undefined,
                designImageUrl: p.designImageUrl || undefined,
                unitPrice: p.unitPrice,
              }))
            : [],
          addons: item.addons.map((a) => ({
            addonType: a.addonType,
            name: a.name,
            pricingType: a.pricingType as "PER_PIECE" | "PER_ORDER",
            unitPrice: a.unitPrice,
          })),
          notes: item.notes || undefined,
          // Garment spec (CUSTOM_MADE)
          patternId: item.patternId || undefined,
          collarType: item.collarType || undefined,
          sleeveType: item.sleeveType || undefined,
          bodyFit: item.bodyFit || undefined,
          patternFileUrl: item.patternFileUrl || undefined,
          patternNote: item.patternNote || undefined,
          // Receive tracking (CUSTOMER_PROVIDED)
          garmentCondition: item.garmentCondition || undefined,
          receivedInspected: item.receivedInspected,
          receiveNote: item.receiveNote || undefined,
        })),
    fees: showFeeSections
      ? fees.map((f) => ({
          feeType: f.feeType,
          name: f.name,
          amount: f.amount,
        }))
      : [],
    referenceImages: referenceImages.map((img) => ({
      fileUrl: img.fileUrl,
      fileName: img.fileName,
      fileSize: img.fileSize,
      printPosition: img.printPosition || undefined,
    })),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    setFormErrors(errors);
    if (errors.length > 0) return;

    const summary = isQuickInquiry
      ? `สร้างการสอบถาม "${title}"?`
      : `สร้างออเดอร์ ${title} - ${items.length} รายการ - ยอดรวม ${formatCurrency(pricingSummary.grandTotal)} บาท?`;
    if (!window.confirm(summary)) return;

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
    <div className="space-y-6">
      {/* Header with type badge */}
      <div className="flex items-center gap-3">
        <Link href="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              สร้างออเดอร์ใหม่
            </h1>
            <Badge
              variant="outline"
              className={
                isCustom
                  ? "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
              }
            >
              {isCustom ? (
                <Palette className="mr-1 h-3 w-3" />
              ) : (
                <ShoppingBag className="mr-1 h-3 w-3" />
              )}
              {ORDER_TYPE_LABELS[orderType]}
            </Badge>
            <button
              type="button"
              onClick={() => setTypeSelected(false)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <RefreshCw className="h-3 w-3" />
              เปลี่ยนประเภท
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isQuickInquiry
              ? "บันทึกข้อมูลเบื้องต้น — รายละเอียดเพิ่มเติมภายหลัง"
              : "กรอกรายละเอียดออเดอร์"}
          </p>
        </div>
      </div>

      {/* MODE TOGGLE (CUSTOM only) */}
      {isCustom && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setCustomMode("quick")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              customMode === "quick"
                ? "bg-purple-100 text-purple-800 shadow-sm dark:bg-purple-900 dark:text-purple-200"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Zap className="h-4 w-4" />
            สอบถามเบื้องต้น
            <span className="hidden text-xs opacity-70 sm:inline">
              (ข้อมูลน้อย ใส่รายละเอียดภายหลัง)
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCustomMode("full")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              customMode === "full"
                ? "bg-purple-100 text-purple-800 shadow-sm dark:bg-purple-900 dark:text-purple-200"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <ListChecks className="h-4 w-4" />
            ระบุรายละเอียดครบ
            <span className="hidden text-xs opacity-70 sm:inline">
              (รู้ราคา จำนวน ตำแหน่งพิมพ์)
            </span>
          </button>
        </div>
      )}

      {hasDraft && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
          <span className="text-sm text-amber-800 dark:text-amber-200">
            พบข้อมูลร่างที่ยังไม่ได้บันทึก — กรอกต่อจากเดิมหรือเริ่มใหม่?
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={dismissDraft}
            className="ml-auto border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
          >
            เริ่มใหม่
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* ============================================================ */}
        {/* LEFT COLUMN — Items + Images + Fees                          */}
        {/* ============================================================ */}
        <div className="space-y-6">
          {/* Reference Images */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4" />
                ภาพอ้างอิง / ไฟล์แบบ
                {isQuickInquiry && (
                  <span className="text-xs font-normal text-purple-500">(แนะนำ)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {referenceImages.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {referenceImages.map((img, idx) => (
                      <div key={idx} className="group relative">
                        {img.preview ? (
                          <img src={img.preview} alt={img.fileName} className="h-24 w-24 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"><ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" /></div>
                        )}
                        <button type="button" onClick={() => removeReferenceImage(idx)} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-600"><X className="h-3 w-3" /></button>
                        <select value={img.printPosition || ""} onChange={(e) => { setReferenceImages((prev) => prev.map((im, i) => i === idx ? { ...im, printPosition: e.target.value || undefined } : im)); }} className="mt-1 w-24 rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          <option value="">ทั่วไป</option>
                          {Object.entries(PRINT_POSITIONS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                        </select>
                        {img.printPosition && (<Badge variant="secondary" className="mt-0.5 text-[9px]">{PRINT_POSITIONS[img.printPosition] || img.printPosition}</Badge>)}
                        <p className="max-w-[6rem] truncate text-[10px] text-slate-400">{img.fileName}</p>
                      </div>
                    ))}
                  </div>
                )}
                {referenceImages.length < 5 && (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400">
                    <input type="file" accept="image/*,.pdf,.ai,.psd" multiple onChange={handleImageUpload} className="hidden" disabled={uploading} />
                    {uploading ? (<><Loader2 className="h-5 w-5 animate-spin" />กำลังอัปโหลด...</>) : (<><Upload className="h-5 w-5" />อัปโหลดภาพอ้างอิง (สูงสุด 5 ภาพ, ไม่เกิน 10MB)</>)}
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Product Lines */}
          {showItemsSection && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  รายการสินค้า
                </CardTitle>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                    <Search className="mr-1 h-4 w-4" />
                    เพิ่มจากสต็อก
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { addItem(); setExpandedItemIdx(items.length); }}>
                    <Plus className="mr-1 h-4 w-4" />
                    เพิ่มรายการเปล่า
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-0">
                {items.length > 1 && (
                  <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:text-slate-500">
                    <span className="w-6" />
                    <span className="w-16">แหล่ง</span>
                    <span className="flex-1">สินค้า</span>
                    <span className="hidden flex-shrink-0 sm:block">ไซส์/สี</span>
                    <span className="w-12 text-center">จำนวน</span>
                    <span className="hidden w-16 text-center md:block">สกรีน</span>
                    <span className="w-20 text-right">ราคารวม</span>
                    <span className="w-[4.5rem]" />
                  </div>
                )}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
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
              </CardContent>
            </Card>
          )}

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
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {/* Channel */}
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div>
                <label className={sectionLabelClass}>ช่องทาง *</label>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNELS.map((ch) => (
                    <button key={ch} type="button" onClick={() => setChannel(ch)} className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${channel === ch ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"}`}>
                      {CHANNEL_LABELS[ch]}
                    </button>
                  ))}
                </div>
              </div>
              {isMarketplace && (
                <div>
                  <label className={sectionLabelClass}>เลขออเดอร์ {CHANNEL_LABELS[channel]}</label>
                  <Input value={externalOrderId} onChange={(e) => setExternalOrderId(e.target.value)} placeholder="เช่น 2502120001234" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">ข้อมูลทั่วไป</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className={sectionLabelClass}>ลูกค้า *</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className={selectClass}>
                  <option value="">-- เลือกลูกค้า --</option>
                  {customers?.customers.map((c) => (<option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}{c.customerType === "CORPORATE" ? " [นิติบุคคล]" : ""}</option>))}
                </select>
                {selectedCustomer && isCorporateCustomer && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant="default" className="gap-1 text-[10px]">นิติบุคคล</Badge>
                    {selectedCustomer.taxId && <span className="text-[10px] text-slate-400">Tax ID: {selectedCustomer.taxId}</span>}
                  </div>
                )}
              </div>
              <div>
                <label className={sectionLabelClass}>ชื่องาน *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isQuickInquiry ? "เช่น เสื้อยืดทีมฟุตบอล..." : "เช่น เสื้อยืดทีม ABC..."} required />
              </div>
              <div>
                <label className={sectionLabelClass}>กำหนดส่ง</label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div>
                <label className={sectionLabelClass}>รายละเอียด {isQuickInquiry && <span className="text-purple-500">*</span>}</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isQuickInquiry ? "บันทึกสิ่งที่ลูกค้าต้องการ..." : "รายละเอียดเพิ่มเติม..."} rows={isQuickInquiry ? 3 : 2} required={isQuickInquiry} />
              </div>

              {isQuickInquiry && (
                <div>
                  <label className={sectionLabelClass}>จำนวนโดยประมาณ (ชิ้น)</label>
                  <Input type="number" min={1} value={estimatedQuantity} onChange={(e) => setEstimatedQuantity(e.target.value ? parseInt(e.target.value) : "")} placeholder="เช่น 50, 100..." />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={sectionLabelClass}>ความเร่งด่วน</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT")} className={selectClass}>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
                {!isQuickInquiry && (
                  <div>
                    <label className={sectionLabelClass}>ภาษี (%)</label>
                    <Input type="number" min={0} max={100} step={0.01} value={taxRate || ""} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} placeholder="0" />
                  </div>
                )}
              </div>

              {!isQuickInquiry && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={sectionLabelClass}>เงื่อนไขชำระ</label>
                    <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={selectClass}>
                      <option value="">-- ไม่ระบุ --</option>
                      {Object.entries(PAYMENT_TERMS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                    </select>
                  </div>
                  {isCorporateCustomer && (
                    <div>
                      <label className={sectionLabelClass}>เลขที่ PO</label>
                      <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO Number" />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={sectionLabelClass}>หมายเหตุ</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุภายใน..." rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {!isQuickInquiry && (
            <OrderShippingSection
              showShipping={showShipping}
              onToggleShipping={() => setShowShipping(!showShipping)}
              shipping={{
                recipientName: shippingRecipientName,
                phone: shippingPhone,
                address: shippingAddr,
                subDistrict: shippingSubDistrict,
                district: shippingDistrict,
                province: shippingProvince,
                postalCode: shippingPostalCode,
              }}
              onUpdate={(field, value) => {
                const setters: Record<string, (v: string) => void> = {
                  recipientName: setShippingRecipientName,
                  phone: setShippingPhone,
                  address: setShippingAddr,
                  subDistrict: setShippingSubDistrict,
                  district: setShippingDistrict,
                  province: setShippingProvince,
                  postalCode: setShippingPostalCode,
                };
                setters[field]?.(value);
              }}
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
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="mb-1.5 text-xs font-semibold text-red-700 dark:text-red-300">กรุณาแก้ไข:</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-red-600 dark:text-red-400">
                {formErrors.map((err, i) => (<li key={i}>{err}</li>))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              disabled={createOrder.isPending}
              className={`w-full ${isQuickInquiry ? "gap-1 bg-purple-600 text-white hover:bg-purple-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              {createOrder.isPending ? "กำลังบันทึก..." : isQuickInquiry ? "บันทึกการสอบถาม" : "สร้างออเดอร์"}
            </Button>
            <div className="flex gap-2">
              {!isQuickInquiry && (
                <Button type="button" variant="outline" disabled={createOrder.isPending} onClick={handleSaveDraft} className="flex-1 gap-1 text-xs">
                  <Save className="h-3.5 w-3.5" />บันทึกร่าง
                </Button>
              )}
              <Link href="/orders" className={isQuickInquiry ? "flex-1" : ""}>
                <Button type="button" variant="outline" className={`text-xs ${isQuickInquiry ? "w-full" : ""}`}>ยกเลิก</Button>
              </Link>
            </div>
          </div>

          {createOrder.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
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
