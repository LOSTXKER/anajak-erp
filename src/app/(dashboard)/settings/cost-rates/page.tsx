"use client";

import { useState } from "react";
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
import { permAllows } from "@/lib/permissions";
import {
  EMPTY_COST_RATES,
  costRatesConfigured,
  estimateFilmCost,
  estimateLaborOverhead,
} from "@/lib/cost-rates";

// เรตต้นทุนกลาง (FLOW-REDESIGN ก้อน 2) — เข็มทิศกำไรขั้นต้นตอนตีราคา ไม่ใช่บัญชีจริง
// PERM: อ่าน = see_finance · แก้ = manage_settings (ตรง settings.costRates/setCostRates)

// ตัวอย่างคำนวณสด — ลายมาตรฐาน 30×20 ซม. × 100 ตัว
const SAMPLE_PRINT = { widthCm: 30, heightCm: 20 };
const SAMPLE_QTY = 100;
const READ_ONLY_INPUT_CLASS =
  "read-only:cursor-default read-only:bg-slate-50 read-only:text-slate-600 dark:read-only:bg-slate-900 dark:read-only:text-slate-300";

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
  const meQuery = trpc.user.me.useQuery();
  // ยังไม่โหลด me = ให้ query รอ แทนยิงไปโดน FORBIDDEN — permAllows คืน false ตอน undefined
  const canView = permAllows(meQuery.data?.permissions, "see_finance");
  const canEdit = permAllows(meQuery.data?.permissions, "manage_settings");
  const ratesQuery = trpc.settings.costRates.useQuery(undefined, { enabled: canView });
  // null = ยังไม่แก้เอง ให้สะท้อนค่าล่าสุดจาก query โดยไม่ต้อง setState ใน effect
  const [formDraft, setFormDraft] = useState<FormState | null>(null);
  const form = formDraft ?? toForm(ratesQuery.data ?? EMPTY_COST_RATES);

  const utils = trpc.useUtils();
  const save = trpc.settings.setCostRates.useMutation({
    onSuccess: async () => {
      await utils.settings.costRates.invalidate();
      setFormDraft(null);
      toast.success("บันทึกเรตต้นทุนแล้ว");
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (key: keyof CostRates) => (value: string) =>
    setFormDraft((prev) => ({ ...(prev ?? form), [key]: value }));

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

  if (meQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (meQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <QueryError
          message="ตรวจสอบสิทธิ์ดูเรตต้นทุนไม่สำเร็จ"
          onRetry={() => meQuery.refetch()}
        />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <p className="text-sm text-slate-400">
          หน้านี้ต้องมีสิทธิ์เห็นทุน กำไร และรายงานการเงิน
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
              message="โหลดเรตต้นทุนไม่สำเร็จ"
              onRetry={() => ratesQuery.refetch()}
            />
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!canEdit) return;
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
                  <label htmlFor="film-rate-per-meter" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    ค่าฟิล์ม+หมึก+ผง (บาท/เมตรวิ่ง) *
                  </label>
                  <Input
                    id="film-rate-per-meter"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={form.filmRatePerMeter}
                    className={READ_ONLY_INPUT_CLASS}
                    onChange={(e) => set("filmRatePerMeter")(e.target.value)}
                    readOnly={!canEdit}
                    aria-describedby="film-rate-help"
                    required
                  />
                  <p id="film-rate-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">เรตวงการ ~25-50 บาท/เมตร</p>
                </div>
                <div>
                  <label htmlFor="film-roll-width" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    หน้ากว้างม้วนฟิล์ม (ซม.) *
                  </label>
                  <Input
                    id="film-roll-width"
                    type="number"
                    min={1}
                    step="any"
                    inputMode="decimal"
                    value={form.filmRollWidthCm}
                    className={READ_ONLY_INPUT_CLASS}
                    onChange={(e) => set("filmRollWidthCm")(e.target.value)}
                    readOnly={!canEdit}
                    aria-describedby="film-width-help"
                    required
                  />
                  <p id="film-width-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    ใช้แปลงพื้นที่ลายเป็นความยาวเมตรวิ่ง (ม้วนทั่วไป 60 ซม.)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="labor-per-piece" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    ค่าแรงเหมา (บาท/ชิ้น) *
                  </label>
                  <Input
                    id="labor-per-piece"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={form.laborPerPiece}
                    className={READ_ONLY_INPUT_CLASS}
                    onChange={(e) => set("laborPerPiece")(e.target.value)}
                    readOnly={!canEdit}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="overhead-per-piece" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    ค่าไฟ+ค่าเสื่อมเครื่อง (บาท/ชิ้น) *
                  </label>
                  <Input
                    id="overhead-per-piece"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={form.overheadPerPiece}
                    className={READ_ONLY_INPUT_CLASS}
                    onChange={(e) => set("overheadPerPiece")(e.target.value)}
                    readOnly={!canEdit}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cost-deviation-alert" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    เตือนเมื่อทุนซื้อเบี่ยงเกิน (%) *
                  </label>
                  <Input
                    id="cost-deviation-alert"
                    type="number"
                    min={1}
                    max={100}
                    step="any"
                    inputMode="decimal"
                    value={form.costDeviationAlertPct}
                    className={READ_ONLY_INPUT_CLASS}
                    onChange={(e) => set("costDeviationAlertPct")(e.target.value)}
                    readOnly={!canEdit}
                    aria-describedby="cost-deviation-help"
                    required
                  />
                  <p id="cost-deviation-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                {canEdit ? (
                  <Button type="submit" disabled={save.isPending} className="gap-1.5">
                    {save.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    บันทึก
                  </Button>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    คุณมีสิทธิ์ดูอย่างเดียว — ผู้มีสิทธิ์ตั้งค่าระบบเท่านั้นที่แก้ได้
                  </p>
                )}
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
