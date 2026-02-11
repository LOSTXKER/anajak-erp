"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Save,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Setting Keys ──────────────────────────────────────────
const STOCK_API_URL_KEY = "stock_api_url";
const STOCK_API_KEY_KEY = "stock_api_key";

// ─── Category Mapping Data ──────────────────────────────────
const categoryMappings = [
  { stockCategory: "เสื้อ", erpGroup: "เสื้อสำเร็จ", erpCode: "GARMENT" },
  { stockCategory: "กางเกง", erpGroup: "เสื้อสำเร็จ", erpCode: "GARMENT" },
  { stockCategory: "เสื้อแจ็คเก็ต", erpGroup: "เสื้อสำเร็จ", erpCode: "GARMENT" },
  { stockCategory: "วัตถุดิบ", erpGroup: "วัตถุดิบ", erpCode: "MATERIAL" },
  { stockCategory: "อุปกรณ์", erpGroup: "อุปกรณ์", erpCode: "SUPPLY" },
];

export default function StockSettingsPage() {
  // ─── Form State ─────────────────────────────────────────
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [initialUrl, setInitialUrl] = useState("");
  const [initialKey, setInitialKey] = useState("");

  // ─── Connection State ────────────────────────────────────
  const [connectionResult, setConnectionResult] = useState<{
    connected: boolean;
    name?: string;
    error?: string;
  } | null>(null);

  // ─── Sync Results ────────────────────────────────────────
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

  // ─── Load saved settings from DB ─────────────────────────
  const { data: savedSettings, isLoading: settingsLoading } =
    trpc.settings.getMany.useQuery({
      keys: [STOCK_API_URL_KEY, STOCK_API_KEY_KEY],
    });

  useEffect(() => {
    if (savedSettings) {
      const url = savedSettings[STOCK_API_URL_KEY] || "";
      const key = savedSettings[STOCK_API_KEY_KEY] || "";
      setApiUrl(url);
      setApiKey(key);
      setInitialUrl(url);
      setInitialKey(key);
      setIsSaved(true);
    }
  }, [savedSettings]);

  // Track unsaved changes
  useEffect(() => {
    setIsSaved(apiUrl === initialUrl && apiKey === initialKey);
  }, [apiUrl, apiKey, initialUrl, initialKey]);

  // ─── Queries ──────────────────────────────────────────────
  const { data: syncStatus, isLoading: statusLoading } =
    trpc.stockSync.status.useQuery();

  // ─── Mutations ────────────────────────────────────────────
  const utils = trpc.useUtils();

  const saveSettings = trpc.settings.setMany.useMutation({
    onSuccess: () => {
      setInitialUrl(apiUrl);
      setInitialKey(apiKey);
      setIsSaved(true);
      toast.success("บันทึกการตั้งค่าสำเร็จ");
      // Invalidate so stock-sync router picks up new settings
      utils.settings.getMany.invalidate();
    },
    onError: (error) => {
      toast.error("บันทึกไม่สำเร็จ", { description: error.message });
    },
  });

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

  // ─── Handlers ────────────────────────────────────────────
  function handleSave() {
    saveSettings.mutate({
      settings: [
        { key: STOCK_API_URL_KEY, value: apiUrl.trim() },
        { key: STOCK_API_KEY_KEY, value: apiKey.trim() },
      ],
    });
  }

  function handleTest() {
    // Test with current form values (not saved ones)
    testConnection.mutate({
      apiUrl: apiUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
    });
  }

  const isConnected = connectionResult?.connected === true;
  const hasCredentials = apiUrl.trim() && apiKey.trim();

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
              ใส่ API URL และ API Key จากระบบ Anajak Stock
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settingsLoading ? (
              <div className="space-y-3">
                <div className="h-10 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
              </div>
            ) : (
              <>
                {/* API URL */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    API URL
                  </label>
                  <Input
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://stock.anajak.com/api/erp"
                    className="font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    URL ของ Stock API (ดูได้ที่หน้า Integrations ในระบบ Stock)
                  </p>
                </div>

                {/* API Key */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    API Key
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk_xxxxxxxxxxxxxxxx"
                        className="pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    สร้าง API Key ได้ที่ระบบ Stock &gt; ตั้งค่า &gt; เชื่อมต่อระบบ &gt; เพิ่ม Custom ERP
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testConnection.isPending || !hasCredentials}
                    className="flex-1"
                  >
                    {testConnection.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="h-4 w-4" />
                    )}
                    {testConnection.isPending ? "กำลังทดสอบ..." : "ทดสอบเชื่อมต่อ"}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saveSettings.isPending || isSaved || !hasCredentials}
                    className="flex-1"
                  >
                    {saveSettings.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saveSettings.isPending ? "กำลังบันทึก..." : isSaved ? "บันทึกแล้ว" : "บันทึก"}
                  </Button>
                </div>

                {/* Unsaved changes indicator */}
                {!isSaved && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    * มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
                  </p>
                )}

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
              </>
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
                    <span className="text-slate-500 dark:text-slate-400">อัพเดทล่าสุด</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {syncStatus.lastSyncAt
                        ? formatDateTime(syncStatus.lastSyncAt)
                        : "ยังไม่เคย Sync"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">สินค้าจาก Stock</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {syncStatus.totalStockProducts} รายการ
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">สินค้า Local</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {syncStatus.totalLocalProducts} รายการ
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">สินค้าทั้งหมด</span>
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
                disabled={syncAll.isPending || !hasCredentials}
                className="w-full"
              >
                {syncAll.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )}
                {syncAll.isPending ? "กำลัง Sync..." : "Sync สินค้าทั้งหมด"}
              </Button>
              <Button
                variant="outline"
                onClick={() => syncStock.mutate()}
                disabled={syncStock.isPending || !hasCredentials}
                className="w-full"
              >
                {syncStock.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                {syncStock.isPending ? "กำลัง Sync..." : "Sync เฉพาะสต็อค"}
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
                      <p key={i} className="text-xs text-red-500 dark:text-red-400">
                        {err}
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
                      <td className="px-4 py-2.5 text-center text-slate-400">→</td>
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

        {/* ─── Info / How-to Section ────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              วิธีเชื่อมต่อ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                  1
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    สร้าง API Key ในระบบ Stock
                  </p>
                  <p className="text-xs">
                    ไปที่ Anajak Stock &gt; ตั้งค่า &gt; เชื่อมต่อระบบ &gt; เพิ่มการเชื่อมต่อ &gt; เลือก &quot;Custom ERP&quot; &gt; กด &quot;สร้าง&quot; API Key
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                  2
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    คัดลอก API URL และ API Key
                  </p>
                  <p className="text-xs">
                    ในหน้า Integrations ของ Stock จะแสดง API URL (เช่น https://stock.anajak.com/api/erp) และ API Key ที่สร้างไว้
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                  3
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    วาง URL + Key ในฟอร์มด้านบน แล้วกดบันทึก
                  </p>
                  <p className="text-xs">
                    กด &quot;ทดสอบเชื่อมต่อ&quot; เพื่อตรวจสอบ แล้วกด &quot;บันทึก&quot; เพื่อเก็บไว้ในระบบ
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>Tip:</strong> ไม่ต้องตั้งค่า ENV แล้ว เพียงใส่ข้อมูลผ่านหน้าเว็บนี้ ระบบจะเก็บไว้ในฐานข้อมูลอัตโนมัติ
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
