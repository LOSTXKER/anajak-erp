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
  const [showShipping, setShowShipping] = useState(false);
  const [shipping, setShipping] = useState<ShippingState>(INITIAL_SHIPPING);

  const updateShipping = useCallback(
    <K extends keyof ShippingState>(field: K, value: ShippingState[K]) => {
      setShipping((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const resetShipping = useCallback(() => {
    setShipping(INITIAL_SHIPPING);
    setShowShipping(false);
  }, []);

  const validateShipping = useCallback(() => {
    const errors: string[] = [];
    if (!showShipping) return errors;
    if (!shipping.recipientName.trim()) errors.push("กรุณาระบุชื่อผู้รับ (ที่อยู่จัดส่ง)");
    if (!shipping.address.trim()) errors.push("กรุณาระบุที่อยู่จัดส่ง");
    if (shipping.phone && !/^0\d{8,9}$/.test(shipping.phone)) {
      errors.push("เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก");
    }
    if (shipping.postalCode && !/^\d{5}$/.test(shipping.postalCode)) {
      errors.push("รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก");
    }
    return errors;
  }, [showShipping, shipping]);

  const toMutationInput = useCallback(() => {
    if (!showShipping || !shipping.recipientName) return undefined;
    return {
      recipientName: shipping.recipientName,
      phone: shipping.phone,
      address: shipping.address,
      subDistrict: shipping.subDistrict || undefined,
      district: shipping.district || undefined,
      province: shipping.province || undefined,
      postalCode: shipping.postalCode || undefined,
    };
  }, [showShipping, shipping]);

  return {
    showShipping,
    setShowShipping,
    shipping,
    updateShipping,
    resetShipping,
    validateShipping,
    shippingMutationInput: toMutationInput,
  };
}
