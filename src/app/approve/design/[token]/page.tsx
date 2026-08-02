"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { isImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLinkError } from "@/components/public-link-error";
import {
  Check,
  X,
  ExternalLink,
  Loader2,
  Palette,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { DASHED } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

export default function DesignApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState<"approved" | "revision" | null>(null);

  const design = trpc.design.getByToken.useQuery({ token });
  const approve = trpc.design.approveByToken.useMutation({
    onSuccess: (_, variables) => {
      setSubmitted(variables.approved ? "approved" : "revision");
    },
  });

  if (design.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex items-center gap-2 text-slate-500">
          <Spinner size="lg" />
          <span>กำลังโหลด...</span>
        </div>
      </div>
    );
  }

  // ต้องเช็ค !data ด้วย ไม่ใช่แค่ error — react-query มีสถานะ "ยังไม่ยิง/หยุดพัก"
  // ที่ isLoading=false + error=null + data=undefined พร้อมกัน · ของเดิมเขียน
  // `design.data!` (บอก TS ว่ามีแน่ๆ) แล้วลูกค้าที่กดลิงก์เจอจอ error แดงของ Next
  // แทนข้อความ "ลิงก์หมดอายุ" — อีก 3 หน้าลูกค้า (quote/status/upload) เช็คถูกอยู่แล้ว
  if (design.error || !design.data) {
    return <PublicLinkError message="ไม่พบแบบที่ต้องการ ลิงก์อาจหมดอายุแล้ว" onRetry={() => void design.refetch()} />;
  }

  const d = design.data;
  const alreadyDecided = d.approvalStatus !== "PENDING";

  // Thank you screen after submission
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            {submitted === "approved" ? (
              <>
                <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
                <h2 className="mb-2 text-xl font-semibold text-slate-900">
                  อนุมัติแบบเรียบร้อย!
                </h2>
                <p className="text-sm text-slate-500">
                  ขอบคุณที่อนุมัติแบบ ทีมงานจะเริ่มดำเนินการผลิตให้เร็วที่สุด
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="mx-auto mb-4 h-16 w-16 text-amber-500" />
                <h2 className="mb-2 text-xl font-semibold text-slate-900">
                  รับทราบแล้ว!
                </h2>
                <p className="text-sm text-slate-500">
                  ทีมงานจะดำเนินการแก้ไขตามคำแนะนำของคุณ
                  และส่งแบบใหม่ให้ตรวจสอบอีกครั้ง
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-4">
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        {/* Header */}
        <div className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Palette className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-slate-900">
              Anajak Print
            </h1>
          </div>
          <p className="text-sm text-slate-500">ตรวจสอบและอนุมัติแบบ</p>
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
                <span className="font-medium text-slate-900">
                  {d.order.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ชื่องาน</span>
                <span className="font-medium text-slate-900">
                  {d.order.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ลูกค้า</span>
                <span className="font-medium text-slate-900">
                  {d.order.customer.name}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Design Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                แบบเวอร์ชัน {d.versionNumber}
              </CardTitle>
              <Badge
                variant={
                  d.approvalStatus === "APPROVED"
                    ? "success"
                    : d.approvalStatus === "REVISION_REQUESTED"
                      ? "warning"
                      : "default"
                }
              >
                {d.approvalStatus === "APPROVED"
                  ? "อนุมัติแล้ว"
                  : d.approvalStatus === "REVISION_REQUESTED"
                    ? "ขอแก้ไข"
                    : "รอตรวจสอบ"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ไฟล์ .ai/.psd/.pdf แสดงเป็นรูปตรงๆ ไม่ได้ — โชว์กล่องดาวน์โหลดแทนรูปแตก */}
            {d.fileUrl && isImageUrl(d.fileUrl) ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <img
                  src={d.fileUrl}
                  alt={`Design v${d.versionNumber}`}
                  className="w-full object-contain"
                />
              </div>
            ) : d.fileUrl ? (
              <div className={cn(DASHED, "rounded-xl p-6 text-center text-sm text-slate-500")}>
                ไฟล์แบบเป็นไฟล์งาน (เปิดดูตัวอย่างในหน้านี้ไม่ได้) — กด &quot;เปิดไฟล์แบบ&quot;
                ด้านล่างเพื่อดูก่อนตัดสินใจ
              </div>
            ) : null}
            {d.fileUrl && (
              <div className="text-center">
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {isImageUrl(d.fileUrl) ? "เปิดภาพเต็ม" : "เปิดไฟล์แบบ"}
                </a>
              </div>
            )}
            {d.designerNotes && (
              <Alert variant="info">
                <strong>โน้ตจากดีไซเนอร์:</strong> {d.designerNotes}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Action */}
        {alreadyDecided ? (
          <Card>
            <CardContent className="p-6 text-center">
              {d.approvalStatus === "APPROVED" ? (
                <div className="space-y-2">
                  <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
                  <p className="font-medium text-green-700">
                    แบบนี้อนุมัติแล้ว
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
                  <p className="font-medium text-amber-700">
                    ขอแก้ไขแล้ว -- รอแบบใหม่จากทีมงาน
                  </p>
                  {d.customerComment && (
                    <p className="text-sm text-slate-600">
                      &ldquo;{d.customerComment}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ความคิดเห็นของคุณ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="พิมพ์ความเห็นหรือสิ่งที่ต้องการแก้ไข (ถ้ามี)..."
                rows={4}
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() =>
                    approve.mutate({
                      token,
                      approved: false,
                      comment: comment || undefined,
                    })
                  }
                  disabled={approve.isPending}
                >
                  <X />
                  ขอแก้ไข
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={() =>
                    approve.mutate({
                      token,
                      approved: true,
                      comment: comment || undefined,
                    })
                  }
                  disabled={approve.isPending}
                >
                  {approve.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check />
                  )}
                  อนุมัติแบบ
                </Button>
              </div>
              {/* ลูกค้ากดอนุมัติแล้วไม่สำเร็จ ต้องเห็นชัด — เดิมเป็นบรรทัดแดงจางๆ
                  ที่มองข้ามได้ง่าย แล้วลูกค้าจะนึกว่าอนุมัติไปแล้ว (audit สี 2026-08-02) */}
              {approve.error && (
                <Alert variant="error">เกิดข้อผิดพลาด กรุณาลองอีกครั้ง</Alert>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-slate-500">
          Powered by Anajak Print ERP
        </p>
      </div>
    </div>
  );
}
