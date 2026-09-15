"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  FileText,
  ImageIcon,
  ImageOff,
  Layers,
  Link as LinkIcon,
  Lock,
  MessageSquare,
  Printer,
  Receipt,
  RotateCcw,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { MockupThumbRow } from "@/components/mockup/mockup-thumb-row";
import { MockupDecisionDialog, MockupUploadDialog } from "@/components/mockup/mockup-dialogs";
import { c, Callout, CardHead, Empty, StateBox, timeText } from "@/components/kit/kit";
import { MockupPill } from "@/components/orders/orders-ui";
import { layerForCategory, type AttachmentCategory } from "@/lib/file-layers";
import { safeFileExt } from "@/lib/file-urls";
import { mockupCoverImage, mockupImageCount, mockupPositionLabel } from "@/lib/mockup";
import { computeRevisionOverage, REVISION_FEE_PER_ROUND, REVISION_FEE_TYPE } from "@/lib/revision-policy";
import { uploadFile } from "@/lib/supabase";
import { formatDate, formatDateCompact, isImageUrl } from "@/lib/utils";

/* ============================================================
   แท็บ "ม็อกอัพ & ไฟล์" ของใบออเดอร์ — ต้นแบบรอบ 2 tabFiles() (รื้อ 2026-09-15)

   ซ้าย = ม็อกอัพ: รูปเวอร์ชันที่เลือกเต็มกรอบ → แถบเวอร์ชัน → วันที่ส่ง/ผลลูกค้า + ปุ่มที่ทำได้ตอนนี้
   ขวา = ไฟล์ทั้งหมด: ตัวกรองแบบเลื่อน 3 กลุ่ม → แถวไฟล์ (กดดู/ดาวน์โหลด/ลบ) → ช่องลากไฟล์มาวางที่อัปจริง

   ของเดิมที่คงไว้ครบ: อัปม็อกอัพหลายรูปต่อเวอร์ชัน · ลิงก์ให้ลูกค้าตรวจ (token มาเฉพาะคนมีสิทธิ์) ·
   บันทึกผลลูกค้า, นับรอบแก้แบบ/ค่าแก้เกินโควตา, ลิงก์ลูกค้าอัปไฟล์เอง, ลบไฟล์ต้องยืนยัน
   กล่องอัป/บันทึกผลเรียกชุดเดียวกับ MockupPanel (mockup-dialogs) · สิทธิ์ทุกปุ่มตรง server
   ============================================================ */

export interface OrderFilesTabProps {
  orderId: string;
  internalStatus: string;
  /** "CUSTOM" | "READY_MADE" */
  orderType: string;
  canSeeMoney: boolean;
  userId: string;
  userRole: string;
}

export function OrderFilesTab({ orderId, internalStatus, orderType, canSeeMoney, userId, userRole }: OrderFilesTabProps) {
  return (
    <div className={c("two")}>
      <MockupCard orderId={orderId} internalStatus={internalStatus} orderType={orderType} canSeeMoney={canSeeMoney} />
      <FilesCard orderId={orderId} orderType={orderType} userId={userId} userRole={userRole} />
    </div>
  );
}

/* ---------- ม็อกอัพ ---------- */

function MockupCard({
  orderId,
  internalStatus,
  orderType,
  canSeeMoney,
}: {
  orderId: string;
  internalStatus: string;
  orderType: string;
  canSeeMoney: boolean;
}) {
  const utils = trpc.useUtils();
  const designs = trpc.design.listByOrder.useQuery({ orderId });
  const [now] = useState(() => new Date());
  // null = เวอร์ชันล่าสุดเสมอ (อัปเวอร์ชันใหม่แล้วเด้งไปอันใหม่เอง)
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const regenerateToken = useMutationWithInvalidation(trpc.design.regenerateToken, {
    invalidate: [utils.design.listByOrder],
  });
  // ค่าแก้แบบเกินโควตา — fees อ่านจาก order.getById (หน้าใบยิงอยู่แล้ว = cache เดียวกัน)
  const order = trpc.order.getById.useQuery({ id: orderId }, { enabled: canSeeMoney });
  const addRevisionFee = useMutationWithInvalidation(trpc.order.addRevisionFee, {
    invalidate: [utils.order.getById],
    onSuccess: () => toast.success("คิดค่าแก้แบบเกินโควตาแล้ว — ดูที่ค่าธรรมเนียมออเดอร์"),
  });

  // สิทธิ์ชุดเดียวกับ MockupPanel (audit ข้อ 29) · fail closed ระหว่างโหลด me
  const { data: me } = trpc.user.me.useQuery();
  const roleCanUpload = !!me && permAllows(me.permissions, "manage_design_files");
  const roleCanApprove = !!me && permAllows(me.permissions, "create_sales_docs");
  const roleCanRegenerate = !!me && permAllows(me.permissions, "create_design_assets");
  const inDesignPhase = internalStatus === "DESIGNING";
  const isCustom = orderType === "CUSTOM";
  const canUpload = isCustom && inDesignPhase && roleCanUpload;
  const canApprove = inDesignPhase && roleCanApprove;

  const versions = designs.data ?? [];
  const latest = versions[0] ?? null;
  const selected = versions.find((version) => version.id === pickedId) ?? latest;

  const overage = computeRevisionOverage(versions.length);
  const chargedAmount = order.data?.fees?.find((fee) => fee.feeType === REVISION_FEE_TYPE)?.amount ?? 0;
  const baht = (n: number) => n.toLocaleString("th-TH");

  function copyApprovalLink(token: string) {
    const url = `${window.location.origin}/approve/design/${token}`;
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopiedToken(token);
        toast.success("คัดลอกลิงก์ให้ลูกค้าตรวจแบบแล้ว");
        setTimeout(() => setCopiedToken(null), 2000);
      },
      () => toast.error("คัดลอกลิงก์ไม่สำเร็จ"),
    );
  }

  let body: React.ReactNode;
  if (designs.isLoading) {
    body = <span className={c("sk")} style={{ aspectRatio: "4 / 3" }} />;
  } else if (designs.isError && !designs.data) {
    body = (
      <StateBox
        tone="bad"
        icon={AlertTriangle}
        action={
          <button type="button" className={c("btn sm")} onClick={() => void designs.refetch()}>
            ลองอีกครั้ง
          </button>
        }
      >
        โหลดม็อกอัพไม่สำเร็จ
      </StateBox>
    );
  } else if (!selected || !latest) {
    body = (
      <div className={c("canvas")}>
        <div className={c("e")}>
          <ImageOff aria-hidden="true" />
          <span>{isCustom ? "ยังไม่มีม็อกอัพ" : "งานสำเร็จรูป ไม่ต้องมีแบบ"}</span>
          {isCustom && canUpload ? (
            <button type="button" className={c("btn sm")} onClick={() => setShowUpload(true)}>
              <Upload aria-hidden="true" />
              อัปม็อกอัพเวอร์ชันแรก
            </button>
          ) : isCustom && me ? (
            <small>{roleCanUpload ? "อัปได้เมื่อออเดอร์อยู่ขั้นออกแบบ" : "ดีไซเนอร์ยังไม่ได้ส่งแบบ"}</small>
          ) : null}
        </div>
      </div>
    );
  } else {
    const isLatest = selected.id === latest.id;
    const cover = mockupCoverImage(selected);
    const pending = selected.approvalStatus === "PENDING";
    // ลิงก์ตายแล้วต้องมีทางสร้างใหม่ ไม่ปล่อยให้ลูกค้ากดแล้วเจอหมดอายุ (audit ข้อ 17)
    const tokenExpired = !selected.tokenExpiresAt || new Date(selected.tokenExpiresAt) < now;
    const linkAction =
      pending && roleCanRegenerate && selected.approvalToken ? (
        tokenExpired ? (
          <button
            type="button"
            className={c("btn sm")}
            onClick={() => regenerateToken.mutate({ designId: selected.id })}
            disabled={regenerateToken.isPending}
          >
            <RotateCcw aria-hidden="true" />
            ลิงก์หมดอายุ สร้างใหม่
          </button>
        ) : (
          <button type="button" className={c("btn sm")} onClick={() => copyApprovalLink(selected.approvalToken!)}>
            {copiedToken === selected.approvalToken ? <Check aria-hidden="true" /> : <LinkIcon aria-hidden="true" />}
            {copiedToken === selected.approvalToken ? "คัดลอกลิงก์แล้ว" : "ลิงก์ให้ลูกค้าตรวจ"}
          </button>
        )
      ) : null;
    const decisionAction =
      pending && canApprove ? (
        <button type="button" className={c("btn ghost sm")} onClick={() => setDecisionId(selected.id)}>
          <Check aria-hidden="true" />
          บันทึกผลจากลูกค้า
        </button>
      ) : null;
    const compactOriginal = Boolean(linkAction || decisionAction);

    body = (
      <>
        <div className={c("canvas")}>
          <span className={c("ver chip gray")}>v{selected.versionNumber}</span>
          {isLatest ? (
            <span className={c("ap")}>
              <MockupPill design={selected} now={now} />
            </span>
          ) : (
            <span className={c("ap chip line")}>เวอร์ชันเก่า</span>
          )}
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={`ม็อกอัพ v${selected.versionNumber}`} loading="lazy" decoding="async" />
          ) : (
            <div className={c("e")}>
              <ImageOff aria-hidden="true" />
              <span>เวอร์ชันนี้ไม่มีรูปตัวอย่าง</span>
            </div>
          )}
        </div>

        {/* ชุดหลายรูป (หน้า/หลัง/แขน) — รูปย่อทุกด้าน กดขยายได้ */}
        {mockupImageCount(selected) > 1 ? (
          <div style={{ marginTop: 10 }}>
            <MockupThumbRow version={selected} versionNumber={selected.versionNumber} size="sm" />
          </div>
        ) : null}

        <div className={c("vers")} role="group" aria-label="เวอร์ชันม็อกอัพ">
          {versions.map((version) => {
            const thumb = mockupCoverImage(version);
            return (
              <button
                key={version.id}
                type="button"
                className={c("ver-t")}
                aria-pressed={version.id === selected.id}
                onClick={() => setPickedId(version.id === latest.id ? null : version.id)}
              >
                <span className={c("th")}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <ImageOff aria-hidden="true" />
                  )}
                </span>
                v{version.versionNumber}
                <small>{formatDateCompact(version.createdAt)}</small>
              </button>
            );
          })}
        </div>

        <div className={c("caption")}>
          <span>
            {isLatest ? (
              <>
                ส่งให้ลูกค้าดู {formatDateCompact(selected.createdAt)} {timeText(selected.createdAt)}
                {selected.approvalStatus === "APPROVED" && selected.approvedAt ? (
                  <>
                    {" · "}
                    <b style={{ color: "var(--good)" }}>อนุมัติ {formatDateCompact(selected.approvedAt)}</b>
                  </>
                ) : pending ? (
                  " · ลูกค้ายังไม่ตอบ"
                ) : null}
              </>
            ) : (
              `ถูกแทนด้วย v${latest.versionNumber}`
            )}
          </span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {linkAction}
            {decisionAction}
            <a
              className={c("btn ghost sm", compactOriginal && "icon")}
              href={selected.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={compactOriginal ? `เปิดไฟล์ต้นฉบับ v${selected.versionNumber}` : undefined}
            >
              <ArrowUpRight aria-hidden="true" />
              {compactOriginal ? null : "ไฟล์ต้นฉบับ"}
            </a>
          </span>
        </div>

        {selected.customerComment ? (
          <div style={{ marginTop: 10 }}>
            <Callout icon={MessageSquare}>{selected.customerComment}</Callout>
          </div>
        ) : null}
        {selected.designerNotes ? (
          <p className={c("brief")} style={{ marginTop: 10, fontSize: 12.5 }}>
            {selected.designerNotes}
          </p>
        ) : null}

        {/* นับรอบแก้แบบ + ค่าแก้เกินโควตา — พนักงานกดคิดเอง · ยอดเงินโผล่เฉพาะคนเห็นเงิน */}
        {overage.revisionRounds > 0 ? (
          <div className={c("state")} style={{ marginTop: 12 }}>
            <RotateCcw aria-hidden="true" />
            <span className={c("grow")}>
              แก้แบบมาแล้ว {overage.revisionRounds} รอบ (ฟรี {overage.freeRounds} รอบ)
            </span>
            {overage.chargeableRounds > 0 ? (
              <span className={c("chip warn")}>เกินโควตา {overage.chargeableRounds} รอบ</span>
            ) : null}
            {canSeeMoney && overage.chargeableRounds > 0 ? (
              chargedAmount > 0 ? (
                <span className={c("chip good")}>
                  <Check aria-hidden="true" />
                  คิดค่าแก้แล้ว ฿{baht(chargedAmount)}
                </span>
              ) : (
                <>
                  {roleCanApprove ? (
                    <button
                      type="button"
                      className={c("btn sm")}
                      onClick={() => addRevisionFee.mutate({ id: orderId })}
                      disabled={addRevisionFee.isPending}
                    >
                      {addRevisionFee.isPending ? <Spinner size="sm" /> : <Receipt aria-hidden="true" />}
                      คิดค่าแก้แบบ ฿{baht(overage.fee)}
                    </button>
                  ) : null}
                  <small style={{ flexBasis: "100%", fontSize: 12, color: "var(--ink-3)" }}>
                    ฿{REVISION_FEE_PER_ROUND}/รอบ แก้ยอดได้ที่ค่าธรรมเนียมออเดอร์
                  </small>
                </>
              )
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section className={c("card")} aria-labelledby="files-mockup-h">
      <CardHead
        icon={ImageIcon}
        tone="violet"
        id="files-mockup-h"
        title="ม็อกอัพ"
        right={
          designs.data ? (
            <>
              <MockupPill design={latest} now={now} />
              {canUpload && latest ? (
                <button type="button" className={c("btn sm")} onClick={() => setShowUpload(true)}>
                  <Upload aria-hidden="true" />
                  อัปเวอร์ชันใหม่
                </button>
              ) : null}
            </>
          ) : undefined
        }
      />
      <div className={c("cb")}>{body}</div>

      <MockupUploadDialog
        orderId={orderId}
        open={showUpload}
        onOpenChange={setShowUpload}
        onUploaded={() => setPickedId(null)}
      />
      <MockupDecisionDialog designId={decisionId} onClose={() => setDecisionId(null)} />
    </section>
  );
}

/* ---------- ไฟล์ทั้งหมด ---------- */

type GroupKey = "raw" | "print" | "general";

interface FileRow {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  category: string | null;
  printPosition: string | null;
  uploadedById: string | null;
  uploadedBy: { id: string; name: string } | null;
}

interface FileGroup {
  key: GroupKey;
  label: string;
  emptyTitle: string;
  emptyIcon: LucideIcon;
  /** category ที่เขียนตอนอัปจากกลุ่มนี้ */
  categoryFor: (file: File) => AttachmentCategory;
  folder: string;
  accept: string;
  types: string[];
  maxMB: number;
}

/*
  3 กลุ่มบนจอ ↔ category จริง (schema เก็บ String · ดู lib/file-layers)
  ไฟล์ลูกค้า = ชั้น RAW ทั้งหมดที่ไม่ใช่เอกสาร: REFERENCE_IMAGE (ฟอร์ม/ลิงก์ลูกค้า) + OTHER (แอดมินแนบแทนลูกค้า — การ์ดเดิมเขียนค่านี้)
  ไฟล์พิมพ์ = PRINT_FILE (ชั้น 3 ภายในเท่านั้น)
  ทั่วไป    = เอกสารประกอบ PO_DOCUMENT / PAYMENT_SLIP / PHOTO
  อัปเป็น REFERENCE_IMAGE จากที่นี่ไม่ได้ — ชุดนั้นหน้าแก้ไขออเดอร์ถือเป็น desired set
*/
const GENERAL_CATEGORIES: ReadonlySet<string> = new Set(["PO_DOCUMENT", "PAYMENT_SLIP", "PHOTO"]);

export function fileGroupOf(category: string | null | undefined): GroupKey {
  if (layerForCategory(category) === "PRINT") return "print";
  return category && GENERAL_CATEGORIES.has(category) ? "general" : "raw";
}

const FILE_GROUPS: FileGroup[] = [
  {
    key: "raw",
    label: "ไฟล์ลูกค้า",
    emptyTitle: "ยังไม่มีไฟล์ลูกค้า",
    emptyIcon: FileText,
    categoryFor: () => "OTHER",
    folder: "raw",
    accept: "image/*,.pdf,.ai,.psd,.zip",
    types: ["รูป", "PDF", "AI", "PSD", "ZIP"],
    maxMB: 25,
  },
  {
    key: "print",
    label: "ไฟล์พิมพ์",
    emptyTitle: "ยังไม่มีไฟล์พิมพ์",
    emptyIcon: Printer,
    categoryFor: () => "PRINT_FILE",
    folder: "print",
    accept: "image/*,.pdf,.ai,.psd,.eps,.dst,.zip",
    types: ["รูป", "PDF", "AI", "PSD", "EPS", "DST", "ZIP"],
    maxMB: 50,
  },
  {
    key: "general",
    label: "ทั่วไป",
    emptyTitle: "ยังไม่มีไฟล์ทั่วไป",
    emptyIcon: FileText,
    categoryFor: (file) => (file.type.startsWith("image/") ? "PHOTO" : "PO_DOCUMENT"),
    folder: "general",
    accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip",
    types: ["รูป", "PDF", "Word", "Excel", "ZIP"],
    maxMB: 25,
  },
];

/** input accept กรองแค่ตอนกดเลือก — ไฟล์ที่ลากมาวางต้องเช็กเอง */
function acceptsFile(file: File, accept: string): boolean {
  const name = file.name.toLowerCase();
  return accept.split(",").some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (rule.endsWith("/*")) return file.type.startsWith(rule.slice(0, -1));
    if (rule.startsWith(".")) return name.endsWith(rule);
    return file.type === rule;
  });
}

/** ชื่อไฟล์ใน storage: เวลา + สุ่ม + นามสกุล ASCII ล้วน (สูตรเดียวกับ FileUpload) กัน path พังที่ /api/files */
function storageObjectName(fileName: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeFileExt(fileName)}`;
}

function fileSizeText(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileKind(file: FileRow): string {
  // uploadedById = null → ลูกค้าอัปเองผ่านลิงก์
  const who = file.uploadedById === null ? "ลูกค้าอัปเอง" : file.uploadedBy?.name ?? null;
  const position = mockupPositionLabel(file.printPosition);
  const ext = file.fileName.includes(".") ? file.fileName.split(".").pop()?.toUpperCase() : null;
  return [who, position ? `ด้าน${position}` : null, ext].filter(Boolean).join(" · ");
}

function FilesCard({
  orderId,
  orderType,
  userId,
  userRole,
}: {
  orderId: string;
  orderType: string;
  userId: string;
  userRole: string;
}) {
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const attachments = trpc.attachment.listByEntity.useQuery({ entityType: "ORDER", entityId: orderId });
  const [now] = useState(() => new Date());
  const [groupKey, setGroupKey] = useState<GroupKey>("raw");
  const [preview, setPreview] = useState<FileRow | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const segRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);

  // ลิงก์ลูกค้าอัปไฟล์เอง — เฉพาะคนถือความสัมพันธ์ลูกค้า (server gate create_sales_docs ซ้ำ)
  const canManageLink = ["OWNER", "MANAGER", "SALES"].includes(userRole);
  const uploadLink = trpc.customerUpload.getLink.useQuery({ orderId }, { enabled: canManageLink });
  const generateLink = useMutationWithInvalidation(trpc.customerUpload.generateLink, {
    invalidate: [utils.customerUpload.getLink],
    onError: (err: { message?: string }) => toast.error(err.message ?? "สร้างลิงก์ไม่สำเร็จ"),
  });
  const createAttachment = useMutationWithInvalidation(trpc.attachment.create, {
    invalidate: [utils.attachment.listByEntity],
    // แจ้งผลใน uploadFiles ที่เดียว ไม่ให้เด้งซ้ำสองอัน
    onError: () => undefined,
  });
  const deleteAttachment = useMutationWithInvalidation(trpc.attachment.delete, {
    invalidate: [utils.attachment.listByEntity],
    onSuccess: () => setPreview(null),
    onError: (err: { message?: string }) => toast.error(err.message ?? "ลบไฟล์ไม่สำเร็จ"),
  });

  // ตรงกฎ server: ไฟล์พิมพ์ = ทีมผลิต/กราฟิก/ผู้จัดการ · ลบได้เฉพาะไฟล์ตัวเอง ยกเว้น OWNER/MANAGER
  const isManagerUp = userRole === "OWNER" || userRole === "MANAGER";
  const canAttachPrint = ["OWNER", "MANAGER", "DESIGNER", "PRODUCTION_STAFF"].includes(userRole);
  const canDelete = (file: FileRow) => isManagerUp || (!!userId && file.uploadedById === userId);

  const files: FileRow[] = attachments.data ?? [];
  const byGroup: Record<GroupKey, FileRow[]> = { raw: [], print: [], general: [] };
  for (const file of files) byGroup[fileGroupOf(file.category)].push(file);
  const group = FILE_GROUPS.find((item) => item.key === groupKey) ?? FILE_GROUPS[0]!;
  const list = byGroup[group.key];
  const canAttach = group.key !== "print" || canAttachPrint;
  const hasData = Boolean(attachments.data);
  const countKey = `${byGroup.raw.length}-${byGroup.print.length}-${byGroup.general.length}`;

  // ตัวเลื่อนใต้กลุ่มที่เลือก — วัดปุ่มจริงแล้วเขียน style ตรง (placeInd ของต้นแบบ) ไม่ setState ใน effect
  useLayoutEffect(() => {
    const seg = segRef.current;
    const ind = indRef.current;
    if (!seg || !ind) return;
    const place = () => {
      const on = seg.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!on) return;
      ind.style.left = `${on.offsetLeft}px`;
      ind.style.width = `${on.offsetWidth}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(seg);
    void document.fonts.ready.then(place);
    return () => observer.disconnect();
  }, [groupKey, countKey, hasData]);

  async function uploadFiles(picked: FileList | null) {
    const target = group; // กลุ่มตอนเริ่ม — สลับกลุ่มระหว่างอัปก็ยังลงกลุ่มเดิม
    const queue = Array.from(picked ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (queue.length === 0) return;
    if (uploading) {
      toast.error("รอไฟล์ก่อนหน้าอัปเสร็จก่อน");
      return;
    }
    if (target.key === "print" && !canAttachPrint) return;

    let done = 0;
    for (const file of queue) {
      if (!acceptsFile(file, target.accept)) {
        toast.error(`${file.name} — ${target.label}แนบไฟล์ชนิดนี้ไม่ได้`);
        continue;
      }
      if (file.size > target.maxMB * 1024 * 1024) {
        toast.error(`${file.name} ใหญ่เกิน ${target.maxMB} MB`);
        continue;
      }
      setUploading(file.name);
      try {
        const url = await uploadFile("designs", `orders/${orderId}/${target.folder}/${storageObjectName(file.name)}`, file);
        await createAttachment.mutateAsync({
          entityType: "ORDER",
          entityId: orderId,
          fileName: file.name,
          fileUrl: url,
          fileType: file.type || file.name.split(".").pop() || "file",
          fileSize: file.size,
          category: target.categoryFor(file),
        });
        done += 1;
      } catch (err) {
        const reason = err instanceof Error && err.message ? ` — ${err.message}` : "";
        toast.error(`${file.name} อัปโหลดไม่สำเร็จ${reason}`);
      }
    }
    setUploading(null);
    if (done > 0) toast.success(`แนบ ${done} ไฟล์ใน${target.label}แล้ว`);
  }

  async function removeFile(file: FileRow) {
    // ลบ Attachment = ลบถาวร ต้องยืนยันก่อนเสมอ
    if (!(await confirm({ title: "ลบไฟล์นี้?", description: file.fileName, confirmText: "ลบไฟล์", destructive: true }))) return;
    deleteAttachment.mutate({ id: file.id });
  }

  const linkData = uploadLink.data;
  const linkExpired = !linkData?.expiresAt || new Date(linkData.expiresAt) < now;
  const linkUrl =
    linkData?.token && !linkExpired && typeof window !== "undefined"
      ? `${window.location.origin}/upload/${linkData.token}`
      : null;

  function copyUploadLink() {
    if (!linkUrl) return;
    void navigator.clipboard.writeText(linkUrl).then(
      () => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      },
      () => toast.error("คัดลอกลิงก์ไม่สำเร็จ"),
    );
  }

  return (
    <section className={c("card")} aria-labelledby="files-all-h">
      <CardHead
        icon={Layers}
        id="files-all-h"
        title="ไฟล์ทั้งหมด"
        right={
          <>
            {canManageLink ? (
              <button
                type="button"
                className={c("btn ghost sm")}
                aria-expanded={showLink}
                aria-controls="files-customer-link"
                onClick={() => setShowLink((open) => !open)}
              >
                <LinkIcon aria-hidden="true" />
                ลิงก์ลูกค้า
              </button>
            ) : null}
            {hasData ? <span className={c("chip gray")}>{files.length} ไฟล์</span> : null}
          </>
        }
      />
      <div className={c("cb")}>
        {/* ลิงก์ให้ลูกค้าอัปไฟล์เองทาง LINE (ไม่ต้อง login) — ไฟล์เข้ากลุ่มไฟล์ลูกค้า */}
        {canManageLink && showLink ? (
          <div id="files-customer-link" className={c("state on")} style={{ marginBottom: 12 }}>
            <LinkIcon aria-hidden="true" />
            {linkUrl ? (
              <>
                <span className={c("sinput")} style={{ maxWidth: "none" }}>
                  <input
                    readOnly
                    value={linkUrl}
                    aria-label="ลิงก์อัปโหลดไฟล์ของลูกค้า"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </span>
                <button type="button" className={c("btn sm")} onClick={copyUploadLink}>
                  {linkCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {linkCopied ? "คัดลอกแล้ว" : "คัดลอก"}
                </button>
                <span className={c("grow")} style={{ fontSize: 12 }}>
                  {linkData?.expiresAt ? `หมดอายุ ${formatDate(linkData.expiresAt)}` : null}
                </span>
                <button
                  type="button"
                  className={c("btn ghost sm")}
                  onClick={() => generateLink.mutate({ orderId })}
                  disabled={generateLink.isPending}
                >
                  สร้างลิงก์ใหม่ (ลิงก์เดิมจะใช้ไม่ได้)
                </button>
              </>
            ) : (
              <>
                <span className={c("grow")}>
                  {uploadLink.isLoading
                    ? "กำลังโหลดลิงก์..."
                    : linkData?.token && linkExpired
                      ? "ลิงก์เดิมหมดอายุแล้ว"
                      : "ยังไม่มีลิงก์ให้ลูกค้าอัปไฟล์เอง"}
                </span>
                <button
                  type="button"
                  className={c("btn sm")}
                  onClick={() => generateLink.mutate({ orderId })}
                  disabled={generateLink.isPending || uploadLink.isLoading}
                >
                  <LinkIcon aria-hidden="true" />
                  สร้างลิงก์อัปโหลด
                </button>
              </>
            )}
          </div>
        ) : null}

        {/* แยก โหลด/พัง/ว่างจริง — ห้ามบอกว่าไม่มีไฟล์ตอนที่โหลดพัง */}
        {attachments.isLoading ? (
          <div className={c("skstack")} role="status" aria-label="กำลังโหลดไฟล์">
            <span className={c("sk skrow")} />
            <span className={c("sk skrow")} />
          </div>
        ) : attachments.isError && !attachments.data ? (
          <StateBox
            tone="bad"
            icon={AlertTriangle}
            action={
              <button type="button" className={c("btn sm")} onClick={() => void attachments.refetch()}>
                ลองอีกครั้ง
              </button>
            }
          >
            โหลดไฟล์แนบไม่สำเร็จ
          </StateBox>
        ) : (
          <>
            <div ref={segRef} className={c("seg")} role="group" aria-label="ชนิดไฟล์" style={{ marginBottom: 12 }}>
              <span ref={indRef} className={c("ind")} aria-hidden="true" />
              {FILE_GROUPS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={item.key === group.key}
                  onClick={() => setGroupKey(item.key)}
                >
                  {item.label}
                  <span className={c("n")}>{byGroup[item.key].length}</span>
                </button>
              ))}
            </div>

            {list.length > 0 ? (
              <div className={c("files")}>
                {list.map((file) => (
                  <button key={file.id} type="button" className={c("file")} onClick={() => setPreview(file)}>
                    <span className={c("th")}>
                      {isImageUrl(file.fileUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={file.fileUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <FileText aria-hidden="true" />
                      )}
                    </span>
                    <span className={c("nm")}>
                      {file.fileName}
                      <small>{fileKind(file)}</small>
                    </span>
                    <span className={c("m")}>{fileSizeText(file.fileSize)}</span>
                    <ArrowUpRight className={c("arrow")} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                icon={group.emptyIcon}
                title={group.emptyTitle}
                hint={group.key === "print" && orderType === "CUSTOM" ? "ใส่ไฟล์พิมพ์ก่อนส่งงานเข้าผลิต" : undefined}
              />
            )}

            {canAttach ? (
              <button
                type="button"
                className={c("drop", dragOver && "over")}
                style={{ marginTop: 12 }}
                aria-busy={uploading !== null || undefined}
                onClick={() => {
                  if (!uploading) inputRef.current?.click();
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!dragOver) setDragOver(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  void uploadFiles(event.dataTransfer.files);
                }}
              >
                {uploading ? <Spinner size="sm" /> : <Upload aria-hidden="true" />}
                <span>
                  {uploading ? (
                    <>
                      กำลังอัปโหลด <b>{uploading}</b>
                    </>
                  ) : (
                    <>
                      <b>ลากไฟล์มาวาง</b> หรือกดเพื่อเลือก
                    </>
                  )}
                </span>
                <small>
                  {group.types.join(" · ")} ไม่เกิน {group.maxMB} MB
                </small>
              </button>
            ) : (
              <div className={c("drop")} style={{ marginTop: 12 }}>
                <Lock aria-hidden="true" />
                <span>
                  <b>{group.label}แนบได้เฉพาะทีมผลิต กราฟิก และผู้จัดการ</b>
                </span>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={group.accept}
              hidden
              onChange={(event) => void uploadFiles(event.currentTarget.files)}
            />
          </>
        )}
      </div>

      {/* ดูไฟล์ในหน้า + ดาวน์โหลด + ลบ (ถามก่อนเสมอ) */}
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6 text-sm font-medium">{preview?.fileName}</DialogTitle>
          </DialogHeader>
          {preview ? (
            <div className={c("tokens")}>
              <div className={c("canvas")} style={{ aspectRatio: "16 / 10" }}>
                {isImageUrl(preview.fileUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.fileUrl} alt={preview.fileName} />
                ) : (
                  <div className={c("e")}>
                    <FileText aria-hidden="true" />
                    <span>ดูตัวอย่างไม่ได้ ดาวน์โหลดเพื่อเปิด</span>
                    <small>{fileKind(preview)}</small>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {canDelete(preview) ? (
                  <button
                    type="button"
                    className={c("btn danger")}
                    onClick={() => void removeFile(preview)}
                    disabled={deleteAttachment.isPending}
                  >
                    {deleteAttachment.isPending ? <Spinner size="sm" /> : <Trash2 aria-hidden="true" />}
                    ลบ
                  </button>
                ) : null}
                <a
                  className={c("btn")}
                  href={preview.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={preview.fileName}
                >
                  <Download aria-hidden="true" />
                  ดาวน์โหลด
                </a>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
