"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsPageHeader } from "@/components/settings-page-header";
import type { CostRates } from "@/lib/cost-rates";
import { FINANCE_ROLES } from "@/lib/roles";
import {
  EMPTY_COST_RATES,
  costRatesConfigured,
  estimateFilmCost,
  estimateLaborOverhead,
} from "@/lib/cost-rates";

// เรตต้นทุนกลาง (FLOW-REDESIGN ก้อน 2) — เข็มทิศกำไรขั้นต้นตอนตีราคา ไม่ใช่บัญชีจริง
// อ่านได้: OWNER/MANAGER/ACCOUNTANT · แก้ได้: OWNER/MANAGER (ตรง RBAC ใน settings router)
const EDIT_ROLES = ["OWNER", "MANAGER"];

// ตัวอย่างคำนวณสด — ลายมาตรฐาน 30×20 ซม. × 100 ตัว
const SAMPLE_PRINT = { widthCm: 30, heightCm: 20 };
const SAMPLE_QTY = 100;

// เก็บค่าในฟอร์มเป็น string เพื่อให้พิมพ์เลขทศนิยม/ลบค่าได้ลื่น แล้วแปลงตอน submit
type FormState = Record<keyof CostRates, string>;

function toForm(rates: CostRates): FormState {
  return {
    filmRatePerMeter: String(rates.filmRatePerMeter),
    filmRollWidthCm: String(rates.filmRollWidthCm),
    laborPerPiece: String(rates.laborPerPiece),
    overheadPerPiece: String(rates.overheadPerPiece),
    costDeviationAlertPct: String(rates.costDeviationAlertPct),
  };
}

function toRates(form: FormState): CostRates {
  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    filmRatePerMeter: num(form.filmRatePerMeter),
    filmRollWidthCm: num(form.filmRollWidthCm),
    laborPerPiece: num(form.laborPerPiece),
    overheadPerPiece: num(form.overheadPerPiece),
    costDeviationAlertPct: num(form.costDeviationAlertPct),
  };
}

const formatBaht = (n: number) =>
  n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function CostRatesSettingsPage() {
  const { data: me } = trpc.user.me.useQuery();
  const canView = me ? FINANCE_ROLES.includes(me.role) : true;
  const canEdit = me ? EDIT_ROLES.includes(me.role) : true;
  const ratesQuery = trpc.settings.costRates.useQuery(undefined, { enabled: canView });
  const [form, setForm] = useState<FormState>(toForm(EMPTY_COST_RATES));

  useEffect(() => {
    if (ratesQuery.data) setForm(toForm(ratesQuery.data));
  }, [ratesQuery.data]);

  const utils = trpc.useUtils();
  const save = trpc.settings.setCostRates.useMutation({
    onSuccess: () => {
      utils.settings.costRates.invalidate();
      toast.success("บันทึกเรตต้นทุนแล้ว");
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (key: keyof CostRates) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ตัวอย่างคำนวณสดจากค่าที่กรอกอยู่ (ยังไม่ต้องกดบันทึก) — ใช้ฟังก์ชันเดียวกับของจริง
  const draft = toRates(form);
  const configured = costRatesConfigured(draft);
  const sampleFilm = estimateFilmCost(SAMPLE_PRINT, SAMPLE_QTY, draft);
  const sampleLaborOverhead = estimateLaborOverhead(SAMPLE_QTY, draft);

  const header = (
    <SettingsPageHeader
      title="เรตต้นทุนกลาง"
      description="ตั้งครั้งเดียว ระบบคูณเองทุกออเดอร์ — ใช้ดูกำไรขั้นต้นโดยประมาณตอนตีราคา ไม่ใช่บัญชีจริง"
    />
  );

  if (me && !canView) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <p className="text-sm text-slate-400">
          หน้านี้เปิดเฉพาะฝั่งบริหาร — เจ้าของ ผู้จัดการ และบัญชี
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {header}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">เรตต้นทุน 4 ก้อน</CardTitle>
          <CardDescription>
            ทุนตัวเสื้อกับค่าจ้างร้านนอกไม่อยู่ในเรตนี้ — ระบบดึงจากแอป Stock และบิลร้านให้เอง
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ratesQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : ratesQuery.isError ? (
            <QueryError
              message="โหลดเรตต้นทุนไม่ได้ — หน้านี้เปิดเฉพาะฝั่งบริหาร"
              onRetry={() => ratesQuery.refetch()}
            />
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const rates = toRates(form);
                if (rates.filmRollWidthCm <= 0) {
                  toast.error("หน้ากว้างม้วนฟิล์มต้องมากกว่า 0");
                  return;
                }
                save.mutate(rates);
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    ค่าฟิล์ม+หมึก+ผง (บาท/เมตรวิ่ง) *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={form.filmRatePerMeter}
                    onChange={(e) => set("filmRatePerMeter")(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-400">เรตวงการ ~25-50 บาท/เมตร</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    หน้ากว้างม้วนฟิล์ม (ซม.) *
                  </label>
                  <Input
                    type="number"
                    min={1}
                    step="any"
                    inputMode="decimal"
                    value={form.filmRollWidthCm}
                    onChange={(e) => set("filmRollWidthCm")(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    ใช้แปลงพื้นที่ลายเป็นความยาวเมตรวิ่ง (ม้วนทั่วไป 60 ซม.)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    ค่าแรงเหมา (บาท/ชิ้น) *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={form.laborPerPiece}
                    onChange={(e) => set("laborPerPiece")(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    ค่าไฟ+ค่าเสื่อมเครื่อง (บาท/ชิ้น) *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={form.overheadPerPiece}
                    onChange={(e) => set("overheadPerPiece")(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    เตือนเมื่อทุนซื้อเบี่ยงเกิน (%) *
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step="any"
                    inputMode="decimal"
                    value={form.costDeviationAlertPct}
                    onChange={(e) => set("costDeviationAlertPct")(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    ทุนซื้อล็อตใหม่เบี่ยงจากที่ตั้งไว้เกิน % นี้ ระบบจะแจ้งเตือน
                  </p>
                </div>
              </div>

              {/* ตัวอย่างคำนวณสด — อัปเดตตามค่าที่กรอก */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ตัวอย่างคำนวณ
                </p>
                {configured ? (
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    ลาย {SAMPLE_PRINT.widthCm}×{SAMPLE_PRINT.heightCm} ซม. × {SAMPLE_QTY} ตัว ≈
                    ฟิล์ม {sampleFilm !== null ? formatBaht(sampleFilm) : "—"} บาท +
                    ค่าแรง/โสหุ้ย {formatBaht(sampleLaborOverhead)} บาท
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">
                    ยังไม่ได้ตั้งเรต — กรอกเรตด้านบนเพื่อดูตัวอย่าง
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                {!canEdit && (
                  <p className="text-xs text-slate-400">
                    บัญชีดูได้อย่างเดียว — แก้ได้เฉพาะเจ้าของ/ผู้จัดการ
                  </p>
                )}
                <Button type="submit" disabled={save.isPending || !canEdit} className="gap-1.5">
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

      <p className="text-xs text-slate-500 dark:text-slate-400">
        ทุนตัวเสื้อมาจากราคาทุนจริงในแอป Stock อัตโนมัติ · ค่าจ้างร้านนอกตามบิลร้าน (ไม่อยู่ในเรตนี้)
      </p>
    </div>
  );
}
