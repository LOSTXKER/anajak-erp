"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Fact, FactList } from "@/components/ui/fact";
import { ToneMark } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { Calculator, Coins, Layers, Loader2, Save, Store } from "lucide-react";
import { HelpTip } from "@/components/ui/help-tip";
import { c } from "@/components/kit/kit";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CostRates } from "@/lib/cost-rates";
import { permAllows } from "@/lib/permissions";
import {
  EMPTY_COST_RATES,
  costRatesConfigured,
  estimateFilmCost,
  estimateLaborOverhead,
} from "@/lib/cost-rates";
import { PageShell } from "@/components/page-shell";

// เรตต้นทุนกลาง (FLOW-REDESIGN ก้อน 2) — เข็มทิศกำไรขั้นต้นตอนตีราคา ไม่ใช่บัญชีจริง
// PERM: อ่าน = see_finance · แก้ = manage_settings (ตรง settings.costRates/setCostRates)
//
// โครงตามต้นแบบที่เบสเคาะ 2026-09-16 (setcost): ปุ่มบันทึกมุมขวาบนของหน้า ·
// สองคอลัมน์ 7fr/5fr · การ์ดซ้ายเป็น "ตารางเรต" (รายการ/หน่วย/ค่า) อ่านเทียบกันได้
// ต้นแบบมีการ์ด "ประวัติการปรับเรต" ซึ่งระบบนี้ไม่มีข้อมูลรองรับ (setCostRates เขียนทับ
// ค่าเดียวใน Setting ไม่เขียน audit) — คอลัมน์ขวาจึงเป็น "ตัวอย่างคำนวณ" ของจริงแทน

// ตัวอย่างคำนวณสด — ลายมาตรฐาน 30×20 ซม. × 100 ตัว
const SAMPLE_PRINT = { widthCm: 30, heightCm: 20 };
const SAMPLE_QTY = 100;
const FORM_ID = "cost-rates-form";
const READ_ONLY_INPUT_CLASS =
  "read-only:cursor-default read-only:bg-surface-muted read-only:text-secondary";

// เก็บค่าในฟอร์มเป็น string เพื่อให้พิมพ์เลขทศนิยม/ลบค่าได้ลื่น แล้วแปลงตอน submit
type FormState = Record<keyof CostRates, string>;

/** แถวของตารางเรต — ชื่อ/หน่วย/คำช่วย อยู่ที่เดียว ไม่กระจายไปตามป้ายของแต่ละช่อง */
const RATE_ROWS: Array<{
  key: keyof CostRates;
  id: string;
  label: string;
  unit: string;
  help?: string;
  min: number;
  max?: number;
}> = [
  {
    key: "filmRatePerMeter",
    id: "film-rate-per-meter",
    label: "ค่าฟิล์ม+หมึก+ผง",
    unit: "บาท/เมตรวิ่ง",
    help: "เรตวงการประมาณ 25–50 บาท/เมตร",
    min: 0,
  },
  {
    key: "filmRollWidthCm",
    id: "film-roll-width",
    label: "หน้ากว้างม้วนฟิล์ม",
    unit: "ซม.",
    help: "ใช้แปลงพื้นที่ลายเป็นความยาวเมตรวิ่ง — ม้วนทั่วไป 60 ซม.",
    min: 1,
  },
  {
    key: "laborPerPiece",
    id: "labor-per-piece",
    label: "ค่าแรงเหมา",
    unit: "บาท/ชิ้น",
    min: 0,
  },
  {
    key: "overheadPerPiece",
    id: "overhead-per-piece",
    label: "ค่าไฟ+ค่าเสื่อมเครื่อง",
    unit: "บาท/ชิ้น",
    min: 0,
  },
  {
    key: "costDeviationAlertPct",
    id: "cost-deviation-alert",
    label: "เตือนเมื่อทุนซื้อเบี่ยงเกิน",
    unit: "%",
    help: "ทุนซื้อล็อตใหม่เบี่ยงจากที่ตั้งไว้เกิน % นี้ ระบบจะแจ้งเตือน",
    min: 1,
    max: 100,
  },
];

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
  // ฟอร์มยังไม่พร้อมกด = ระหว่างโหลด/โหลดพัง (ปุ่มอยู่นอกการ์ดแล้ว ต้องกันเองตรงนี้)
  const formReady = !ratesQuery.isLoading && !ratesQuery.isError;

  return (
    <PageShell
      title="เรตต้นทุนกลาง"
      description="ใช้คิดต้นทุนต่อใบงาน เพื่อดูว่างานไหนได้กำไรจริง — เป็นเข็มทิศตอนตีราคา ไม่ใช่ตัวเลขบัญชี"
      help="ทุนตัวเสื้อมาจากราคาทุนจริงในแอป Stock อัตโนมัติ · ค่าจ้างร้านนอกตามบิลร้าน ไม่อยู่ในเรตนี้"
      action={
        canEdit ? (
          <Button
            type="submit"
            form={FORM_ID}
            size="sm"
            disabled={save.isPending || !formReady}
            className="gap-1.5"
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            บันทึก
          </Button>
        ) : undefined
      }
      loading={meQuery.isLoading}
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์ดูเรตต้นทุนไม่สำเร็จ",
              onRetry: () => void meQuery.refetch(),
            }
          : null
      }
      denied={
        !canView && {
          description: "หน้านี้ต้องมีสิทธิ์เห็นทุน กำไร และรายงานการเงิน",
        }
      }
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToneMark icon={Coins} tone="finance" />
              เรตที่ใช้อยู่
            </CardTitle>
            <CardDescription>
              ทุนตัวเสื้อกับค่าจ้างร้านนอกไม่อยู่ในเรตนี้ — ระบบดึงจากแอป Stock และบิลร้านให้เอง
            </CardDescription>
          </CardHeader>
          <div>
            {ratesQuery.isLoading ? (
              <div className="space-y-3 px-4.5 pb-4.5">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : ratesQuery.isError ? (
              <div className="px-4.5 pb-4.5">
                <QueryError
                  message="โหลดเรตต้นทุนไม่สำเร็จ"
                  onRetry={() => ratesQuery.refetch()}
                />
              </div>
            ) : (
              <form
                id={FORM_ID}
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
                <fieldset disabled={save.isPending}>
                  <DataTable.Root bordered={false}>
                    <DataTable.Head>
                      <tr>
                        <DataTable.Th>รายการ</DataTable.Th>
                        <DataTable.Th>หน่วย</DataTable.Th>
                        <DataTable.Th align="right">ค่า</DataTable.Th>
                      </tr>
                    </DataTable.Head>
                    <DataTable.Body>
                      {RATE_ROWS.map((row) => (
                        <DataTable.Row key={row.key}>
                          <DataTable.Td>
                            <span className="flex items-center gap-1">
                              <label htmlFor={row.id} className="text-sm font-medium text-strong">
                                {row.label}
                              </label>
                              {row.help ? (
                                <HelpTip label={row.label}>{row.help}</HelpTip>
                              ) : null}
                            </span>
                          </DataTable.Td>
                          <DataTable.Td className="text-muted">{row.unit}</DataTable.Td>
                          <DataTable.Td align="right">
                            <div className="flex justify-end">
                              <Input
                                id={row.id}
                                type="number"
                                min={row.min}
                                max={row.max}
                                step="any"
                                inputMode="decimal"
                                size="sm"
                                value={form[row.key]}
                                className={cn("w-28 text-right tabular-nums", READ_ONLY_INPUT_CLASS)}
                                onChange={(e) => set(row.key)(e.target.value)}
                                readOnly={!canEdit}
                                required
                              />
                            </div>
                          </DataTable.Td>
                        </DataTable.Row>
                      ))}
                    </DataTable.Body>
                  </DataTable.Root>

                  {!canEdit && (
                    <p className="px-4.5 pb-4 pt-3 text-xs text-muted">
                      คุณมีสิทธิ์ดูอย่างเดียว — ผู้มีสิทธิ์ตั้งค่าระบบเท่านั้นที่แก้ได้
                    </p>
                  )}
                </fieldset>
              </form>
            )}
          </div>
          <div className={c("tfoot")}>
            เรตนี้ใช้ประเมินกำไรขั้นต้นตอนตีราคา ไม่ถูกบันทึกลงออเดอร์หรือใบผลิต
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToneMark icon={Calculator} tone="finance" />
              ตัวอย่างคำนวณ
            </CardTitle>
            <CardDescription>
              ลาย {SAMPLE_PRINT.widthCm}×{SAMPLE_PRINT.heightCm} ซม. × {SAMPLE_QTY} ตัว
              คิดจากค่าที่กรอกอยู่ ยังไม่ต้องกดบันทึก
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {configured ? (
              <FactList columns={2}>
                <Fact
                  label="ค่าฟิล์ม"
                  value={sampleFilm !== null ? `${formatBaht(sampleFilm)} บาท` : "—"}
                  sub={`${SAMPLE_QTY} ตัว`}
                />
                <Fact
                  label="ค่าแรง + โสหุ้ย"
                  value={`${formatBaht(sampleLaborOverhead)} บาท`}
                  sub={`${SAMPLE_QTY} ตัว`}
                />
              </FactList>
            ) : (
              <p className="text-sm text-muted">
                ยังไม่ได้ตั้งเรต — กรอกเรตด้านบนเพื่อดูตัวอย่าง
              </p>
            )}

            <div className="border-t border-divider pt-3">
              <p className="mb-2 text-xs font-medium text-muted">อีก 2 ก้อนที่ไม่ได้ตั้งที่นี่</p>
              <FactList columns={1}>
                <Fact
                  icon={Layers}
                  label="ทุนตัวเสื้อ"
                  value="ดึงจากราคาทุนจริงในแอป Stock"
                  sub="อัปเดตตามล็อตที่รับเข้าจริง ไม่ต้องกรอกเอง"
                />
                <Fact
                  icon={Store}
                  label="ค่าจ้างร้านนอก"
                  value="ตามบิลของร้านในใบงานนั้น"
                  sub="คิดเป็นรายใบ ไม่ใช่เรตกลาง"
                />
              </FactList>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
