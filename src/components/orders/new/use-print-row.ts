"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { uploadFile } from "@/lib/supabase";
import { safeFileExt } from "@/lib/file-urls";
import { PRINT_SIZES, type PrintForm } from "@/types/order-form";

// Logic ของลายหนึ่งแถว ใช้ร่วมกันระหว่างตารางจอกว้างกับการ์ดจอแคบ
// เพื่อให้การอัปโหลดไฟล์และ preset ขนาดทำงานเหมือนกันทั้งสอง layout
export function usePrintRow(
  print: PrintForm,
  onUpdate: (field: string, value: unknown) => void
) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCustomSize = print.printSize === "CUSTOM" || !print.printSize;
  const showColorCount =
    print.printType === "SILK_SCREEN" || print.printType === "HEAT_TRANSFER";
  const imageUrl = print.designImagePreview || print.designImageUrl;
  const sizePreset = !isCustomSize ? PRINT_SIZES[print.printSize] : undefined;

  const handleSizePreset = (preset: string) => {
    onUpdate("printSize", preset);
    const sizeConfig = PRINT_SIZES[preset];
    if (sizeConfig && preset !== "CUSTOM") {
      onUpdate("width", sizeConfig.width);
      onUpdate("height", sizeConfig.height);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 10 * 1024 * 1024) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) =>
      onUpdate("designImagePreview", event.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeFileExt(file.name)}`;
      const url = await uploadFile("designs", `orders/prints/${uniqueName}`, file);
      onUpdate("designImageUrl", url);
      onUpdate("artworkId", undefined);
    } catch {
      onUpdate("designImagePreview", undefined);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearImage = () => {
    onUpdate("designImageUrl", undefined);
    onUpdate("designImagePreview", undefined);
    onUpdate("artworkId", undefined);
  };

  return {
    uploading,
    inputRef,
    handleSizePreset,
    handleImageUpload,
    clearImage,
    isCustomSize,
    showColorCount,
    imageUrl,
    sizePreset,
  };
}
