"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { c, CardHead } from "@/components/kit/kit";
import { uploadFile } from "@/lib/supabase";
import { safeFileExt } from "@/lib/file-urls";
import { PRINT_POSITIONS } from "@/types/order-form";
import type { ReferenceImage } from "@/types/order-form";
import { ChevronRight, FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { cn, isImageUrl } from "@/lib/utils";

// รูป/ไฟล์อ้างอิงจากแชท — แยกจาก orders/new/page.tsx ตอนรื้อฟอร์ม 2026-06-12
// (อัปโหลด Supabase + เลือกตำแหน่งพิมพ์ต่อไฟล์) · หน้าตาแถวไฟล์ตามต้นแบบ 2026-09-18 (tabFiles)

const MAX_FILES = 5;

interface OrderAttachmentsSectionProps {
  /** anchor + โฟกัสให้แถบขั้นตอนกระโดดมาได้ (ใช้ตอนเป็นตอนเต็มของหน้าเปิดงาน) */
  id?: string;
  className?: string;
  images: ReferenceImage[];
  onImagesChange: React.Dispatch<React.SetStateAction<ReferenceImage[]>>;
}

/** รูปย่อ: preview ที่เป็นรูปจริง (ไฟล์เดิมที่ระบบรู้ว่าเป็นรูปส่ง preview = fileUrl มาแล้ว)
 *  หรือ URL ไฟล์ที่เป็นรูป — .pdf/.ai/.psd ใช้ไอคอนไฟล์แทน เพราะ <img> จะแตก */
function thumbSrc(img: ReferenceImage): string | null {
  if (img.preview && (isImageUrl(img.preview) || img.preview === img.fileUrl)) return img.preview;
  return isImageUrl(img.fileUrl) ? img.fileUrl : null;
}

function fileSizeText(bytes: number | undefined): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function OrderAttachmentsSection({
  id,
  className,
  images,
  onImagesChange,
}: OrderAttachmentsSectionProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canAttach = images.length < MAX_FILES;

  const openPicker = () => {
    if (!uploading) inputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxFiles = MAX_FILES - images.length;
    const filesToUpload = Array.from(files).slice(0, maxFiles);
    // ตัดไฟล์ที่เกินโควตาต้องบอก — เดิมตัดเงียบ ผู้ใช้คิดว่าแนบครบแล้ว (audit ข้อ 4)
    if (files.length > maxFiles) {
      toast.warning(`แนบได้สูงสุด ${MAX_FILES} ไฟล์ — ข้าม ${files.length - maxFiles} ไฟล์ที่เกินมา`);
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
    <section id={id} tabIndex={id ? -1 : undefined} className={cn(c("card"), className)}>
      <CardHead
        icon={ImageIcon}
        tone="violet"
        title="ไฟล์อ้างอิงจากแชท"
        right={
          <>
            <span className={c("chip gray")}>
              {images.length}/{MAX_FILES} ไฟล์
            </span>
            {/* ครบโควตาแล้วไม่มีปุ่มแนบ (ชิปบอกว่าเต็ม) · ระหว่างอัปโหลดกดซ้ำไม่ได้แต่ยังเห็นว่ากำลังทำ */}
            {canAttach && (
              <button
                type="button"
                className={c("btn sm")}
                aria-busy={uploading || undefined}
                onClick={openPicker}
              >
                {uploading ? <Spinner size="md" /> : <Upload aria-hidden="true" />}
                {uploading ? "กำลังอัปโหลด..." : "แนบไฟล์"}
              </button>
            )}
          </>
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.ai,.psd"
        multiple
        onChange={handleImageUpload}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={uploading}
      />
      <div className={c("cb")}>
        {images.length === 0 ? (
          <button
            type="button"
            className={c("drop act")}
            aria-busy={uploading || undefined}
            onClick={openPicker}
          >
            {uploading ? <Spinner size="md" /> : <Upload aria-hidden="true" />}
            <b>{uploading ? "กำลังอัปโหลด..." : "แนบไฟล์อ้างอิง"}</b>
          </button>
        ) : (
          <div className={c("files")}>
            {images.map((img, idx) => {
              const src = thumbSrc(img);
              const editable = img.canEdit !== false;
              return (
                /* ทั้งแถวเปิดไฟล์ในแท็บใหม่ (ลิงก์ชื่อไฟล์ขยายเต็มแถว) — ไม่ใช่ <button> ทั้งแถวแบบต้นแบบ
                   เพราะในแถวมีช่องตำแหน่งพิมพ์กับปุ่มลบซ้อนอยู่ */
                <div key={idx} className={c("file rfile")}>
                  <span className={c("th")}>
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <FileText aria-hidden="true" />
                    )}
                  </span>
                  <span className={c("nm")}>
                    <a href={img.fileUrl} target="_blank" rel="noopener noreferrer" className={c("open")}>
                      {img.fileName}
                    </a>
                    {/* บรรทัดชนิดไฟล์ = ตำแหน่งพิมพ์ของไฟล์นี้ เลือกได้ในที่ · ไฟล์ของคนอื่นเป็นข้อความอ่านอย่างเดียว
                        จอเมาส์เตี้ยเท่าบรรทัดข้อความให้แถวสูงเท่าแถวไฟล์ทั่วไป · จอทัชยังสูง 44px ตาม control กลาง */}
                    {editable ? (
                      <Select
                        size="dense"
                        surface="inline"
                        value={img.printPosition || ""}
                        onChange={(e) => {
                          onImagesChange((prev) =>
                            prev.map((im, i) =>
                              i === idx ? { ...im, printPosition: e.target.value || undefined } : im
                            )
                          );
                        }}
                        aria-label={`ตำแหน่งพิมพ์ของ ${img.fileName}`}
                        className={cn(c("ctl"), "-ml-2 w-auto max-w-full gap-1 px-2 text-secondary sm:h-6 sm:min-h-6")}
                      >
                        <option value="">อ้างอิง</option>
                        {Object.entries(PRINT_POSITIONS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <small className={c("ctl")} title="แก้ไขได้เฉพาะไฟล์ที่คุณอัปโหลดเอง">
                        {(img.printPosition && PRINT_POSITIONS[img.printPosition]) || "อ้างอิง"}
                      </small>
                    )}
                  </span>
                  <span className={c("m")}>{fileSizeText(img.fileSize)}</span>
                  {editable ? (
                    <button
                      type="button"
                      className={c("ibtn ctl")}
                      onClick={() => onImagesChange((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`ลบไฟล์ ${img.fileName}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  <ChevronRight className={c("arrow")} aria-hidden="true" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
