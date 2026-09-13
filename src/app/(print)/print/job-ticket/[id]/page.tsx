// Job Ticket — ใบสั่งงานหน้างาน (พิมพ์ติดแฟ้มงาน/ส่งเข้าไลน์ผลิต)
// กติกาสำคัญ: "ไม่มีราคา/เงินใดๆ บนใบนี้" — พนักงานหน้างานไม่เห็นเงิน (RBAC เดียวกับระบบ)
// กระดาษเป็นหลัก (เบสเคาะ A 2026-09-05 · ROADMAP §A5): ใบนี้คือบันทึกจริงของขั้นที่ "จดบนกระดาษ" (รีดร้อน ฯลฯ)
//   · ทุกขั้นพิมพ์ข้อกำหนดมาตรฐานเป็นช่องติ๊ก · ขั้นที่จดในระบบ (เบิกเสื้อ/ร้านนอก) ไม่มีช่องยอด — ไม่ให้เขียน 2 ที่
//   · งานร้านนอกแยกตาราง "เดินคู่ขนาน" · ท้ายใบมีวันพิมพ์ + ม็อกอัพเวอร์ชัน กันกระดาษเก่า
// QR สแกนเปิดใบผลิตในระบบ (?production=<id>) และพกเวอร์ชันม็อกอัพที่พิมพ์ — สแกนใบเก่าแล้วใบผลิตเตือน
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import {
  PRODUCT_TYPES,
  ITEM_SOURCES,
  PROCESSING_TYPES,
  FABRIC_TYPES,
  PRINT_POSITIONS,
  PRINT_TYPES,
} from "@/types/order-form";
import { PRIORITY_LABELS, CHANNEL_LABELS } from "@/lib/order-status";
import {
  STEP_TYPE_LABELS,
  isOutsourceStep,
  productionWorkflowSteps,
} from "@/lib/production-steps";
import { isImageUrl } from "@/lib/utils";
import { mockupImages } from "@/lib/mockup";
import { PrintPage, NotesBlock, formatDocDate, DocumentStamp } from "@/components/print/print-document";
import { PrintActions } from "@/components/print/print-actions";
import { MonitorSmartphone, ShieldAlert, Square } from "lucide-react";
import { RECORD_MODE_LABEL, recordModeOf } from "@/lib/work-order-record-mode";
import { workOrderStandards } from "@/lib/work-order-standards";

function MetaCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] text-slate-500">{label}</p>
      <p className={strong ? "text-[14px] font-bold" : "text-[12.5px] font-medium"}>{value}</p>
    </div>
  );
}

type TicketStep = {
  id: string;
  stepType: string;
  customStepName: string | null;
  executionMode: string;
  assignedTo: { name: string } | null;
  outsourceOrders: Array<{ sentAt: Date | null; expectedBackAt: Date | null; vendor: { name: string } }>;
};

function stepTitle(step: TicketStep) {
  return `${STEP_TYPE_LABELS[step.stepType] ?? step.stepType}${step.customStepName ? ` — ${step.customStepName}` : ""}`;
}

function TickBoxes({ stepType }: { stepType: string }) {
  return (
    <ul className="space-y-1">
      {workOrderStandards(stepType).map((item) => (
        <li key={item} className="flex items-start gap-1.5 text-[12px] leading-tight">
          <Square className="mt-px h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StepsHead() {
  return (
    <thead>
      <tr className="border-y border-slate-400 text-left">
        <th className="w-8 py-1 pr-2 text-center font-semibold">#</th>
        <th className="py-1 pr-2 font-semibold">ขั้นตอน</th>
        <th className="py-1 pr-2 font-semibold">ข้อกำหนด (ติ๊กเมื่อทำแล้ว)</th>
        <th className="w-24 py-1 pr-2 font-semibold">ยอดดี / เสีย</th>
        <th className="w-24 py-1 pr-2 font-semibold">เสร็จ</th>
        <th className="w-20 py-1 font-semibold">ลงชื่อ</th>
      </tr>
    </thead>
  );
}

/** แถวขั้นบนกระดาษ — จดในระบบ: ไม่มีช่องยอด/เสร็จ/ลงชื่อ · จดบนกระดาษ: ช่องว่างให้เขียน · ผ่านเอง (DTF): ไม่มีช่อง */
function StepRow({ step, index, note }: { step: TicketStep; index: number; note?: string }) {
  const mode = recordModeOf(step);
  const outsource = step.outsourceOrders[0];
  return (
    <tr className={`border-b border-slate-200 align-top${mode === "screen" ? " bg-slate-100" : ""}`}>
      <td className="py-2 pr-2 text-center text-slate-500">{index}</td>
      <td className="py-2 pr-2">
        <p className="font-semibold leading-tight">{stepTitle(step)}</p>
        {step.assignedTo ? <p className="text-[10.5px] text-slate-600">{step.assignedTo.name}</p> : null}
        {outsource ? (
          <p className="text-[10.5px] text-slate-600">
            {outsource.vendor.name}
            {outsource.sentAt ? ` — ส่ง ${formatDocDate(outsource.sentAt)}` : ""}
            {outsource.expectedBackAt ? ` นัดรับ ${formatDocDate(outsource.expectedBackAt)}` : ""}
          </p>
        ) : null}
        {note ? <p className="text-[10.5px] text-slate-600">{note}</p> : null}
        {mode === "screen" ? (
          <p className="mt-1 inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold">
            <MonitorSmartphone className="h-3 w-3" aria-hidden="true" /> {RECORD_MODE_LABEL.screen}
          </p>
        ) : null}
        {mode === "auto" ? <p className="mt-1 text-[10.5px] text-slate-500">ผ่านเองเมื่อปิดรอบพิมพ์ — ไม่ต้องเซ็น</p> : null}
      </td>
      <td className="py-2 pr-2">{mode === "auto" ? <span className="text-slate-400">—</span> : <TickBoxes stepType={step.stepType} />}</td>
      {mode === "screen" ? (
        <td colSpan={3} className="py-2 text-[11.5px] text-slate-600">
          <span className="inline-flex items-start gap-1">
            <MonitorSmartphone className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              ยอดและเวลาบันทึกในระบบ — สแกน QR หัวใบ
              <br />
              <span className="text-slate-500">ไม่ต้องเขียนยอดบนใบนี้</span>
            </span>
          </span>
        </td>
      ) : mode === "auto" ? (
        <td colSpan={3} className="py-2 text-slate-400">
          —
        </td>
      ) : (
        <>
          <td className="py-2 pr-2 text-slate-400">____ / ____</td>
          <td className="py-2 pr-2 text-slate-300">___ / ___</td>
          <td className="py-2 text-slate-300">________</td>
        </>
      )}
    </tr>
  );
}

export default async function PrintJobTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ production?: string }>;
}) {
  const { id } = await params;
  const { production: productionParam } = (await searchParams) ?? {};

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, company: true, phone: true } },
      createdBy: { select: { name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          products: {
            orderBy: { sortOrder: "asc" },
            include: {
              variants: { orderBy: { size: "asc" } },
              pattern: { select: { name: true } },
              packagingOption: { select: { name: true } },
            },
          },
          prints: { orderBy: { position: "asc" } },
          addons: true,
        },
      },
      productions: {
        orderBy: { createdAt: "asc" },
        include: {
          steps: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              stepType: true,
              customStepName: true,
              executionMode: true,
              assignedTo: { select: { name: true } },
              outsourceOrders: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { sentAt: true, expectedBackAt: true, vendor: { select: { name: true } } },
              },
            },
          },
        },
      },
      // ม็อกอัพที่ลูกค้าอนุมัติล่าสุด — ช่างหน้าเครื่องต้องเห็นลายจริง ไม่ใช่แค่ชื่อไฟล์
      // ดึงทั้งชุด: งานพิมพ์หน้า+หลังถ้าพิมพ์แค่รูปปกลงกระดาษ ช่างจะทำเฉพาะด้านที่เห็น
      designs: {
        where: { approvalStatus: "APPROVED" },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          versionNumber: true,
          fileUrl: true,
          thumbnailUrl: true,
          approvedAt: true,
          files: {
            orderBy: { sortOrder: "asc" },
            select: { fileUrl: true, thumbnailUrl: true, position: true },
          },
        },
      },
    },
  });
  if (!order) notFound();

  const approvedDesign = order.designs[0] ?? null;
  // ทุกรูปในชุดที่พิมพ์ลงกระดาษได้จริง — เวอร์ชันเก่าที่ยังไม่มี files จะได้รูปปกใบเดียว
  const approvedDesignImages = approvedDesign
    ? mockupImages(approvedDesign).filter((image) => image.previewUrl)
    : [];

  // QR เปิดใบผลิตในระบบ (หัวหน้าเห็นใบผลิต · ช่างถูกพาไปหน้าลงมือของสถานีตัวเอง) และพกเวอร์ชันม็อกอัพที่พิมพ์
  // ใบผลิตที่จะชี้: ?production=<id> จากปุ่มในใบผลิต · ไม่ระบุ = ใบเดียวของออเดอร์ · หลายใบ = หน้าออเดอร์
  // ต้องเป็น URL เต็ม (ตั้ง NEXT_PUBLIC_APP_URL ตอน deploy)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const targetProduction =
    order.productions.find((p) => p.id === productionParam) ?? (order.productions.length === 1 ? order.productions[0] : null);
  const mockupQuery = approvedDesign ? `?mockup=${approvedDesign.versionNumber}` : "";
  const qrTarget = targetProduction ? `${baseUrl}/production/${targetProduction.id}${mockupQuery}` : `${baseUrl}/orders/${order.id}`;
  const qrSvg = await QRCode.toString(qrTarget, {
    type: "svg",
    margin: 0,
    width: 92,
  });

  const totalQty = order.items.reduce((s, it) => s + it.totalQuantity, 0);
  // PACKAGING รุ่นเก่าเคยอยู่ก่อน QC — ห้ามพิมพ์เป็นช่องให้ช่างติ๊กว่าแพ็กแล้ว
  // เพราะแพ็กสุดท้ายเกิดหลัง QC ผ่าน Delivery เท่านั้น
  const steps: TicketStep[] = productionWorkflowSteps((targetProduction ? [targetProduction] : order.productions).flatMap((p) => p.steps));
  const inhouseSteps = steps.filter((s) => recordModeOf(s) !== "screen" || !(isOutsourceStep(s.stepType) || s.executionMode === "OUTSOURCE" || s.outsourceOrders.length > 0));
  const outsourceSteps = steps.filter((s) => !inhouseSteps.includes(s));
  const isUrgent = order.priority === "URGENT" || order.priority === "HIGH";
  const printedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date());

  return (
    <div className="print-viewport">
      <PrintActions backHref={`/orders/${order.id}`} />

      <PrintPage>
        {/* หัวใบงาน */}
        <div className="flex items-start justify-between gap-4 border-b-4 border-slate-900 pb-3">
          <div>
            <div className="mb-2">
              <DocumentStamp title="ใบสั่งงาน" label="Production document" code="JT" />
            </div>
            <p className="text-[12px] font-semibold tracking-wide text-slate-500">
              ใบสั่งงาน / JOB TICKET
            </p>
            <p className="text-[26px] font-bold leading-tight tabular-nums">{order.orderNumber}</p>
          </div>
          <div className="flex items-start gap-3">
            {isUrgent && (
              <span className="mt-1 rounded border-2 border-red-600 px-2.5 py-1 text-[14px] font-bold text-red-600">
                {PRIORITY_LABELS[order.priority]}
              </span>
            )}
            <div className="text-center">
              <div
                className="h-[92px] w-[92px]"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="mt-0.5 text-[9.5px] text-slate-500">{targetProduction ? "สแกน = เปิดใบนี้ในระบบ" : "สแกนเปิดออเดอร์"}</p>
            </div>
          </div>
        </div>

        {/* blind ship — ใบนี้เดินทางกับกองเสื้อถึงโต๊ะแพ็คแต่ไม่เข้ากล่อง จึงใส่คำเตือนได้
            (query ใช้ include → blindShip/blindShipSenderName เป็น scalar มาครบอยู่แล้ว) */}
        {order.blindShip && (
          <div className="mt-3 rounded border-4 border-red-600 bg-red-50 px-4 py-2.5">
            <p className="flex items-center gap-2 text-[16px] font-bold leading-snug text-red-700">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              BLIND SHIP — ห้ามใส่เอกสาร/ชื่อ Anajak ในกล่อง
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-red-700">
              ผู้ส่งบนใบ: {order.blindShipSenderName || order.customer.name}
            </p>
          </div>
        )}

        {/* ข้อมูลงาน — ไม่มีราคา */}
        <div className="mt-3 grid grid-cols-4 gap-x-4 gap-y-2 rounded border border-slate-300 px-4 py-2.5">
          <MetaCell
            label="ลูกค้า"
            value={order.customer.company || order.customer.name}
          />
          <MetaCell label="ช่องทาง" value={CHANNEL_LABELS[order.channel] ?? order.channel} />
          <MetaCell label="วันเปิดงาน" value={formatDocDate(order.createdAt)} />
          <MetaCell
            label="กำหนดส่ง"
            value={order.deadline ? formatDocDate(order.deadline) : "ไม่ระบุ"}
            strong
          />
          <MetaCell label="ผู้เปิดงาน" value={order.createdBy.name} />
          <MetaCell label="ความเร่งด่วน" value={PRIORITY_LABELS[order.priority] ?? order.priority} />
          <MetaCell label="จำนวนรวม" value={`${totalQty.toLocaleString("th-TH")} ตัว`} strong />
          <MetaCell label="จำนวนรายการ" value={`${order.items.length} รายการ`} />
        </div>

        {/* ม็อกอัพที่ลูกค้าอนุมัติล่าสุด — อ้างอิงเวอร์ชันชัดเจน กันพิมพ์ผิดเวอร์ชัน */}
        {approvedDesign && (
          <div className="mt-3 rounded border border-slate-300 px-4 py-2.5">
            <p className="text-[10.5px] text-slate-500">
              ม็อกอัพอนุมัติล่าสุด — เวอร์ชัน {approvedDesign.versionNumber}
              {approvedDesign.approvedAt
                ? ` (อนุมัติ ${formatDocDate(approvedDesign.approvedAt)})`
                : ""}
            </p>
            {approvedDesignImages.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {approvedDesignImages.map((image, index) => (
                  <figure key={`${image.fileUrl}-${index}`} className="max-w-[32%]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.previewUrl!}
                      alt={`ม็อกอัพ v${approvedDesign.versionNumber}${image.positionLabel ? ` ด้าน${image.positionLabel}` : ""}`}
                      className="max-h-44 rounded border border-slate-200 object-contain"
                    />
                    {image.positionLabel ? (
                      <figcaption className="mt-0.5 text-center text-[10.5px] font-semibold text-slate-600">
                        {image.positionLabel}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[12px] text-slate-600">
                ไฟล์ม็อกอัพไม่ใช่รูปภาพ (เปิดดูในระบบ: สแกน QR → แท็บม็อกอัพ)
              </p>
            )}
          </div>
        )}

        {/* รายการงาน */}
        {order.items.map((item, itemIdx) => (
          <div key={item.id} className="mt-4 rounded border border-slate-400">
            <div className="border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-[13px] font-bold">
              รายการ {itemIdx + 1}
              {item.description ? ` — ${item.description}` : ""}
              <span className="float-right font-semibold">{item.totalQuantity} ตัว</span>
            </div>

            <div className="space-y-3 px-3 py-2.5">
              {/* สินค้า + ตารางไซซ์ */}
              {item.products.map((p) => (
                <div key={p.id}>
                  <p className="text-[12.5px] font-semibold">
                    {PRODUCT_TYPES[p.productType] ?? p.productType} — {p.description}
                    <span className="ml-2 font-normal text-slate-600">
                      [{ITEM_SOURCES[p.itemSource ?? ""] ?? "ไม่ระบุแหล่ง"}
                      {p.processingType ? ` · ${PROCESSING_TYPES[p.processingType] ?? p.processingType}` : ""}]
                    </span>
                  </p>
                  <p className="text-[11.5px] text-slate-600">
                    {[
                      p.fabricType && `ผ้า: ${FABRIC_TYPES[p.fabricType] ?? p.fabricType}`,
                      p.fabricWeight && `น้ำหนัก: ${p.fabricWeight}`,
                      p.fabricColor && `สีผ้า: ${p.fabricColor}`,
                      p.pattern?.name && `แพทเทิร์น: ${p.pattern.name}`,
                      p.collarType && `คอ: ${p.collarType}`,
                      p.sleeveType && `แขน: ${p.sleeveType}`,
                      p.packagingOption?.name && `แพ็ค: ${p.packagingOption.name}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  {p.itemSource === "CUSTOMER_PROVIDED" && (
                    <p className="text-[11.5px] font-medium text-red-700">
                      ⚠ เสื้อของลูกค้า — ตรวจรับ{p.receivedInspected ? "แล้ว" : ": ยังไม่ตรวจ"}
                      {p.garmentCondition ? ` · สภาพ: ${p.garmentCondition}` : ""}
                      {p.receiveNote ? ` · ${p.receiveNote}` : ""}
                    </p>
                  )}
                  <table className="mt-1 w-auto border-collapse text-[12px] tabular-nums">
                    <tbody>
                      <tr>
                        {p.variants.map((v) => (
                          <td key={v.id} className="border border-slate-300 px-2.5 py-0.5 text-center">
                            <span className="font-semibold">{v.size}</span>
                            {v.color ? <span className="text-slate-500"> {v.color}</span> : null}
                            <span className="ml-1.5 font-bold">× {v.quantity}</span>
                          </td>
                        ))}
                        <td className="border border-slate-400 bg-slate-50 px-2.5 py-0.5 text-center font-bold">
                          รวม {p.totalQuantity}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              {/* ลายพิมพ์ — มีภาพแบบให้ดูตรงตำแหน่ง กันพิมพ์ผิดลาย/ผิดเวอร์ชัน */}
              {item.prints.length > 0 && (
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-y border-slate-400 text-left">
                      <th className="w-16 py-1 pr-2 font-semibold">ภาพแบบ</th>
                      <th className="py-1 pr-2 font-semibold">ตำแหน่ง</th>
                      <th className="py-1 pr-2 font-semibold">วิธีพิมพ์</th>
                      <th className="py-1 pr-2 font-semibold">ขนาด</th>
                      <th className="py-1 pr-2 font-semibold">จำนวนสี</th>
                      <th className="py-1 font-semibold">หมายเหตุแบบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.prints.map((pr) => (
                      <tr key={pr.id} className="border-b border-slate-200 align-top">
                        <td className="py-1 pr-2">
                          {isImageUrl(pr.designImageUrl) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pr.designImageUrl!}
                              alt="ลายพิมพ์"
                              className="h-14 w-14 rounded border border-slate-300 object-contain"
                            />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-1 pr-2 font-semibold">
                          {PRINT_POSITIONS[pr.position] ?? pr.position}
                        </td>
                        <td className="py-1 pr-2">{PRINT_TYPES[pr.printType] ?? pr.printType}</td>
                        <td className="py-1 pr-2">
                          {pr.width && pr.height
                            ? `${pr.width} × ${pr.height} ซม.`
                            : pr.printSize ?? "-"}
                        </td>
                        <td className="py-1 pr-2">{pr.colorCount ?? "-"}</td>
                        <td className="py-1">{pr.designNote ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Add-ons */}
              {item.addons.length > 0 && (
                <p className="text-[12px]">
                  <span className="font-semibold">ส่วนเสริม: </span>
                  {item.addons
                    .map((a) => `${a.name}${a.quantity ? ` ×${a.quantity}` : ""}`)
                    .join(" · ")}
                </p>
              )}

              {item.notes && (
                <p className="text-[12px] text-slate-700">
                  <span className="font-semibold">หมายเหตุรายการ: </span>
                  {item.notes}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* ขั้นตอนผลิต — กระดาษเป็นหลัก: ทำในโรงงาน (ตามลำดับ) แยกจากของจากร้านนอก (เดินคู่ขนาน ระบบตามให้) */}
        <div className="mt-4">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-bold">ขั้นตอนผลิต — ทำในโรงงาน (ตามลำดับ)</p>
            <p className="flex items-center gap-1 text-[10.5px] text-slate-600">
              <MonitorSmartphone className="h-3 w-3" aria-hidden="true" /> แถวที่มีเครื่องหมายนี้ = ยอดและเวลาอยู่ในระบบ ไม่ต้องเขียนบนใบ
            </p>
          </div>
          <table className="w-full border-collapse text-[12px]">
            <StepsHead />
            <tbody>
              {inhouseSteps.length > 0 ? (
                inhouseSteps.map((step, idx) => <StepRow key={step.id} step={step} index={idx + 1} />)
              ) : (
                <tr className="border-b border-slate-200">
                  <td colSpan={6} className="py-3 text-center text-slate-400">
                    ยังไม่มีขั้นผลิตในใบนี้
                  </td>
                </tr>
              )}
              <tr className="border-b border-slate-200 align-top bg-slate-100">
                <td className="py-2 pr-2 text-center text-slate-500">{inhouseSteps.length + 1}</td>
                <td className="py-2 pr-2">
                  <p className="font-semibold leading-tight">ตรวจ QC</p>
                  {outsourceSteps.length > 0 ? <p className="text-[10.5px] text-slate-600">เริ่มได้เมื่อของจากร้านนอกกลับครบ</p> : null}
                  <p className="mt-1 inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold">
                    <MonitorSmartphone className="h-3 w-3" aria-hidden="true" /> {RECORD_MODE_LABEL.screen}
                  </p>
                </td>
                <td className="py-2 pr-2">
                  <TickBoxes stepType="FINAL_QC" />
                </td>
                <td colSpan={3} className="py-2 text-[11.5px] text-slate-600">
                  ยอดดี/เสียบันทึกในระบบ — ส่งเข้า QC แล้วขั้นที่จดบนกระดาษถือว่าผ่าน
                </td>
              </tr>
            </tbody>
          </table>
          {outsourceSteps.length > 0 && (
            <>
              <p className="mb-1 mt-3 text-[13px] font-bold">ของจากร้านนอก — เดินคู่ขนาน ระบบตามให้</p>
              <table className="w-full border-collapse text-[12px]">
                <StepsHead />
                <tbody>
                  {outsourceSteps.map((step, idx) => (
                    <StepRow key={step.id} step={step} index={inhouseSteps.length + 1 + idx + 1} />
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {order.notes && <NotesBlock title="หมายเหตุออเดอร์">{order.notes}</NotesBlock>}

        <div className="mt-4 rounded border border-dashed border-slate-400 px-3 py-2 text-[11px] text-slate-400">
          บันทึกหน้างาน
          <div className="h-14" />
        </div>

        {/* ท้ายใบ: วันพิมพ์ + ม็อกอัพเวอร์ชัน — กระดาษเก่าตอนแบบเปลี่ยนจับได้ · QR พกเวอร์ชันนี้ไปด้วย */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-300 pt-2 text-[10.5px] text-slate-500">
          <span className="font-semibold text-slate-700">พิมพ์ {printedAt}</span>
          <span>{approvedDesign ? `ม็อกอัพ v${approvedDesign.versionNumber}` : "ยังไม่มีม็อกอัพอนุมัติ"}</span>
          {targetProduction ? <span>QR ผูกเวอร์ชันนี้ — สแกนใบเก่าระบบจะเตือน</span> : null}
        </div>
      </PrintPage>
    </div>
  );
}
