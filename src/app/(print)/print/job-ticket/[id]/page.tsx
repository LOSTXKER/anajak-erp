// Job Ticket — ใบสั่งงานหน้างาน (พิมพ์ติดแฟ้มงาน/ส่งเข้าไลน์ผลิต)
// กติกาสำคัญ: "ไม่มีราคา/เงินใดๆ บนใบนี้" — พนักงานหน้างานไม่เห็นเงิน (RBAC เดียวกับระบบ)
// QR สแกนเปิดหน้าออเดอร์ในระบบจากมือถือหน้าเครื่อง
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
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { isImageUrl } from "@/lib/utils";
import { PrintPage, NotesBlock, formatDocDate } from "@/components/print/print-document";
import { PrintActions } from "@/components/print/print-actions";

function MetaCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={strong ? "text-[14px] font-bold" : "text-[12.5px] font-medium"}>{value}</p>
    </div>
  );
}

export default async function PrintJobTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
            include: {
              assignedTo: { select: { name: true } },
              outsourceOrders: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { vendor: { select: { name: true } } },
              },
            },
          },
        },
      },
      // แบบที่ลูกค้าอนุมัติล่าสุด — ช่างหน้าเครื่องต้องเห็นลายจริง ไม่ใช่แค่ชื่อไฟล์
      designs: {
        where: { approvalStatus: "APPROVED" },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { versionNumber: true, fileUrl: true, thumbnailUrl: true, approvedAt: true },
      },
    },
  });
  if (!order) notFound();

  const approvedDesign = order.designs[0] ?? null;
  const approvedDesignImage = approvedDesign
    ? [approvedDesign.thumbnailUrl, approvedDesign.fileUrl].find(isImageUrl) ?? null
    : null;

  // UX8: QR ชี้หน้าใบผลิต (จอช่าง /production/<id>) — สแกนจากแฟ้มหน้าเครื่องตกจอทำงานเลย ไม่ต้องผ่านหน้าออเดอร์
  // ยังไม่มีใบผลิต (ยังไม่เข้าคิวผลิต) → fallback หน้าออเดอร์ · ต้องเป็น URL เต็ม (ตั้ง NEXT_PUBLIC_APP_URL ตอน deploy)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const productionId = order.productions[0]?.id;
  const qrTarget = productionId
    ? `${baseUrl}/production/${productionId}`
    : `${baseUrl}/orders/${order.id}`;
  const qrSvg = await QRCode.toString(qrTarget, {
    type: "svg",
    margin: 0,
    width: 92,
  });

  const totalQty = order.items.reduce((s, it) => s + it.totalQuantity, 0);
  const steps = order.productions.flatMap((p) => p.steps);
  const isUrgent = order.priority === "URGENT" || order.priority === "HIGH";

  return (
    <div className="print-viewport">
      <PrintActions backHref={`/orders/${order.id}`} />

      <PrintPage>
        {/* หัวใบงาน */}
        <div className="flex items-start justify-between gap-4 border-b-4 border-slate-900 pb-3">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-slate-500">
              ใบสั่งงาน / JOB TICKET
            </p>
            <p className="text-[26px] font-bold leading-tight tabular-nums">{order.orderNumber}</p>
            <p className="text-[13px] font-medium">{order.title}</p>
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
              <p className="mt-0.5 text-[9.5px] text-slate-500">สแกนเปิดออเดอร์</p>
            </div>
          </div>
        </div>

        {/* blind ship — ใบนี้เดินทางกับกองเสื้อถึงโต๊ะแพ็คแต่ไม่เข้ากล่อง จึงใส่คำเตือนได้
            (query ใช้ include → blindShip/blindShipSenderName เป็น scalar มาครบอยู่แล้ว) */}
        {order.blindShip && (
          <div className="mt-3 rounded border-4 border-red-600 bg-red-50 px-4 py-2.5">
            <p className="text-[16px] font-bold leading-snug text-red-700">
              🚫 BLIND SHIP — ห้ามใส่เอกสาร/ชื่อ Anajak ในกล่อง
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

        {/* แบบที่ลูกค้าอนุมัติล่าสุด — อ้างอิงเวอร์ชันชัดเจน กันพิมพ์ผิดเวอร์ชัน */}
        {approvedDesign && (
          <div className="mt-3 rounded border border-slate-300 px-4 py-2.5">
            <p className="text-[10.5px] uppercase tracking-wide text-slate-500">
              แบบอนุมัติล่าสุด — เวอร์ชัน {approvedDesign.versionNumber}
              {approvedDesign.approvedAt
                ? ` (อนุมัติ ${formatDocDate(approvedDesign.approvedAt)})`
                : ""}
            </p>
            {approvedDesignImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={approvedDesignImage}
                alt={`แบบอนุมัติ v${approvedDesign.versionNumber}`}
                className="mt-1.5 max-h-44 rounded border border-slate-200 object-contain"
              />
            ) : (
              <p className="mt-1 text-[12px] text-slate-600">
                ไฟล์แบบไม่ใช่รูปภาพ (เปิดดูในระบบ: สแกน QR → ส่วนงานออกแบบ)
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

        {/* ขั้นตอนผลิต — checklist ให้ติ๊ก/เซ็นหน้างาน */}
        <div className="mt-4">
          <p className="mb-1 text-[13px] font-bold">ขั้นตอนผลิต</p>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-slate-400 text-left">
                <th className="w-8 py-1 pr-2 text-center font-semibold">#</th>
                <th className="py-1 pr-2 font-semibold">ขั้นตอน</th>
                <th className="w-32 py-1 pr-2 font-semibold">ผู้รับผิดชอบ</th>
                <th className="w-28 py-1 pr-2 font-semibold">เสร็จวันที่</th>
                <th className="w-24 py-1 font-semibold">ลงชื่อ</th>
              </tr>
            </thead>
            <tbody>
              {(steps.length > 0 ? steps : Array.from({ length: 4 }, () => null)).map(
                (step, idx) => (
                  <tr key={step?.id ?? idx} className="border-b border-slate-200">
                    <td className="py-2 pr-2 text-center text-slate-500">{idx + 1}</td>
                    <td className="py-2 pr-2">
                      {step
                        ? `${STEP_TYPE_LABELS[step.stepType] ?? step.stepType}${step.customStepName ? ` — ${step.customStepName}` : ""}${step.outsourceOrders[0] ? ` (outsource: ${step.outsourceOrders[0].vendor.name})` : ""}`
                        : " "}
                    </td>
                    <td className="py-2 pr-2">{step?.assignedTo?.name ?? ""}</td>
                    <td className="py-2 pr-2 text-slate-300">____ / ____ / ____</td>
                    <td className="py-2 text-slate-300">______________</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {order.notes && <NotesBlock title="หมายเหตุออเดอร์">{order.notes}</NotesBlock>}

        <div className="mt-4 rounded border border-dashed border-slate-400 px-3 py-2 text-[11px] text-slate-400">
          บันทึกหน้างาน
          <div className="h-14" />
        </div>
      </PrintPage>
    </div>
  );
}
