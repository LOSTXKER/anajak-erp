"use client";

// ตั้งค่า → สำรองข้อมูล (เบสเคาะ 2026-07-07: Supabase แผนฟรีไม่มี backup อัตโนมัติ
// → เจ้าของกดดาวน์โหลดไฟล์สำรองเก็บเองสม่ำเสมอแทน) — ดาวน์โหลดผ่าน fetch เพื่อได้
// loading state จริง + error ภาษาไทย (review จับ: <a href> เฉยๆ ไม่มีสัญญาณระหว่างรอ
// ~10-30 วิ · Button asChild+disabled บน <a> ไม่ block คลิกจริง) · gate เจ้าของที่ route

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HardDriveDownload, Loader2, ShieldAlert } from "lucide-react";

export default function BackupSettingsPage() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const canExport = permAllows(me?.permissions, "manage_users");

  // สำรองล่าสุดจาก audit log (aux — พัง/ไม่มีสิทธิ์ดู log ก็แค่ไม่โชว์บรรทัดนี้)
  const canSeeLog = canExport && permAllows(me?.permissions, "view_admin_reports");
  const { data: lastExport } = trpc.analytics.auditLog.useQuery(
    { entityType: "DATABASE_BACKUP", page: 1, limit: 1 },
    { enabled: canSeeLog }
  );
  const last = lastExport?.logs?.[0];

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
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
      utils.analytics.auditLog.invalidate(); // อัปเดตบรรทัด "สำรองล่าสุด"
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setDownloading(false);
    }
  }

  if (me && !canExport) {
    return (
      <div className="space-y-5">
        <PageHeader title="สำรองข้อมูล" description="ดาวน์โหลดข้อมูลทั้งระบบเก็บไว้เอง" />
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            หน้านี้สำหรับเจ้าของเท่านั้น
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="สำรองข้อมูล" description="ดาวน์โหลดข้อมูลทั้งระบบเก็บไว้เอง" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDriveDownload className="h-5 w-5" strokeWidth={1.75} />
            ดาวน์โหลดไฟล์สำรองข้อมูล
          </CardTitle>
          <CardDescription>
            ได้ไฟล์เดียวรวมข้อมูลทุกตารางในระบบ (ออเดอร์ / ลูกค้า / บิล / เอกสารภาษี ฯลฯ)
            ณ เวลาที่กด — เก็บไว้ใช้กู้ข้อมูลกรณีฉุกเฉิน · ใช้เวลาเตรียมไฟล์ราว 10-30 วินาที
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {last && (
            <p className="text-sm text-slate-500">
              สำรองครั้งล่าสุด:{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {new Date(last.createdAt).toLocaleString("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>{" "}
              โดย {last.user?.name ?? "-"}
            </p>
          )}
          <Button onClick={handleDownload} disabled={!canExport || downloading}>
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังเตรียมไฟล์... (อย่าปิดหน้านี้)
              </>
            ) : (
              <>
                <HardDriveDownload className="mr-2 h-4 w-4" />
                ดาวน์โหลดไฟล์สำรองข้อมูล
              </>
            )}
          </Button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <div>
              <p className="font-medium">ไฟล์นี้มีข้อมูลลับทั้งระบบ — ห้ามส่งต่อ</p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                รวมข้อมูลลูกค้า ราคา ต้นทุน และกุญแจเชื่อมระบบคลัง ให้เก็บในที่ปลอดภัย
                (เช่น เครื่องส่วนตัว/ไดรฟ์ส่วนตัว) · แนะนำดาวน์โหลดเก็บอย่างน้อยสัปดาห์ละครั้ง
                และหลังปิดยอดทุกสิ้นเดือน
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
