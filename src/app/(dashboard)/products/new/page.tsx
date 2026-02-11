"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Plus, Trash2, Package } from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type Variant = {
  size: string;
  color: string;
  sku: string;
  priceAdj: number;
  stock: number;
};

// ============================================================
// CONSTANTS
// ============================================================

const productTypes = [
  { value: "T_SHIRT", label: "เสื้อยืด" },
  { value: "POLO", label: "โปโล" },
  { value: "HOODIE", label: "ฮู้ดดี้" },
  { value: "JACKET", label: "แจ็คเก็ต" },
  { value: "TOTE_BAG", label: "ถุงผ้า" },
  { value: "OTHER", label: "อื่นๆ" },
] as const;

const selectClass =
  "flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const labelClass =
  "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300";

const subLabelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

// ============================================================
// COMPONENT
// ============================================================

export default function NewProductPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  // -- Product fields --
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState("T_SHIRT");
  const [category, setCategory] = useState("");
  const [basePrice, setBasePrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState("");

  // -- Variants --
  const [variants, setVariants] = useState<Variant[]>([]);

  const createProduct = trpc.product.create.useMutation({
    onSuccess: () => {
      utils.product.list.invalidate();
      router.push("/products");
    },
  });

  // ---- variant helpers ----
  const generateVariantSku = (size: string, color: string) => {
    const base = sku || "SKU";
    const s = size.toUpperCase().replace(/\s+/g, "");
    const c = color.toUpperCase().replace(/\s+/g, "");
    return `${base}-${s}-${c}`;
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      { size: "", color: "", sku: "", priceAdj: 0, stock: 0 },
    ]);
  };

  const removeVariant = (idx: number) => {
    setVariants(variants.filter((_, i) => i !== idx));
  };

  const updateVariant = <K extends keyof Variant>(
    idx: number,
    field: K,
    value: Variant[K]
  ) => {
    const copy = [...variants];
    copy[idx] = { ...copy[idx], [field]: value };

    // Auto-generate SKU when size or color changes
    if (field === "size" || field === "color") {
      const v = copy[idx];
      if (v.size && v.color) {
        copy[idx].sku = generateVariantSku(v.size, v.color);
      }
    }

    setVariants(copy);
  };

  // ---- submit ----
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createProduct.mutate({
      sku,
      name,
      description: description || undefined,
      productType,
      category: category || undefined,
      basePrice,
      costPrice: costPrice || undefined,
      imageUrl: imageUrl || undefined,
      variants: variants
        .filter((v) => v.size && v.color && v.sku)
        .map((v) => ({
          size: v.size,
          color: v.color,
          sku: v.sku,
          priceAdj: v.priceAdj,
          stock: v.stock,
        })),
    });
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            เพิ่มสินค้าใหม่
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            กรอกรายละเอียดสินค้าและตัวเลือก
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ============================================================ */}
        {/* BASIC INFO                                                   */}
        {/* ============================================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              ข้อมูลสินค้า
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>SKU *</label>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="เช่น TS-001"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>ชื่อสินค้า *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น เสื้อยืด Cotton 100%"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>ประเภทสินค้า *</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className={selectClass}
                  required
                >
                  {productTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>หมวดหมู่</label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="เช่น เสื้อผ้า, ของพรีเมียม"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>ราคาขาย (บาท) *</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={basePrice || ""}
                  onChange={(e) =>
                    setBasePrice(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>ราคาทุน (บาท)</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={costPrice || ""}
                  onChange={(e) =>
                    setCostPrice(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>รายละเอียด</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="รายละเอียดสินค้า..."
                rows={3}
              />
            </div>

            <div>
              <label className={labelClass}>URL รูปภาพ</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* VARIANTS                                                     */}
        {/* ============================================================ */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">ตัวเลือกสินค้า (Variants)</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addVariant}>
              <Plus className="mr-1 h-4 w-4" />
              เพิ่มตัวเลือก
            </Button>
          </CardHeader>
          <CardContent>
            {variants.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-10 dark:border-slate-700">
                <p className="text-sm text-slate-400">
                  ยังไม่มีตัวเลือก — เช่น ไซส์/สี ต่างกัน
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={addVariant}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  เพิ่มตัวเลือกแรก
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {variants.map((variant, idx) => (
                  <div
                    key={idx}
                    className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        ตัวเลือก #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <div>
                        <label className={subLabelClass}>ไซส์ *</label>
                        <Input
                          value={variant.size}
                          onChange={(e) =>
                            updateVariant(idx, "size", e.target.value)
                          }
                          placeholder="S, M, L, XL"
                        />
                      </div>
                      <div>
                        <label className={subLabelClass}>สี *</label>
                        <Input
                          value={variant.color}
                          onChange={(e) =>
                            updateVariant(idx, "color", e.target.value)
                          }
                          placeholder="ขาว, ดำ"
                        />
                      </div>
                      <div>
                        <label className={subLabelClass}>SKU</label>
                        <Input
                          value={variant.sku}
                          onChange={(e) =>
                            updateVariant(idx, "sku", e.target.value)
                          }
                          placeholder="Auto"
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className={subLabelClass}>ปรับราคา (±)</label>
                        <Input
                          type="number"
                          step={0.01}
                          value={variant.priceAdj || ""}
                          onChange={(e) =>
                            updateVariant(
                              idx,
                              "priceAdj",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className={subLabelClass}>สต็อก</label>
                        <Input
                          type="number"
                          min={0}
                          value={variant.stock || ""}
                          onChange={(e) =>
                            updateVariant(
                              idx,
                              "stock",
                              parseInt(e.target.value) || 0
                            )
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {variant.priceAdj !== 0 && basePrice > 0 && (
                      <p className="text-xs text-slate-500">
                        ราคาขายจริง:{" "}
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {formatCurrency(basePrice + variant.priceAdj)}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================================ */}
        {/* ACTIONS                                                      */}
        {/* ============================================================ */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/products">
            <Button type="button" variant="outline">
              ยกเลิก
            </Button>
          </Link>
          <Button type="submit" disabled={createProduct.isPending}>
            {createProduct.isPending ? "กำลังบันทึก..." : "สร้างสินค้า"}
          </Button>
        </div>

        {/* Error display */}
        {createProduct.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {createProduct.error.message}
          </div>
        )}
      </form>
    </div>
  );
}
