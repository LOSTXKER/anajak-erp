"use client";

import { trpc } from "@/lib/trpc";
import { Section } from "@/components/ui/section";
import { HomeChip, HomeIconTile } from "@/components/dashboard/home/home-card";
import { formatBaht, formatDateTime } from "@/lib/utils";
import { FileText, ArrowRight, AlertTriangle, History } from "lucide-react";
import { QueryError } from "@/components/ui/query-error";

// ประวัติใบแก้ไขออเดอร์ (ก้อน 6 ชิ้น 3) — โชว์ใบแก้ไข (CO) ที่ออกหลังออเดอร์อนุมัติ:
// เลขใบ · เหตุผล · ยอดเก่า→ใหม่ + ส่วนต่าง · ป้ายเตือนถ้าออกใบกำกับ/มัดจำไปแล้ว · คน/เวลา
// query order.changeOrders (resolve ชื่อคนฝั่ง server) · แสดงทุกรายการโดยไม่ตัดเหลือ 5 รายการ
// หน้าตาตามต้นแบบหน้าออเดอร์รอบ 2 (2026-09-15): การ์ดใต้รายการสินค้า · ว่าง = วงไอคอน + บอกว่าใบนี้เกิดเมื่อไร

interface OrderChangeOrdersProps {
  orderId: string;
}

const TITLE = (
  <span className="flex items-center gap-2.5">
    <HomeIconTile icon={History} />
    ใบแก้ไขรายการ (CO)
  </span>
);

export function OrderChangeOrders({ orderId }: OrderChangeOrdersProps) {
  const { data, isLoading, isError, refetch } = trpc.order.changeOrders.useQuery({ id: orderId });

  if (isError) {
    return (
      <Section title={TITLE}>
        <QueryError message="โหลดประวัติใบแก้ไขออเดอร์ไม่สำเร็จ" onRetry={() => void refetch()} />
      </Section>
    );
  }

  return (
    <Section title={TITLE} action={data?.length ? <HomeChip className="tabular-nums">{data.length} ใบ</HomeChip> : undefined}>
      {isLoading ? (
        <p className="text-sm text-muted">กำลังโหลดประวัติ...</p>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-4 text-center">
          <span
            aria-hidden="true"
            className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-muted"
          >
            <FileText className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-strong">ยังไม่มีใบแก้ไข</p>
          <p className="text-xs text-muted">แก้รายการหลังยืนยันออเดอร์แล้ว ระบบจะออกใบแก้ไขให้เอง</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((co) => {
            // ⑦: server ส่งยอดเป็น null ให้ role ที่ไม่เห็นเงิน — ซ่อนแถวยอดทั้งบรรทัด
            const showMoney = co.oldTotal != null && co.newTotal != null;
            const diff = showMoney ? (co.newTotal ?? 0) - (co.oldTotal ?? 0) : 0;
            return (
              <div key={co.id} className="rounded-lg border border-divider p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-strong">{co.changeNumber}</span>
                  {co.invoicedWarning && (
                    <HomeChip tone="warning">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      ออกใบกำกับ/มัดจำแล้ว
                    </HomeChip>
                  )}
                </div>

                <p className="mt-1 text-sm text-strong">{co.reason}</p>
                {co.summary && <p className="text-xs text-muted">{co.summary}</p>}

                {showMoney && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-sm tabular-nums">
                    <span className="text-muted line-through">{formatBaht(co.oldTotal ?? 0)}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                    <span className="font-medium text-strong">{formatBaht(co.newTotal ?? 0)}</span>
                    {diff !== 0 && (
                      <span className="text-muted">
                        ({diff > 0 ? "+" : "−"}
                        {formatBaht(Math.abs(diff))})
                      </span>
                    )}
                  </div>
                )}

                <p className="mt-1 text-xs text-muted">
                  {co.createdByName} &mdash; {formatDateTime(co.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
