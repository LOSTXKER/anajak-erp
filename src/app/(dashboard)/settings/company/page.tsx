"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { CompanyProfile } from "@/lib/company-profile";
import { EMPTY_COMPANY_PROFILE } from "@/lib/company-profile";
import { PageShell } from "@/components/page-shell";

// ข้อมูลกิจการ — ขึ้นหัวเอกสารพิมพ์ทุกใบ + เป็นข้อมูลบังคับของใบกำกับภาษีเต็มรูป

/** ปุ่มบันทึกอยู่มุมขวาบนของหน้า (ต้นแบบ 2026-09-16) จึงอยู่นอก <form> — ผูกกลับด้วย id */
const FORM_ID = "company-profile-form";

const labelClass = "mb-1 block text-xs font-medium text-secondary";

export default function CompanySettingsPage() {
  const meQuery = trpc.user.me.useQuery();
  const canManage = permAllows(meQuery.data?.permissions, "manage_settings");
  const profileQuery = trpc.settings.companyProfile.useQuery(undefined, {
    enabled: canManage,
  });
  const [draft, setDraft] = useState<CompanyProfile | null>(null);
  const form = draft ?? profileQuery.data ?? EMPTY_COMPANY_PROFILE;

  const utils = trpc.useUtils();
  const save = trpc.settings.setCompanyProfile.useMutation({
    onSuccess: () => {
      utils.settings.companyProfile.setData(undefined, form);
      setDraft(null);
      utils.settings.companyProfile.invalidate();
      toast.success("บันทึกข้อมูลกิจการแล้ว");
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (key: keyof CompanyProfile) => (value: string) =>
    setDraft((prev) => ({
      ...(prev ?? profileQuery.data ?? EMPTY_COMPANY_PROFILE),
      [key]: value,
    }));

  return (
    <PageShell
      title="ข้อมูลกิจการ"
      description="ใช้พิมพ์บนใบเสนอราคา ใบกำกับภาษี และใบส่งของ"
      /* ระหว่างโหลดยังไม่มีฟอร์มให้ปุ่มหัวหน้าสั่งบันทึก — ให้ PageShell ซ่อนปุ่มและวาดโครงร่างแทน */
      loading={meQuery.isLoading || (canManage && profileQuery.isLoading)}
      skeleton={<Skeleton className="h-96 rounded-2xl" />}
      action={
        <Button type="submit" form={FORM_ID} disabled={save.isPending} className="gap-1.5">
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          บันทึก
        </Button>
      }
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์หน้าข้อมูลกิจการไม่ได้",
              onRetry: () => void meQuery.refetch(),
            }
          : // โหลดไม่สำเร็จห้ามแสดงฟอร์มค่าว่าง — เซฟทับจะลบข้อมูลกิจการจริง (หัวใบกำกับภาษี)
            // && !data: refetch เบื้องหลังล้มระหว่างแก้ฟอร์มอยู่ ห้ามถอนฟอร์ม (ของที่พิมพ์หาย)
            profileQuery.isError && !profileQuery.data
            ? {
                message: "โหลดข้อมูลกิจการไม่สำเร็จ",
                onRetry: () => void profileQuery.refetch(),
              }
            : null
      }
      // !meQuery.isLoading: ระหว่างเช็คสิทธิ์ยังโชว์โครงร่างฟอร์ม (ตามเดิม) ไม่ใช่จอไม่มีสิทธิ์
      denied={
        !meQuery.isLoading &&
        !canManage && {
          title: "ไม่มีสิทธิ์แก้ข้อมูลกิจการ",
          description: "หน้านี้เปิดให้ผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น",
        }
      }
    >
      <Section
        title="ข้อมูลที่ขึ้นบนเอกสาร"
        icon={Building2}
        tone="brand"
        description="ชื่อ ที่อยู่ และเลขประจำตัวผู้เสียภาษี เป็นข้อมูลบังคับบนใบกำกับภาษีเต็มรูป (ม.86/4)"
      >
        <form
          id={FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          <fieldset disabled={save.isPending} className="min-w-0">
            {/* ฟอร์ม 2 คอลัมน์ตามต้นแบบ (.form2) — ลำดับช่อง ชื่อ → เลขผู้เสียภาษี → สาขา → ที่อยู่ → โทร → อีเมล */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4">
              <div className="sm:col-span-2">
                <label htmlFor="company-name" className={labelClass}>
                  ชื่อกิจการ (ตามจดทะเบียน) *
                </label>
                <Input
                  id="company-name"
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                  placeholder="เช่น บริษัท อณาจักร จำกัด"
                  required
                />
              </div>

              <div>
                <label htmlFor="company-tax-id" className={labelClass}>
                  เลขประจำตัวผู้เสียภาษี (13 หลัก) *
                </label>
                <Input
                  id="company-tax-id"
                  value={form.taxId}
                  onChange={(e) => set("taxId")(e.target.value.replace(/\D/g, "").slice(0, 13))}
                  placeholder="0000000000000"
                  inputMode="numeric"
                  required
                />
              </div>

              <div>
                <label htmlFor="company-branch-kind" className={labelClass}>
                  สำนักงาน
                </label>
                <Select
                  id="company-branch-kind"
                  value={form.branch === "สำนักงานใหญ่" ? "สำนักงานใหญ่" : "branch"}
                  onChange={(e) =>
                    set("branch")(e.target.value === "สำนักงานใหญ่" ? "สำนักงานใหญ่" : "สาขาที่ ")
                  }
                  aria-describedby="company-branch-hint"
                >
                  <option value="สำนักงานใหญ่">สำนักงานใหญ่</option>
                  <option value="branch">สาขา (ระบุเอง)</option>
                </Select>
                {form.branch !== "สำนักงานใหญ่" && (
                  <>
                    <label htmlFor="company-branch-name" className="sr-only">
                      ชื่อหรือรหัสสาขา
                    </label>
                    <Input
                      id="company-branch-name"
                      className="mt-2"
                      value={form.branch}
                      onChange={(e) => set("branch")(e.target.value)}
                      placeholder="เช่น สาขาที่ 00001"
                      aria-describedby="company-branch-hint"
                    />
                  </>
                )}
                {/* คำช่วยอยู่ตรงช่องที่ใช้ตามต้นแบบ (.fld small) */}
                <p id="company-branch-hint" className="mt-1 text-xs text-secondary">
                  ขึ้นบนใบกำกับภาษีตามที่กรมสรรพากรกำหนด
                </p>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="company-address" className={labelClass}>
                  ที่อยู่ *
                </label>
                <Textarea
                  id="company-address"
                  value={form.address}
                  onChange={(e) => set("address")(e.target.value)}
                  rows={3}
                  placeholder="ที่อยู่ตามจดทะเบียน"
                  required
                />
              </div>

              <div>
                <label htmlFor="company-phone" className={labelClass}>
                  โทรศัพท์
                </label>
                <Input
                  id="company-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  placeholder="0x-xxx-xxxx"
                />
              </div>

              <div>
                <label htmlFor="company-email" className={labelClass}>
                  อีเมล
                </label>
                <Input
                  id="company-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
            </div>
          </fieldset>
        </form>
      </Section>
    </PageShell>
  );
}
