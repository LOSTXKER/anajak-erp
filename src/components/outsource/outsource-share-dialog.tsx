"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { buildLineShareUrl, buildJobShareText } from "@/lib/line-share";
import { formatDate, isImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

// แชร์ใบงานให้ร้านนอกผ่าน LINE + แนบไฟล์ลาย (Gate B14)
// ลิงก์ = /job/<token> เปิดได้ไม่ต้อง login — ร้านเห็นเฉพาะ งาน/จำนวน/ตารางไซซ์/ลาย/กำหนดส่งคืน
// (server ไม่คืน ค่าจ้าง/ราคาขาย/ชื่อลูกค้า — ดู services/outsource-share.ts)

interface OutsourceShareDialogProps {
  job: {
    id: string;
    description: string;
    quantity: number;
    expectedBackAt: Date | string | null;
  };
  onClose: () => void;
}

export function OutsourceShareDialog({ job, onClose }: OutsourceShareDialogProps) {
  const utils = trpc.useUtils();
  const [showUpload, setShowUpload] = useState(false);

  const { data: link, isLoading: loadingLink } = trpc.outsourceShare.getLink.useQuery({
    outsourceOrderId: job.id,
  });
  const { data: attachments, isLoading: loadingFiles } = trpc.attachment.listByEntity.useQuery({
    entityType: "OUTSOURCE_ORDER",
    entityId: job.id,
  });

  const generateLink = useMutationWithInvalidation(trpc.outsourceShare.generateLink, {
    invalidate: [utils.outsourceShare.getLink],
    onSuccess: () => toast.success("สร้างลิงก์แล้ว — ลิงก์เก่า (ถ้ามี) ใช้ไม่ได้อีก"),
    onError: (err: { message?: string }) => toast.error(err.message ?? "สร้างลิงก์ไม่สำเร็จ"),
  });
  const createAttachment = useMutationWithInvalidation(trpc.attachment.create, {
    invalidate: [utils.attachment.listByEntity],
    onSuccess: () => setShowUpload(false),
    onError: (err: { message?: string }) => toast.error(err.message ?? "แนบไฟล์ไม่สำเร็จ"),
  });
  const deleteAttachment = useMutationWithInvalidation(trpc.attachment.delete, {
    invalidate: [utils.attachment.listByEntity],
    onError: (err: { message?: string }) => toast.error(err.message ?? "ลบไฟล์ไม่สำเร็จ"),
  });

  const tokenValid =
    !!link?.token && !!link.expiresAt && new Date(link.expiresAt) > new Date();
  const shareUrl = tokenValid ? `${window.location.origin}/job/${link.token}` : null;

  async function handleCopy() {
    if (!shareUrl) return;
    // clipboard API เป็น undefined บน insecure context (http://192.168.x.x — LAN โรงงาน)
    // + reject ได้ตอนโฟกัสหลุด → fallback textarea+execCommand แล้ว toast ตามผลจริง
    const fallbackCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };
    let copied = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    } catch {
      copied = fallbackCopy();
    }
    toast.success(
      copied ? "คัดลอกลิงก์แล้ว — วางในแชท LINE ได้เลย" : `ลิงก์ใบงาน: ${shareUrl}`
    );
  }

  function handleShareLine() {
    if (!shareUrl) return;
    const text = buildJobShareText({
      description: job.description,
      quantity: job.quantity,
      dueText: job.expectedBackAt ? formatDate(job.expectedBackAt) : null,
      url: shareUrl,
    });
    window.open(buildLineShareUrl(text), "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>แชร์ใบงานให้ร้าน</DialogTitle>
          <DialogDescription>
            {job.description} · {job.quantity} ชิ้น
            {job.expectedBackAt && ` · กำหนดส่งคืน ${formatDate(job.expectedBackAt)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ไฟล์ลาย */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                ไฟล์ลาย ({attachments?.length ?? 0})
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setShowUpload((v) => !v)}
              >
                <Upload className="h-3 w-3" />
                แนบไฟล์
              </Button>
            </div>

            {showUpload && (
              <div className="mb-3">
                <FileUpload
                  bucket="designs"
                  pathPrefix={`outsource/${job.id}`}
                  accept="image/*,.pdf,.ai,.psd,.eps,.zip"
                  maxSizeMB={25}
                  disabled={createAttachment.isPending}
                  onUploaded={(url, fileName, file) =>
                    createAttachment.mutate({
                      entityType: "OUTSOURCE_ORDER",
                      entityId: job.id,
                      fileName,
                      fileUrl: url,
                      fileType: file.type || "application/octet-stream",
                      fileSize: file.size,
                      category: "PRINT_FILE",
                    })
                  }
                  onError={(msg) => toast.error(msg)}
                />
              </div>
            )}

            {loadingFiles ? (
              <p className="text-xs text-slate-400">กำลังโหลด...</p>
            ) : !attachments || attachments.length === 0 ? (
              <p className="text-xs text-slate-400">
                ยังไม่มีไฟล์ — แนบไฟล์ลายให้ร้านโหลดไปทำงานได้จากลิงก์
              </p>
            ) : (
              <ul className="space-y-1.5">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm dark:border-slate-700"
                  >
                    {isImageUrl(a.fileUrl) ? (
                      <img
                        src={a.fileUrl}
                        alt={a.fileName}
                        className="h-9 w-9 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <a
                      href={a.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {a.fileName}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-slate-400 hover:text-red-500"
                      disabled={deleteAttachment.isPending}
                      onClick={() => deleteAttachment.mutate({ id: a.id })}
                      title="ลบไฟล์"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ลิงก์แชร์ */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              ลิงก์ใบงาน
            </p>
            {loadingLink ? (
              <p className="text-xs text-slate-400">กำลังโหลด...</p>
            ) : shareUrl ? (
              <>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-slate-100 px-2.5 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {shareUrl}
                  </code>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1.5" onClick={handleShareLine}>
                    <MessageCircle className="h-3.5 w-3.5" />
                    แชร์เข้า LINE
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5" />
                    คัดลอกลิงก์
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-slate-500"
                    disabled={generateLink.isPending}
                    onClick={() => generateLink.mutate({ outsourceOrderId: job.id })}
                    title="ออกลิงก์ใหม่ — ลิงก์เดิมใช้ไม่ได้อีก"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    สร้างลิงก์ใหม่
                  </Button>
                </div>
                {link?.expiresAt && (
                  <p className="text-xs text-slate-400">
                    ลิงก์ใช้ได้ถึง {formatDate(link.expiresAt)} · ร้านเปิดได้โดยไม่ต้อง login —
                    เห็นเฉพาะ งาน/จำนวน/ตารางไซซ์/ลาย/กำหนดส่งคืน (ไม่มีราคา/ชื่อลูกค้า)
                  </p>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={generateLink.isPending}
                onClick={() => generateLink.mutate({ outsourceOrderId: job.id })}
              >
                {generateLink.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                สร้างลิงก์ใบงาน
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
