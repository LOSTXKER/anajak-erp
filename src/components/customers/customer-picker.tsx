"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserPlus, Loader2, Search } from "lucide-react";
import { normalizePhone } from "@/lib/phone";
import { QueryError } from "@/components/ui/query-error";
import { Field } from "@/components/ui/field";

// ตัวเลือกลูกค้ามาตรฐาน: ค้นหาผ่าน server + เพิ่มลูกค้าด่วนจากชื่อแชท + กันสร้างซ้ำ
// หลักคิด "โปรไฟล์โตตามงาน" — ลูกค้าแชทใหม่เริ่มได้ด้วยชื่ออย่างเดียว ข้อมูลอื่นเติมทีหลัง

export type PickerCustomer = RouterOutput["customer"]["list"]["customers"][number];

interface CustomerPickerProps {
  value: string;
  onChange: (customerId: string, customer: PickerCustomer | null) => void;
  required?: boolean;
  labelledBy?: string;
}

export function CustomerPicker({ value, onChange, required, labelledBy }: CustomerPickerProps) {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  // ลูกค้าที่เลือกอยู่ — ปักไว้ใน dropdown แม้ผลค้นหาปัจจุบันไม่มีรายนี้
  const [selected, setSelected] = useState<PickerCustomer | null>(null);

  // Quick create form
  const [newName, setNewName] = useState("");
  const [newLineId, setNewLineId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");
  // ลูกค้าที่หน้าตาคล้ายของใหม่ — ให้เลือกใช้รายเดิมก่อนยืนยันสร้างซ้ำ
  const [similar, setSimilar] = useState<PickerCustomer[] | null>(null);
  // กันกดซ้ำระหว่างรอผลเช็คซ้ำ (isPending ของ mutation ยังไม่ติดช่วงนั้น)
  const [isChecking, setIsChecking] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading, isError, refetch } = trpc.customer.list.useQuery({
    search: search || undefined,
    limit: 50,
  });

  const createCustomer = trpc.customer.create.useMutation({
    onSuccess: (customer) => {
      utils.customer.list.invalidate();
      pick(customer as PickerCustomer);
      closeCreate();
      toast.success(`เพิ่มลูกค้า "${customer.name}" แล้ว — เติมที่อยู่/ข้อมูลอื่นทีหลังได้`);
    },
    onError: (err) => toast.error(err.message ?? "เพิ่มลูกค้าไม่สำเร็จ"),
  });

  const list = data?.customers ?? [];
  const options =
    selected && !list.some((c) => c.id === selected.id) ? [selected, ...list] : list;

  function pick(customer: PickerCustomer | null) {
    setSelected(customer);
    onChange(customer?.id ?? "", customer);
  }

  function closeCreate() {
    setShowCreate(false);
    setNewName("");
    setNewLineId("");
    setNewPhone("");
    setNewType("INDIVIDUAL");
    setSimilar(null);
    setIsChecking(false);
  }

  async function handleCreate() {
    if (isChecking) return;
    // เบอร์เก็บเป็นตัวเลขล้วน — กันซ้ำพลาดเพราะคนพิมพ์มี/ไม่มีขีด (helper เดียวกับ server)
    const cleanPhone = normalizePhone(newPhone);

    // กันซ้ำก่อนสร้าง: เบอร์/LINE ตรง หรือชื่อใกล้เคียง → เสนอใช้รายเดิม
    if (similar === null) {
      try {
        setIsChecking(true);
        const probes = [cleanPhone, newLineId, newName].filter(Boolean);
        const matches = new Map<string, PickerCustomer>();
        for (const probe of probes) {
          const result = await utils.customer.list.fetch({ search: probe, limit: 5 });
          for (const c of result.customers) matches.set(c.id, c);
        }
        if (matches.size > 0) {
          setSimilar([...matches.values()]);
          return; // รอผู้ใช้ตัดสิน — กดสร้างอีกครั้ง = ยืนยันสร้างใหม่
        }
      } catch {
        toast.error("ตรวจลูกค้าซ้ำไม่สำเร็จ — ลองอีกครั้ง");
        return;
      } finally {
        setIsChecking(false);
      }
    }
    createCustomer.mutate({
      name: newName,
      lineId: newLineId || undefined,
      phone: cleanPhone || undefined,
      customerType: newType,
      segment: "NEW",
      tags: [],
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          aria-label="ค้นหาลูกค้า"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          // กัน Enter ไป submit ฟอร์มใหญ่ที่ครอบอยู่ (เช่นสร้างใบเสนอทั้งใบโดยไม่ตั้งใจ)
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="ค้นหาชื่อ/บริษัท/เบอร์/LINE..."
          className="pl-8"
        />
      </div>
      {isError ? (
        <QueryError
          message="โหลดรายชื่อลูกค้าไม่สำเร็จ"
          onRetry={() => void refetch()}
        />
      ) : <div className="flex gap-1.5">
        <NativeSelect
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : "เลือกลูกค้า"}
          value={value}
          onChange={(e) => pick(options.find((c) => c.id === e.target.value) ?? null)}
          required={required}
          className="flex-1"
        >
          <option value="">
            {isLoading ? "กำลังโหลด..." : `-- เลือกลูกค้า${search ? ` (${list.length} ราย)` : ""} --`}
          </option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.company ? `(${c.company})` : ""}
              {c.customerType === "CORPORATE" ? " [นิติบุคคล]" : ""}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowCreate(true)}
          className="shrink-0 gap-1"
          title="เพิ่มลูกค้าใหม่จากชื่อแชทได้เลย"
        >
          <UserPlus className="h-4 w-4" />
          ใหม่
        </Button>
      </div>}

      <Dialog open={showCreate} onOpenChange={(open) => !open && closeCreate()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
            <DialogDescription>
              ใส่แค่ชื่อแชทก็เริ่มงานได้ — ที่อยู่/เบอร์/ข้อมูลใบกำกับ เติมทีหลังเมื่อลูกค้าบอก
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="ชื่อ (ชื่อแชทได้)" required>
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setSimilar(null);
                }}
                placeholder="เช่น คุณส้ม LINE"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="LINE ID">
                <Input
                  value={newLineId}
                  onChange={(e) => {
                    setNewLineId(e.target.value);
                    setSimilar(null);
                  }}
                  placeholder="@..."
                />
              </Field>
              <Field label="เบอร์ (ถ้ามี)">
                <Input
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(e.target.value);
                    setSimilar(null);
                  }}
                  placeholder="08xxxxxxxx"
                />
              </Field>
            </div>
            <Field label="ประเภทลูกค้า">
              <NativeSelect
                value={newType}
                onChange={(e) => setNewType(e.target.value as "INDIVIDUAL" | "CORPORATE")}
              >
                <option value="INDIVIDUAL">บุคคลธรรมดา</option>
                <option value="CORPORATE">นิติบุคคล (บริษัท/หจก. — เติมเลขภาษีทีหลังได้)</option>
              </NativeSelect>
            </Field>

            {similar && similar.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  เจอลูกค้าที่คล้ายกันในระบบ — ใช่คนเดียวกันไหม?
                </p>
                {similar.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      pick(c);
                      closeCreate();
                    }}
                    className="flex w-full items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-left text-sm shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <span>
                      {c.name}
                      {c.company && <span className="text-slate-500"> ({c.company})</span>}
                      <span className="ml-1.5 text-xs text-slate-400">
                        {[c.phone, c.lineId].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-xs text-blue-600 dark:text-blue-400">ใช้รายนี้</span>
                  </button>
                ))}
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ไม่ใช่คนเดียวกัน → กด &quot;เพิ่มลูกค้า&quot; อีกครั้งเพื่อยืนยันสร้างใหม่
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCreate}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || createCustomer.isPending || isChecking}
              className="gap-1.5"
            >
              {createCustomer.isPending || isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              เพิ่มลูกค้า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
