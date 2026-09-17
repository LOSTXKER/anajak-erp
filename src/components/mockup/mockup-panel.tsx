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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Section } from "@/components/ui/section";
import { Spinner } from "@/components/ui/spinner";
import { RADIUS, SUNK_PANEL, TINT } from "@/components/ui/tokens";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_VARIANTS } from "@/lib/status-config";
import { cn, formatBaht, formatDate, formatDateTime } from "@/lib/utils";
import { MockupGallery } from "./mockup-gallery";
import { MockupDecisionDialog, MockupUploadDialog } from "./mockup-dialogs";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Receipt,
  Shirt,
  Upload,
} from "lucide-react";

// บ้านเดียวของม็อกอัพ (ไฟล์ชั้น 2 APPROVAL ตาม src/lib/file-layers.ts)
// ทุกจอที่ต้องโชว์ม็อกอัพเรียก component นี้ ห้ามสร้างตัวที่สอง — ก่อนหน้านี้หน้าออเดอร์
// โชว์ม็อกอัพสองแท็บด้วยโค้ดคนละชุด ยิง query เดียวกันซ้ำ และหน้าผลิตไม่มีที่ให้ดูเลย
//
// readOnly = พื้นผิวฝ่ายผลิต (/production/[id]) — ดูอย่างเดียว ไม่มีอัป/อนุมัติ/ลิงก์ลูกค้า
// และไม่มีเงินเด็ดขาด
//
// กล่องอัปเวอร์ชันใหม่/บันทึกผลลูกค้าอยู่ ./mockup-dialogs (2026-09-15) — ใช้ร่วมกับแท็บไฟล์หน้าออเดอร์

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
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const designs = trpc.design.listByOrder.useQuery({ orderId });

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

  // ค่าแก้แบบ — นับรอบจากจำนวนเวอร์ชัน · เช็คว่าคิดค่าแก้ไปแล้วเท่าไร (แถว DESIGN_REVISION)
  const overage = computeRevisionOverage(versions.length);
  const existingRevisionFee = order.data?.fees?.find((f) => f.feeType === REVISION_FEE_TYPE);
  const chargedAmount = existingRevisionFee?.amount ?? 0;

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
        icon={Shirt}
        tone="production"
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
                    คิดค่าแก้แล้ว {formatBaht(chargedAmount)}
                  </span>
                ) : (
                  <>
                    <span className="text-muted">
                      ค่าแก้แบบเกินโควตา {formatBaht(overage.fee)} ({formatBaht(REVISION_FEE_PER_ROUND)}/รอบ)
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
                        คิดค่าแก้แบบ {formatBaht(overage.fee)}
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
      <MockupUploadDialog
        orderId={orderId}
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
      />

      {/* บันทึกผลที่ลูกค้าตอบมา (ทางโทรศัพท์/แชท) — ลูกค้ากดเองได้ที่ลิงก์อนุมัติ */}
      <MockupDecisionDialog
        designId={showApproveDialog}
        onClose={() => setShowApproveDialog(null)}
      />
    </>
  );
}
