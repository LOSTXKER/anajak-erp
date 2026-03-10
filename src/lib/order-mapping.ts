import type { OrderItemForm, OrderItemProductForm, PrintForm, AddonForm, OrderFeeForm } from "@/types/order-form";
import { EMPTY_PRODUCT, deriveProcessingType } from "@/types/order-form";

type ItemSource = "FROM_STOCK" | "CUSTOM_MADE" | "CUSTOMER_PROVIDED";
type ProcessingType = "PRINT_ONLY" | "CUT_AND_SEW_PRINT" | "CUT_AND_SEW_ONLY" | "PACK_ONLY" | "FULL_PRODUCTION";

/**
 * Map OrderItemForm[] to the mutation input shape expected by the order router.
 */
export function mapItemsToMutationInput(items: OrderItemForm[]) {
  return items.map((item) => ({
    description: item.description || undefined,
    notes: item.notes || undefined,
    products: item.products.map((p) => mapProductToMutationInput(p, item.prints.length > 0)),
    prints: item.prints.map(mapPrintToMutationInput),
    addons: item.addons.map(mapAddonToMutationInput),
  }));
}

function mapProductToMutationInput(p: OrderItemProductForm, hasPrints: boolean) {
  return {
    productId: p.productId || undefined,
    productType: p.productType,
    description: p.description,
    material: p.material || undefined,
    baseUnitPrice: p.baseUnitPrice,
    discount: p.discount || 0,
    packagingOptionId: p.packagingOptionId || undefined,
    itemSource: (p.itemSource || undefined) as ItemSource | undefined,
    fabricType: p.fabricType || undefined,
    fabricWeight: p.fabricWeight || undefined,
    fabricColor: p.fabricColor || undefined,
    processingType: deriveProcessingType(p.itemSource, hasPrints) as ProcessingType,
    variants: p.variants.map((v) => ({
      size: v.size,
      color: v.color || undefined,
      quantity: v.quantity,
    })),
    patternId: p.patternId || undefined,
    collarType: p.collarType || undefined,
    sleeveType: p.sleeveType || undefined,
    bodyFit: p.bodyFit || undefined,
    patternFileUrl: p.patternFileUrl || undefined,
    patternNote: p.patternNote || undefined,
    garmentCondition: p.garmentCondition || undefined,
    receivedInspected: p.receivedInspected,
    receiveNote: p.receiveNote || undefined,
  };
}

function mapPrintToMutationInput(pr: PrintForm) {
  return {
    position: pr.position,
    printType: pr.printType,
    colorCount: pr.colorCount || undefined,
    printSize: pr.printSize || undefined,
    width: pr.width || undefined,
    height: pr.height || undefined,
    designNote: pr.designNote || undefined,
    designImageUrl: pr.designImageUrl || undefined,
    unitPrice: pr.unitPrice,
  };
}

function mapAddonToMutationInput(a: AddonForm) {
  return {
    addonType: a.addonType,
    name: a.name,
    pricingType: a.pricingType as "PER_PIECE" | "PER_ORDER",
    unitPrice: a.unitPrice,
  };
}

export function mapFeesToMutationInput(fees: OrderFeeForm[]) {
  return fees.map((f) => ({
    feeType: f.feeType,
    name: f.name,
    amount: f.amount,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiItem = any;

/**
 * Map API order items back to OrderItemForm[] for the edit dialog.
 */
export function mapApiItemsToForm(apiItems: ApiItem[]): OrderItemForm[] {
  return apiItems.map((item) => ({
    description: item.description || "",
    products: (item.products || []).flatMap((p: ApiItem) => {
      const base: OrderItemProductForm = {
        ...structuredClone(EMPTY_PRODUCT),
        productId: p.productId || undefined,
        productType: p.productType || "OTHER",
        description: p.description || "",
        material: p.material || "",
        baseUnitPrice: p.baseUnitPrice || 0,
        discount: p.discount || 0,
        packagingOptionId: p.packagingOptionId || "",
        itemSource: p.itemSource || "",
        fabricType: p.fabricType || "",
        fabricWeight: p.fabricWeight || "",
        fabricColor: p.fabricColor || "",
        processingType: p.processingType || "",
        patternId: p.patternId || undefined,
        patternMode: p.patternId ? "catalog" : "custom",
        collarType: p.collarType || "",
        sleeveType: p.sleeveType || "",
        bodyFit: p.bodyFit || "",
        patternFileUrl: p.patternFileUrl || "",
        patternNote: p.patternNote || "",
        garmentCondition: p.garmentCondition || "",
        receivedInspected: p.receivedInspected ?? false,
        receiveNote: p.receiveNote || "",
        productName: p.product?.name,
        productSku: p.product?.sku,
        productImageUrl: p.product?.imageUrl,
      };
      const variants = (p.variants || []) as ApiItem[];
      if (variants.length <= 1) {
        return [{ ...base, variants: variants.map((v: ApiItem) => ({ size: v.size, color: v.color || "", quantity: v.quantity })) }];
      }
      return variants.map((v: ApiItem) => ({
        ...structuredClone(base),
        variants: [{ size: v.size, color: v.color || "", quantity: v.quantity }],
      }));
    }),
    prints: (item.prints || []).map((pr: ApiItem) => ({
      position: pr.position,
      printType: pr.printType,
      colorCount: pr.colorCount || 0,
      unitPrice: pr.unitPrice,
      printSize: pr.printSize || "",
      width: pr.width || 0,
      height: pr.height || 0,
      designNote: pr.designNote || "",
      designImageUrl: pr.designImageUrl || undefined,
    })),
    addons: (item.addons || []).map((a: ApiItem) => ({
      addonType: a.addonType,
      name: a.name,
      pricingType: a.pricingType,
      unitPrice: a.unitPrice,
    })),
    notes: item.notes || "",
  }));
}

/**
 * Map API fee data back to OrderFeeForm[] for the edit dialog.
 */
export function mapApiFeesToForm(apiFees: ApiItem[]): OrderFeeForm[] {
  return apiFees.map((f) => ({
    feeType: f.feeType,
    name: f.name,
    amount: f.amount,
  }));
}
