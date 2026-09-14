"use client";

import { ArrowRight, FileText, History } from "lucide-react";
import { c, CardHead, Empty } from "@/components/orders/orders-ui";
import { QueryError } from "@/components/ui/query-error";
import { trpc } from "@/lib/trpc";
import { formatBaht, formatDateTime } from "@/lib/utils";

/* ============================================================
   การ์ด "ใบแก้ไขรายการ (CO)" ใต้รายการสินค้า — ต้นแบบ tabItems() ส่วนล่างของคอลัมน์ซ้าย (รื้อ 2026-09-15)

   ใบแก้ไขที่ออกหลังออเดอร์อนุมัติ: เลขใบ · เหตุผล/สรุป · ยอดเก่า→ใหม่ + ส่วนต่าง · ป้ายเตือนออกใบกำกับ/มัดจำแล้ว · คน/เวลา
   query order.changeOrders (ชื่อคนมาจาก server) · โชว์ทุกใบไม่ตัด
   ⑦: server ส่งยอดเป็น null ให้ role ที่ไม่เห็นเงิน — ไม่มีคอลัมน์ยอดใน DOM เลย
   ============================================================ */

interface OrderChangeOrdersProps {
  orderId: string;
}

export function OrderChangeOrders({ orderId }: OrderChangeOrdersProps) {
  const { data, isLoading, isError, refetch } = trpc.order.changeOrders.useQuery({ id: orderId });
  const list = data ?? [];
  const hasMoney = list.some((co) => co.oldTotal != null && co.newTotal != null);

  return (
    <section className={c("card")} aria-labelledby="items-co-h">
      <CardHead
        icon={History}
        title={<span id="items-co-h">ใบแก้ไขรายการ (CO)</span>}
        right={list.length > 0 ? <span className={c("chip gray")}>{list.length.toLocaleString("th-TH")} ใบ</span> : undefined}
      />
      {isError ? (
        <div className={c("cb")}>
          <QueryError message="โหลดใบแก้ไขรายการไม่สำเร็จ" onRetry={() => void refetch()} />
        </div>
      ) : isLoading ? (
        <div className={c("cb")} role="status">
          <span className={c("sk skrow")} aria-hidden="true" />
          <span className={c("sr")}>กำลังโหลดใบแก้ไข</span>
        </div>
      ) : list.length === 0 ? (
        <Empty icon={FileText} title="ยังไม่มีใบแก้ไข" hint="แก้รายการหลังยืนยันแล้วระบบจะออกใบแก้ไขให้เอง" />
      ) : (
        <div className={c("cb")}>
          <div className={c("tblw")}>
            <table className={c("tbl")}>
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>เหตุผล</th>
                  {hasMoney && <th className={c("num")}>ยอดเดิม → ใหม่</th>}
                  <th>ผู้แก้</th>
                </tr>
              </thead>
              <tbody>
                {list.map((co) => {
                  const rowMoney = co.oldTotal != null && co.newTotal != null;
                  const diff = rowMoney ? (co.newTotal ?? 0) - (co.oldTotal ?? 0) : 0;
                  return (
                    <tr key={co.id}>
                      <td style={{ verticalAlign: "top" }}>
                        <span className={c("mono")} style={{ display: "block", fontWeight: 500, whiteSpace: "nowrap" }}>
                          {co.changeNumber}
                        </span>
                        {co.invoicedWarning ? (
                          <span className={c("chip warn")} style={{ marginTop: 4 }}>
                            ออกใบกำกับ/มัดจำแล้ว
                          </span>
                        ) : null}
                      </td>
                      <td style={{ verticalAlign: "top", overflowWrap: "anywhere" }}>
                        {co.reason}
                        {co.summary ? (
                          <small style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)" }}>{co.summary}</small>
                        ) : null}
                      </td>
                      {hasMoney && (
                        <td className={c("num mono")} style={{ verticalAlign: "top" }}>
                          {rowMoney ? (
                            <>
                              <span style={{ color: "var(--ink-4)", textDecoration: "line-through" }}>
                                {formatBaht(co.oldTotal ?? 0)}
                              </span>{" "}
                              <ArrowRight aria-label="เป็น" style={{ width: 12, height: 12, verticalAlign: -1 }} />{" "}
                              <b>{formatBaht(co.newTotal ?? 0)}</b>
                              {diff !== 0 ? (
                                <small style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)" }}>
                                  {diff > 0 ? "+" : "−"}
                                  {formatBaht(Math.abs(diff))}
                                </small>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td style={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {co.createdByName}
                        <small style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)" }}>
                          {formatDateTime(co.createdAt)}
                        </small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
