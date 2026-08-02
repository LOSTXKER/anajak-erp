import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { Clock, ArrowRight } from "lucide-react";

// ประวัติการเปลี่ยนแปลง — อ่านรู้เรื่องสำหรับคนหน้างาน (เบสชี้ 2026-06-12):
// ป้ายชนิดเป็นไทย · แถวสถานะแปลจาก oldValue/newValue เป็นชื่อสถานะไทย ·
// ชื่อคนมาจาก server (changedByName) · โชว์ประวัติทั้งหมดโดยไม่พับซ่อน

const CHANGE_TYPE_LABELS: Record<string, string> = {
  STATUS: "สถานะ",
  ITEMS: "รายการ",
  FEES: "ค่าธรรมเนียม",
  DESIGN: "งานออกแบบ",
  QUOTATION: "ใบเสนอราคา",
  INFO: "ข้อมูลออเดอร์",
  CHANGE_ORDER: "ใบแก้ไข",
};

interface Revision {
  id: string;
  description: string;
  changedBy: string;
  changedByName?: string;
  changeType: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: Date | string;
}

interface OrderRevisionsProps {
  revisions: Revision[];
}

const statusLabel = (v: string | null | undefined) =>
  v ? ((INTERNAL_STATUS_LABELS as Record<string, string>)[v] ?? v) : null;

export function OrderRevisions({ revisions }: OrderRevisionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          ประวัติการเปลี่ยนแปลง
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!revisions || revisions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ยังไม่มีประวัติการเปลี่ยนแปลง
          </p>
        ) : (
        <div className="space-y-3">
          {revisions.map((rev) => {
            // แถวเปลี่ยนสถานะ: แปลจาก oldValue/newValue (enum) เป็นชื่อไทย —
            // description ใน DB เก่าเก็บข้อความอังกฤษดิบ ใช้เป็น fallback เท่านั้น
            const isStatusRow =
              rev.changeType === "STATUS" && rev.oldValue && rev.newValue;

            return (
              <div
                key={rev.id}
                className="flex gap-3 border-l-2 border-slate-200 pl-4 dark:border-slate-700"
              >
                <div className="min-w-0 flex-1">
                  {isStatusRow ? (
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-900 dark:text-white">
                      <span className="text-slate-500 dark:text-slate-400">
                        {statusLabel(rev.oldValue)}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="font-medium">{statusLabel(rev.newValue)}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-900 dark:text-white">
                      {rev.description}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    {rev.changedByName ?? rev.changedBy} &mdash;{" "}
                    {formatDateTime(rev.createdAt)}
                  </p>
                </div>
                {rev.changeType && (
                  <Badge variant="secondary" className="h-fit shrink-0">
                    {CHANGE_TYPE_LABELS[rev.changeType] ?? rev.changeType}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
