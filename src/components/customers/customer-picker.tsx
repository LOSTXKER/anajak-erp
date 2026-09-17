"use client";

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CustomerCreateDialog } from "@/components/customers/customer-create-dialog";
import { CUSTOMER_TYPE_LABELS } from "@/components/customers/customer-type";
import { UserPlus, Search } from "lucide-react";
import { QueryError } from "@/components/ui/query-error";

import { cn } from "@/lib/utils";

// ตัวเลือกลูกค้ามาตรฐาน: ค้นหาผ่าน server + เพิ่มลูกค้าใหม่ได้จากที่นี่ตรงๆ
// หลักคิด "โปรไฟล์โตตามงาน" — ลูกค้าแชทใหม่เริ่มได้ด้วยชื่ออย่างเดียว ข้อมูลอื่นเติมทีหลัง
// ปุ่ม "ใหม่" เปิดฟอร์มเพิ่มลูกค้าชุดเดียวกับหน้าลูกค้า (CustomerCreateDialog) — เบสสั่ง
// 2026-09-18 "ขอใช้ฟอร์มเดียวกันทั้งเว็บ" · เดิมที่นี่มีฟอร์มย่อ 4 ช่องของตัวเอง
// ลูกค้าที่เพิ่มจากหน้าเปิดงานจึงไม่มีที่อยู่/เลขภาษี แล้วไปติดตอนออกใบกำกับ
// (กันสร้างซ้ำจากชื่อ/เบอร์/LINE ย้ายไปอยู่ในกล่องนั้นแล้ว ทุกทางเข้าได้เหมือนกัน)

export type PickerCustomer = RouterOutput["customer"]["list"]["customers"][number];

interface CustomerPickerProps {
  value: string;
  onChange: (customerId: string, customer: PickerCustomer | null) => void;
  /** ปักลูกค้าเดิมไว้แม้ไม่อยู่ใน 50 ผลลัพธ์ล่าสุด (สำคัญในโหมดแก้ออเดอร์) */
  initialSelected?: PickerCustomer | null;
  disabled?: boolean;
  required?: boolean;
  /** ช่องเลือกหลักไม่ผ่าน validation — วาด/ประกาศที่ control จริง ไม่ใช่แค่ summary */
  invalid?: boolean;
  /** ให้ฟอร์มโฟกัสกลับมาที่ช่องนี้ได้เมื่อตรวจไม่ผ่าน */
  id?: string;
  labelledBy?: string;
  /** โฟกัสช่องค้นหาทันทีที่เปิดหน้า — เฉพาะจอ ≥sm (มือถือคีย์บอร์ดจะเด้งบังฟอร์ม)
   *  ใช้ที่หน้าเปิดงาน: "เปิดงานได้ในไม่กี่วินาทีระหว่างถือแชท" ต้องพร้อมพิมพ์ทันที */
  autoFocusSearch?: boolean;
  /** จัดช่องค้นหาและตัวเลือกไว้แถวเดียวบนจอกว้าง โดยคงค่าเริ่มต้นของหน้าที่ใช้ร่วมกัน */
  layout?: "stacked" | "inline";
}

export function CustomerPicker({
  value,
  onChange,
  initialSelected = null,
  disabled = false,
  required,
  invalid = false,
  labelledBy,
  id,
  layout = "stacked",
  autoFocusSearch = false,
}: CustomerPickerProps) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // โฟกัสหลัง mount เฉพาะจอ ≥sm — ไม่ใช้ attribute autoFocus เพราะเลือก breakpoint ไม่ได้
  useEffect(() => {
    if (!autoFocusSearch || disabled) return;
    if (window.matchMedia("(min-width: 640px)").matches) searchRef.current?.focus();
  }, [autoFocusSearch, disabled]);
  const [showCreate, setShowCreate] = useState(false);
  // ลูกค้าที่เลือกอยู่ — ปักไว้ใน dropdown แม้ผลค้นหาปัจจุบันไม่มีรายนี้
  const [selected, setSelected] = useState<PickerCustomer | null>(initialSelected);

  const { data, isLoading, isError, refetch } = trpc.customer.list.useQuery(
    {
      search: search || undefined,
      limit: 50,
    },
    { enabled: !disabled },
  );

  const list = data?.customers ?? [];
  const options =
    selected && !list.some((c) => c.id === selected.id) ? [selected, ...list] : list;

  function pick(customer: PickerCustomer | null) {
    setSelected(customer);
    onChange(customer?.id ?? "", customer);
  }

  return (
    <div
      className={cn(
        layout === "inline"
          ? "grid gap-2 lg:grid-cols-2"
          : "space-y-1.5"
      )}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <Input
          ref={searchRef}
          aria-label="ค้นหาลูกค้า"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
          // กัน Enter ไป submit ฟอร์มใหญ่ที่ครอบอยู่ (เช่นสร้างใบเสนอทั้งใบโดยไม่ตั้งใจ)
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="ค้นหาชื่อ/บริษัท/เบอร์/LINE..."
          className="pl-8"
        />
      </div>
      {isError ? (
        <div className={cn(layout === "inline" && "lg:col-span-2")}>
          <QueryError
            message="โหลดรายชื่อลูกค้าไม่สำเร็จ"
            onRetry={() => void refetch()}
          />
        </div>
      ) : <div className="flex gap-1.5">
        <Select
          id={id}
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : "เลือกลูกค้า"}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={(e) => pick(options.find((c) => c.id === e.target.value) ?? null)}
          required={required}
          disabled={disabled}
          className="flex-1"
        >
          <option value="">
            {isLoading ? "กำลังโหลด..." : `เลือกลูกค้า${search ? ` (${list.length} ราย)` : ""}`}
          </option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.company ? `(${c.company})` : ""}
              {/* ใน <option> ใส่ป้ายไม่ได้ ต้องเป็นข้อความล้วน — อย่างน้อยใช้คำชุดเดียวกับที่อื่น
                  และคั่นด้วยจุดแบบบรรทัดรองทั้งเว็บ แทนวงเล็บเหลี่ยมที่ไม่มีที่อื่นใช้ */}
              {c.customerType === "CORPORATE" ? ` · ${CUSTOMER_TYPE_LABELS.CORPORATE}` : ""}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowCreate(true)}
          disabled={disabled}
          className="shrink-0 gap-1.5"
          title="เพิ่มลูกค้าใหม่จากชื่อแชทได้เลย"
        >
          <UserPlus />
          ใหม่
        </Button>
      </div>}

      {showCreate && (
        <CustomerCreateDialog
          onClose={() => setShowCreate(false)}
          // ผลลัพธ์ของ create (และรายเดิมที่คนกด "ใช้รายนี้") มาจาก customer router
          // ชุดเดียวกับ list — แคสต์ให้เป็นรายการใน dropdown เหมือนโค้ดเดิม
          onCreated={(customer) => pick(customer as PickerCustomer)}
        />
      )}
    </div>
  );
}
