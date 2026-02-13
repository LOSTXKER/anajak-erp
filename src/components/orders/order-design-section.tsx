"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
import { formatDateTime } from "@/lib/utils";
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
} from "lucide-react";

interface OrderDesignSectionProps {
  orderId: string;
  orderNumber: string;
  internalStatus: string;
}

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REVISION_REQUESTED: "ขอแก้ไข",
  REJECTED: "ปฏิเสธ",
};

const APPROVAL_STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive"> = {
  PENDING: "default",
  APPROVED: "success",
  REVISION_REQUESTED: "warning",
  REJECTED: "destructive",
};

export function OrderDesignSection({
  orderId,
  orderNumber,
  internalStatus,
}: OrderDesignSectionProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState<string | null>(null);
  const [designerNotes, setDesignerNotes] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [approveComment, setApproveComment] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const designs = trpc.design.listByOrder.useQuery({ orderId });
  const uploadDesign = trpc.design.upload.useMutation({
    onSuccess: () => {
      utils.design.listByOrder.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowUploadDialog(false);
      setUploadedUrl(null);
      setDesignerNotes("");
      setUploadError(null);
    },
  });
  const approveDesign = trpc.design.approve.useMutation({
    onSuccess: () => {
      utils.design.listByOrder.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowApproveDialog(null);
      setApproveComment("");
    },
  });

  const canUpload = [
    "DESIGN_PENDING",
    "DESIGNING",
    "AWAITING_APPROVAL",
  ].includes(internalStatus);

  const canApprove = ["DESIGNING", "AWAITING_APPROVAL"].includes(internalStatus);

  function handleUploadSubmit() {
    if (!uploadedUrl) return;
    uploadDesign.mutate({
      orderId,
      fileUrl: uploadedUrl,
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

  // Show section if designs exist or status indicates design phase
  if (
    !hasDesigns &&
    !["DESIGN_PENDING", "DESIGNING", "AWAITING_APPROVAL", "DESIGN_APPROVED"].includes(
      internalStatus
    )
  ) {
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
              {designs.data!.map((design: any) => (
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
                              APPROVAL_STATUS_VARIANTS[design.approvalStatus] || "default"
                            }
                          >
                            {APPROVAL_STATUS_LABELS[design.approvalStatus] || design.approvalStatus}
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
                      {design.approvalToken && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyApprovalLink(design.approvalToken)}
                        >
                          {copiedToken === design.approvalToken ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
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
              ))}
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
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                โน้ตจากดีไซเนอร์
              </label>
              <textarea
                value={designerNotes}
                onChange={(e) => setDesignerNotes(e.target.value)}
                placeholder="รายละเอียดการออกแบบ..."
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
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
              disabled={!uploadedUrl || uploadDesign.isPending}
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
            <textarea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="ความเห็นเพิ่มเติม (ถ้ามี)..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
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
