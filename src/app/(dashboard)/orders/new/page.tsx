"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CHANNEL_LABELS,
  ORDER_TYPE_LABELS,
  isMarketplaceChannel,
} from "@/lib/order-status";
import {
  calculateItemSubtotal,
  calculateTotalQuantity,
  formatCurrency,
} from "@/lib/pricing";
import { ArrowLeft, Plus, Trash2, Package, Search } from "lucide-react";
import {
  ProductPickerDialog,
  type SelectedProduct,
} from "@/components/product-picker";

// ============================================================
// TYPES
// ============================================================

type Variant = { size: string; color: string; quantity: number };
type Print = {
  position: string;
  printType: string;
  colorCount: number;
  unitPrice: number;
};
type Addon = {
  addonType: string;
  name: string;
  pricingType: "PER_PIECE" | "PER_ORDER";
  unitPrice: number;
};
type OrderItem = {
  productId?: string;
  productType: string;
  description: string;
  material: string;
  baseUnitPrice: number;
  variants: Variant[];
  prints: Print[];
  addons: Addon[];
  notes: string;
};
type OrderFee = {
  feeType: string;
  name: string;
  amount: number;
};

// ============================================================
// DEFAULTS
// ============================================================

const emptyVariant: Variant = { size: "", color: "", quantity: 1 };
const emptyPrint: Print = {
  position: "FRONT",
  printType: "SILK_SCREEN",
  colorCount: 1,
  unitPrice: 0,
};
const emptyAddon: Addon = {
  addonType: "",
  name: "",
  pricingType: "PER_PIECE",
  unitPrice: 0,
};
const emptyItem: OrderItem = {
  productType: "T_SHIRT",
  description: "",
  material: "",
  baseUnitPrice: 0,
  variants: [{ ...emptyVariant }],
  prints: [],
  addons: [],
  notes: "",
};
const emptyFee: OrderFee = { feeType: "", name: "", amount: 0 };

// ============================================================
// CONSTANTS
// ============================================================

const PRODUCT_TYPES: Record<string, string> = {
  T_SHIRT: "เสื้อยืด",
  POLO: "เสื้อโปโล",
  HOODIE: "ฮู้ด",
  JACKET: "แจ็คเก็ต",
  TOTE_BAG: "ถุงผ้า",
  OTHER: "อื่นๆ",
};

const PRINT_POSITIONS: Record<string, string> = {
  FRONT: "หน้า",
  BACK: "หลัง",
  SLEEVE_L: "แขนซ้าย",
  SLEEVE_R: "แขนขวา",
  COLLAR: "ปก",
  POCKET: "กระเป๋า",
};

const PRINT_TYPES: Record<string, string> = {
  SILK_SCREEN: "Silk Screen",
  DTG: "DTG",
  SUBLIMATION: "Sublimation",
  HEAT_TRANSFER: "Heat Transfer",
  EMBROIDERY: "ปัก",
};

const CHANNELS = Object.keys(CHANNEL_LABELS) as string[];

const selectClass =
  "flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

const sectionLabelClass =
  "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300";

// ============================================================
// COMPONENT
// ============================================================

export default function NewOrderPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  // -- Step 0 --
  const [channel, setChannel] = useState("LINE");
  const [orderType, setOrderType] = useState<"READY_MADE" | "CUSTOM">("CUSTOM");
  const [externalOrderId, setExternalOrderId] = useState("");

  // -- Step 1 --
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  // -- Step 2 --
  const [items, setItems] = useState<OrderItem[]>([
    JSON.parse(JSON.stringify(emptyItem)),
  ]);

  // -- Step 3 --
  const [fees, setFees] = useState<OrderFee[]>([]);

  // -- Step 4 --
  const [platformFee, setPlatformFee] = useState(0);
  const [discount, setDiscount] = useState(0);

  // -- Product picker --
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItemIndex, setPickerItemIndex] = useState<number | null>(null);

  // ---- data ----
  const { data: customers } = trpc.customer.list.useQuery({ limit: 100 });

  const createOrder = trpc.order.create.useMutation({
    onSuccess: (data) => {
      utils.order.list.invalidate();
      router.push(`/orders/${data.id}`);
    },
  });

  const isCustom = orderType === "CUSTOM";
  const isMarketplace = isMarketplaceChannel(channel);

  // ---- pricing calculations ----
  const pricingSummary = useMemo(() => {
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
    const grandTotal = Math.max(0, subtotalItems + subtotalFees + pf - discount);
    return { subtotalItems, subtotalFees, platformFee: pf, discount, grandTotal };
  }, [items, fees, platformFee, discount, isMarketplace]);

  // ---- item helpers ----
  const addItem = () =>
    setItems([...items, JSON.parse(JSON.stringify(emptyItem))]);

  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));

  const updateItem = <K extends keyof OrderItem>(
    idx: number,
    field: K,
    value: OrderItem[K],
  ) => {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: value };
    setItems(copy);
  };

  // variant helpers
  const addVariant = (itemIdx: number) => {
    const copy = [...items];
    copy[itemIdx] = {
      ...copy[itemIdx],
      variants: [...copy[itemIdx].variants, { ...emptyVariant }],
    };
    setItems(copy);
  };
  const removeVariant = (itemIdx: number, vIdx: number) => {
    const copy = [...items];
    copy[itemIdx] = {
      ...copy[itemIdx],
      variants: copy[itemIdx].variants.filter((_, i) => i !== vIdx),
    };
    setItems(copy);
  };
  const updateVariant = <K extends keyof Variant>(
    itemIdx: number,
    vIdx: number,
    field: K,
    value: Variant[K],
  ) => {
    const copy = [...items];
    const variants = [...copy[itemIdx].variants];
    variants[vIdx] = { ...variants[vIdx], [field]: value };
    copy[itemIdx] = { ...copy[itemIdx], variants };
    setItems(copy);
  };

  // print helpers
  const addPrint = (itemIdx: number) => {
    const copy = [...items];
    copy[itemIdx] = {
      ...copy[itemIdx],
      prints: [...copy[itemIdx].prints, { ...emptyPrint }],
    };
    setItems(copy);
  };
  const removePrint = (itemIdx: number, pIdx: number) => {
    const copy = [...items];
    copy[itemIdx] = {
      ...copy[itemIdx],
      prints: copy[itemIdx].prints.filter((_, i) => i !== pIdx),
    };
    setItems(copy);
  };
  const updatePrint = <K extends keyof Print>(
    itemIdx: number,
    pIdx: number,
    field: K,
    value: Print[K],
  ) => {
    const copy = [...items];
    const prints = [...copy[itemIdx].prints];
    prints[pIdx] = { ...prints[pIdx], [field]: value };
    copy[itemIdx] = { ...copy[itemIdx], prints };
    setItems(copy);
  };

  // addon helpers
  const addAddon = (itemIdx: number) => {
    const copy = [...items];
    copy[itemIdx] = {
      ...copy[itemIdx],
      addons: [...copy[itemIdx].addons, { ...emptyAddon }],
    };
    setItems(copy);
  };
  const removeAddon = (itemIdx: number, aIdx: number) => {
    const copy = [...items];
    copy[itemIdx] = {
      ...copy[itemIdx],
      addons: copy[itemIdx].addons.filter((_, i) => i !== aIdx),
    };
    setItems(copy);
  };
  const updateAddon = <K extends keyof Addon>(
    itemIdx: number,
    aIdx: number,
    field: K,
    value: Addon[K],
  ) => {
    const copy = [...items];
    const addons = [...copy[itemIdx].addons];
    addons[aIdx] = { ...addons[aIdx], [field]: value };
    copy[itemIdx] = { ...copy[itemIdx], addons };
    setItems(copy);
  };

  // fee helpers
  const addFee = () => setFees([...fees, { ...emptyFee }]);
  const removeFee = (idx: number) => setFees(fees.filter((_, i) => i !== idx));
  const updateFee = <K extends keyof OrderFee>(
    idx: number,
    field: K,
    value: OrderFee[K],
  ) => {
    const copy = [...fees];
    copy[idx] = { ...copy[idx], [field]: value };
    setFees(copy);
  };

  // ---- product picker handler ----
  const openPickerForItem = (idx: number) => {
    setPickerItemIndex(idx);
    setPickerOpen(true);
  };

  const handleProductSelected = (product: SelectedProduct) => {
    if (pickerItemIndex === null) return;
    const copy = [...items];
    copy[pickerItemIndex] = {
      ...copy[pickerItemIndex],
      productId: product.productId,
      productType: product.productType,
      description: product.name,
      baseUnitPrice: product.basePrice,
      material: "",
      variants:
        product.variants.length > 0
          ? product.variants.map((v) => ({
              size: v.size,
              color: v.color,
              quantity: 0,
            }))
          : [{ ...emptyVariant }],
    };
    setItems(copy);
    setPickerItemIndex(null);
  };

  // ---- submit ----
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createOrder.mutate({
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
      items: items.map((item) => ({
        productType: item.productType,
        description: item.description,
        material: item.material || undefined,
        baseUnitPrice: item.baseUnitPrice,
        variants: item.variants.map((v) => ({
          size: v.size,
          color: v.color || undefined,
          quantity: v.quantity,
        })),
        prints: isCustom
          ? item.prints.map((p) => ({
              position: p.position,
              printType: p.printType,
              colorCount: p.colorCount || undefined,
              unitPrice: p.unitPrice,
            }))
          : [],
        addons: isCustom
          ? item.addons.map((a) => ({
              addonType: a.addonType,
              name: a.name,
              pricingType: a.pricingType,
              unitPrice: a.unitPrice,
            }))
          : [],
        notes: item.notes || undefined,
      })),
      fees: isCustom
        ? fees.map((f) => ({
            feeType: f.feeType,
            name: f.name,
            amount: f.amount,
          }))
        : [],
    });
  };

  // ---- item subtotal helper ----
  const getItemSubtotal = (item: OrderItem) => {
    const totalQuantity = calculateTotalQuantity(item.variants);
    return calculateItemSubtotal({
      baseUnitPrice: item.baseUnitPrice,
      totalQuantity,
      prints: item.prints,
      addons: item.addons,
    });
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            สร้างออเดอร์ใหม่
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            กรอกรายละเอียดออเดอร์
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ============================================================ */}
        {/* STEP 0 — Channel + Type                                      */}
        {/* ============================================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ช่องทาง &amp; ประเภท</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Channel selector */}
            <div>
              <label className={sectionLabelClass}>ช่องทางการขาย *</label>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      channel === ch
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600"
                    }`}
                  >
                    {CHANNEL_LABELS[ch]}
                  </button>
                ))}
              </div>
            </div>

            {/* Order type toggle */}
            <div>
              <label className={sectionLabelClass}>ประเภทออเดอร์ *</label>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700">
                {(["READY_MADE", "CUSTOM"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderType(t)}
                    className={`px-4 py-2 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      orderType === t
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    {ORDER_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* External order ID (marketplace only) */}
            {isMarketplace && (
              <div className="max-w-md">
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
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* STEP 1 — Basic Info                                          */}
        {/* ============================================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลทั่วไป</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={sectionLabelClass}>ลูกค้า *</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  className={selectClass}
                >
                  <option value="">-- เลือกลูกค้า --</option>
                  {customers?.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={sectionLabelClass}>กำหนดส่ง</label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={sectionLabelClass}>ชื่องาน *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น เสื้อยืดทีม ABC, ถุงผ้ารณรงค์..."
                required
              />
            </div>
            <div>
              <label className={sectionLabelClass}>รายละเอียด</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติม..."
                rows={3}
              />
            </div>
            <div>
              <label className={sectionLabelClass}>หมายเหตุ</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="หมายเหตุภายใน..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* STEP 2 — Product Lines                                       */}
        {/* ============================================================ */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              รายการสินค้า
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" />
              เพิ่มรายการ
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {items.map((item, itemIdx) => {
              const totalQty = calculateTotalQuantity(item.variants);
              const itemSubtotal = getItemSubtotal(item);

              return (
                <div
                  key={itemIdx}
                  className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30"
                >
                  {/* Item header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        รายการ #{itemIdx + 1}
                      </span>
                      {item.productId && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          จากแค็ตตาล็อก
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openPickerForItem(itemIdx)}
                        className="h-7 gap-1 border-blue-200 px-2 text-xs text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
                      >
                        <Search className="h-3 w-3" />
                        เลือกจากแค็ตตาล็อก
                      </Button>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {formatCurrency(itemSubtotal)}
                      </span>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(itemIdx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Product type, description, material, base price */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className={labelClass}>ประเภทสินค้า</label>
                      <select
                        value={item.productType}
                        onChange={(e) =>
                          updateItem(itemIdx, "productType", e.target.value)
                        }
                        className={selectClass}
                      >
                        {Object.entries(PRODUCT_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>คำอธิบาย *</label>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(itemIdx, "description", e.target.value)
                        }
                        placeholder="รายละเอียดงาน..."
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>วัสดุ</label>
                      <Input
                        value={item.material}
                        onChange={(e) =>
                          updateItem(itemIdx, "material", e.target.value)
                        }
                        placeholder="เช่น Cotton 100%"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>ราคาตัวเปล่า/ชิ้น *</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.baseUnitPrice || ""}
                        onChange={(e) =>
                          updateItem(
                            itemIdx,
                            "baseUnitPrice",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  {/* ---- Variants (Size/Color grid) ---- */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        ไซส์ / สี / จำนวน
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          รวม:{" "}
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {totalQty}
                          </span>{" "}
                          ชิ้น
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addVariant(itemIdx)}
                          className="h-7 px-2 text-xs"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          แถว
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {item.variants.map((v, vIdx) => (
                        <div
                          key={vIdx}
                          className="grid grid-cols-[1fr_1fr_100px_32px] items-end gap-2"
                        >
                          <div>
                            {vIdx === 0 && (
                              <label className={labelClass}>ไซส์ *</label>
                            )}
                            <Input
                              value={v.size}
                              onChange={(e) =>
                                updateVariant(
                                  itemIdx,
                                  vIdx,
                                  "size",
                                  e.target.value,
                                )
                              }
                              placeholder="S, M, L..."
                              required
                            />
                          </div>
                          <div>
                            {vIdx === 0 && (
                              <label className={labelClass}>สี</label>
                            )}
                            <Input
                              value={v.color}
                              onChange={(e) =>
                                updateVariant(
                                  itemIdx,
                                  vIdx,
                                  "color",
                                  e.target.value,
                                )
                              }
                              placeholder="ขาว, ดำ..."
                            />
                          </div>
                          <div>
                            {vIdx === 0 && (
                              <label className={labelClass}>จำนวน *</label>
                            )}
                            <Input
                              type="number"
                              min={1}
                              value={v.quantity}
                              onChange={(e) =>
                                updateVariant(
                                  itemIdx,
                                  vIdx,
                                  "quantity",
                                  parseInt(e.target.value) || 1,
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            {vIdx === 0 && (
                              <span className="mb-1 block text-xs">&nbsp;</span>
                            )}
                            {item.variants.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-red-400 hover:text-red-600"
                                onClick={() => removeVariant(itemIdx, vIdx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ---- Print Positions (CUSTOM only) ---- */}
                  {isCustom && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          ตำแหน่งพิมพ์
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addPrint(itemIdx)}
                          className="h-7 px-2 text-xs"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          ตำแหน่ง
                        </Button>
                      </div>
                      {item.prints.length === 0 && (
                        <p className="text-xs italic text-slate-400 dark:text-slate-500">
                          ยังไม่มีตำแหน่งพิมพ์ — กดเพิ่มเพื่อเริ่ม
                        </p>
                      )}
                      <div className="space-y-1.5">
                        {item.prints.map((p, pIdx) => (
                          <div
                            key={pIdx}
                            className="grid grid-cols-[1fr_1fr_80px_100px_32px] items-end gap-2"
                          >
                            <div>
                              {pIdx === 0 && (
                                <label className={labelClass}>ตำแหน่ง</label>
                              )}
                              <select
                                value={p.position}
                                onChange={(e) =>
                                  updatePrint(
                                    itemIdx,
                                    pIdx,
                                    "position",
                                    e.target.value,
                                  )
                                }
                                className={selectClass}
                              >
                                {Object.entries(PRINT_POSITIONS).map(
                                  ([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div>
                              {pIdx === 0 && (
                                <label className={labelClass}>วิธีพิมพ์</label>
                              )}
                              <select
                                value={p.printType}
                                onChange={(e) =>
                                  updatePrint(
                                    itemIdx,
                                    pIdx,
                                    "printType",
                                    e.target.value,
                                  )
                                }
                                className={selectClass}
                              >
                                {Object.entries(PRINT_TYPES).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              {pIdx === 0 && (
                                <label className={labelClass}>จำนวนสี</label>
                              )}
                              <Input
                                type="number"
                                min={1}
                                value={p.colorCount}
                                onChange={(e) =>
                                  updatePrint(
                                    itemIdx,
                                    pIdx,
                                    "colorCount",
                                    parseInt(e.target.value) || 1,
                                  )
                                }
                              />
                            </div>
                            <div>
                              {pIdx === 0 && (
                                <label className={labelClass}>
                                  ราคา/ชิ้น *
                                </label>
                              )}
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={p.unitPrice || ""}
                                onChange={(e) =>
                                  updatePrint(
                                    itemIdx,
                                    pIdx,
                                    "unitPrice",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              {pIdx === 0 && (
                                <span className="mb-1 block text-xs">
                                  &nbsp;
                                </span>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-red-400 hover:text-red-600"
                                onClick={() => removePrint(itemIdx, pIdx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ---- Add-ons (CUSTOM only) ---- */}
                  {isCustom && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          ส่วนเสริม (Add-ons)
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addAddon(itemIdx)}
                          className="h-7 px-2 text-xs"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Add-on
                        </Button>
                      </div>
                      {item.addons.length === 0 && (
                        <p className="text-xs italic text-slate-400 dark:text-slate-500">
                          ไม่มีส่วนเสริม
                        </p>
                      )}
                      <div className="space-y-1.5">
                        {item.addons.map((a, aIdx) => (
                          <div
                            key={aIdx}
                            className="grid grid-cols-[1fr_1fr_120px_100px_32px] items-end gap-2"
                          >
                            <div>
                              {aIdx === 0 && (
                                <label className={labelClass}>ประเภท</label>
                              )}
                              <Input
                                value={a.addonType}
                                onChange={(e) =>
                                  updateAddon(
                                    itemIdx,
                                    aIdx,
                                    "addonType",
                                    e.target.value,
                                  )
                                }
                                placeholder="LABEL, TAG..."
                              />
                            </div>
                            <div>
                              {aIdx === 0 && (
                                <label className={labelClass}>ชื่อ</label>
                              )}
                              <Input
                                value={a.name}
                                onChange={(e) =>
                                  updateAddon(
                                    itemIdx,
                                    aIdx,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                placeholder="ชื่อ add-on"
                              />
                            </div>
                            <div>
                              {aIdx === 0 && (
                                <label className={labelClass}>คิดราคา</label>
                              )}
                              <select
                                value={a.pricingType}
                                onChange={(e) =>
                                  updateAddon(
                                    itemIdx,
                                    aIdx,
                                    "pricingType",
                                    e.target.value as "PER_PIECE" | "PER_ORDER",
                                  )
                                }
                                className={selectClass}
                              >
                                <option value="PER_PIECE">ต่อชิ้น</option>
                                <option value="PER_ORDER">ต่อออเดอร์</option>
                              </select>
                            </div>
                            <div>
                              {aIdx === 0 && (
                                <label className={labelClass}>ราคา *</label>
                              )}
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={a.unitPrice || ""}
                                onChange={(e) =>
                                  updateAddon(
                                    itemIdx,
                                    aIdx,
                                    "unitPrice",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              {aIdx === 0 && (
                                <span className="mb-1 block text-xs">
                                  &nbsp;
                                </span>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-red-400 hover:text-red-600"
                                onClick={() => removeAddon(itemIdx, aIdx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Item notes */}
                  <div>
                    <label className={labelClass}>หมายเหตุรายการ</label>
                    <Input
                      value={item.notes}
                      onChange={(e) =>
                        updateItem(itemIdx, "notes", e.target.value)
                      }
                      placeholder="หมายเหตุเพิ่มเติมสำหรับรายการนี้..."
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* STEP 3 — Order Fees (CUSTOM only)                            */}
        {/* ============================================================ */}
        {isCustom && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">ค่าใช้จ่ายเพิ่มเติม</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFee}
              >
                <Plus className="mr-1 h-4 w-4" />
                เพิ่มค่าใช้จ่าย
              </Button>
            </CardHeader>
            <CardContent>
              {fees.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  ไม่มีค่าใช้จ่ายเพิ่มเติม
                </p>
              )}
              <div className="space-y-2">
                {fees.map((f, fIdx) => (
                  <div
                    key={fIdx}
                    className="grid grid-cols-[1fr_1fr_120px_32px] items-end gap-2"
                  >
                    <div>
                      {fIdx === 0 && (
                        <label className={labelClass}>ประเภท</label>
                      )}
                      <Input
                        value={f.feeType}
                        onChange={(e) =>
                          updateFee(fIdx, "feeType", e.target.value)
                        }
                        placeholder="SHIPPING, SETUP..."
                      />
                    </div>
                    <div>
                      {fIdx === 0 && <label className={labelClass}>ชื่อ</label>}
                      <Input
                        value={f.name}
                        onChange={(e) =>
                          updateFee(fIdx, "name", e.target.value)
                        }
                        placeholder="ค่าจัดส่ง, ค่าเซ็ตอัพ..."
                      />
                    </div>
                    <div>
                      {fIdx === 0 && (
                        <label className={labelClass}>จำนวนเงิน *</label>
                      )}
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={f.amount || ""}
                        onChange={(e) =>
                          updateFee(
                            fIdx,
                            "amount",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      {fIdx === 0 && (
                        <span className="mb-1 block text-xs">&nbsp;</span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-400 hover:text-red-600"
                        onClick={() => removeFee(fIdx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* STEP 4 — Price Summary                                       */}
        {/* ============================================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">สรุปราคา</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Sub-lines */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>รวมสินค้า</span>
                <span className="tabular-nums">
                  {formatCurrency(pricingSummary.subtotalItems)}
                </span>
              </div>

              {isCustom && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>รวมค่าใช้จ่ายเพิ่มเติม</span>
                  <span className="tabular-nums">
                    {formatCurrency(pricingSummary.subtotalFees)}
                  </span>
                </div>
              )}

              {isMarketplace && (
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400">
                    ค่าธรรมเนียม {CHANNEL_LABELS[channel]}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={platformFee || ""}
                    onChange={(e) =>
                      setPlatformFee(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                    className="w-32 text-right"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="text-slate-600 dark:text-slate-400">
                  ส่วนลด
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={discount || ""}
                  onChange={(e) =>
                    setDiscount(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="w-32 text-right"
                />
              </div>
            </div>

            {/* Grand total */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                ยอดรวมทั้งหมด
              </span>
              <span className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {formatCurrency(pricingSummary.grandTotal)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* Actions                                                      */}
        {/* ============================================================ */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/orders">
            <Button type="button" variant="outline">
              ยกเลิก
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={createOrder.isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {createOrder.isPending ? "กำลังบันทึก..." : "สร้างออเดอร์"}
          </Button>
        </div>

        {/* Error display */}
        {createOrder.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {createOrder.error.message}
          </div>
        )}
      </form>

      {/* Product Picker Dialog */}
      <ProductPickerDialog
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerItemIndex(null);
        }}
        onSelect={handleProductSelected}
      />
    </div>
  );
}
