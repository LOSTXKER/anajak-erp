"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { FileUpload } from "@/components/ui/file-upload";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RADIUS, SUNK_PANEL, TINT } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import {
  MOCKUP_MAX_FILES_PER_VERSION,
  canSubmitMockupSet,
  mockupPreviewUrl,
  type MockupFileLike,
} from "@/lib/mockup";
import { PRINT_POSITIONS } from "@/types/order-form";
import { Check, ImageOff, Loader2, Trash2, Upload, X } from "lucide-react";

// กล่องโต้ตอบของม็อกอัพที่ใช้ร่วมกัน: อัปเวอร์ชันใหม่ (หลายรูปในชุดเดียว) + บันทึกผลจากลูกค้า
// ยกออกจาก MockupPanel ทั้งก้อน (2026-09-15) ให้แท็บ "ม็อกอัพ & ไฟล์" หน้าตาใหม่ของหน้าออเดอร์
// เรียกสูตรอัป/อนุมัติชุดเดียวกัน ไม่ก๊อปเป็นชุดที่สอง · ข้างในเหมือนเดิมทุกบรรทัด
// สิทธิ์ว่าใครเปิดกล่องได้ยังตัดสินที่ผู้เรียก (และ server ตรวจซ้ำ)

interface DraftFile extends MockupFileLike {
  fileName: string;
}

export function MockupUploadDialog({
  orderId,
  open,
  onOpenChange,
  onUploaded,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** เรียกหลังส่งสำเร็จ — เช่นให้หน้าเลือกเวอร์ชันล่าสุดกลับมา */
  onUploaded?: () => void;
}) {
  const [draftFiles, setDraftFiles] = useState<DraftFile[]>([]);
  const [designerNotes, setDesignerNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  // บังคับ remount FileUpload หลังเพิ่มไฟล์ — ตัวมันเก็บ preview ของไฟล์ล่าสุดไว้ข้างใน
  // ถ้าไม่รีเซ็ตจะเพิ่มรูปที่สองไม่ได้ (ช่องยังโชว์รูปแรกค้าง)
  const [uploaderKey, setUploaderKey] = useState(0);

  const utils = trpc.useUtils();
  const uploadMockup = useMutationWithInvalidation(trpc.design.upload, {
    invalidate: [utils.design.listByOrder, utils.order.getById],
    onSuccess: () => {
      onOpenChange(false);
      setDraftFiles([]);
      setDesignerNotes("");
      setUploadError(null);
      setUploaderKey((k) => k + 1);
      onUploaded?.();
    },
  });

  const readyToSubmit = canSubmitMockupSet(draftFiles);

  function addDraftFile(url: string, fileName: string) {
    setDraftFiles((files) =>
      files.length >= MOCKUP_MAX_FILES_PER_VERSION
        ? files
        : [...files, { fileUrl: url, fileName }],
    );
    setUploadError(null);
    setUploaderKey((k) => k + 1);
  }

  function updateDraftFile(index: number, patch: Partial<DraftFile>) {
    setDraftFiles((files) =>
      files.map((file, i) => (i === index ? { ...file, ...patch } : file)),
    );
  }

  function removeDraftFile(index: number) {
    setDraftFiles((files) => files.filter((_, i) => i !== index));
  }

  function handleUploadSubmit() {
    if (!readyToSubmit) return; // ปุ่ม disabled อยู่แล้ว — กันยิงตรง
    uploadMockup.mutate({
      orderId,
      files: draftFiles.map((file) => ({
        fileUrl: file.fileUrl,
        thumbnailUrl: file.thumbnailUrl || undefined,
        position: file.position || undefined,
        caption: file.caption || undefined,
      })),
      designerNotes: designerNotes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>อัปม็อกอัพเวอร์ชันใหม่</DialogTitle>
          <DialogDescription>
            แนบได้หลายรูปในเวอร์ชันเดียว (หน้า/หลัง/แขน) ลูกค้าจะเห็นทั้งชุดแล้วอนุมัติครั้งเดียว
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {draftFiles.length > 0 && (
            <ul className="space-y-3">
              {draftFiles.map((file, index) => {
                const preview = mockupPreviewUrl(file);
                return (
                  <li
                    key={`${file.fileUrl}-${index}`}
                    className={cn("flex flex-wrap gap-3 p-3", SUNK_PANEL, RADIUS.inner)}
                  >
                    <div
                      className={cn(
                        "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-surface",
                        RADIUS.item,
                      )}
                    >
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt={`รูปที่ ${index + 1}`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <ImageOff className="h-4 w-4 text-muted" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="truncate text-xs text-muted" title={file.fileName}>
                        {file.fileName}
                      </p>
                      <Select
                        aria-label={`ตำแหน่งพิมพ์ของรูปที่ ${index + 1}`}
                        value={file.position ?? ""}
                        onChange={(e) =>
                          updateDraftFile(index, { position: e.target.value })
                        }
                        size="dense"
                      >
                        <option value="">ไม่ระบุตำแหน่ง</option>
                        {Object.entries(PRINT_POSITIONS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>

                      {/* ไฟล์งาน .ai/.psd ลูกค้าเปิดดูบนมือถือไม่ได้ — ต้องแนบรูปตัวอย่าง
                          ไม่งั้นส่งลิงก์ไปแล้วลูกค้าต้องตัดสินทั้งที่มองไม่เห็นแบบ (audit ข้อ 15) */}
                      {!preview && (
                        <div className={cn("border p-2", TINT.warning, RADIUS.item)}>
                          <p className="mb-2 text-xs font-medium">
                            ไฟล์นี้ลูกค้าเปิดดูบนมือถือไม่ได้ — แนบรูปตัวอย่างก่อนส่ง
                          </p>
                          <FileUpload
                            bucket="designs"
                            pathPrefix={`orders/${orderId}/previews`}
                            accept="image/*"
                            maxSizeMB={10}
                            onUploaded={(url) =>
                              updateDraftFile(index, { thumbnailUrl: url })
                            }
                            onError={(err) => setUploadError(err)}
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      onClick={() => removeDraftFile(index)}
                      aria-label={`เอารูปที่ ${index + 1} ออก`}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {draftFiles.length < MOCKUP_MAX_FILES_PER_VERSION ? (
            <FileUpload
              key={uploaderKey}
              bucket="designs"
              pathPrefix={`orders/${orderId}`}
              accept="image/*,.pdf,.ai,.psd"
              maxSizeMB={25}
              onUploaded={(url, fileName) => addDraftFile(url, fileName)}
              onError={(err) => setUploadError(err)}
            />
          ) : (
            <p className="text-xs text-muted">
              ครบ {MOCKUP_MAX_FILES_PER_VERSION} รูปแล้ว — เอารูปออกก่อนถ้าจะเพิ่มรูปอื่น
            </p>
          )}

          {uploadError && (
            <Alert variant="error">{uploadError}</Alert>
          )}

          <div>
            <label
              htmlFor="mockup-designer-notes"
              className="mb-1 block text-sm font-medium text-secondary"
            >
              โน้ตจากดีไซเนอร์
            </label>
            <Textarea
              id="mockup-designer-notes"
              value={designerNotes}
              onChange={(e) => setDesignerNotes(e.target.value)}
              placeholder="สิ่งที่อยากให้ลูกค้าดูเป็นพิเศษ..."
              rows={3}
            />
          </div>
        </div>

        <DialogSubmitFooter
          pending={uploadMockup.isPending}
          disabled={!readyToSubmit}
          submitLabel={
            draftFiles.length > 1 ? `ส่งม็อกอัพ ${draftFiles.length} รูป` : "ส่งม็อกอัพ"
          }
          submitIcon={<Upload />}
          onCancel={() => onOpenChange(false)}
          onSubmit={handleUploadSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

/** บันทึกผลที่ลูกค้าตอบมา (ทางโทรศัพท์/แชท) — ลูกค้ากดเองได้ที่ลิงก์อนุมัติ · designId null = ปิด */
export function MockupDecisionDialog({
  designId,
  onClose,
}: {
  designId: string | null;
  onClose: () => void;
}) {
  const [approveComment, setApproveComment] = useState("");

  const utils = trpc.useUtils();
  const approveMockup = useMutationWithInvalidation(trpc.design.approve, {
    invalidate: [utils.design.listByOrder, utils.order.getById],
    onSuccess: () => {
      onClose();
      setApproveComment("");
    },
  });

  return (
    <Dialog
      open={designId !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>บันทึกผลจากลูกค้า</DialogTitle>
          <DialogDescription>
            ผลนี้ใช้กับม็อกอัพทั้งชุดในเวอร์ชันนี้
          </DialogDescription>
        </DialogHeader>
        <div>
          <label
            htmlFor="mockup-approval-comment"
            className="mb-1 block text-sm font-medium text-secondary"
          >
            ความเห็นลูกค้า
          </label>
          <Textarea
            id="mockup-approval-comment"
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            placeholder="เช่น ขอโลโก้ใหญ่กว่านี้..."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (designId)
                approveMockup.mutate({
                  designId,
                  approved: false,
                  comment: approveComment || undefined,
                });
            }}
            disabled={approveMockup.isPending}
            className="gap-1.5"
          >
            <X />
            ลูกค้าขอแก้
          </Button>
          <Button
            onClick={() => {
              if (designId)
                approveMockup.mutate({
                  designId,
                  approved: true,
                  comment: approveComment || undefined,
                });
            }}
            disabled={approveMockup.isPending}
            className="gap-1.5"
          >
            {approveMockup.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            ลูกค้าอนุมัติ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
