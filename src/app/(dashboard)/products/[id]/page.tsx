"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Pencil, Plus, X, Check, Package } from "lucide-react";

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

const typeConfig: Record<string, { label: string; variant: "default" | "secondary" | "indigo" | "purple" | "teal" | "orange" }> = {
  T_SHIRT: { label: "เสื้อยืด", variant: "default" },
  POLO: { label: "โปโล", variant: "indigo" },
  HOODIE: { label: "ฮู้ดดี้", variant: "purple" },
  JACKET: { label: "แจ็คเก็ต", variant: "teal" },
  TOTE_BAG: { label: "ถุงผ้า", variant: "orange" },
  OTHER: { label: "อื่นๆ", variant: "secondary" },
};

const selectClass =
  "flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const labelClass =
  "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300";

// ============================================================
// COMPONENT
// ============================================================

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();

  const { data: product, isLoading } = trpc.product.getById.useQuery({ id });

  // -- Edit mode --
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    description: "",
    productType: "",
    category: "",
    basePrice: 0,
    costPrice: 0,
    imageUrl: "",
  });

  // -- Add variant form --
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newVariant, setNewVariant] = useState({
    size: "",
    color: "",
    sku: "",
    priceAdj: 0,
    stock: 0,
  });

  // -- Mutations --
  const updateProduct = trpc.product.update.useMutation({
    onSuccess: () => {
      utils.product.getById.invalidate({ id });
      setEditing(false);
    },
  });

  const addVariant = trpc.product.addVariant.useMutation({
    onSuccess: () => {
      utils.product.getById.invalidate({ id });
      setShowAddVariant(false);
      setNewVariant({ size: "", color: "", sku: "", priceAdj: 0, stock: 0 });
    },
  });

  const updateVariant = trpc.product.updateVariant.useMutation({
    onSuccess: () => {
      utils.product.getById.invalidate({ id });
    },
  });

  // ---- handlers ----
  const startEditing = () => {
    if (!product) return;
    setEditData({
      name: product.name,
      description: product.description || "",
      productType: product.productType,
      category: product.category || "",
      basePrice: product.basePrice,
      costPrice: product.costPrice || 0,
      imageUrl: product.imageUrl || "",
    });
    setEditing(true);
  };

  const handleSaveEdit = () => {
    updateProduct.mutate({
      id,
      name: editData.name,
      description: editData.description || undefined,
      productType: editData.productType,
      category: editData.category || undefined,
      basePrice: editData.basePrice,
      costPrice: editData.costPrice || undefined,
      imageUrl: editData.imageUrl || undefined,
    });
  };

  const handleAddVariant = (e: React.FormEvent) => {
    e.preventDefault();
    addVariant.mutate({
      productId: id,
      ...newVariant,
    });
  };

  const handleToggleVariantActive = (variantId: string, isActive: boolean) => {
    updateVariant.mutate({ id: variantId, isActive: !isActive });
  };

  const handleUpdateVariantStock = (variantId: string, stock: number) => {
    updateVariant.mutate({ id: variantId, stock });
  };

  const handleToggleProductActive = () => {
    if (!product) return;
    updateProduct.mutate({ id, isActive: !product.isActive });
  };

  // ---- auto-generate variant SKU ----
  const generateVariantSku = (size: string, color: string) => {
    const base = product?.sku || "SKU";
    const s = size.toUpperCase().replace(/\s+/g, "");
    const c = color.toUpperCase().replace(/\s+/g, "");
    return `${base}-${s}-${c}`;
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  const typ = typeConfig[product.productType] ?? {
    label: product.productType,
    variant: "secondary" as const,
  };

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {product.name}
              </h1>
              <Badge variant={typ.variant}>{typ.label}</Badge>
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  product.isActive
                    ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]"
                    : "bg-slate-400"
                }`}
              />
            </div>
            <p className="text-sm text-slate-500">{product.sku}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleProductActive}
          >
            {product.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </Button>
          {!editing && (
            <Button size="sm" onClick={startEditing}>
              <Pencil className="h-4 w-4" />
              แก้ไข
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Product image + info */}
        <div className="space-y-6">
          {/* Image */}
          <Card className="overflow-hidden">
            <div className="flex h-56 items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-20 w-20 text-white/40" />
              )}
            </div>
          </Card>

          {/* Info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ข้อมูลสินค้า</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>ชื่อสินค้า</label>
                    <Input
                      value={editData.name}
                      onChange={(e) =>
                        setEditData({ ...editData, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ประเภท</label>
                    <select
                      value={editData.productType}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          productType: e.target.value,
                        })
                      }
                      className={selectClass}
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
                      value={editData.category}
                      onChange={(e) =>
                        setEditData({ ...editData, category: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>ราคาขาย</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editData.basePrice || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            basePrice: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>ราคาทุน</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editData.costPrice || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            costPrice: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>รายละเอียด</label>
                    <Textarea
                      value={editData.description}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>URL รูปภาพ</label>
                    <Input
                      value={editData.imageUrl}
                      onChange={(e) =>
                        setEditData({ ...editData, imageUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={updateProduct.isPending}
                    >
                      <Check className="h-4 w-4" />
                      {updateProduct.isPending ? "กำลังบันทึก..." : "บันทึก"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(false)}
                    >
                      <X className="h-4 w-4" />
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">ราคาขาย</span>
                    <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
                      {formatCurrency(product.basePrice)}
                    </span>
                  </div>
                  {product.costPrice && product.costPrice > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">ราคาทุน</span>
                      <span className="tabular-nums">
                        {formatCurrency(product.costPrice)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">สต็อกรวม</span>
                    <span className="font-semibold tabular-nums">
                      {totalStock} ชิ้น
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">ตัวเลือก</span>
                    <span>{product.variants.length} รายการ</span>
                  </div>
                  {product.category && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">หมวดหมู่</span>
                      <span>{product.category}</span>
                    </div>
                  )}
                  {product.description && (
                    <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                      <p className="text-slate-600 dark:text-slate-400">
                        {product.description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Variants */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                ตัวเลือกสินค้า ({product.variants.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddVariant(!showAddVariant)}
              >
                <Plus className="mr-1 h-4 w-4" />
                เพิ่มตัวเลือก
              </Button>
            </CardHeader>
            <CardContent>
              {/* Add variant form */}
              {showAddVariant && (
                <form
                  onSubmit={handleAddVariant}
                  className="mb-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30"
                >
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    เพิ่มตัวเลือกใหม่
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        ไซส์ *
                      </label>
                      <Input
                        value={newVariant.size}
                        onChange={(e) => {
                          const size = e.target.value;
                          setNewVariant((v) => ({
                            ...v,
                            size,
                            sku:
                              size && v.color
                                ? generateVariantSku(size, v.color)
                                : v.sku,
                          }));
                        }}
                        placeholder="S, M, L"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        สี *
                      </label>
                      <Input
                        value={newVariant.color}
                        onChange={(e) => {
                          const color = e.target.value;
                          setNewVariant((v) => ({
                            ...v,
                            color,
                            sku:
                              v.size && color
                                ? generateVariantSku(v.size, color)
                                : v.sku,
                          }));
                        }}
                        placeholder="ขาว, ดำ"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        SKU
                      </label>
                      <Input
                        value={newVariant.sku}
                        onChange={(e) =>
                          setNewVariant({ ...newVariant, sku: e.target.value })
                        }
                        placeholder="Auto"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        ปรับราคา
                      </label>
                      <Input
                        type="number"
                        step={0.01}
                        value={newVariant.priceAdj || ""}
                        onChange={(e) =>
                          setNewVariant({
                            ...newVariant,
                            priceAdj: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        สต็อก
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={newVariant.stock || ""}
                        onChange={(e) =>
                          setNewVariant({
                            ...newVariant,
                            stock: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addVariant.isPending}
                    >
                      {addVariant.isPending ? "กำลังเพิ่ม..." : "เพิ่ม"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddVariant(false)}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </form>
              )}

              {/* Variants table */}
              {product.variants.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  ยังไม่มีตัวเลือก
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                          ไซส์
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                          สี
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                          SKU
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">
                          ราคา
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium uppercase text-slate-500">
                          สต็อก
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium uppercase text-slate-500">
                          สถานะ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {product.variants.map((variant) => (
                        <tr
                          key={variant.id}
                          className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            !variant.isActive ? "opacity-50" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-white">
                            {variant.size}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">
                            {variant.color}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono text-slate-500">
                            {variant.sku}
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {formatCurrency(product.basePrice + variant.priceAdj)}
                            </span>
                            {variant.priceAdj !== 0 && (
                              <span className="ml-1 text-xs text-slate-400">
                                ({variant.priceAdj > 0 ? "+" : ""}
                                {variant.priceAdj})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Input
                              type="number"
                              min={0}
                              value={variant.stock}
                              onChange={(e) =>
                                handleUpdateVariantStock(
                                  variant.id,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="ml-auto h-7 w-20 text-right text-xs"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleVariantActive(
                                  variant.id,
                                  variant.isActive
                                )
                              }
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                                variant.isActive
                                  ? "bg-blue-600"
                                  : "bg-slate-300 dark:bg-slate-600"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                  variant.isActive
                                    ? "translate-x-4"
                                    : "translate-x-0.5"
                                } mt-0.5`}
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error display */}
          {(updateProduct.isError || addVariant.isError || updateVariant.isError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {updateProduct.error?.message ||
                addVariant.error?.message ||
                updateVariant.error?.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
