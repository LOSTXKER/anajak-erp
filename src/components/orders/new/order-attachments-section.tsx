"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { uploadFile } from "@/lib/supabase";
import { safeFileExt } from "@/lib/file-urls";
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

        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeFileExt(file.name)}`;
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
      defaultOpen
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
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => onImagesChange((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label={`ลบไฟล์ ${img.fileName}`}
                  className="absolute -right-2 -top-2 rounded-full opacity-100 shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                >
                  <X className="h-3 w-3" />
                </Button>
                <NativeSelect
                  value={img.printPosition || ""}
                  onChange={(e) => {
                    onImagesChange((prev) =>
                      prev.map((im, i) =>
                        i === idx ? { ...im, printPosition: e.target.value || undefined } : im
                      )
                    );
                  }}
                  aria-label={`ตำแหน่งพิมพ์ของ ${img.fileName}`}
                  className="mt-1.5 h-11 w-24 px-1.5 py-0 text-sm sm:h-8 sm:text-xs"
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
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-4 py-5 text-sm text-slate-600 transition-colors hover:border-blue-400 hover:bg-white hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:border-blue-500">
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
