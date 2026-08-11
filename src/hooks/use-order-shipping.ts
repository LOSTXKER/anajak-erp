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
  // ที่อยู่ชุดนี้ก๊อปมาจากโปรไฟล์ลูกค้ารายไหน (null = คนพิมพ์เอง เช่นที่อยู่ไซต์งาน)
  // ใช้ตัดสินตอนสลับลูกค้าว่าต้องล้างทิ้งไหม — ดู shouldClearShippingOnCustomerChange
  const [filledFromCustomerId, setFilledFromCustomerId] = useState<string | null>(null);

  const updateShipping = useCallback(
    <K extends keyof ShippingState>(field: K, value: ShippingState[K]) => {
      setShipping((prev) => ({ ...prev, [field]: value }));
      // การพิมพ์ในช่องคือเจตนาระบุที่อยู่ — เปิดสวิตช์ให้เลย ไม่งั้นพิมพ์เสร็จแล้วที่อยู่หายตอนบันทึก
      setIncludeShipping(true);
      setShippingDirty(true);
      // พิมพ์ทับแล้วไม่ใช่ที่อยู่ของโปรไฟล์อีกต่อไป
      setFilledFromCustomerId(null);
    },
    [],
  );

  /** เติมที่อยู่จากโปรไฟล์ลูกค้า (ปุ่ม "ใช้ที่อยู่ลูกค้า") — เปิดสวิตช์ให้พร้อมกัน
   *  บั๊กเดิม: prefill ให้เงียบๆ แต่สวิตช์ยังปิด → กดเปิดงานแล้วที่อยู่ถูกทิ้งทั้งชุดไม่มีคำเตือน */
  const fillShippingFromCustomer = useCallback(
    (value: ShippingState, customerId: string | null) => {
      setShipping(value);
      setIncludeShipping(true);
      setShippingDirty(false);
      setFilledFromCustomerId(customerId);
    },
    [],
  );

  const resetShipping = useCallback(() => {
    setShipping(INITIAL_SHIPPING);
    setIncludeShipping(false);
    setShippingDirty(false);
    setFilledFromCustomerId(null);
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
    filledFromCustomerId,
    updateShipping,
    fillShippingFromCustomer,
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
