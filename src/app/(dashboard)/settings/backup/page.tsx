"use client";

// ตั้งค่า → สำรองข้อมูล (เบสเคาะ 2026-07-07: Supabase แผนฟรีไม่มี backup อัตโนมัติ
// → เจ้าของกดดาวน์โหลดไฟล์สำรองเก็บเองสม่ำเสมอแทน) — ดาวน์โหลดผ่าน fetch เพื่อได้
// loading state จริง + error ภาษาไทย (review จับ: <a href> เฉยๆ ไม่มีสัญญาณระหว่างรอ
// ~10-30 วิ · Button asChild+disabled บน <a> ไม่ block คลิกจริง) · gate เจ้าของที่ route
//
// โครงตามต้นแบบที่เบสเคาะ 2026-09-16 (setbackup): ปุ่มมุมขวาบน · แถบสถานะใต้หัว ·
// สองคอลัมน์ 7fr/5fr  ต้นแบบเขียนว่ามี backup อัตโนมัติและเก็บไฟล์ย้อนหลัง 30 วัน
// พร้อมปุ่มโหลดไฟล์เก่า — ระบบนี้ไม่มีทั้งสองอย่าง (ไฟล์ส่งตรงถึงเครื่อง ไม่เก็บไว้)
// จึงใช้ข้อมูลจริงจาก audit log แทน ไม่ลอกคำที่จะกลายเป็นคำโกหก

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ToneMark } from "@/components/ui/section";
import { StateBox } from "@/components/kit/kit";
import { HardDriveDownload, History, Loader2, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";

const HISTORY_LIMIT = 5;

/** newValue ที่ /api/backup/export เขียนไว้ = { tableCount, rowCount } — อ่านแบบไม่เชื่อรูปทรง */
function backupCounts(value: unknown): { tableCount: number | null; rowCount: number | null } {
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { tableCount: null, rowCount: null };
  }
  const record = value as Record<string, unknown>;
  return { tableCount: num(record.tableCount), rowCount: num(record.rowCount) };
}

const formatCount = (n: number | null) => (n === null ? "—" : n.toLocaleString("th-TH"));

export default function BackupSettingsPage() {
  const utils = trpc.useUtils();
  const meQuery = trpc.user.me.useQuery();
  const canExport = permAllows(meQuery.data?.permissions, "manage_users");

  // ประวัติจาก audit log (aux — ไม่มีสิทธิ์ไม่ยิง query; โหลดพังแสดงเตือนแต่ไม่บล็อก export)
  const canSeeLog = canExport && permAllows(meQuery.data?.permissions, "view_admin_reports");
  const lastExportQuery = trpc.analytics.auditLog.useQuery(
    { entityType: "DATABASE_BACKUP", page: 1, limit: HISTORY_LIMIT },
    { enabled: canSeeLog }
  );
  const history = lastExportQuery.data?.logs ?? [];
  const last = history[0];
  const lastCounts = backupCounts(last?.newValue);

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!canExport) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/backup/export");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `ดาวน์โหลดไม่สำเร็จ (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(cd)?.[1] ?? "anajak-erp-backup.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      utils.analytics.auditLog.invalidate(); // อัปเดตแถบสถานะ + ประวัติ
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <PageShell
      title="สำรองข้อมูล"
      description="ดาวน์โหลดข้อมูลทั้งระบบเก็บไว้เอง เผื่อวันที่ต้องย้อนดู"
      action={
        <Button size="sm" onClick={handleDownload} disabled={downloading}>
          {downloading ? (
            <>
              <Loader2 className="animate-spin" />
              กำลังเตรียมไฟล์... (อย่าปิดหน้านี้)
            </>
          ) : (
            <>
              <HardDriveDownload />
              ดาวน์โหลดตอนนี้
            </>
          )}
        </Button>
      }
      headerChildren={
        canSeeLog ? (
          <StateBox icon={History}>
            {last ? (
              <>
                สำรองล่าสุด{" "}
                <strong className="font-medium text-strong">{formatDateTime(last.createdAt)}</strong>{" "}
                โดย {last.user?.name ?? "-"}
                {lastCounts.tableCount !== null && lastCounts.rowCount !== null
                  ? ` · ${formatCount(lastCounts.tableCount)} ตาราง · ${formatCount(lastCounts.rowCount)} แถว`
                  : ""}
              </>
            ) : (
              "ยังไม่เคยดาวน์โหลดไฟล์สำรอง — กดปุ่มมุมขวาบนเพื่อเก็บไฟล์ชุดแรก"
            )}
          </StateBox>
        ) : undefined
      }
      loading={meQuery.isLoading}
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์สำรองข้อมูลไม่สำเร็จ",
              onRetry: () => void meQuery.refetch(),
            }
          : null
      }
      denied={!canExport && { description: "หน้านี้สำหรับเจ้าของเท่านั้น" }}
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToneMark icon={HardDriveDownload} tone="system" />
              ข้อมูลที่อยู่ในไฟล์สำรอง
            </CardTitle>
            <CardDescription>
              ไฟล์ .json เดียวรวมทุกตารางในฐานข้อมูล ณ เวลาที่กด · เตรียมไฟล์ราว 10-30 วินาที
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                title="ตารางในไฟล์"
                value={formatCount(lastCounts.tableCount)}
                caption={last ? "จากไฟล์สำรองครั้งล่าสุด" : "ยังไม่เคยสำรอง"}
                moduleTone="system"
              />
              <StatCard
                title="แถวข้อมูล"
                value={formatCount(lastCounts.rowCount)}
                caption={last ? "จากไฟล์สำรองครั้งล่าสุด" : "ยังไม่เคยสำรอง"}
                moduleTone="system"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            )}
            <Alert variant="warning" icon={ShieldAlert}>
              <div>
                <p className="font-medium">ไฟล์นี้มีข้อมูลลับทั้งระบบ — ห้ามส่งต่อ</p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  รวมข้อมูลลูกค้า ราคา ต้นทุน และกุญแจเชื่อมระบบคลัง ให้เก็บในที่ปลอดภัย
                  (เช่น เครื่องส่วนตัว/ไดรฟ์ส่วนตัว) · แนะนำดาวน์โหลดเก็บอย่างน้อยสัปดาห์ละครั้ง
                  และหลังปิดยอดทุกสิ้นเดือน
                </p>
              </div>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToneMark icon={History} tone="system" />
              ประวัติการดาวน์โหลด
            </CardTitle>
            <CardDescription>
              ระบบไม่เก็บไฟล์เก่าไว้บนเซิร์ฟเวอร์ — รายการนี้คือร่องรอยว่าใครกดเมื่อไหร่
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canSeeLog ? (
              <p className="text-sm text-muted">
                ต้องมีสิทธิ์ดูรายงานผู้ดูแลระบบจึงจะเห็นประวัติการดาวน์โหลด
              </p>
            ) : lastExportQuery.isError ? (
              <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <span>โหลดประวัติการสำรองไม่สำเร็จ</span>
                <Button variant="ghost" size="sm" onClick={() => lastExportQuery.refetch()}>
                  ลองใหม่
                </Button>
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีการดาวน์โหลดไฟล์สำรอง</p>
            ) : (
              <ol>
                {history.map((log, index) => {
                  const counts = backupCounts(log.newValue);
                  return (
                    <li key={log.id} className="relative flex gap-3 py-2 pl-1">
                      {index < history.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-0 left-[8.5px] top-6 w-px bg-divider"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className="relative mt-1.5 size-2.5 shrink-0 rounded-full bg-module-system-solid"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-strong">
                          {formatDateTime(log.createdAt)}
                        </span>
                        <span className="block text-xs text-muted">
                          โดย {log.user?.name ?? "-"}
                          {counts.rowCount !== null ? ` · ${formatCount(counts.rowCount)} แถว` : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
