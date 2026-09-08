"use client";

import { use, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { uploadToCustomerSignedUrl } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLinkError } from "@/components/public-link-error";
import {
  PublicPageShell,
  FullScreenLoading,
  InfoRow,
} from "@/components/public/public-page";
import { Upload, CheckCircle, FileCheck, Paperclip, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { DASHED_INTERACTIVE, FOCUS_BUTTON, SUNK_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { CUSTOMER_UPLOAD_ACCEPT, CUSTOMER_UPLOAD_MAX_BYTES, CUSTOMER_UPLOAD_MAX_MB } from "@/lib/customer-upload-policy";

// หน้าอัปโหลดไฟล์ของลูกค้า (FLOW-REDESIGN ก้อน 4 ชิ้น 3) — เปิดผ่านลิงก์ token ไม่ต้อง login
// flow: createUploadUrl (server ออก signed URL) → อัปตรงเข้า storage → confirmUpload (บันทึก)
// โชว์เฉพาะข้อมูลของลูกค้า (เลขออเดอร์/ลูกค้า/กำหนดส่ง) — ไม่มีข้อมูลภายใน

type UploadItem = {
  id: number;
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
};

export default function CustomerUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadSequence = useRef(0);
  const uploadInFlight = useRef(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);

  const info = trpc.customerUpload.getInfo.useQuery({ token });
  const createUrl = trpc.customerUpload.createUploadUrl.useMutation();
  const confirm = trpc.customerUpload.confirmUpload.useMutation();

  function setItemStatus(id: number, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || uploadInFlight.current) return;
    const files = Array.from(fileList, (file) => ({ file, id: ++uploadSequence.current }));
    uploadInFlight.current = true;
    setBusy(true);
    // แต่ละครั้งมี id ของตัวเอง แม้เลือกไฟล์ชื่อเดียวกันจากหลายโฟลเดอร์หรือส่งซ้ำ
    setItems((prev) => [
      ...files.map(({ file, id }) => ({ id, name: file.name, status: "uploading" as const })),
      ...prev,
    ]);

    for (const { file, id } of files) {
      if (file.size > CUSTOMER_UPLOAD_MAX_BYTES) {
        setItemStatus(id, {
          status: "error",
          error: `ไฟล์ใหญ่เกิน ${CUSTOMER_UPLOAD_MAX_MB}MB`,
        });
        continue;
      }
      try {
        const signed = await createUrl.mutateAsync({
          token,
          fileName: file.name,
          fileSize: file.size,
        });
        await uploadToCustomerSignedUrl(
          signed.bucket,
          signed.path,
          signed.uploadToken,
          file
        );
        await confirm.mutateAsync({
          token,
          path: signed.path,
          fileName: file.name,
          fileType: file.type || "",
          fileSize: file.size,
        });
        setItemStatus(id, { status: "done" });
      } catch (err) {
        setItemStatus(id, {
          status: "error",
          error: err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ",
        });
      }
    }

    uploadInFlight.current = false;
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    utils.customerUpload.getInfo.invalidate({ token });
  }

  if (info.isLoading) {
    return <FullScreenLoading />;
  }

  if (info.error || !info.data) {
    return <PublicLinkError message="ลิงก์ส่งไฟล์อาจไม่ถูกต้องหรือหมดอายุแล้ว" onRetry={() => void info.refetch()} />;
  }

  const d = info.data;
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <PublicPageShell
      icon={<Paperclip />}
      subtitle="ส่งไฟล์งานให้ทีมงาน"
    >
        {/* Order Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลออเดอร์</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <InfoRow label="เลขออเดอร์">{d.orderNumber}</InfoRow>
              <InfoRow label="ลูกค้า">{d.customerName}</InfoRow>
              {d.deadline && (
                <InfoRow label="กำหนดส่ง">{formatDate(d.deadline)}</InfoRow>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">อัปโหลดไฟล์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept={CUSTOMER_UPLOAD_ACCEPT}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              disabled={busy}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className={cn(DASHED_INTERACTIVE, FOCUS_BUTTON, "flex w-full touch-manipulation flex-col items-center justify-center gap-2 rounded-lg px-4 py-8 text-sm text-muted transition-colors hover:text-strong disabled:pointer-events-none disabled:border-border disabled:bg-surface-muted disabled:text-muted")}
            >
              {busy ? (
                <>
                  <Spinner size="xl" />
                  กำลังอัปโหลด...
                </>
              ) : (
                <>
                  <Upload className="h-7 w-7" />
                  <span className="font-medium">เลือกไฟล์เพื่ออัปโหลด</span>
                  <span className="text-xs text-muted">
                    รูปภาพ / PDF / AI / PSD / ไฟล์ ZIP · สูงสุด {CUSTOMER_UPLOAD_MAX_MB}MB ต่อไฟล์
                  </span>
                </>
              )}
            </button>

            {/* รายการที่อัปในรอบนี้ */}
            {items.length > 0 && (
              <ul className="space-y-1.5" aria-live="polite" aria-label="สถานะการส่งไฟล์">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className={cn(SUNK_PANEL, "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm")}
                  >
                    {it.status === "uploading" && (
                      <Spinner size="md" className="shrink-0 text-blue-500" />
                    )}
                    {it.status === "done" && (
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    )}
                    {it.status === "error" && (
                      <X className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    )}
                    <span className="min-w-0 flex-1 break-words text-secondary [overflow-wrap:anywhere]">
                      {it.name}
                    </span>
                    <span className="sr-only">{it.status === "done" ? "ส่งแล้ว" : it.status === "uploading" ? "กำลังส่ง" : "ส่งไม่สำเร็จ"}</span>
                    {it.status === "error" && (
                      <span className="w-full break-words text-sm text-red-600 dark:text-red-400 [overflow-wrap:anywhere]">
                        {it.error}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {doneCount > 0 && (
              <p role="status" className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <FileCheck className="h-4 w-4" />
                ส่งไฟล์เรียบร้อย {doneCount} ไฟล์ — ทีมงานได้รับแล้ว
              </p>
            )}
          </CardContent>
        </Card>

        {/* ไฟล์ที่เคยส่ง */}
        {d.files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                ไฟล์ที่ส่งแล้ว ({d.files.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {d.files.map((f, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-secondary">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="truncate">{f.fileName}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {formatDate(f.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
    </PublicPageShell>
  );
}
