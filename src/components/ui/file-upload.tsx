"use client";

import * as React from "react";
import { Upload, X, FileImage, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/supabase";

interface FileUploadProps {
  bucket: string;
  pathPrefix: string;
  accept?: string;
  maxSizeMB?: number;
  onUploaded: (url: string, fileName: string) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  bucket,
  pathPrefix,
  accept = "image/*",
  maxSizeMB = 10,
  onUploaded,
  onError,
  className,
  disabled,
}: FileUploadProps) {
  const [uploading, setUploading] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      onError?.(`ไฟล์ใหญ่เกินไป (สูงสุด ${maxSizeMB}MB)`);
      return;
    }

    setUploading(true);
    setFileName(file.name);

    // Show preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }

    try {
      const ext = file.name.split(".").pop() || "file";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `${pathPrefix}/${uniqueName}`;

      const url = await uploadFile(bucket, path, file);
      onUploaded(url, file.name);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
      setPreview(null);
      setFileName(null);
    } finally {
      setUploading(false);
    }
  }

  function clearFile() {
    setPreview(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
      />

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="h-32 w-auto rounded-lg border border-slate-200 object-contain dark:border-slate-700"
          />
          <button
            type="button"
            onClick={clearFile}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white shadow-sm hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400",
            (disabled || uploading) && "pointer-events-none opacity-50"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              กำลังอัปโหลด...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              เลือกไฟล์
            </>
          )}
        </button>
      )}

      {fileName && !preview && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <FileImage className="h-4 w-4" />
          {fileName}
          {uploading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      )}
    </div>
  );
}
