"use client";

import { use, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { uploadToCustomerSignedUrl } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileCheck,
  Paperclip,
  X,
} from "lucide-react";

// หน้าอัปโหลดไฟล์ของลูกค้า (FLOW-REDESIGN ก้อน 4 ชิ้น 3) — เปิดผ่านลิงก์ token ไม่ต้อง login
// flow: createUploadUrl (server ออก signed URL) → อัปตรงเข้า storage → confirmUpload (บันทึก)
// โชว์เฉพาะข้อมูลของลูกค้า (เลขออเดอร์/ชื่องาน/กำหนดส่ง) — ไม่มีข้อมูลภายใน

const MAX_MB = 25;
const ACCEPT = "image/*,.pdf,.ai,.psd,.eps,.zip,.rar";

type UploadItem = {
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
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);

  const info = trpc.customerUpload.getInfo.useQuery({ token });
  const createUrl = trpc.customerUpload.createUploadUrl.useMutation();
  const confirm = trpc.customerUpload.confirmUpload.useMutation();

  function setItemStatus(name: string, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((it) => (it.name === name ? { ...it, ...patch } : it))
    );
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setBusy(true);
    // เริ่มทุกไฟล์เป็น uploading (key ด้วยชื่อ — ไฟล์ชื่อซ้ำในชุดเดียวพบยาก ยอมรับได้)
    setItems((prev) => [
      ...files.map((f) => ({ name: f.name, status: "uploading" as const })),
      ...prev,
    ]);

    for (const file of files) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setItemStatus(file.name, {
          status: "error",
          error: `ไฟล์ใหญ่เกิน ${MAX_MB}MB`,
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
        setItemStatus(file.name, { status: "done" });
      } catch (err) {
        setItemStatus(file.name, {
          status: "error",
          error: err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ",
        });
      }
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    utils.customerUpload.getInfo.invalidate({ token });
  }

  if (info.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      </div>
    );
  }

  if (info.error || !info.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              เปิดลิงก์ไม่ได้
            </h2>
            <p className="text-sm text-slate-500">
              {info.error?.message ??
                "ลิงก์อาจไม่ถูกต้องหรือหมดอายุแล้ว กรุณาติดต่อทีมงาน"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = info.data;
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        {/* Header */}
        <div className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Paperclip className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Anajak Print</h1>
          </div>
          <p className="text-sm text-slate-500">ส่งไฟล์งานให้ทีมงาน</p>
        </div>

        {/* Order Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลออเดอร์</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">เลขออเดอร์</span>
                <span className="font-medium text-slate-900">{d.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ชื่องาน</span>
                <span className="font-medium text-slate-900">{d.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ลูกค้า</span>
                <span className="font-medium text-slate-900">{d.customerName}</span>
              </div>
              {d.deadline && (
                <div className="flex justify-between">
                  <span className="text-slate-500">กำหนดส่ง</span>
                  <span className="font-medium text-slate-900">
                    {formatDate(d.deadline)}
                  </span>
                </div>
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
              accept={ACCEPT}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              disabled={busy}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-500 disabled:pointer-events-none disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-7 w-7 animate-spin" />
                  กำลังอัปโหลด...
                </>
              ) : (
                <>
                  <Upload className="h-7 w-7" />
                  <span className="font-medium">เลือกไฟล์เพื่ออัปโหลด</span>
                  <span className="text-xs text-slate-400">
                    รูปภาพ / PDF / AI / PSD / ZIP · สูงสุด {MAX_MB}MB ต่อไฟล์
                  </span>
                </>
              )}
            </button>

            {/* รายการที่อัปในรอบนี้ */}
            {items.length > 0 && (
              <ul className="space-y-1.5">
                {items.map((it, idx) => (
                  <li
                    key={`${it.name}-${idx}`}
                    className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm"
                  >
                    {it.status === "uploading" && (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
                    )}
                    {it.status === "done" && (
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    )}
                    {it.status === "error" && (
                      <X className="h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-slate-700">
                      {it.name}
                    </span>
                    {it.status === "error" && (
                      <span className="shrink-0 text-xs text-red-500">
                        {it.error}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {doneCount > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-green-600">
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
                    <span className="flex min-w-0 items-center gap-2 text-slate-700">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{f.fileName}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDate(f.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-slate-400">
          Powered by Anajak Print ERP
        </p>
      </div>
    </div>
  );
}
