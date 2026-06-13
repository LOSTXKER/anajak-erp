"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { isImageUrl, formatDate } from "@/lib/utils";
import {
  FILE_LAYERS,
  ATTACHMENT_CATEGORY_LABELS,
  layerForCategory,
  type AttachmentCategory,
} from "@/lib/file-layers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  FolderOpen,
  ImageIcon,
  Link2,
  Lock,
  Palette,
  Printer,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

// ไฟล์ 3 ชั้นบนหน้าออเดอร์ (FLOW-REDESIGN ก้อน 4 — ดู src/lib/file-layers.ts)
// ชั้น 1 = Attachment ทั่วไป (รวม REFERENCE_IMAGE เดิม) + ปุ่มแอดมินแนบแทนลูกค้า
// ชั้น 2 = DesignVersion (สรุป+ลิงก์ไปการ์ดงานออกแบบ — ไม่ทำซ้ำ UI)
// ชั้น 3 = Attachment category PRINT_FILE — ภายในเท่านั้น

interface OrderFilesCardProps {
  orderId: string;
  attachments: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  userId?: string;
  userRole?: string;
}

const POSITION_LABELS: Record<string, string> = {
  FRONT: "หน้า", BACK: "หลัง", SLEEVE_L: "แขนซ้าย", SLEEVE_R: "แขนขวา",
  COLLAR: "ปก", POCKET: "กระเป๋า", OTHER: "อื่นๆ",
};

const DESIGN_STATUS_LABELS: Record<string, string> = {
  PENDING: "รอลูกค้าตัดสิน",
  APPROVED: "อนุมัติแล้ว",
  REVISION_REQUESTED: "ขอแก้ไข",
  REJECTED: "ไม่อนุมัติ",
};

function FileThumb({
  att,
  verdict,
}: {
  att: { fileUrl: string; fileName: string; uploadedById?: string | null };
  verdict?: string;
}) {
  // uploadedById = null → ลูกค้าอัปเองผ่านลิงก์ (ก้อน 4 ชิ้น 3)
  const byCustomer = att.uploadedById === null;
  // ป้ายเตือน preflight (ก้อน 4) — เฉพาะไฟล์ลูกค้าที่ระบบตรวจพบข้อควรระวัง/ไม่ควรใช้
  const flagged = byCustomer && (verdict === "YELLOW" || verdict === "RED");
  return (
    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="group relative">
      {flagged && (
        <span
          className={`absolute left-1 top-1 z-10 flex items-center rounded-full p-0.5 ${
            verdict === "RED" ? "bg-red-500/90" : "bg-amber-500/90"
          }`}
          title="ระบบตรวจไฟล์พบข้อควรระวัง — ดูรายละเอียดด้านบน"
        >
          <AlertTriangle className="h-2.5 w-2.5 text-white" />
        </span>
      )}
      {isImageUrl(att.fileUrl) ? (
        <img
          src={att.fileUrl}
          alt={att.fileName}
          className="h-28 w-28 rounded-lg border border-slate-200 object-cover transition-shadow hover:shadow-md dark:border-slate-700"
        />
      ) : (
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
          <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <span className="mt-1 text-[10px] text-slate-400">
            {att.fileName.split(".").pop()?.toUpperCase()}
          </span>
        </div>
      )}
      {byCustomer && (
        <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-blue-600/90 px-1 py-0.5 text-[9px] font-medium text-white">
          <User className="h-2.5 w-2.5" />
          ลูกค้า
        </span>
      )}
      <p className="mt-1 max-w-[7rem] truncate text-[10px] text-slate-400">{att.fileName}</p>
    </a>
  );
}

export function OrderFilesCard({ orderId, attachments, userId, userRole }: OrderFilesCardProps) {
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const [uploadingLayer, setUploadingLayer] = React.useState<"RAW" | "PRINT" | null>(null);
  const [showLink, setShowLink] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);

  // cache ร่วมกับ OrderDesignSection (query key เดียวกัน) — ไม่ยิงซ้ำ
  const designs = trpc.design.listByOrder.useQuery({ orderId });

  // ลิงก์อัปโหลดลูกค้า (ก้อน 4 ชิ้น 3) — เฉพาะคนถือความสัมพันธ์ลูกค้า (server gate ด้วย)
  const canManageLink =
    !userRole || ["OWNER", "MANAGER", "SALES"].includes(userRole);
  const uploadLink = trpc.customerUpload.getLink.useQuery(
    { orderId },
    { enabled: canManageLink }
  );
  const generateLink = useMutationWithInvalidation(
    trpc.customerUpload.generateLink,
    {
      invalidate: [utils.customerUpload.getLink],
      onError: (err: { message?: string }) =>
        toast.error(err.message ?? "สร้างลิงก์ไม่สำเร็จ"),
    }
  );

  const createAttachment = useMutationWithInvalidation(trpc.attachment.create, {
    invalidate: [utils.attachment.listByEntity],
    onSuccess: () => setUploadingLayer(null),
    onError: (err: { message?: string }) => toast.error(err.message ?? "แนบไฟล์ไม่สำเร็จ"),
  });
  const deleteAttachment = useMutationWithInvalidation(trpc.attachment.delete, {
    invalidate: [utils.attachment.listByEntity],
    onError: (err: { message?: string }) => toast.error(err.message ?? "ลบไฟล์ไม่สำเร็จ"),
  });

  const all = attachments ?? [];
  const rawFiles = all.filter((a) => layerForCategory(a.category) === "RAW");
  const printFiles = all.filter((a) => layerForCategory(a.category) === "PRINT");

  // preflight ไฟล์ลูกค้า (ก้อน 4) — ตรวจเฉพาะไฟล์ที่ "ลูกค้า" อัป (uploadedById null · non-expert)
  // ไม่ตรวจไฟล์ที่ทีมแนบเอง (ทีมกราฟิกรู้อยู่แล้ว — เบสเคาะ 2026-06-14 ย้ายจากการ์ดงานออกแบบมาที่นี่)
  const customerFiles = rawFiles.filter((a) => a.uploadedById === null && a.fileUrl);
  const customerFileUrls: string[] = customerFiles.map((a) => a.fileUrl).slice(0, 50); // กัน input เกิน limit router
  const preflight = trpc.preflight.getByUrls.useQuery(
    { fileUrls: customerFileUrls },
    { enabled: customerFileUrls.length > 0 }
  );
  const preflightRun = useMutationWithInvalidation(trpc.preflight.run, {
    invalidate: [utils.preflight.getByUrls],
    onError: () => {}, // ตรวจไฟล์ล้มไม่ต้องเด้ง toast — แค่ไม่มีป้าย
  });
  const preflightByUrl = new Map(
    (preflight.data ?? []).map((p) => [p.fileUrl, p])
  );
  // ยิงตรวจครั้งเดียวต่อไฟล์ลูกค้าที่ยังไม่มีผล (ไฟล์ใหม่ + ไฟล์เก่าที่ยังไม่เคยตรวจ)
  const firedRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (!preflight.data) return;
    const have = new Set(preflight.data.map((p) => p.fileUrl));
    for (const url of customerFileUrls) {
      if (have.has(url) || firedRef.current.has(url)) continue;
      firedRef.current.add(url);
      preflightRun.mutate({ fileUrl: url });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preflight.data, attachments]);
  // ไฟล์ลูกค้าที่ระบบเตือน (เหลือง/แดง) — รวมเป็นรายการให้ทีมเช็กก่อนเริ่มงาน
  const flaggedFiles = customerFiles
    .map((a) => ({ att: a, pf: preflightByUrl.get(a.fileUrl) }))
    .filter((x) => x.pf && (x.pf.verdict === "YELLOW" || x.pf.verdict === "RED"));

  // ชั้น 1: รูปอ้างอิงจัดกลุ่มตามตำแหน่งลายเหมือนเดิม · ไฟล์ category อื่นรวมไว้ "ทั่วไป"
  const generalRaw = rawFiles.filter((a) => !a.printPosition);
  const positionGroups = rawFiles.reduce<Record<string, typeof rawFiles>>((acc, a) => {
    if (a.printPosition) {
      (acc[a.printPosition] ??= []).push(a);
    }
    return acc;
  }, {});

  const isManagerUp = userRole === "OWNER" || userRole === "MANAGER";
  const canAttachPrint =
    !userRole || ["OWNER", "MANAGER", "DESIGNER", "PRODUCTION_STAFF"].includes(userRole);
  const canDelete = (att: { uploadedById?: string }) =>
    isManagerUp || (!!userId && att.uploadedById === userId);

  const latestDesign = designs.data?.[0];

  function handleUploaded(layer: "RAW" | "PRINT", url: string, fileName: string, file: File) {
    createAttachment.mutate({
      entityType: "ORDER",
      entityId: orderId,
      fileName,
      fileUrl: url,
      fileType: file.type || fileName.split(".").pop() || "file",
      fileSize: file.size,
      category: (layer === "PRINT" ? "PRINT_FILE" : "OTHER") as AttachmentCategory,
    });
  }

  function scrollToDesign() {
    document
      .getElementById("order-section-design")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const linkData = uploadLink.data;
  const linkExpired =
    !linkData?.expiresAt || new Date(linkData.expiresAt) < new Date();
  const linkUrl =
    linkData?.token && !linkExpired
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/upload/${linkData.token}`
      : null;

  function copyUploadLink() {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function renderDeleteButton(att: { id: string; fileName: string; uploadedById?: string }) {
    if (!canDelete(att)) return null;
    // ปุ่มโชว์ตลอด (ห้าม opacity-0 — บนจอสัมผัสมองไม่เห็นแต่กดโดน) + confirm
    // ก่อนลบจริงตามมาตรฐาน repo — ลบ Attachment row คือลบถาวร
    return (
      <button
        type="button"
        onClick={async () => {
          if (
            !(await confirm({
              title: "ลบไฟล์นี้?",
              description: att.fileName,
              destructive: true,
            }))
          )
            return;
          deleteAttachment.mutate({ id: att.id });
        }}
        disabled={deleteAttachment.isPending}
        className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600"
        title="ลบไฟล์"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="h-4 w-4" />
          ไฟล์ของออเดอร์
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ===== ชั้น 1 — ไฟล์ดิบลูกค้า ===== */}
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {FILE_LAYERS.RAW.label}
            </p>
            <span className="text-xs text-slate-400">({rawFiles.length})</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setUploadingLayer(uploadingLayer === "RAW" ? null : "RAW")}
            >
              {uploadingLayer === "RAW" ? <X className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
              {uploadingLayer === "RAW" ? "ปิด" : "แนบไฟล์"}
            </Button>
            {canManageLink && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-blue-600 dark:text-blue-400"
                onClick={() => setShowLink((v) => !v)}
              >
                <Link2 className="h-3 w-3" />
                ลิงก์ลูกค้า
              </Button>
            )}
          </div>

          {/* ลิงก์อัปโหลดสำหรับลูกค้า — ส่งใน LINE ให้ลูกค้าอัปไฟล์เข้าออเดอร์ตรง (ไม่ต้อง login) */}
          {canManageLink && showLink && (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              {linkUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={linkUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    />
                    <Button
                      size="sm"
                      className="h-8 shrink-0 gap-1 px-2 text-xs"
                      onClick={copyUploadLink}
                    >
                      {linkCopied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {linkCopied ? "คัดลอกแล้ว" : "คัดลอก"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {linkData?.expiresAt
                        ? `หมดอายุ ${formatDate(linkData.expiresAt)}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                      onClick={() => generateLink.mutate({ orderId })}
                      disabled={generateLink.isPending}
                    >
                      สร้างลิงก์ใหม่ (ลิงก์เดิมจะใช้ไม่ได้)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    {linkData?.token && linkExpired
                      ? "ลิงก์เดิมหมดอายุแล้ว"
                      : "ยังไม่มีลิงก์ — สร้างเพื่อส่งให้ลูกค้าอัปไฟล์เองทาง LINE"}
                  </p>
                  <Button
                    size="sm"
                    className="h-8 gap-1 px-3 text-xs"
                    onClick={() => generateLink.mutate({ orderId })}
                    disabled={generateLink.isPending}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    สร้างลิงก์อัปโหลด
                  </Button>
                </div>
              )}
            </div>
          )}

          {uploadingLayer === "RAW" && (
            <div className="mb-3">
              {/* แอดมินแนบแทนลูกค้า — ของจากแชท LINE เข้าออเดอร์ตรงนี้ ไม่ค้างในแชท */}
              <FileUpload
                bucket="designs"
                pathPrefix={`orders/${orderId}/raw`}
                accept="image/*,.pdf,.ai,.psd,.zip"
                maxSizeMB={25}
                onUploaded={(url, fileName, file) => handleUploaded("RAW", url, fileName, file)}
                onError={(msg) => toast.error(msg)}
                disabled={createAttachment.isPending}
              />
            </div>
          )}

          {/* ผลตรวจไฟล์ลูกค้า (ก้อน 4) — เตือนเฉพาะที่ควรเช็ก ก่อนทีมเสียเวลาเปิดทีละไฟล์ */}
          {flaggedFiles.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                <Sparkles className="h-3.5 w-3.5" />
                ตรวจไฟล์ลูกค้า (AI) — {flaggedFiles.length} ไฟล์ควรเช็กก่อนใช้
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {flaggedFiles.map(({ att, pf }) => (
                  <li key={att.id} className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{att.fileName}</span>
                    {pf!.summary ? ` — ${pf!.summary}` : ""}
                    {pf!.warnings.length > 0 && (
                      <ul className="mt-0.5 list-disc pl-4 text-amber-700 dark:text-amber-400">
                        {pf!.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rawFiles.length === 0 && uploadingLayer !== "RAW" && (
            <p className="text-xs text-slate-400">
              ยังไม่มีไฟล์จากลูกค้า — กด &quot;แนบไฟล์&quot; เพื่อแนบของจากแชทแทนลูกค้า
            </p>
          )}

          {generalRaw.length > 0 && (
            <div className="mb-2">
              {Object.keys(positionGroups).length > 0 && (
                <p className="mb-2 text-xs font-medium text-slate-500">ทั่วไป</p>
              )}
              <div className="flex flex-wrap gap-3">
                {generalRaw.map((att) => (
                  <div key={att.id} className="relative">
                    {renderDeleteButton(att)}
                    <FileThumb att={att} verdict={preflightByUrl.get(att.fileUrl)?.verdict} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.entries(positionGroups).map(([pos, imgs]) => (
            <div key={pos} className="mb-2">
              <p className="mb-2 text-xs font-medium text-slate-500">
                <Badge variant="secondary" className="text-[10px]">
                  {POSITION_LABELS[pos] || pos}
                </Badge>
              </p>
              <div className="flex flex-wrap gap-3">
                {imgs.map((att) => (
                  <div key={att.id} className="relative">
                    {renderDeleteButton(att)}
                    <FileThumb att={att} verdict={preflightByUrl.get(att.fileUrl)?.verdict} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ===== ชั้น 2 — แบบขออนุมัติ (สรุป — ตัวจริงอยู่การ์ดงานออกแบบ) ===== */}
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Palette className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {FILE_LAYERS.APPROVAL.label}
              </span>
              {latestDesign ? (
                <span className="text-xs text-slate-500">
                  {designs.data!.length} เวอร์ชัน · ล่าสุด v{latestDesign.versionNumber}{" "}
                  {DESIGN_STATUS_LABELS[latestDesign.approvalStatus] ?? latestDesign.approvalStatus}
                </span>
              ) : (
                <span className="text-xs text-slate-400">ยังไม่มีแบบ</span>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={scrollToDesign}>
              ไปที่งานออกแบบ
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-400">{FILE_LAYERS.APPROVAL.description}</p>
        </section>

        {/* ===== ชั้น 3 — ไฟล์พิมพ์จริง (ภายในเท่านั้น) ===== */}
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Printer className="h-4 w-4" />
              {FILE_LAYERS.PRINT.label}
            </p>
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Lock className="h-2.5 w-2.5" />
              ภายในเท่านั้น
            </Badge>
            <span className="text-xs text-slate-400">({printFiles.length})</span>
            {canAttachPrint && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setUploadingLayer(uploadingLayer === "PRINT" ? null : "PRINT")}
              >
                {uploadingLayer === "PRINT" ? <X className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                {uploadingLayer === "PRINT" ? "ปิด" : "แนบไฟล์"}
              </Button>
            )}
          </div>

          {uploadingLayer === "PRINT" && (
            <div className="mb-3">
              <FileUpload
                bucket="designs"
                pathPrefix={`orders/${orderId}/print`}
                accept="image/*,.pdf,.ai,.psd,.eps,.dst,.zip"
                maxSizeMB={50}
                onUploaded={(url, fileName, file) => handleUploaded("PRINT", url, fileName, file)}
                onError={(msg) => toast.error(msg)}
                disabled={createAttachment.isPending}
              />
            </div>
          )}

          {printFiles.length === 0 && uploadingLayer !== "PRINT" ? (
            <p className="text-xs text-slate-400">
              ยังไม่มีไฟล์พิมพ์ — gang sheet/ไฟล์ production เก็บชั้นนี้ ไม่ปนกับแบบที่ลูกค้าเห็น
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {printFiles.map((att) => (
                <div key={att.id} className="relative">
                  {renderDeleteButton(att)}
                  <FileThumb att={att} />
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
