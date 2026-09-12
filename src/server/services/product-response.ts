import { redactCostFields } from "./cost-response";

/** Stock ส่งราคาขายรายตัวเลือกเท่านั้น; basePrice ของรายการ sync รุ่นเก่าเป็นต้นทุน */
export function productResponse<T extends { source: string; basePrice: number; variants?: object[] }>(
  product: T,
  canSeeCosts: boolean,
): T {
  const response = {
    ...product,
    basePrice: product.source === "LOCAL" ? product.basePrice : 0,
    ...(product.variants ? {
      variants: product.variants.map((variant) => redactCostFields(variant, canSeeCosts)),
    } : {}),
  };
  return redactCostFields(response, canSeeCosts);
}
