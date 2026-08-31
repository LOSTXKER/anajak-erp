"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Section, SectionTitle } from "@/components/ui/section";
import { uploadFile } from "@/lib/supabase";
import { safeFileExt } from "@/lib/file-urls";
import { PRINT_POSITIONS } from "@/types/order-form";
import type { ReferenceImage } from "@/types/order-form";
import { ImageIcon, Upload, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { DASHED_INTERACTIVE } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

// รูป/ไฟล์อ้างอิงจากแชท — แยกจาก orders/new/page.tsx ตอนรื้อฟอร์ม 2026-06-12
// (กางตลอด + อัปโหลด Supabase + เลือกตำแหน่งพิมพ์ต่อรูป)

interface OrderAttachmentsSectionProps {
  title?: React.ReactNode;
  /** anchor + โฟกัสให้แถบขั้นตอนกระโดดมาได้ (ใช้ตอนเป็นตอนเต็มของหน้าเปิดงาน) */
  id?: string;
  className?: string;
  images: ReferenceImage[];
  onImagesChange: React.Dispatch<React.SetStateAction<ReferenceImage[]>>;
  /** วางใน Section หลักของหน้าโดยไม่สร้าง card-surface ซ้อนอีกชั้น */
  embedded?: boolean;
}

export function OrderAttachmentsSection({
  title = "ไฟล์อ้างอิงจากแชท",
  id,
  className,
  images,
  onImagesChange,
  embedded = false,
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

  const uploadControl = images.length < 5 ? (
    <label
      className={cn(
        DASHED_INTERACTIVE,
        "flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm text-secondary transition-colors hover:bg-interactive-hover hover:text-strong focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30 dark:hover:text-strong dark:focus-within:border-blue-300 dark:focus-within:ring-blue-300/25",
        !embedded && "w-full px-4 py-3.5"
      )}
    >
      <input
        type="file"
        accept="image/*,.pdf,.ai,.psd"
        multiple
        onChange={handleImageUpload}
        className="sr-only"
        disabled={uploading}
      />
      {uploading ? (
        <>
          <Spinner size="md" />
          กำลังอัปโหลด...
        </>
      ) : (
        <>
          <Upload className="h-4 w-4" />
          {embedded ? "แนบไฟล์" : "แนบไฟล์อ้างอิง (สูงสุด 5 ไฟล์)"}
        </>
      )}
    </label>
  ) : undefined;

  return (
    <Section
      id={id}
      tabIndex={id ? -1 : undefined}
      className={className}
      title={
        <SectionTitle icon={ImageIcon} tone="system">
          {title}
        </SectionTitle>
      }
      meta={images.length > 0 ? `${images.length}/5 ไฟล์` : "สูงสุด 5 ไฟล์"}
      bordered={!embedded}
      headingLevel={embedded ? 3 : 2}
      action={embedded ? uploadControl : undefined}
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
                    className="h-24 w-24 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-border bg-surface-muted">
                    <ImageIcon className="h-8 w-8 text-muted" />
                  </div>
                )}
                {img.canEdit !== false && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => onImagesChange((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label={`ลบไฟล์ ${img.fileName}`}
                    className="absolute -right-2 -top-2 rounded-full opacity-100 shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  >
                    <X />
                  </Button>
                )}
                <Select
                  size="dense"
                  value={img.printPosition || ""}
                  onChange={(e) => {
                    onImagesChange((prev) =>
                      prev.map((im, i) =>
                        i === idx ? { ...im, printPosition: e.target.value || undefined } : im
                      )
                    );
                  }}
                  aria-label={`ตำแหน่งพิมพ์ของ ${img.fileName}`}
                  disabled={img.canEdit === false}
                  title={img.canEdit === false ? "แก้ไขได้เฉพาะไฟล์ที่คุณอัปโหลดเอง" : undefined}
                  className="mt-1.5 w-24 px-1.5 py-0"
                >
                  <option value="">ทั่วไป</option>
                  {Object.entries(PRINT_POSITIONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        )}
        {!embedded && uploadControl}
      </div>
    </Section>
  );
}
