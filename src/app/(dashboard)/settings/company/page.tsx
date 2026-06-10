"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CompanyProfile } from "@/lib/company-profile";
import { EMPTY_COMPANY_PROFILE } from "@/lib/company-profile";

// ข้อมูลกิจการ — ขึ้นหัวเอกสารพิมพ์ทุกใบ + เป็นข้อมูลบังคับของใบกำกับภาษีเต็มรูป
export default function CompanySettingsPage() {
  const profileQuery = trpc.settings.companyProfile.useQuery();
  const [form, setForm] = useState<CompanyProfile>(EMPTY_COMPANY_PROFILE);

  useEffect(() => {
    if (profileQuery.data) setForm(profileQuery.data);
  }, [profileQuery.data]);

  const utils = trpc.useUtils();
  const save = trpc.settings.setCompanyProfile.useMutation({
    onSuccess: () => {
      utils.settings.companyProfile.invalidate();
      toast.success("บันทึกข้อมูลกิจการแล้ว");
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (key: keyof CompanyProfile) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">ข้อมูลกิจการ</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ขึ้นหัวเอกสารทุกใบ — ใบเสนอราคา/แจ้งหนี้/ใบเสร็จ/ใบกำกับภาษี
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลผู้ออกเอกสาร</CardTitle>
          <CardDescription>
            ชื่อ ที่อยู่ และเลขประจำตัวผู้เสียภาษี เป็นข้อมูลบังคับบนใบกำกับภาษีเต็มรูป (ม.86/4)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profileQuery.isLoading ? (
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
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ชื่อกิจการ (ตามจดทะเบียน) *
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                  placeholder="เช่น บริษัท อณาจักร จำกัด"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ที่อยู่ *
                </label>
                <Textarea
                  value={form.address}
                  onChange={(e) => set("address")(e.target.value)}
                  rows={3}
                  placeholder="ที่อยู่ตามจดทะเบียน"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    เลขประจำตัวผู้เสียภาษี (13 หลัก) *
                  </label>
                  <Input
                    value={form.taxId}
                    onChange={(e) => set("taxId")(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    placeholder="0000000000000"
                    inputMode="numeric"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    สำนักงาน
                  </label>
                  <NativeSelect
                    value={form.branch === "สำนักงานใหญ่" ? "สำนักงานใหญ่" : "branch"}
                    onChange={(e) =>
                      set("branch")(e.target.value === "สำนักงานใหญ่" ? "สำนักงานใหญ่" : "สาขาที่ ")
                    }
                  >
                    <option value="สำนักงานใหญ่">สำนักงานใหญ่</option>
                    <option value="branch">สาขา (ระบุเอง)</option>
                  </NativeSelect>
                  {form.branch !== "สำนักงานใหญ่" && (
                    <Input
                      className="mt-2"
                      value={form.branch}
                      onChange={(e) => set("branch")(e.target.value)}
                      placeholder="เช่น สาขาที่ 00001"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    โทรศัพท์
                  </label>
                  <Input
                    value={form.phone}
                    onChange={(e) => set("phone")(e.target.value)}
                    placeholder="0x-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    อีเมล
                  </label>
                  <Input
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
