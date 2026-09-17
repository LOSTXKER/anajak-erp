"use client";

import { useState } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { CustomerFormFields } from "@/components/customers/customer-form-fields";
import {
  buildCustomerCreatePayload,
  customerDuplicateProbes,
  emptyCustomerForm,
  validateCustomerEditForm,
  type CustomerEditForm,
} from "@/lib/customer-form";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { TINT } from "@/components/ui/tokens";

/* เพิ่มลูกค้า = กล่องเด้ง (ต้นแบบที่เบสเคาะ 2026-09-16 · data-act="xdlg" d="customer")
   เดิมฟอร์มแทรกกลางหน้าแล้วดันตารางลงทั้งจอ — คนกดปุ่มเพิ่มแล้วรายการที่กำลังดูหายไป

   ช่องกรอกยกฟอร์มชุดเดิมมาทั้งก้อน (CustomerFormFields + validateCustomerEditForm +
   Alert ของ server + กัน SALES ตั้งวงเงิน) ต้นแบบมี 6 ช่องสมมติ — ห้ามลดช่องตามต้นแบบ
   โครงกล่อง/ระยะ/ฟุตเตอร์ใช้ชุดเดียวกับกล่องแก้ข้อมูลลูกค้า

   กล่องนี้คือฟอร์มเพิ่มลูกค้าชุดเดียวของทั้งเว็บ (เบสสั่ง 2026-09-18 "ขอใช้ฟอร์มเดียวกัน
   ทั้งเว็บ ใช้ของหน้าเพิ่มลูกค้า") — ตัวเลือกลูกค้าในฟอร์มเปิดงาน/ใบเสนอเคยมีฟอร์มย่อ
   4 ช่องของตัวเอง ทำให้ลูกค้าที่เพิ่มจากหน้าเปิดงานไม่มีที่อยู่/เลขภาษีให้ออกเอกสาร
   ส่วนกันสร้างซ้ำ (ชื่อ/เบอร์/LINE คล้ายกัน) ยกมาจากฟอร์มย่อนั้น ตอนนี้ทุกทางเข้าได้ด้วย */
export type CreatedCustomer =
  | RouterOutput["customer"]["create"]
  | RouterOutput["customer"]["list"]["customers"][number];

export function CustomerCreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  /** ผู้เรียกที่ต้องใช้ลูกค้ารายนี้ต่อทันที (ตัวเลือกลูกค้าในฟอร์มเปิดงาน/ใบเสนอ)
   *  — เรียกทั้งตอนสร้างใหม่สำเร็จ และตอนคนกดใช้รายเดิมที่ระบบเจอว่าคล้ายกัน */
  onCreated?: (customer: CreatedCustomer) => void;
}) {
  const [form, setForm] = useState(emptyCustomerForm);
  // ฟอร์มใหม่เริ่มจากว่างทุกช่อง — โชว์ error หลังกดบันทึกครั้งแรกเท่านั้น
  // (ต่างจากฟอร์มแก้ไขที่ข้อมูลตั้งต้นถูกอยู่แล้ว โชว์สดได้)
  const [showErrors, setShowErrors] = useState(false);
  // ลูกค้าที่หน้าตาคล้ายของใหม่ — ให้เลือกใช้รายเดิมก่อนยืนยันสร้างซ้ำ
  const [similar, setSimilar] = useState<CreatedCustomer[] | null>(null);
  // กันกดซ้ำระหว่างรอผลเช็คซ้ำ (isPending ของ mutation ยังไม่ติดช่วงนั้น)
  const [isChecking, setIsChecking] = useState(false);

  const utils = trpc.useUtils();
  // วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES เห็นช่องแต่แก้ไม่ได้ (ตรง guard ของ
  // customer.create ที่เช็ค userRole === "SALES") · กล่องนี้ถามเองเพื่อให้ทุกทางเข้าได้กติกาเดียว
  const { data: me } = trpc.user.me.useQuery();
  const canEditCredit = !me || me.role !== "SALES";

  // เดิม fail เงียบ — SALES กรอกวงเงินโดน FORBIDDEN แล้วฟอร์มค้างเฉยๆ ไม่มีอะไรบอก
  // server error แสดงใน Alert ในฟอร์มที่เดียว — onError noop กัน hook ยิง toast ซ้ำสองทาง
  const createCustomer = useMutationWithInvalidation(trpc.customer.create, {
    invalidate: [utils.customer.list, utils.customer.stats],
    onSuccess: (customer: RouterOutput["customer"]["create"]) => {
      toast.success(`เพิ่มลูกค้า "${customer.name}" แล้ว`);
      onCreated?.(customer);
      onClose();
    },
    onError: () => {},
  });

  const validationErrors = validateCustomerEditForm(form);
  const set = (patch: Partial<CustomerEditForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    // แก้ช่องที่ใช้หาคนซ้ำ = ผลเดิมใช้ไม่ได้แล้ว ต้องเช็คใหม่ก่อนสร้าง
    if ("name" in patch || "phone" in patch || "lineId" in patch) setSimilar(null);
  };

  function pickExisting(customer: CreatedCustomer) {
    onCreated?.(customer);
    onClose();
  }

  async function submit() {
    if (Object.keys(validationErrors).length > 0) {
      setShowErrors(true);
      return;
    }
    if (isChecking) return;

    // กันซ้ำก่อนสร้าง: เบอร์/LINE ตรง หรือชื่อใกล้เคียง → เสนอใช้รายเดิม
    // เบอร์เก็บเป็นตัวเลขล้วน — กันซ้ำพลาดเพราะคนพิมพ์มี/ไม่มีขีด (helper เดียวกับ server)
    if (similar === null) {
      const probes = customerDuplicateProbes(form);
      try {
        setIsChecking(true);
        const matches = new Map<string, CreatedCustomer>();
        for (const probe of probes) {
          const result = await utils.customer.list.fetch({ search: probe, limit: 5 });
          for (const c of result.customers) matches.set(c.id, c);
        }
        if (matches.size > 0) {
          setSimilar([...matches.values()]);
          return; // รอผู้ใช้ตัดสิน — กดยืนยันอีกครั้ง = สร้างใหม่
        }
        setSimilar([]);
      } catch {
        toast.error("ตรวจลูกค้าซ้ำไม่สำเร็จ — ลองอีกครั้ง");
        return;
      } finally {
        setIsChecking(false);
      }
    }
    // SALES ไม่ส่ง creditLimit เลย — ส่งไปโดน FORBIDDEN (ช่องก็ disabled แล้ว)
    createCustomer.mutate(buildCustomerCreatePayload(form, canEditCredit));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // กล่องนี้ถูกเปิดจากในฟอร์มใหญ่ (เปิดงาน/ใบเสนอ) ได้ — React ส่ง submit ข้าม portal
    // ขึ้นไปถึงฟอร์มแม่ ถ้าไม่หยุดไว้ กดเพิ่มลูกค้าจะกลายเป็นสั่งเปิดงานไปด้วย
    e.stopPropagation();
    void submit();
  }

  const hasSimilar = Boolean(similar && similar.length > 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-clip p-0 pr-0 sm:max-w-2xl sm:p-0 sm:pr-0">
        {/* ปุ่ม X กินพื้นที่เฉพาะหัว — body/footer จึงกลับมามีขอบซ้ายขวาเท่ากัน */}
        <DialogHeader className="px-5 pb-4 pr-14 pt-5 sm:px-6 sm:pr-12 sm:pt-6">
          <DialogTitle>เพิ่มลูกค้า</DialogTitle>
          <DialogDescription>
            ใส่แค่ชื่อก็เพิ่มได้ — ที่อยู่ออกบิลและเลขผู้เสียภาษีเติมทีหลังได้
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-clip">
          <div
            data-dialog-body=""
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div data-dialog-fields="" className="space-y-4 px-5 sm:px-6">
              <CustomerFormFields
                form={form}
                set={set}
                errors={showErrors ? validationErrors : {}}
                canEditCredit={canEditCredit}
                mode="create"
              />

              {hasSimilar && (
                <div className={cn(TINT.warning, "space-y-1.5 rounded-lg border p-3")}>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    เจอลูกค้าที่คล้ายกันในระบบ — ใช่รายเดียวกันไหม?
                  </p>
                  {similar?.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-sm"
                    >
                      <span>
                        {c.name}
                        {c.company && <span className="text-muted"> ({c.company})</span>}
                        <span className="ml-1.5 text-xs text-muted">
                          {[c.phone, c.lineId].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {onCreated ? (
                        <button
                          type="button"
                          onClick={() => pickExisting(c)}
                          className="shrink-0 text-xs text-blue-600 underline-offset-2 active:underline dark:text-blue-400"
                        >
                          ใช้รายนี้
                        </button>
                      ) : (
                        <a
                          href={`/customers/${c.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-xs text-blue-600 underline-offset-2 active:underline dark:text-blue-400"
                        >
                          เปิดดู
                        </a>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    ไม่ใช่รายเดียวกัน → กด &quot;ยืนยันเพิ่มรายใหม่&quot;
                  </p>
                </div>
              )}

              {createCustomer.error && (
                <Alert variant="error">
                  บันทึกไม่สำเร็จ: {createCustomer.error.message}
                </Alert>
              )}
            </div>
          </div>

          <DialogSubmitFooter
            className="static z-auto px-5 sm:px-6"
            pending={createCustomer.isPending || isChecking}
            submitLabel={hasSimilar ? "ยืนยันเพิ่มรายใหม่" : "เพิ่มลูกค้า"}
            submitIcon={<UserPlus />}
            onCancel={onClose}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
