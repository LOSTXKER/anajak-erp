// ใบรายการแนบกล่อง (Packing List) — กระดาษแนบกล่องตอนส่งของ บอกว่ากล่องนี้มีอะไรบ้าง
// กติกาสำคัญ: "ไม่มีราคา/เงินใดๆ บนใบนี้" (เหมือน Job Ticket) · ออเดอร์ blind ship:
// ผู้ส่ง = ชื่อแบรนด์ลูกค้าเท่านั้น ห้ามมีชื่อ/ที่อยู่/โลโก้ Anajak บนใบเด็ดขาด
// (ลูกค้า reseller ส่งต่อให้ลูกค้าเขา — พลาดครั้งเดียวเสียลูกค้าขายซ้ำทั้งราย)
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { COMPANY_PROFILE_KEY, parseCompanyProfile } from "@/lib/company-profile";
import { SHIPPING_METHOD_LABELS } from "@/lib/status-config";
import {
  PrintPage,
  NotesBlock,
  SignatureRow,
  formatDocDate,
} from "@/components/print/print-document";
import { PrintActions } from "@/components/print/print-actions";

export default async function PrintPackingListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [delivery, companySetting] = await Promise.all([
    prisma.delivery.findUnique({
      where: { id },
      include: {
        lines: true,
        order: {
          select: {
            orderNumber: true,
            title: true,
            blindShip: true,
            blindShipSenderName: true,
            customer: { select: { name: true, company: true } },
          },
        },
      },
    }),
    prisma.setting.findUnique({ where: { key: COMPANY_PROFILE_KEY } }),
  ]);
  if (!delivery) notFound();

  const order = delivery.order;
  const company = parseCompanyProfile(companySetting?.value);

  // blind ship: ผู้ส่ง = ชื่อแบรนด์ลูกค้าเท่านั้น — ห้าม fallback เป็นข้อมูลบริษัทจาก company profile
  const blindSenderName =
    order.blindShipSenderName || order.customer.company || order.customer.name;

  const recipientAddress = [
    delivery.address,
    delivery.subDistrict,
    delivery.district,
    delivery.province,
    delivery.postalCode,
  ]
    .filter(Boolean)
    .join(" ");

  const hasLines = delivery.lines.length > 0;
  const totalQty = delivery.lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <div className="print-viewport">
      <PrintActions backHref={`/orders/${delivery.orderId}`} />

      <PrintPage>
        {/* หัวใบ — ไม่ใช้ DocHeader เพราะ DocHeader พิมพ์หัวบริษัทเสมอ (ผิดกติกา blind ship) */}
        <div className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div className="min-w-0">
            <p className="text-[20px] font-bold leading-tight">ใบรายการสินค้า</p>
            <p className="text-[12px] tracking-wide text-slate-600">PACKING LIST</p>
            <p className="mt-1 text-[12.5px] font-medium">{order.title}</p>
          </div>
          <div className="shrink-0 text-right">
            <table className="ml-auto text-[12.5px]">
              <tbody>
                <tr>
                  <td className="pr-3 text-right text-slate-600">ออเดอร์</td>
                  <td className="text-right font-semibold tabular-nums">{order.orderNumber}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-right text-slate-600">วันที่</td>
                  <td className="text-right tabular-nums">{formatDocDate(delivery.createdAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ผู้ส่ง / ผู้รับ */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded border border-slate-300 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              ผู้ส่ง / FROM
            </p>
            {order.blindShip ? (
              <p className="font-semibold">{blindSenderName}</p>
            ) : (
              <>
                <p className="font-semibold">
                  {company.name || "(ยังไม่ตั้งค่าข้อมูลกิจการ — Settings → ข้อมูลกิจการ)"}
                </p>
                {company.address && (
                  <p className="whitespace-pre-line text-[12px] text-slate-700">
                    {company.address}
                  </p>
                )}
                {company.phone && (
                  <p className="text-[12px] text-slate-700">โทร. {company.phone}</p>
                )}
              </>
            )}
          </div>
          <div className="rounded border border-slate-300 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              ผู้รับ / TO
            </p>
            <p className="font-semibold">{delivery.recipientName}</p>
            {recipientAddress && (
              <p className="whitespace-pre-line text-[12px] text-slate-700">{recipientAddress}</p>
            )}
            <p className="text-[12px] text-slate-700">โทร. {delivery.phone}</p>
          </div>
        </div>

        {/* วิธีส่ง + เลขพัสดุ */}
        <div className="mt-3 rounded border border-slate-300 px-4 py-2 text-[12.5px]">
          <span className="font-semibold">วิธีส่ง: </span>
          {SHIPPING_METHOD_LABELS[delivery.shippingMethod] ?? delivery.shippingMethod}
          {delivery.trackingNumber && (
            <>
              <span className="mx-2 text-slate-400">·</span>
              <span className="font-semibold">เลขพัสดุ: </span>
              <span className="tabular-nums">{delivery.trackingNumber}</span>
            </>
          )}
        </div>

        {/* รายการในกล่อง — ไม่มีราคา/เงินทุกชนิด */}
        <table className="mt-4 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-y border-slate-900 text-left">
              <th className="w-8 py-1.5 pr-2 text-center font-semibold">#</th>
              <th className="py-1.5 pr-2 font-semibold">รายการ</th>
              <th className="w-20 py-1.5 pr-2 text-center font-semibold">ไซส์</th>
              <th className="w-24 py-1.5 pr-2 text-center font-semibold">สี</th>
              <th className="w-20 py-1.5 text-right font-semibold">จำนวน</th>
            </tr>
          </thead>
          <tbody>
            {hasLines ? (
              delivery.lines.map((line, idx) => (
                <tr key={line.id} className="border-b border-slate-200 align-top">
                  <td className="py-1.5 pr-2 text-center text-slate-500">{idx + 1}</td>
                  <td className="whitespace-pre-line py-1.5 pr-2">{line.description}</td>
                  <td className="py-1.5 pr-2 text-center">{line.size || "-"}</td>
                  <td className="py-1.5 pr-2 text-center">{line.color || "-"}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {line.qty.toLocaleString("th-TH")}
                  </td>
                </tr>
              ))
            ) : (
              // ใบส่งเก่าที่ไม่มีรายการต่อกล่อง — อ้างใบสั่งงานแทน
              <tr className="border-b border-slate-200">
                <td className="py-1.5 pr-2 text-center text-slate-500">1</td>
                <td className="py-1.5 pr-2" colSpan={4}>
                  ตามใบสั่งงาน {order.orderNumber}
                </td>
              </tr>
            )}
          </tbody>
          {hasLines && (
            <tfoot>
              <tr className="border-t-2 border-slate-900 text-[13px] font-bold">
                <td colSpan={4} className="py-1.5 pr-2 text-right">
                  รวม
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {totalQty.toLocaleString("th-TH")} ตัว
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {delivery.notes && <NotesBlock title="หมายเหตุ">{delivery.notes}</NotesBlock>}

        <SignatureRow labels={["ผู้แพ็ค", "ผู้ตรวจ"]} />
      </PrintPage>
    </div>
  );
}
