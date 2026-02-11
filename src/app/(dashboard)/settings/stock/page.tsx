"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import {
  Cloud,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Info,
  Database,
  Plug,
} from "lucide-react";
import { toast } from "sonner";

// ─── Category Mapping Data ──────────────────────────────────
const categoryMappings = [
  { stockCategory: "เสื้อ", erpGroup: "เสื้อสำเร็จ", erpCode: "GARMENT" },
  { stockCategory: "กางเกง", erpGroup: "เสื้อสำเร็จ", erpCode: "GARMENT" },
  {
    stockCategory: "เสื้อแจ็คเก็ต",
    erpGroup: "เสื้อสำเร็จ",
    erpCode: "GARMENT",
  },
  { stockCategory: "วัตถุดิบ", erpGroup: "วัตถุดิบ", erpCode: "MATERIAL" },
  { stockCategory: "อุปกรณ์", erpGroup: "อุปกรณ์", erpCode: "SUPPLY" },
];

export default function StockSettingsPage() {
  const [connectionResult, setConnectionResult] = useState<{
    connected: boolean;
    name?: string;
    error?: string;
  } | null>(null);

  const [lastSyncResult, setLastSyncResult] = useState<{
    productsCreated: number;
    productsUpdated: number;
    variantsCreated: number;
    variantsUpdated: number;
    errors: string[];
  } | null>(null);

  const [lastStockResult, setLastStockResult] = useState<{
    updated: number;
    errors: string[];
  } | null>(null);

  // ─── Queries ──────────────────────────────────────────────
  const { data: syncStatus, isLoading: statusLoading } =
    trpc.stockSync.status.useQuery();

  // ─── Mutations ────────────────────────────────────────────
  const utils = trpc.useUtils();

  const testConnection = trpc.stockSync.testConnection.useMutation({
    onSuccess: (result) => {
      setConnectionResult(result);
      if (result.connected) {
        toast.success("เชื่อมต่อสำเร็จ");
      } else {
        toast.error("เชื่อมต่อไม่สำเร็จ", { description: result.error });
      }
    },
    onError: (error) => {
      setConnectionResult({ connected: false, error: error.message });
      toast.error("เกิดข้อผิดพลาด", { description: error.message });
    },
  });

  const syncAll = trpc.stockSync.syncAll.useMutation({
    onSuccess: (result) => {
      setLastSyncResult(result);
      toast.success("Sync สินค้าสำเร็จ", {
        description: `สร้างใหม่ ${result.productsCreated}, อัพเดท ${result.productsUpdated}`,
      });
      utils.stockSync.status.invalidate();
    },
    onError: (error) => {
      toast.error("Sync ล้มเหลว", { description: error.message });
    },
  });

  const syncStock = trpc.stockSync.syncStock.useMutation({
    onSuccess: (result) => {
      setLastStockResult(result);
      toast.success("Sync สต็อกสำเร็จ", {
        description: `อัพเดท ${result.updated} รายการ`,
      });
      utils.stockSync.status.invalidate();
    },
    onError: (error) => {
      toast.error("Sync สต็อกล้มเหลว", { description: error.message });
    },
  });

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          เชื่อมต่อ Anajak Stock
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          ตั้งค่าการเชื่อมต่อและ Sync สินค้าจากระบบ Stock
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ─── Connection Section ─────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="h-4 w-4" />
              การเชื่อมต่อ API
            </CardTitle>
            <CardDescription>
              ทดสอบการเชื่อมต่อกับ Anajak Stock API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                API URL
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {process.env.NEXT_PUBLIC_STOCK_API_URL || "ตั้งค่าใน .env (ANAJAK_STOCK_API_URL)"}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                API Key
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                ••••••••••••••••
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
              className="w-full"
            >
              {testConnection.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              {testConnection.isPending
                ? "กำลังทดสอบ..."
                : "ทดสอบเชื่อมต่อ"}
            </Button>

            {/* Connection result */}
            {connectionResult && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                  connectionResult.connected
                    ? "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                }`}
              >
                {connectionResult.connected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      เชื่อมต่อสำเร็จ
                      {connectionResult.name && ` — ${connectionResult.name}`}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>{connectionResult.error || "ไม่สามารถเชื่อมต่อได้"}</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Sync Section ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" />
              Sync สินค้า
            </CardTitle>
            <CardDescription>
              ดึงข้อมูลสินค้าและสต็อกจาก Anajak Stock
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sync status summary */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              {statusLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              ) : syncStatus ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      อัพเดทล่าสุด
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {syncStatus.lastSyncAt
                        ? formatDateTime(syncStatus.lastSyncAt)
                        : "ยังไม่เคย Sync"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      สินค้าจาก Stock
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {syncStatus.totalStockProducts} รายการ
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      สินค้า Local
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {syncStatus.totalLocalProducts} รายการ
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">
                      สินค้าทั้งหมด
                    </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {syncStatus.totalProducts} รายการ
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">ไม่สามารถโหลดสถานะได้</p>
              )}
            </div>

            {/* Sync buttons */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                onClick={() => syncAll.mutate()}
                disabled={syncAll.isPending}
                className="w-full"
              >
                {syncAll.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )}
                {syncAll.isPending
                  ? "กำลัง Sync..."
                  : "Sync สินค้าทั้งหมด"}
              </Button>
              <Button
                variant="outline"
                onClick={() => syncStock.mutate()}
                disabled={syncStock.isPending}
                className="w-full"
              >
                {syncStock.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                {syncStock.isPending
                  ? "กำลัง Sync..."
                  : "Sync เฉพาะสต็อค"}
              </Button>
            </div>

            {/* Last sync result */}
            {lastSyncResult && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
                <p className="mb-1 text-sm font-medium text-blue-700 dark:text-blue-400">
                  ผลลัพธ์ Sync สินค้า
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-blue-600 dark:text-blue-300">
                  <span>สร้างใหม่: {lastSyncResult.productsCreated}</span>
                  <span>อัพเดท: {lastSyncResult.productsUpdated}</span>
                  <span>Variant ใหม่: {lastSyncResult.variantsCreated}</span>
                  <span>Variant อัพเดท: {lastSyncResult.variantsUpdated}</span>
                </div>
                {lastSyncResult.errors.length > 0 && (
                  <div className="mt-2 border-t border-blue-200 pt-2 dark:border-blue-800">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      ข้อผิดพลาด ({lastSyncResult.errors.length}):
                    </p>
                    {lastSyncResult.errors.slice(0, 3).map((err, i) => (
                      <p
                        key={i}
                        className="text-xs text-red-500 dark:text-red-400"
                      >
                        • {err}
                      </p>
                    ))}
                    {lastSyncResult.errors.length > 3 && (
                      <p className="text-xs text-red-400">
                        ...อีก {lastSyncResult.errors.length - 3} รายการ
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Last stock sync result */}
            {lastStockResult && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/50">
                <p className="mb-1 text-sm font-medium text-green-700 dark:text-green-400">
                  ผลลัพธ์ Sync สต็อก
                </p>
                <p className="text-xs text-green-600 dark:text-green-300">
                  อัพเดท: {lastStockResult.updated} รายการ
                </p>
                {lastStockResult.errors.length > 0 && (
                  <p className="mt-1 text-xs text-red-500">
                    ข้อผิดพลาด: {lastStockResult.errors.length} รายการ
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Category Mapping ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4" />
              การแมปหมวดหมู่
            </CardTitle>
            <CardDescription>
              หมวดหมู่จาก Stock จะถูกแมปเข้ากลุ่มสินค้าใน ERP โดยอัตโนมัติ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400">
                      หมวดหมู่ Stock
                    </th>
                    <th className="px-4 py-2.5 text-center font-medium text-slate-400">
                      →
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400">
                      กลุ่มสินค้า ERP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {categoryMappings.map((mapping, i) => (
                    <tr
                      key={i}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-2.5 text-slate-900 dark:text-white">
                        {mapping.stockCategory}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-400">
                        →
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 dark:text-white">
                            {mapping.erpGroup}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {mapping.erpCode}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ─── Info Section ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              การทำงาน Stock Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <div className="space-y-2">
              <p>
                <strong className="text-slate-900 dark:text-white">
                  Sync สินค้าทั้งหมด
                </strong>{" "}
                — ดึงข้อมูลสินค้า, ราคาต้นทุน, และสต็อกจาก Anajak Stock
                แล้วสร้างหรืออัพเดทสินค้าใน ERP สินค้าที่มี SKU
                ซ้ำกันจะถูกอัพเดทแทนสร้างใหม่
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">
                  Sync เฉพาะสต็อค
                </strong>{" "}
                — ดึงเฉพาะข้อมูลสต็อก (จำนวน) มาอัพเดท โดยไม่แก้ไขข้อมูลอื่น
                เหมาะสำหรับอัพเดทเร็วระหว่างวัน
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">
                  แหล่งที่มา
                </strong>{" "}
                — สินค้าจาก Stock จะมี badge สีน้ำเงิน &quot;Stock&quot;
                ในหน้าสินค้า สินค้าที่สร้างเองจะเป็น &quot;Local&quot; สีเทา
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">
                  เบิกวัตถุดิบ
                </strong>{" "}
                — เมื่อเริ่มผลิตออเดอร์ ระบบจะส่งรายการเบิกไปยัง Stock API
                โดยอัตโนมัติเพื่อหักยอดจากคลังจริง
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>หมายเหตุ:</strong> การตั้งค่า API URL และ API Key
                ทำผ่านไฟล์ .env บนเซิร์ฟเวอร์ (ANAJAK_STOCK_API_URL และ
                ANAJAK_STOCK_API_KEY) เพื่อความปลอดภัย
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
