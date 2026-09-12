"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { mockupImages } from "@/lib/mockup";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLinkError } from "@/components/public-link-error";
import { isPublicLinkUnavailable, retryPublicQuery } from "@/lib/public-link-state";
import {
  PublicPageShell,
  PublicRefreshNotice,
  FullScreenLoading,
  InfoRow,
} from "@/components/public/public-page";
import {
  Check,
  X,
  ExternalLink,
  Loader2,
  Palette,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
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

  const design = trpc.design.getByToken.useQuery({ token }, { retry: retryPublicQuery });
  const approve = trpc.design.approveByToken.useMutation({
    onSuccess: (_, variables) => {
      setSubmitted(variables.approved ? "approved" : "revision");
    },
  });

  if (design.isLoading) {
    return <FullScreenLoading />;
  }

  // เมื่อ query หยุดพักอาจยังไม่มีทั้ง data และ error; ไม่ถือว่า token หมดอายุเอง
  if (!design.data || (design.error && isPublicLinkUnavailable(design.error))) {
    return <PublicLinkError error={design.error} message="ไม่พบแบบที่ต้องการ ลิงก์อาจหมดอายุแล้ว" onRetry={() => void design.refetch()} />;
  }

  const d = design.data;
  const alreadyDecided = d.approvalStatus !== "PENDING";
  // เวอร์ชันเก่าที่มีรูปเดียวจะได้ลิสต์ยาว 1 — หน้านี้จึงใช้โค้ดทางเดียวกันทั้งของเก่าและใหม่
  const images = mockupImages(d);

  // Thank you screen after submission
  if (submitted) {
    return (
      <PublicPageShell icon={<Palette />} subtitle={`แบบออเดอร์ ${d.order.orderNumber}`}>
        <Card>
          <CardContent className="p-8 text-center" role="status">
            {submitted === "approved" ? (
              <>
                <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600 dark:text-green-400" />
                <h2 className="mb-2 text-xl font-semibold text-strong">
                  อนุมัติแบบเรียบร้อย!
                </h2>
                <p className="text-sm text-muted">
                  ขอบคุณที่อนุมัติแบบ ทีมงานได้รับผลอนุมัติแล้ว
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="mx-auto mb-4 h-16 w-16 text-amber-700 dark:text-amber-400" />
                <h2 className="mb-2 text-xl font-semibold text-strong">
                  รับทราบแล้ว!
                </h2>
                <p className="text-sm text-muted">
                  ทีมงานจะดำเนินการแก้ไขตามคำแนะนำของคุณ
                  และส่งแบบใหม่ให้ตรวจสอบอีกครั้ง
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell
      icon={<Palette />}
      heading="ตรวจสอบแบบ"
      subtitle="ดูแบบให้ครบก่อนอนุมัติ หรือระบุจุดที่ต้องการแก้ไข"
    >
      {design.error && <PublicRefreshNotice onRetry={() => void design.refetch()} refreshing={design.isFetching} />}

        {/* Order Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลออเดอร์</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <InfoRow label="เลขออเดอร์">{d.order.orderNumber}</InfoRow>
              <InfoRow label="ลูกค้า">{d.order.customer.name}</InfoRow>
            </div>
          </CardContent>
        </Card>

        {/* ม็อกอัพทั้งชุด — ลูกค้าตัดสินครั้งเดียวจึงต้องเห็นครบทุกด้านก่อนกด */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                ม็อกอัพเวอร์ชัน {d.versionNumber}
                {images.length > 1 ? (
                  <span className="ml-1.5 font-normal text-muted">
                    ({images.length} รูป)
                  </span>
                ) : null}
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
            {/* กางรูปใหญ่เรียงลงมา ไม่ใช่ตารางรูปย่อ — ลูกค้าส่วนใหญ่เปิดบนมือถือและ
                ต้องเห็นรายละเอียดลายชัดพอจะตัดสินใจ ไม่ใช่แค่รู้ว่ามีกี่รูป */}
            {images.map((image, index) => (
              <figure key={`${image.fileUrl}-${index}`} className="space-y-1.5">
                {image.positionLabel ? (
                  <figcaption className="text-sm font-medium text-secondary">
                    ด้าน{image.positionLabel}
                  </figcaption>
                ) : null}

                {image.previewUrl ? (
                  <a
                    href={image.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={image.previewUrl}
                      alt={
                        image.positionLabel
                          ? `ม็อกอัพ v${d.versionNumber} ด้าน${image.positionLabel}`
                          : `ม็อกอัพ v${d.versionNumber} รูปที่ ${index + 1}`
                      }
                      className="w-full object-contain"
                    />
                  </a>
                ) : (
                  // .ai/.psd/.pdf แสดงเป็นรูปตรงๆ ไม่ได้ — บอกทางแทนปล่อยรูปแตก
                  <div className={cn(DASHED, "rounded-lg p-6 text-center text-sm text-muted")}>
                    ไฟล์นี้เป็นไฟล์งาน เปิดดูตัวอย่างในหน้านี้ไม่ได้ — กดลิงก์ด้านล่างเพื่อดูก่อนตัดสินใจ
                  </div>
                )}

                {image.caption ? (
                  <p className="text-sm text-muted">{image.caption}</p>
                ) : null}

                <p className="text-center">
                  <a
                    href={image.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 px-2 text-sm text-secondary hover:text-strong hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {image.previewUrl ? "เปิดภาพเต็ม" : "เปิดไฟล์"}
                  </a>
                </p>
              </figure>
            ))}

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
                  <CheckCircle className="mx-auto h-10 w-10 text-green-600 dark:text-green-400" />
                  <p className="font-medium text-green-700 dark:text-green-300">
                    แบบนี้อนุมัติแล้ว
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AlertCircle className="mx-auto h-10 w-10 text-amber-700 dark:text-amber-400" />
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    ขอแก้ไขแล้ว -- รอแบบใหม่จากทีมงาน
                  </p>
                  {d.customerComment && (
                    <p className="text-sm text-secondary">
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
              <Field label="ความคิดเห็นของคุณ" visuallyHiddenLabel>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="พิมพ์ความเห็นหรือสิ่งที่ต้องการแก้ไข (ถ้ามี)..."
                  rows={4}
                  disabled={approve.isPending || !!design.error}
                />
              </Field>
              <div className="flex flex-col gap-3 sm:flex-row">
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
                  disabled={approve.isPending || !!design.error}
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
                  disabled={approve.isPending || !!design.error}
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
                <Alert variant="error">{["BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(approve.error.data?.code ?? "") ? approve.error.message : "ส่งผลไม่สำเร็จ ความคิดเห็นยังอยู่ กรุณาลองอีกครั้ง"}</Alert>
              )}
            </CardContent>
          </Card>
        )}
    </PublicPageShell>
  );
}
