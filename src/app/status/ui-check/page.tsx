"use client";

import { useState } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// หน้าตรวจชั่วคราว — ให้เบสกดทดสอบเมนูกับแจ้งเตือนของจริง แล้วลบทิ้ง
export default function UiCheckPage() {
  const [sort, setSort] = useState("createdAt:desc");
  const [status, setStatus] = useState("");
  const [long, setLong] = useState("b");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">หน้าทดสอบ</h1>

      <section className="card-surface space-y-4 rounded-2xl p-4">
        <p className="text-base font-semibold">เมนูของเรา — กดดูได้</p>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            shape="pill"
            aria-label="เรียงลำดับ"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 w-auto px-3 text-xs"
          >
            <option value="createdAt:desc">วันที่ (ล่าสุด)</option>
            <option value="createdAt:asc">วันที่ (เก่าสุด)</option>
            <option value="deadline:asc">กำหนดส่ง (ใกล้สุด)</option>
            <option value="totalAmount:desc">ยอดรวม (มาก→น้อย)</option>
          </NativeSelect>
          <span className="text-xs text-slate-500">ค่า: {sort}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="กรองสถานะ"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-56"
          >
            <option value="">ทุกสถานะ (ค่าว่าง)</option>
            <option value="DRAFT">ร่าง</option>
            <option value="IN_PRODUCTION">กำลังผลิต</option>
            <option value="DONE" disabled>
              เสร็จแล้ว (ปิดไว้)
            </option>
          </NativeSelect>
          <span className="text-xs text-slate-500">
            ค่า: {status === "" ? "(ว่าง)" : status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="รายการยาว"
            value={long}
            onChange={(e) => setLong(e.target.value)}
            className="w-72"
          >
            {Array.from({ length: 25 }, (_, i) => (
              <option key={i} value={String.fromCharCode(97 + (i % 26))}>
                ตัวเลือกที่ {i + 1} — ทดสอบรายการยาวว่าเลื่อนได้
              </option>
            ))}
          </NativeSelect>
          <span className="text-xs text-slate-500">ค่า: {long}</span>
        </div>

        <NativeSelect aria-label="ปิดใช้งาน" value="x" disabled className="w-56">
          <option value="x">ปิดใช้งานอยู่</option>
        </NativeSelect>
      </section>

      <section className="card-surface space-y-3 rounded-2xl p-4">
        <p className="text-base font-semibold">แจ้งเตือน — กดดูได้</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              toast.success("บันทึกออเดอร์แล้ว", {
                description: "ORD-2026-0184 · บริษัท สยามเท็กซ์",
              })
            }
          >
            สำเร็จ
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.warning("ยังไม่ได้ใส่กำหนดส่ง", {
                description: "ใส่ทีหลังได้ แต่งานจะไม่ขึ้นคิวผลิต",
              })
            }
          >
            เตือน
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.error("บันทึกไม่สำเร็จ", {
                description: "เครดิตลูกค้าเต็ม — ต้องเก็บเงินก้อนก่อน",
              })
            }
          >
            ผิดพลาด
          </Button>
        </div>
      </section>
    </div>
  );
}
