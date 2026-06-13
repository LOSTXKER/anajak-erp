"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import {
  computeRevisionOverage,
  REVISION_FEE_TYPE,
  REVISION_FEE_PER_ROUND,
} from "@/lib/revision-policy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatDate, isImageUrl } from "@/lib/utils";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_VARIANTS } from "@/lib/status-config";
import {
  Palette,
  Upload,
  Check,
  X,
  Copy,
  ExternalLink,
  MessageSquare,
  Image,
  Loader2,
  Receipt,
} from "lucide-react";

interface OrderDesignSectionProps {
  orderId: string;
  orderNumber: string;
  internalStatus: string;
}


export function OrderDesignSection({
  orderId,
  orderNumber,
  internalStatus,
}: OrderDesignSectionProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState<string | null>(null);
  const [designerNotes, setDesignerNotes] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedThumbUrl, setUploadedThumbUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [approveComment, setApproveComment] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // ไฟล์งาน .ai/.psd ลูกค้าเปิดดูบนมือถือไม่ได้ — ต้องแนบรูปตัวอย่างให้ลิงก์อนุมัติมีภาพโชว์
  // (audit ข้อ 15: เดิมส่งลิงก์ไปลูกค้าต้องตัดสินใจทั้งที่มองไม่เห็นแบบ)
  const needsThumbnail = !!uploadedUrl && !isImageUrl(uploadedUrl);

  const utils = trpc.useUtils();
  const designs = trpc.design.listByOrder.useQuery({ orderId });
  const uploadDesign = useMutationWithInvalidation(trpc.design.upload, {
    invalidate: [utils.design.listByOrder, utils.order.getById],
    onSuccess: () => {
      setShowUploadDialog(false);
      setUploadedUrl(null);
      setUploadedThumbUrl(null);
      setDesignerNotes("");
      setUploadError(null);
    },
  });
  const approveDesign = useMutationWithInvalidation(trpc.design.approve, {
    invalidate: [utils.design.listByOrder, utils.order.getById],
    onSuccess: () => {
      setShowApproveDialog(null);
      setApproveComment("");
    },
  });
  const regenerateToken = useMutationWithInvalidation(trpc.design.regenerateToken, {
    invalidate: [utils.design.listByOrder],
  });
  // ค่าแก้แบบเกินโควตา (ก้อน 4) — อ่าน fees จาก order (cache hit · มาจากหน้าออเดอร์อยู่แล้ว)
  const order = trpc.order.getById.useQuery({ id: orderId });
  const addRevisionFee = useMutationWithInvalidation(trpc.order.addRevisionFee, {
    invalidate: [utils.order.getById],
    onSuccess: () => toast.success("คิดค่าแก้แบบเกินโควตาแล้ว — ดูที่ค่าธรรมเนียมออเดอร์"),
  });

  // ปุ่มต้องตรงสิทธิ์ server (audit ข้อ 29): อัปแบบ = กราฟิกขึ้นไป (designerUp) ·
  // บันทึกผลแทนลูกค้า = ฝั่งขาย (salesUp — คนถือความสัมพันธ์ลูกค้า ไม่ใช่คนวาดเอง)
  const { data: me } = trpc.user.me.useQuery();
  const roleCanUpload = !me || ["OWNER", "MANAGER", "DESIGNER"].includes(me.role);
  const roleCanApprove = !me || ["OWNER", "MANAGER", "SALES"].includes(me.role);
  const canUpload = internalStatus === "DESIGNING" && roleCanUpload;

  const canApprove = internalStatus === "DESIGNING" && roleCanApprove;

  function handleUploadSubmit() {
    if (!uploadedUrl) return;
    if (needsThumbnail && !uploadedThumbUrl) return; // ปุ่ม disabled อยู่แล้ว — กันยิงตรง
    uploadDesign.mutate({
      orderId,
      fileUrl: uploadedUrl,
      thumbnailUrl: uploadedThumbUrl || undefined,
      designerNotes: designerNotes || undefined,
    });
  }

  function handleApprove(designId: string, approved: boolean) {
    approveDesign.mutate({
      designId,
      approved,
      comment: approveComment || undefined,
    });
  }

  function copyApprovalLink(token: string) {
    const url = `${window.location.origin}/approve/design/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  const hasDesigns = designs.data && designs.data.length > 0;

  // ค่าแก้แบบเกินโควตา — นับรอบจากจำนวนเวอร์ชัน · เช็คว่าคิดค่าแก้ไปแล้วเท่าไร (แถว DESIGN_REVISION)
  const overage = computeRevisionOverage(designs.data?.length ?? 0);
  const existingRevisionFee = order.data?.fees?.find((f) => f.feeType === REVISION_FEE_TYPE);
  const chargedAmount = existingRevisionFee?.amount ?? 0;
  const baht = (n: number) => n.toLocaleString("th-TH");

  // Show section if designs exist or status indicates design phase
  if (!hasDesigns && !["DESIGNING", "DESIGN_APPROVED"].includes(internalStatus)) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" />
              งานออกแบบ
            </CardTitle>
            {canUpload && (
              <Button
                size="sm"
                onClick={() => setShowUploadDialog(true)}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                อัปโหลดแบบ
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasDesigns ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ยังไม่มีไฟล์ออกแบบ
            </p>
          ) : (
            <div className="space-y-3">
              {designs.data!.map((design) => {
                // ลิงก์อนุมัติตายแล้วต้องมีตัวบอก + ทางสร้างใหม่ — เดิมปุ่ม copy ยังโชว์
                // ทั้งที่ลูกค้ากดแล้วเจอ "หมดอายุ" (audit ข้อ 17)
                const tokenExpired =
                  !design.tokenExpiresAt || new Date(design.tokenExpiresAt) < new Date();
                return (
                <div
                  key={design.id}
                  className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      {design.fileUrl && (
                        <a
                          href={design.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <div className="relative h-16 w-16 overflow-hidden rounded-md border border-slate-200 dark:border-slate-600">
                            <img
                              src={design.thumbnailUrl || design.fileUrl}
                              alt={`Design v${design.versionNumber}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </a>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            เวอร์ชัน {design.versionNumber}
                          </span>
                          <Badge
                            variant={
                              APPROVAL_STATUS_VARIANTS[design.approvalStatus as keyof typeof APPROVAL_STATUS_VARIANTS] || "default"
                            }
                          >
                            {APPROVAL_STATUS_LABELS[design.approvalStatus as keyof typeof APPROVAL_STATUS_LABELS] || design.approvalStatus}
                          </Badge>
                        </div>
                        {design.designerNotes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {design.designerNotes}
                          </p>
                        )}
                        {design.customerComment && (
                          <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <MessageSquare className="h-3 w-3" />
                            {design.customerComment}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {formatDateTime(design.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-1">
                      {design.fileUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-7 w-7"
                        >
                          <a
                            href={design.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {design.approvalToken &&
                        design.approvalStatus === "PENDING" &&
                        (tokenExpired ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs text-amber-700 dark:text-amber-300"
                            onClick={() => regenerateToken.mutate({ designId: design.id })}
                            disabled={regenerateToken.isPending}
                          >
                            ลิงก์หมดอายุ — สร้างใหม่
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={
                              design.tokenExpiresAt
                                ? `คัดลอกลิงก์อนุมัติ (หมดอายุ ${formatDate(design.tokenExpiresAt)})`
                                : "คัดลอกลิงก์อนุมัติ"
                            }
                            onClick={() => copyApprovalLink(design.approvalToken!)}
                          >
                            {copiedToken === design.approvalToken ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        ))}
                      {canApprove && design.approvalStatus === "PENDING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => setShowApproveDialog(design.id)}
                        >
                          ตรวจสอบ
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* นับรอบแก้แบบ + ค่าแก้เกินโควตา (ก้อน 4) — โชว์ให้เห็น พนักงานกดคิดเองถ้าจะคิด */}
          {hasDesigns && overage.revisionRounds > 0 && (
            <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    แก้แบบมาแล้ว {overage.revisionRounds} รอบ
                  </span>
                  <span className="text-slate-400"> · ฟรี {overage.freeRounds} รอบ</span>
                </span>
                {overage.chargeableRounds > 0 && (
                  <Badge variant="warning">เกินโควตา {overage.chargeableRounds} รอบ</Badge>
                )}
              </div>

              {overage.chargeableRounds > 0 && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {chargedAmount > 0 ? (
                    // คิดไปแล้ว — โชว์ยอดที่คิดจริง (พนักงานอาจตั้งใจปรับ/ยกเว้น) ไม่ดันให้แก้กลับ
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Check className="h-3.5 w-3.5" />
                      คิดค่าแก้แล้ว ฿{baht(chargedAmount)}
                    </span>
                  ) : (
                    <>
                      <span className="text-slate-500 dark:text-slate-400">
                        ค่าแก้แบบเกินโควตา ฿{baht(overage.fee)} (฿{REVISION_FEE_PER_ROUND}/รอบ)
                      </span>
                      {roleCanApprove && (
                        <Button
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => addRevisionFee.mutate({ id: orderId })}
                          disabled={addRevisionFee.isPending}
                        >
                          {addRevisionFee.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Receipt className="h-3.5 w-3.5" />
                          )}
                          คิดค่าแก้แบบ ฿{baht(overage.fee)}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              <p className="mt-1.5 text-xs text-slate-400">
                นับจากเวอร์ชันแบบ · คิดเมื่อจะคิด (กดเอง) — ลบ/แก้ยอดได้ที่ค่าธรรมเนียมออเดอร์
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>อัปโหลดแบบใหม่</DialogTitle>
            <DialogDescription>
              อัปโหลดไฟล์แบบ (PNG, JPG, PDF, AI, PSD) เพื่อส่งให้ลูกค้าอนุมัติ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FileUpload
              bucket="designs"
              pathPrefix={`orders/${orderId}`}
              accept="image/*,.pdf,.ai,.psd"
              maxSizeMB={25}
              onUploaded={(url) => {
                setUploadedUrl(url);
                setUploadError(null);
              }}
              onError={(err) => setUploadError(err)}
            />
            {uploadError && (
              <p className="text-sm text-red-500">{uploadError}</p>
            )}
            {needsThumbnail && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  ไฟล์นี้ลูกค้าเปิดดูบนมือถือไม่ได้ (.ai/.psd/.pdf) — แนบรูปตัวอย่างให้ลูกค้าดูก่อนตัดสินแบบ
                </p>
                <FileUpload
                  bucket="designs"
                  pathPrefix={`orders/${orderId}/previews`}
                  accept="image/*"
                  maxSizeMB={10}
                  onUploaded={(url) => setUploadedThumbUrl(url)}
                  onError={(err) => setUploadError(err)}
                />
                {uploadedThumbUrl && (
                  <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">
                    ✓ แนบรูปตัวอย่างแล้ว
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                โน้ตจากดีไซเนอร์
              </label>
              <Textarea
                value={designerNotes}
                onChange={(e) => setDesignerNotes(e.target.value)}
                placeholder="รายละเอียดการออกแบบ..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={!uploadedUrl || (needsThumbnail && !uploadedThumbUrl) || uploadDesign.isPending}
              className="gap-1.5"
            >
              {uploadDesign.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              อัปโหลด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Dialog */}
      <Dialog
        open={showApproveDialog !== null}
        onOpenChange={(open) => !open && setShowApproveDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ตรวจสอบแบบ</DialogTitle>
            <DialogDescription>
              อนุมัติแบบเพื่อดำเนินการผลิต หรือขอให้แก้ไข
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              ความเห็น
            </label>
            <Textarea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="ความเห็นเพิ่มเติม (ถ้ามี)..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (showApproveDialog) handleApprove(showApproveDialog, false);
              }}
              disabled={approveDesign.isPending}
              className="gap-1.5"
            >
              <X className="h-4 w-4" />
              ขอแก้ไข
            </Button>
            <Button
              onClick={() => {
                if (showApproveDialog) handleApprove(showApproveDialog, true);
              }}
              disabled={approveDesign.isPending}
              className="gap-1.5"
            >
              {approveDesign.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              อนุมัติแบบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
