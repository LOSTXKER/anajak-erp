"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { Save, Loader2, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { SettingsPageHeader } from "@/components/settings-page-header";
import type { CompanyProfile } from "@/lib/company-profile";
import { EMPTY_COMPANY_PROFILE } from "@/lib/company-profile";

// ข้อมูลกิจการ — ขึ้นหัวเอกสารพิมพ์ทุกใบ + เป็นข้อมูลบังคับของใบกำกับภาษีเต็มรูป
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

  const header = (
    <SettingsPageHeader
      title="ข้อมูลกิจการ"
      description="ขึ้นหัวเอกสารทุกใบ — ใบเสนอราคา/แจ้งหนี้/ใบเสร็จ/ใบกำกับภาษี"
    />
  );

  if (meQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <QueryError
          message="ตรวจสอบสิทธิ์หน้าข้อมูลกิจการไม่ได้"
          onRetry={() => void meQuery.refetch()}
        />
      </div>
    );
  }

  if (!meQuery.isLoading && !canManage) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <Card>
          <CardContent>
            <EmptyState
              icon={ShieldX}
              title="ไม่มีสิทธิ์แก้ข้อมูลกิจการ"
              description="หน้านี้เปิดให้ผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // โหลดไม่สำเร็จห้ามแสดงฟอร์มค่าว่าง — เซฟทับจะลบข้อมูลกิจการจริง (หัวใบกำกับภาษี)
  // && !data: refetch เบื้องหลังล้มระหว่างแก้ฟอร์มอยู่ ห้ามถอนฟอร์ม (ของที่พิมพ์หาย)
  if (profileQuery.isError && !profileQuery.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <QueryError
          message="โหลดข้อมูลกิจการไม่สำเร็จ"
          onRetry={() => void profileQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {header}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลผู้ออกเอกสาร</CardTitle>
          <CardDescription>
            ชื่อ ที่อยู่ และเลขประจำตัวผู้เสียภาษี เป็นข้อมูลบังคับบนใบกำกับภาษีเต็มรูป (ม.86/4)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meQuery.isLoading || profileQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(form);
              }}
            >
              <div>
                <label htmlFor="company-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
                <label htmlFor="company-address" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="company-tax-id" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
                  <label htmlFor="company-branch-kind" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    สำนักงาน
                  </label>
                  <NativeSelect
                    id="company-branch-kind"
                    value={form.branch === "สำนักงานใหญ่" ? "สำนักงานใหญ่" : "branch"}
                    onChange={(e) =>
                      set("branch")(e.target.value === "สำนักงานใหญ่" ? "สำนักงานใหญ่" : "สาขาที่ ")
                    }
                  >
                    <option value="สำนักงานใหญ่">สำนักงานใหญ่</option>
                    <option value="branch">สาขา (ระบุเอง)</option>
                  </NativeSelect>
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
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="company-phone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
                  <label htmlFor="company-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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

              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending} className="gap-1.5">
                  {save.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  บันทึก
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
