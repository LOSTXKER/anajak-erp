"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { FileText, ArrowRight, AlertTriangle } from "lucide-react";
import { QueryError } from "@/components/ui/query-error";

// ประวัติใบแก้ไขออเดอร์ (ก้อน 6 ชิ้น 3) — โชว์ใบแก้ไข (CO) ที่ออกหลังออเดอร์อนุมัติ:
// เลขใบ · เหตุผล · ยอดเก่า→ใหม่ + ส่วนต่าง · ป้ายเตือนถ้าออกใบกำกับ/มัดจำไปแล้ว · คน/เวลา
// query order.changeOrders (resolve ชื่อคนฝั่ง server) · แสดงทุกรายการโดยไม่ตัดเหลือ 5 รายการ

interface OrderChangeOrdersProps {
  orderId: string;
}

export function OrderChangeOrders({ orderId }: OrderChangeOrdersProps) {
  const { data, isLoading, isError, refetch } = trpc.order.changeOrders.useQuery({ id: orderId });

  if (isError) {
    return (
      <Card>
        <QueryError
          message="โหลดประวัติใบแก้ไขออเดอร์ไม่สำเร็จ"
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          ใบแก้ไขออเดอร์
          {!!data?.length && (
            <Badge variant="secondary" className="ml-0.5">
              {data.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">กำลังโหลดประวัติ...</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">ยังไม่มีใบแก้ไขออเดอร์</p>
        ) : (
        <div className="space-y-3">
          {data.map((co) => {
            // ⑦: server ส่งยอดเป็น null ให้ role ที่ไม่เห็นเงิน — ซ่อนแถวยอดทั้งบรรทัด
            const showMoney = co.oldTotal != null && co.newTotal != null;
            const diff = showMoney ? (co.newTotal ?? 0) - (co.oldTotal ?? 0) : 0;
            return (
              <div
                key={co.id}
                className="rounded-lg border border-slate-200/70 p-3 dark:border-slate-700/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                    {co.changeNumber}
                  </span>
                  {co.invoicedWarning && (
                    <Badge variant="warning" size="sm" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      ออกใบกำกับ/มัดจำแล้ว
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-900 dark:text-white">{co.reason}</p>
                {co.summary && <p className="text-xs text-slate-400">{co.summary}</p>}

                {showMoney && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="text-slate-400 line-through">
                      {formatCurrency(co.oldTotal ?? 0)}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="font-medium text-slate-900 dark:text-white">
                      {formatCurrency(co.newTotal ?? 0)}
                    </span>
                    {diff !== 0 && (
                      <span className="text-slate-500 dark:text-slate-400">
                        ({diff > 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(diff))})
                      </span>
                    )}
                  </div>
                )}

                <p className="mt-1 text-xs text-slate-400">
                  {co.createdByName} &mdash; {formatDateTime(co.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
