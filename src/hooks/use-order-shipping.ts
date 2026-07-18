import { useState, useCallback } from "react";

export interface ShippingState {
  recipientName: string;
  phone: string;
  address: string;
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

const INITIAL_SHIPPING: ShippingState = {
  recipientName: "",
  phone: "",
  address: "",
  subDistrict: "",
  district: "",
  province: "",
  postalCode: "",
};

export function useOrderShippingState() {
  const [includeShipping, setIncludeShipping] = useState(false);
  const [shippingDirty, setShippingDirty] = useState(false);
  const [shipping, setShipping] = useState<ShippingState>(INITIAL_SHIPPING);

  const updateShipping = useCallback(
    <K extends keyof ShippingState>(field: K, value: ShippingState[K]) => {
      setShipping((prev) => ({ ...prev, [field]: value }));
      // การพิมพ์ในช่องคือเจตนาระบุที่อยู่; prefill ใช้ replaceShipping จึงไม่เปิดเอง
      setIncludeShipping(true);
      setShippingDirty(true);
    },
    [],
  );

  const replaceShipping = useCallback((value: ShippingState) => {
    setShipping(value);
    setShippingDirty(false);
  }, []);

  const resetShipping = useCallback(() => {
    setShipping(INITIAL_SHIPPING);
    setIncludeShipping(false);
    setShippingDirty(false);
  }, []);

  const validateShipping = useCallback(() => {
    return validateShippingState(shipping, includeShipping);
  }, [includeShipping, shipping]);

  const toMutationInput = useCallback(() => {
    return buildShippingMutationInput(shipping, includeShipping);
  }, [includeShipping, shipping]);

  return {
    includeShipping,
    setIncludeShipping,
    shippingDirty,
    shipping,
    updateShipping,
    replaceShipping,
    resetShipping,
    validateShipping,
    shippingMutationInput: toMutationInput,
  };
}

export function validateShippingState(
  shipping: ShippingState,
  includeShipping: boolean,
): string[] {
  const errors: string[] = [];
  if (!includeShipping) return errors;
  if (!shipping.recipientName.trim()) errors.push("กรุณาระบุชื่อผู้รับ (ที่อยู่จัดส่ง)");
  if (!shipping.address.trim()) errors.push("กรุณาระบุที่อยู่จัดส่ง");
  if (shipping.phone && !/^0\d{8,9}$/.test(shipping.phone)) {
    errors.push("เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก");
  }
  if (shipping.postalCode && !/^\d{5}$/.test(shipping.postalCode)) {
    errors.push("รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก");
  }
  return errors;
}

// แยก "เลือกส่งที่อยู่นี้" ออกจาก "ผู้ใช้แก้ที่อยู่เองแล้ว" — เปิดสวิตช์เฉยๆ ยังรับ
// prefill ของลูกค้ารายใหม่ได้ แต่ที่อยู่ไซต์งานที่พิมพ์เองต้องไม่ถูกล้างเมื่อเปลี่ยนผู้วางบิล
export function shouldPrefillShippingOnCustomerChange(shippingDirty: boolean): boolean {
  return !shippingDirty;
}

export function buildShippingMutationInput(
  shipping: ShippingState,
  includeShipping: boolean,
) {
  if (!includeShipping || !shipping.recipientName) return undefined;
  return {
    recipientName: shipping.recipientName,
    phone: shipping.phone,
    address: shipping.address,
    subDistrict: shipping.subDistrict || undefined,
    district: shipping.district || undefined,
    province: shipping.province || undefined,
    postalCode: shipping.postalCode || undefined,
  };
}
