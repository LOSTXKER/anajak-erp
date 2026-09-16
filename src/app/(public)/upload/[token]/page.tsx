"use client";

import { use, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { uploadToCustomerSignedUrl } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { c } from "@/components/kit/kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicLinkError } from "@/components/public-link-error";
import {
  PublicPageShell,
  FullScreenLoading,
} from "@/components/public/public-page";
import { Upload, CheckCircle, FileCheck, Paperclip, FileText, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { RADIUS, SUNK_PANEL } from "@/components/ui/tokens";
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
  const [dragOver, setDragOver] = useState(false);

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
    return <PublicLinkError error={info.error} message="ลิงก์ส่งไฟล์อาจไม่ถูกต้องหรือหมดอายุแล้ว" onRetry={() => void info.refetch()} />;
  }

  const d = info.data;
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <PublicPageShell
      icon={<Paperclip />}
      pageLabel="ส่งไฟล์งาน"
      brandNote="อัปโหลดไฟล์ให้ร้านโดยไม่ต้องเข้าระบบ"
      title={<span className="tabular-nums">ส่งไฟล์สำหรับ {d.orderNumber}</span>}
      subtitle={
        <>
          <span className="block">
            {d.customerName}
            {d.deadline ? ` · กำหนดส่ง ${formatDate(d.deadline)}` : ""}
          </span>
          {/* ชนิดไฟล์/ขนาดอ่านจากกติกากลาง (customer-upload-policy) — ห้ามพิมพ์รายการไฟล์ตายตัว */}
          <span className="block">
            รับไฟล์รูปภาพ · PDF · AI · PSD · ไฟล์บีบอัด ขนาดไม่เกิน {CUSTOMER_UPLOAD_MAX_MB} MB ต่อไฟล์
          </span>
        </>
      }
    >
        {/* กล่องรับไฟล์ — ลากมาวางได้ หรือกดปุ่มเลือกไฟล์ (ต้นแบบ: .drop) */}
        <Card>
          <CardContent className="space-y-4 pt-4.5">
            <input
              ref={inputRef}
              type="file"
              accept={CUSTOMER_UPLOAD_ACCEPT}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              disabled={busy}
              className="hidden"
            />
            <div
              className={c("drop", dragOver && "over")}
              aria-busy={busy || undefined}
              onDragOver={(event) => {
                if (busy) return;
                event.preventDefault();
                if (!dragOver) setDragOver(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                if (!busy) void handleFiles(event.dataTransfer.files);
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                aria-hidden="true"
              >
                {busy ? <Spinner size="lg" /> : <Upload className="h-5 w-5" />}
              </span>
              {busy ? (
                <b className="text-sm font-medium text-strong">กำลังอัปโหลด...</b>
              ) : (
                <>
                  <b className="text-sm font-medium text-strong">ลากไฟล์มาวางตรงนี้</b>
                  <span className="text-sm text-muted">หรือ</span>
                  <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
                    เลือกไฟล์จากเครื่อง
                  </Button>
                </>
              )}
            </div>

            {/* รายการที่อัปในรอบนี้ */}
            {items.length > 0 && (
              <ul className="space-y-1.5" aria-live="polite" aria-label="สถานะการส่งไฟล์">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className={cn(SUNK_PANEL, RADIUS.inner, "flex flex-wrap items-center gap-2 px-3 py-2 text-sm")}
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
              <p role="status" className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300">
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
              <CardTitle className="flex items-center gap-2 text-base">
                ไฟล์ที่ส่งมาแล้ว
                <Badge>{d.files.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* แถวไฟล์: กล่องไอคอน · ชื่อไฟล์ + วันที่ใต้ชื่อ · คั่นด้วยเส้นเต็มความกว้างการ์ด */}
              <ul className="-mx-4.5">
                {d.files.map((f, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-3 border-t border-divider px-4.5 py-2.5"
                  >
                    <span
                      className={cn(SUNK_PANEL, RADIUS.inner, "flex h-8 w-8 shrink-0 items-center justify-center text-secondary")}
                      aria-hidden="true"
                    >
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-strong">{f.fileName}</span>
                      <span className="block text-sm text-muted">ส่งเมื่อ {formatDate(f.createdAt)}</span>
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
