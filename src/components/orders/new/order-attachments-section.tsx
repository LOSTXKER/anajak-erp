"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/ui/native-select";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { uploadFile } from "@/lib/supabase";
import { PRINT_POSITIONS } from "@/types/order-form";
import type { ReferenceImage } from "@/types/order-form";
import { ImageIcon, Upload, X, Loader2 } from "lucide-react";

// รูป/ไฟล์อ้างอิงจากแชท — แยกจาก orders/new/page.tsx ตอนรื้อฟอร์ม 2026-06-12
// (กล่องพับ + อัปโหลด Supabase + เลือกตำแหน่งพิมพ์ต่อรูป — พฤติกรรมเดิมทุกอย่าง)

interface OrderAttachmentsSectionProps {
  title?: React.ReactNode;
  images: ReferenceImage[];
  onImagesChange: React.Dispatch<React.SetStateAction<ReferenceImage[]>>;
}

export function OrderAttachmentsSection({
  title = "รูป / ไฟล์อ้างอิงจากแชท",
  images,
  onImagesChange,
}: OrderAttachmentsSectionProps) {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxFiles = 5 - images.length;
    const filesToUpload = Array.from(files).slice(0, maxFiles);
    // ตัดไฟล์ที่เกินโควตาต้องบอก — เดิมตัดเงียบ ผู้ใช้คิดว่าแนบครบแล้ว (audit ข้อ 4)
    if (files.length > maxFiles) {
      toast.warning(`แนบได้สูงสุด 5 ไฟล์ — ข้าม ${files.length - maxFiles} ไฟล์ที่เกินมา`);
    }

    setUploading(true);
    try {
      for (const file of filesToUpload) {
        if (file.size > 10 * 1024 * 1024) {
          toast.warning(`ไฟล์ "${file.name}" มีขนาดเกิน 10MB — ข้ามไฟล์นี้`);
          continue;
        }

        const preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });

        const ext = file.name.split(".").pop() || "file";
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const path = `orders/references/${uniqueName}`;
        const url = await uploadFile("designs", path, file);

        onImagesChange((prev) => [
          ...prev,
          { fileUrl: url, fileName: file.name, fileSize: file.size, preview },
        ]);
      }
    } catch {
      // อัปโหลดล้มเหลวห้ามเงียบ — ไฟล์ที่ขึ้นแล้วยังอยู่ แต่ผู้ใช้ต้องรู้ว่าที่เหลือไม่ขึ้น
      toast.error("อัปโหลดไฟล์ไม่สำเร็จ — ไฟล์ที่ขึ้นแล้วยังอยู่ ลองแนบไฟล์ที่เหลือใหม่อีกครั้ง");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <CollapsibleSection
      title={title}
      defaultOpen={images.length > 0}
      summary={images.length > 0 ? `${images.length} ไฟล์` : "แนะนำแนบรูปที่ลูกค้าส่งมา"}
    >
      <div className="space-y-3">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {images.map((img, idx) => (
              <div key={idx} className="group relative">
                {img.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.preview}
                    alt={img.fileName}
                    className="h-24 w-24 rounded-xl border border-slate-200/60 object-cover dark:border-slate-700/60"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800">
                    <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onImagesChange((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
                <NativeSelect
                  value={img.printPosition || ""}
                  onChange={(e) => {
                    onImagesChange((prev) =>
                      prev.map((im, i) =>
                        i === idx ? { ...im, printPosition: e.target.value || undefined } : im
                      )
                    );
                  }}
                  className="mt-1.5 h-7 w-24 px-1.5 py-0 text-[11px]"
                >
                  <option value="">ทั่วไป</option>
                  {Object.entries(PRINT_POSITIONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>
        )}
        {images.length < 5 && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-4 py-6 text-[13px] text-slate-500 transition-colors hover:border-blue-400 hover:bg-white hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:border-blue-500">
            <input
              type="file"
              accept="image/*,.pdf,.ai,.psd"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังอัปโหลด...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                อัปโหลดภาพอ้างอิง (สูงสุด 5 ภาพ)
              </>
            )}
          </label>
        )}
      </div>
    </CollapsibleSection>
  );
}
