"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { sumVariantQty } from "@/lib/size-matrix";
import type { OrderItemForm, OrderItemProductForm } from "@/types/order-form";

// Logic แถวสินค้า 1 ชิ้น (handlers + state + derived) — ใช้ร่วม ProductTableRow (เดสก์ท็อป/ตาราง)
// และ ProductCardMobile (มือถือ/การ์ด) แหล่งเดียวกัน กัน drift · JSX แยกตาม layout ในแต่ละ component
export function useProductRow(
  product: OrderItemProductForm,
  prodIdx: number,
  itemIdx: number,
  totalProducts: number,
  onSetItems: (updater: (prev: OrderItemForm[]) => OrderItemForm[]) => void
) {
  // งานตัดเย็บ/ลูกค้าส่งมา แทบไม่มีไซส์เดียว → เปิดตารางหลายไซส์ (SizeMatrix) เป็น default (UX7)
  const [showMatrix, setShowMatrix] = useState(
    () =>
      product.itemSource === "CUSTOM_MADE" || product.itemSource === "CUSTOMER_PROVIDED"
  );
  const { data: packagingOptions } = trpc.packaging.list.useQuery();

  const updateProduct = (field: string, value: unknown) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const products = [...copy[itemIdx].products];
      products[prodIdx] = { ...products[prodIdx], [field]: value };
      copy[itemIdx] = { ...copy[itemIdx], products };
      return copy;
    });
  };

  const updateVariantField = (field: "quantity" | "size" | "color", value: string | number) => {
    onSetItems((prev) => {
      const copy = [...prev];
      const products = [...copy[itemIdx].products];
      const variants = [...products[prodIdx].variants];
      variants[0] = { ...variants[0], [field]: value };
      products[prodIdx] = { ...products[prodIdx], variants };
      copy[itemIdx] = { ...copy[itemIdx], products };
      return copy;
    });
  };

  const removeProduct = () => {
    onSetItems((prev) => {
      const copy = [...prev];
      copy[itemIdx] = {
        ...copy[itemIdx],
        products: copy[itemIdx].products.filter((_, i) => i !== prodIdx),
      };
      return copy;
    });
  };

  const moveProduct = (direction: -1 | 1) => {
    const newIdx = prodIdx + direction;
    if (newIdx < 0 || newIdx >= totalProducts) return;
    onSetItems((prev) => {
      const copy = [...prev];
      const products = [...copy[itemIdx].products];
      [products[prodIdx], products[newIdx]] = [products[newIdx], products[prodIdx]];
      copy[itemIdx] = { ...copy[itemIdx], products };
      return copy;
    });
  };

  const variant = product.variants[0] || { size: "", color: "", quantity: 0 };
  const qty = variant.quantity;
  const netPrice = Math.max(0, product.baseUnitPrice - (product.discount || 0));
  const isFromStock = product.itemSource === "FROM_STOCK";
  const isCustomMade = product.itemSource === "CUSTOM_MADE";
  const isCustomerProvided = product.itemSource === "CUSTOMER_PROVIDED";

  // โหมดหลายไซส์ (matrix) — เฉพาะสินค้าที่กรอกเอง (ไม่ใช่จากสต๊อค) · มี >1 variant = บังคับเปิด
  const canMatrix = !isFromStock;
  const multi = canMatrix && (showMatrix || product.variants.length > 1);
  const filledSizes = product.variants.filter((v) => v.size.trim());
  const totalQty = sumVariantQty(filledSizes);
  const effectiveQty = multi ? totalQty : qty;
  const lineTotal = netPrice * effectiveQty;

  const productLabel = product.productName || product.description || "สินค้าใหม่";
  const variantLabel = [variant.color, variant.size].filter(Boolean).join(" ");

  return {
    // state
    showMatrix, setShowMatrix,
    // handlers
    updateProduct, updateVariantField, removeProduct, moveProduct,
    // data
    packagingOptions,
    // derived
    variant, qty, netPrice,
    isFromStock, isCustomMade, isCustomerProvided,
    canMatrix, multi, totalQty, lineTotal,
    productLabel, variantLabel,
  };
}
