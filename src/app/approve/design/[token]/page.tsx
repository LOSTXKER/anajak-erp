"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  X,
  ExternalLink,
  Loader2,
  Palette,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      </div>
    );
  }

  if (design.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              ไม่พบแบบที่ต้องการ
            </h2>
            <p className="text-sm text-slate-500">
              ลิงก์อาจไม่ถูกต้องหรือหมดอายุแล้ว กรุณาติดต่อทีมงาน
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = design.data!;
  const alreadyDecided = d.approvalStatus !== "PENDING";

  // Thank you screen after submission
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
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
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        {/* Header */}
        <div className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Palette className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">
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
            {d.fileUrl && (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <img
                  src={d.fileUrl}
                  alt={`Design v${d.versionNumber}`}
                  className="w-full object-contain"
                />
              </div>
            )}
            {d.fileUrl && (
              <div className="text-center">
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  เปิดภาพเต็ม
                </a>
              </div>
            )}
            {d.designerNotes && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                <strong>โน้ตจากดีไซเนอร์:</strong> {d.designerNotes}
              </div>
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
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="พิมพ์ความเห็นหรือสิ่งที่ต้องการแก้ไข (ถ้ามี)..."
                rows={4}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <X className="h-4 w-4" />
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  อนุมัติแบบ
                </Button>
              </div>
              {approve.error && (
                <p className="text-center text-sm text-red-500">
                  เกิดข้อผิดพลาด กรุณาลองอีกครั้ง
                </p>
              )}
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
