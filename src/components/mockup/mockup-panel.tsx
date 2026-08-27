"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import {
  computeRevisionOverage,
  REVISION_FEE_TYPE,
  REVISION_FEE_PER_ROUND,
} from "@/lib/revision-policy";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload } from "@/components/ui/file-upload";
import { QueryError } from "@/components/ui/query-error";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { RADIUS, SUNK_PANEL, TINT } from "@/components/ui/tokens";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_VARIANTS } from "@/lib/status-config";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import {
  MOCKUP_MAX_FILES_PER_VERSION,
  canSubmitMockupSet,
  mockupPreviewUrl,
  type MockupFileLike,
} from "@/lib/mockup";
import { PRINT_POSITIONS } from "@/types/order-form";
import { MockupGallery } from "./mockup-gallery";
import {
  Check,
  Copy,
  ExternalLink,
  ImageOff,
  Loader2,
  MessageSquare,
  Receipt,
  Shirt,
  Trash2,
  Upload,
  X,
} from "lucide-react";

// บ้านเดียวของม็อกอัพ (ไฟล์ชั้น 2 APPROVAL ตาม src/lib/file-layers.ts)
// ทุกจอที่ต้องโชว์ม็อกอัพเรียก component นี้ ห้ามสร้างตัวที่สอง — ก่อนหน้านี้หน้าออเดอร์
// โชว์ม็อกอัพสองแท็บด้วยโค้ดคนละชุด ยิง query เดียวกันซ้ำ และหน้าผลิตไม่มีที่ให้ดูเลย
//
// readOnly = พื้นผิวฝ่ายผลิต (/production/[id]) — ดูอย่างเดียว ไม่มีอัป/อนุมัติ/ลิงก์ลูกค้า
// และไม่มีเงินเด็ดขาด

interface DraftFile extends MockupFileLike {
  fileName: string;
}

export function MockupPanel({
  orderId,
  internalStatus,
  canSeeMoney = false,
  readOnly = false,
  title = "ม็อกอัพ",
  description,
}: {
  orderId: string;
  internalStatus: string;
  canSeeMoney?: boolean;
  readOnly?: boolean;
  title?: string;
  description?: string;
}) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState<string | null>(null);
  const [draftFiles, setDraftFiles] = useState<DraftFile[]>([]);
  const [designerNotes, setDesignerNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [approveComment, setApproveComment] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  // บังคับ remount FileUpload หลังเพิ่มไฟล์ — ตัวมันเก็บ preview ของไฟล์ล่าสุดไว้ข้างใน
  // ถ้าไม่รีเซ็ตจะเพิ่มรูปที่สองไม่ได้ (ช่องยังโชว์รูปแรกค้าง)
  const [uploaderKey, setUploaderKey] = useState(0);

  const utils = trpc.useUtils();
  const designs = trpc.design.listByOrder.useQuery({ orderId });

  const uploadMockup = useMutationWithInvalidation(trpc.design.upload, {
    invalidate: [utils.design.listByOrder, utils.order.getById],
    onSuccess: () => {
      setShowUploadDialog(false);
      setDraftFiles([]);
      setDesignerNotes("");
      setUploadError(null);
      setUploaderKey((k) => k + 1);
    },
  });
  const approveMockup = useMutationWithInvalidation(trpc.design.approve, {
    invalidate: [utils.design.listByOrder, utils.order.getById],
    onSuccess: () => {
      setShowApproveDialog(null);
      setApproveComment("");
    },
  });
  const regenerateToken = useMutationWithInvalidation(trpc.design.regenerateToken, {
    invalidate: [utils.design.listByOrder],
  });

  // ค่าแก้แบบเกินโควตา (ก้อน 4) — อ่าน fees จาก order (cache hit · หน้าออเดอร์ยิงอยู่แล้ว)
  const order = trpc.order.getById.useQuery(
    { id: orderId },
    { enabled: canSeeMoney && !readOnly },
  );
  const addRevisionFee = useMutationWithInvalidation(trpc.order.addRevisionFee, {
    invalidate: [utils.order.getById],
    onSuccess: () => toast.success("คิดค่าแก้แบบเกินโควตาแล้ว — ดูที่ค่าธรรมเนียมออเดอร์"),
  });

  // ปุ่มต้องตรงสิทธิ์ server (audit ข้อ 29): อัปม็อกอัพ = กราฟิกขึ้นไป ·
  // บันทึกผลแทนลูกค้า = ฝั่งขาย (คนถือความสัมพันธ์ลูกค้า ไม่ใช่คนวาดเอง)
  const { data: me } = trpc.user.me.useQuery();
  // fail closed ระหว่างโหลดสิทธิ์ — หน้ากางส่วนนี้ทันทีจึงห้ามให้ปุ่มแวบขึ้นก่อนรู้ role
  const roleCanUpload = !!me && permAllows(me.permissions, "manage_design_files");
  const roleCanApprove = !!me && permAllows(me.permissions, "create_sales_docs");
  const roleCanRegenerate = !!me && permAllows(me.permissions, "create_design_assets");
  const inDesignPhase = internalStatus === "DESIGNING";
  const canUpload = !readOnly && inDesignPhase && roleCanUpload;
  const canApprove = !readOnly && inDesignPhase && roleCanApprove;

  const versions = designs.data ?? [];
  const hasVersions = versions.length > 0;
  const readyToSubmit = canSubmitMockupSet(draftFiles);

  // ค่าแก้แบบ — นับรอบจากจำนวนเวอร์ชัน · เช็คว่าคิดค่าแก้ไปแล้วเท่าไร (แถว DESIGN_REVISION)
  const overage = computeRevisionOverage(versions.length);
  const existingRevisionFee = order.data?.fees?.find((f) => f.feeType === REVISION_FEE_TYPE);
  const chargedAmount = existingRevisionFee?.amount ?? 0;
  const baht = (n: number) => n.toLocaleString("th-TH");

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

  function copyApprovalLink(token: string) {
    const url = `${window.location.origin}/approve/design/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  // หน้าผลิตกางแท็บนี้เสมอ — ไม่ซ่อนตามสถานะ ไม่งั้นแท็บว่างโดยไม่บอกเหตุผล
  // ส่วนหน้าออเดอร์ก่อนถึงเฟสออกแบบก็ยังต้องเห็นว่า "ยังไม่มีม็อกอัพ" ไม่ใช่หายไปเฉยๆ

  return (
    <>
      <Section
        title={title}
        help={
          description ??
          (readOnly
            ? "แบบที่ลูกค้าอนุมัติแล้ว ใช้อ้างอิงหน้างาน"
            : "แบบที่ส่งให้ลูกค้าตัดสิน — หนึ่งเวอร์ชันแนบได้หลายรูป (หน้า/หลัง/แขน)")
        }
        action={
          canUpload ? (
            <Button size="sm" onClick={() => setShowUploadDialog(true)} className="gap-1.5">
              <Upload />
              อัปม็อกอัพใหม่
            </Button>
          ) : undefined
        }
      >
        {/* แยก โหลด/พัง/ว่างจริง — จอต้องไม่โกหกว่า "ไม่มีม็อกอัพ" ตอนที่จริงๆ โหลดพัง */}
        {designs.isLoading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted">
            <Spinner size="sm" />
            กำลังโหลดม็อกอัพ...
          </div>
        ) : designs.isError ? (
          <QueryError
            message="โหลดม็อกอัพไม่สำเร็จ"
            onRetry={() => void designs.refetch()}
          />
        ) : !hasVersions ? (
          <EmptyState
            icon={Shirt}
            title="ยังไม่มีม็อกอัพ"
            description={
              canUpload
                ? "อัปรูปแบบที่ทำเสร็จแล้ว ลูกค้าจะเห็นทั้งชุดในลิงก์อนุมัติ และฝ่ายผลิตใช้อ้างอิงหน้างาน"
                : "ดีไซเนอร์ยังไม่ได้ส่งม็อกอัพของออเดอร์นี้"
            }
          />
        ) : (
          <div className="space-y-4">
            {versions.map((version) => {
              // ลิงก์อนุมัติตายแล้วต้องมีตัวบอก + ทางสร้างใหม่ — เดิมปุ่ม copy ยังโชว์
              // ทั้งที่ลูกค้ากดแล้วเจอ "หมดอายุ" (audit ข้อ 17)
              const tokenExpired =
                !version.tokenExpiresAt || new Date(version.tokenExpiresAt) < new Date();

              return (
                <article
                  key={version.id}
                  className={cn("border border-border p-4", RADIUS.inner)}
                >
                  <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium text-strong">
                          เวอร์ชัน {version.versionNumber}
                        </h3>
                        <Badge
                          variant={
                            APPROVAL_STATUS_VARIANTS[
                              version.approvalStatus as keyof typeof APPROVAL_STATUS_VARIANTS
                            ] || "default"
                          }
                        >
                          {APPROVAL_STATUS_LABELS[
                            version.approvalStatus as keyof typeof APPROVAL_STATUS_LABELS
                          ] || version.approvalStatus}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted">{formatDateTime(version.createdAt)}</p>
                    </div>

                    {!readOnly ? (
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <Button variant="ghost" size="icon-sm" asChild title="เปิดไฟล์ต้นฉบับ">
                          <a href={version.fileUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink />
                            <span className="sr-only">
                              เปิดไฟล์ม็อกอัพ v{version.versionNumber}
                            </span>
                          </a>
                        </Button>
                        {roleCanRegenerate &&
                          version.approvalToken &&
                          version.approvalStatus === "PENDING" &&
                          (tokenExpired ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-amber-700 dark:text-amber-300"
                              onClick={() => regenerateToken.mutate({ designId: version.id })}
                              disabled={regenerateToken.isPending}
                            >
                              ลิงก์หมดอายุ — สร้างใหม่
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title={
                                version.tokenExpiresAt
                                  ? `คัดลอกลิงก์ให้ลูกค้าดู (หมดอายุ ${formatDate(version.tokenExpiresAt)})`
                                  : "คัดลอกลิงก์ให้ลูกค้าดู"
                              }
                              onClick={() => copyApprovalLink(version.approvalToken!)}
                            >
                              {copiedToken === version.approvalToken ? (
                                <Check className="text-green-500" />
                              ) : (
                                <Copy />
                              )}
                              <span className="sr-only">
                                คัดลอกลิงก์อนุมัติ v{version.versionNumber}
                              </span>
                            </Button>
                          ))}
                        {canApprove && version.approvalStatus === "PENDING" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setShowApproveDialog(version.id)}
                          >
                            บันทึกผลลูกค้า
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </header>

                  <MockupGallery version={version} versionNumber={version.versionNumber} />

                  {version.designerNotes ? (
                    <p className="mt-3 text-xs text-muted">{version.designerNotes}</p>
                  ) : null}
                  {version.customerComment ? (
                    <p
                      className={cn(
                        "mt-3 flex items-start gap-1.5 border p-2 text-xs",
                        TINT.warning,
                        RADIUS.item,
                      )}
                    >
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{version.customerComment}</span>
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {/* นับรอบแก้แบบ + ค่าแก้เกินโควตา (ก้อน 4) — โชว์ให้เห็น พนักงานกดคิดเองถ้าจะคิด
            readOnly (หน้าผลิต/station) ไม่มีก้อนนี้เลย — no-money contract */}
        {!readOnly && hasVersions && overage.revisionRounds > 0 && (
          <div className={cn("mt-4 p-3 text-sm", SUNK_PANEL, RADIUS.inner)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium text-secondary">
                  แก้แบบมาแล้ว {overage.revisionRounds} รอบ
                </span>
                <span className="text-muted"> · ฟรี {overage.freeRounds} รอบ</span>
              </span>
              {overage.chargeableRounds > 0 && (
                <Badge variant="warning">เกินโควตา {overage.chargeableRounds} รอบ</Badge>
              )}
            </div>

            {canSeeMoney && overage.chargeableRounds > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                {chargedAmount > 0 ? (
                  // คิดไปแล้ว — โชว์ยอดที่คิดจริง (พนักงานอาจตั้งใจปรับ/ยกเว้น) ไม่ดันให้แก้กลับ
                  <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" />
                    คิดค่าแก้แล้ว ฿{baht(chargedAmount)}
                  </span>
                ) : (
                  <>
                    <span className="text-muted">
                      ค่าแก้แบบเกินโควตา ฿{baht(overage.fee)} (฿{REVISION_FEE_PER_ROUND}/รอบ)
                    </span>
                    {roleCanApprove && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => addRevisionFee.mutate({ id: orderId })}
                        disabled={addRevisionFee.isPending}
                      >
                        {addRevisionFee.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Receipt />
                        )}
                        คิดค่าแก้แบบ ฿{baht(overage.fee)}
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            <p className="mt-1.5 text-xs text-muted">
              {canSeeMoney
                ? "คิดเมื่อกดเอง — แก้/ลบยอดได้ที่ค่าธรรมเนียมออเดอร์"
                : "นับจากจำนวนเวอร์ชันม็อกอัพ"}
            </p>
          </div>
        )}
      </Section>

      {/* อัปม็อกอัพเวอร์ชันใหม่ — หลายรูปในชุดเดียว */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
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
            onCancel={() => setShowUploadDialog(false)}
            onSubmit={handleUploadSubmit}
          />
        </DialogContent>
      </Dialog>

      {/* บันทึกผลที่ลูกค้าตอบมา (ทางโทรศัพท์/แชท) — ลูกค้ากดเองได้ที่ลิงก์อนุมัติ */}
      <Dialog
        open={showApproveDialog !== null}
        onOpenChange={(open) => !open && setShowApproveDialog(null)}
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
                if (showApproveDialog)
                  approveMockup.mutate({
                    designId: showApproveDialog,
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
                if (showApproveDialog)
                  approveMockup.mutate({
                    designId: showApproveDialog,
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
    </>
  );
}
