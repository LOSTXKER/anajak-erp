"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { FileText, ArrowRight, ChevronDown, AlertTriangle } from "lucide-react";

// ประวัติใบแก้ไขออเดอร์ (ก้อน 6 ชิ้น 3) — โชว์ใบแก้ไข (CO) ที่ออกหลังออเดอร์อนุมัติ:
// เลขใบ · เหตุผล · ยอดเก่า→ใหม่ + ส่วนต่าง · ป้ายเตือนถ้าออกใบกำกับ/มัดจำไปแล้ว · คน/เวลา
// query order.changeOrders (resolve ชื่อคนฝั่ง server) · ว่าง = ไม่ render (เลียน OrderRevisions)

const SHOW_COUNT = 5;

interface OrderChangeOrdersProps {
  orderId: string;
}

export function OrderChangeOrders({ orderId }: OrderChangeOrdersProps) {
  const [showAll, setShowAll] = useState(false);
  const { data } = trpc.order.changeOrders.useQuery({ id: orderId });

  if (!data || data.length === 0) return null;

  const visible = showAll ? data : data.slice(0, SHOW_COUNT);
  const hiddenCount = data.length - SHOW_COUNT;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          ใบแก้ไขออเดอร์
          <Badge variant="secondary" className="ml-0.5">
            {data.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visible.map((co) => {
            const diff = co.newTotal - co.oldTotal;
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

                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-slate-400 line-through">
                    {formatCurrency(co.oldTotal)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatCurrency(co.newTotal)}
                  </span>
                  {diff !== 0 && (
                    <span className="text-slate-500 dark:text-slate-400">
                      ({diff > 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(diff))})
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  {co.createdByName} &mdash; {formatDateTime(co.createdAt)}
                </p>
              </div>
            );
          })}

          {!showAll && hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(true)}
              className="w-full gap-1 text-slate-500"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              ดูทั้งหมด ({data.length} รายการ)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
