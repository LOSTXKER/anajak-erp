"use client";

import { CheckCircle2 } from "lucide-react";
import { MockupGallery } from "@/components/mockup/mockup-gallery";
import { Fact, FactList } from "@/components/ui/fact";
import { Metric } from "@/components/ui/metric";
import { TABLE_HEAD_SURFACE } from "@/components/ui/tokens";
import { BigMockup } from "../_kit/pieces";
import type { LeanOrder } from "../work-order-lean/_data";

export function ItemsPanel({ order }: { order: LeanOrder }) {
  const imageVersion = order.mockupVersion ?? order.mockups.at(-1)?.version;

  return (
    <section className="@container min-w-0" aria-label="สินค้าและแบบ">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-strong">สินค้าและแบบ</h2>
        <span className="text-sm text-secondary">{order.items.length} รายการ</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {order.mockupVersion !== null ? (
          <>
            <span className="inline-flex items-center gap-1.5 font-medium text-strong">
              <CheckCircle2 className="size-4 text-green-700 dark:text-green-400" aria-hidden="true" />
              แบบอนุมัติ v{order.mockupVersion}
            </span>
            <span className="text-secondary">โดย {order.mockupApprovedBy}</span>
          </>
        ) : (
          <span className="text-secondary">ยังไม่มีแบบอนุมัติ</span>
        )}
      </div>

      {order.items.length > 0 ? (
        <ul className="mt-5 divide-y divide-divider">
          {order.items.map((item, index) => (
            <li
              key={`${item.product}-${index}`}
              className="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] items-start gap-x-4 gap-y-4 py-6 first:pt-0 last:pb-0 @lg:grid-cols-[10rem_minmax(0,1fr)] @lg:gap-x-6"
            >
              <div className="w-24 @lg:row-span-2 @lg:w-40">
                {item.mockup && imageVersion !== undefined ? (
                  <MockupGallery
                    version={{ fileUrl: item.mockup }}
                    versionNumber={imageVersion}
                    className="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1"
                  />
                ) : item.mockup ? (
                  <BigMockup src={item.mockup} alt={`แบบ ${item.product}`} className="aspect-square w-full [&_img]:object-contain" />
                ) : (
                  <p className="flex aspect-square items-center justify-center text-center text-xs text-muted">
                    ยังไม่มีม็อกอัพ
                  </p>
                )}
              </div>

              <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <h3 className="min-w-0 text-base font-semibold text-strong">{item.product}</h3>
                <Metric value={item.qty} unit="ตัว" size="sm" className="shrink-0" />
              </div>

              <div className="col-span-2 min-w-0 space-y-5 @lg:col-span-1 @lg:col-start-2">
                <table className="w-full table-fixed text-sm">
                  <caption className="sr-only">จำนวนต่อไซซ์และสีของ {item.product}</caption>
                  <thead className={TABLE_HEAD_SURFACE}>
                    <tr>
                      <th scope="col" className="w-20 pb-2 text-left text-xs font-medium">ไซซ์ / สี</th>
                      {item.sizes.map((size) => (
                        <th key={size.size} scope="col" className="px-1 pb-2 text-center text-xs font-medium">{size.size}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row" className="pt-2 text-left font-normal text-secondary">จำนวน</th>
                      {item.sizes.map((size) => (
                        <td key={size.size} className="px-1 pt-2 text-center font-medium tabular-nums text-strong">{size.qty}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>

                {item.prints.length > 0 ? (
                  <table className="w-full text-sm">
                    <caption className="sr-only">ตำแหน่งและรายละเอียดงานของ {item.product}</caption>
                    <thead className={TABLE_HEAD_SURFACE}>
                      <tr>
                        <th scope="col" className="w-24 pb-2 text-left text-xs font-medium">ตำแหน่ง</th>
                        <th scope="col" className="w-20 pb-2 text-left text-xs font-medium">วิธีทำ</th>
                        <th scope="col" className="pb-2 text-left text-xs font-medium">รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.prints.map((print, printIndex) => (
                        <tr key={`${print.position}-${printIndex}`}>
                          <th scope="row" className="py-2 pr-3 text-left align-top font-medium text-strong">{print.position}</th>
                          <td className="py-2 pr-3 align-top text-secondary">{print.technique}</td>
                          <td className="py-2 align-top text-secondary">{print.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-secondary">ไม่มีตำแหน่งพิมพ์หรือปักในรายการนี้</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-sm text-secondary">ยังไม่มีรายการสินค้า</p>
      )}
    </section>
  );
}

export function DetailsPanel({ order }: { order: LeanOrder }) {
  const completedSteps = order.steps.filter((step) => step.state === "done");
  const priorityLabel = order.priority === "URGENT" ? "เร่งด่วน" : order.priority === "HIGH" ? "สำคัญ" : "ปกติ";

  return (
    <div className="@container min-w-0 space-y-7">
      <section aria-label="ข้อมูลใบ">
        <h2 className="text-base font-semibold text-strong">ข้อมูลใบ</h2>
        <FactList columns={1} className="mt-4 gap-y-5 @lg:grid-cols-2">
          <Fact label="สูตรขั้นงาน" value={order.routing} className="@lg:col-span-2" />
          <Fact label="เปิดใบ" value={order.openedOn} />
          <Fact label="ความสำคัญ" value={priorityLabel} />
          <Fact label="สถานะออเดอร์" value={order.status} />
          <Fact label="ที่มาของเสื้อ" value={order.garment} className="@lg:col-span-2" />
          <Fact label="หมายเหตุ" value={order.note ?? "ไม่มีหมายเหตุ"} className="@lg:col-span-2" />
        </FactList>
      </section>

      <section className="border-t border-divider pt-6" aria-label="ขั้นที่เสร็จแล้ว">
        <h2 className="text-base font-semibold text-strong">ขั้นที่เสร็จแล้ว</h2>
        {completedSteps.length > 0 ? (
          <ul className="mt-2 divide-y divide-divider">
            {completedSteps.map((step) => (
              <li key={step.id} className="grid gap-3 py-4 last:pb-0 @lg:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <p className="font-medium text-strong">{step.label}</p>
                  <p className="mt-1 text-sm text-secondary">{step.qtyDone} / {step.qtyTotal} ตัว</p>
                </div>
                <div className="space-y-1 @lg:text-right">
                  {step.owner ? <p className="text-sm text-secondary">{step.owner}</p> : null}
                  {step.completedAt ? <p className="text-xs text-muted">เสร็จ {step.completedAt}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-secondary">ยังไม่มีขั้นที่บันทึกเสร็จ</p>
        )}
      </section>

      <section className="border-t border-divider pt-6" aria-label="ประวัติแบบ">
        <h2 className="text-base font-semibold text-strong">ประวัติแบบ</h2>
        {order.mockups.length > 0 ? (
          <ul className="mt-2 divide-y divide-divider">
            {order.mockups.map((mockup) => (
              <li key={mockup.version} className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 py-4 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-strong">แบบ v{mockup.version}</span>
                  <span className="text-sm text-secondary">{mockup.approved ? "อนุมัติแล้ว" : "ฉบับก่อน"}</span>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-sm text-secondary">{mockup.by}</p>
                  <p className="text-xs text-muted">{mockup.on}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-secondary">ยังไม่มีประวัติแบบ</p>
        )}
      </section>
    </div>
  );
}
