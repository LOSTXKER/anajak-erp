"use client";
import { HelpTip } from "@/components/ui/help-tip";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { RADIUS, TINT } from "@/components/ui/tokens";
import { Badge } from "@/components/ui/badge";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";
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
import { SyncDialog } from "@/components/sync-dialog";
import { Alert } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import { PageShell } from "@/components/page-shell";
import { ContextPanel } from "@/components/ui/context-panel";
import { c } from "@/components/kit/kit";

// ─── Setting Keys ──────────────────────────────────────────
const STOCK_API_URL_KEY = "stock_api_url";
const STOCK_API_KEY_KEY = "stock_api_key";
const STOCK_SETTING_KEYS = [STOCK_API_URL_KEY, STOCK_API_KEY_KEY];

// ─── Item Type Mapping Data ──────────────────────────────────
const itemTypeMappings = [
  {
    stockCategory: "เสื้อ",
    erpItemType: "สินค้าสำเร็จรูป",
    erpCode: "FINISHED_GOOD",
  },
  {
    stockCategory: "กางเกง",
    erpItemType: "สินค้าสำเร็จรูป",
    erpCode: "FINISHED_GOOD",
  },
  {
    stockCategory: "เสื้อแจ็คเก็ต",
    erpItemType: "สินค้าสำเร็จรูป",
    erpCode: "FINISHED_GOOD",
  },
  {
    stockCategory: "วัตถุดิบ",
    erpItemType: "วัตถุดิบ",
    erpCode: "RAW_MATERIAL",
  },
  {
    stockCategory: "อุปกรณ์",
    erpItemType: "วัสดุสิ้นเปลือง",
    erpCode: "CONSUMABLE",
  },
];

export default function StockSettingsPage() {
  // ─── Form State ─────────────────────────────────────────
  const [draft, setDraft] = useState<{ apiUrl: string; apiKey: string } | null>(
    null,
  );
  const [showApiKey, setShowApiKey] = useState(false);

  // ─── Connection State ────────────────────────────────────
  const [connectionResult, setConnectionResult] = useState<{
    connected: boolean;
    name?: string;
    error?: string;
  } | null>(null);

  // ─── Sync Dialog ────────────────────────────────────────
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  const [lastStockResult, setLastStockResult] = useState<{
    updated: number;
    errors: string[];
  } | null>(null);

  const meQuery = trpc.user.me.useQuery();
  const canManage = permAllows(meQuery.data?.permissions, "manage_settings");

  // ─── Load saved settings from DB ─────────────────────────
  const {
    data: savedSettings,
    isLoading: settingsLoading,
    isError: settingsError,
    refetch: refetchSettings,
  } = trpc.settings.getMany.useQuery(
    { keys: STOCK_SETTING_KEYS },
    { enabled: canManage },
  );

  const savedApiUrl = savedSettings?.[STOCK_API_URL_KEY] ?? "";
  const savedApiKey = savedSettings?.[STOCK_API_KEY_KEY] ?? "";
  const apiUrl = draft?.apiUrl ?? savedApiUrl;
  const apiKey = draft?.apiKey ?? savedApiKey;
  const isSaved = apiUrl === savedApiUrl && apiKey === savedApiKey;

  // ─── Queries ──────────────────────────────────────────────
  const {
    data: syncStatus,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = trpc.stockSync.status.useQuery(undefined, { enabled: canManage });
  const demoMode = syncStatus?.demoMode === true;

  // ─── Mutations ────────────────────────────────────────────
  const utils = trpc.useUtils();

  const saveSettings = trpc.settings.setMany.useMutation({
    onSuccess: () => {
      utils.settings.getMany.setData(
        { keys: STOCK_SETTING_KEYS },
        {
          ...(savedSettings ?? {}),
          [STOCK_API_URL_KEY]: apiUrl.trim(),
          [STOCK_API_KEY_KEY]: apiKey.trim(),
        },
      );
      setDraft(null);
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

  const syncStock = trpc.stockSync.syncStock.useMutation({
    onSuccess: (result) => {
      setLastStockResult(result);
      toast.success("ดึงยอดคงเหลือแล้ว", {
        description: `อัปเดต ${result.updated} รายการ`,
      });
      utils.stockSync.status.invalidate();
    },
    onError: (error) => {
      toast.error("ดึงยอดคงเหลือไม่สำเร็จ", { description: error.message });
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

  const hasCredentials = Boolean(apiUrl.trim() && apiKey.trim());
  /** ตั้งค่าไว้แล้วจริงในฐานข้อมูล (ไม่ใช่ค่าที่เพิ่งพิมพ์) — ใช้บอกสถานะบนแถบ */
  const isLinked = Boolean(savedApiUrl && savedApiKey);

  return (
    <PageShell
      title="สต๊อกเสื้อ"
      description="ยอดจริงอยู่ที่ Anajak Stock · ที่นี่ตั้งค่าการเชื่อมต่อและสั่งดึงยอด"
      loading={meQuery.isLoading || (canManage && statusLoading)}
      /* ปุ่มสั่งดึงยอดอยู่มุมขวาบนตามต้นแบบ — ของเดิมฝังอยู่กลางหน้า ต้องเลื่อนหา */
      action={
        !demoMode ? (
          <Button
            variant="outline"
            onClick={() => syncStock.mutate()}
            disabled={syncStock.isPending || !hasCredentials}
          >
            {syncStock.isPending ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            {syncStock.isPending ? "กำลังดึงยอด…" : "ดึงยอดล่าสุด"}
          </Button>
        ) : undefined
      }
      error={
        meQuery.isError
          ? {
              message: "ตรวจสอบสิทธิ์หน้าการเชื่อมต่อ Stock ไม่ได้",
              onRetry: () => void meQuery.refetch(),
            }
          : // โหลด settings ไม่สำเร็จ → ไม่ render ฟอร์มค่าว่าง กันบันทึกทับค่าเชื่อมต่อจริง
            // && !data: refetch เบื้องหลังล้มระหว่างแก้ฟอร์มอยู่ ห้ามถอนฟอร์ม (ของที่พิมพ์หาย)
            settingsError && !savedSettings && !demoMode
            ? {
                message: "โหลดค่าการเชื่อมต่อ Stock ไม่สำเร็จ",
                onRetry: () => void refetchSettings(),
              }
            : null
      }
      denied={
        !canManage && {
          title: "ไม่มีสิทธิ์ตั้งค่าการเชื่อมต่อ Stock",
          description: "หน้านี้เปิดให้ผู้ที่ได้รับสิทธิ์ตั้งค่าระบบเท่านั้น",
        }
      }
    >
      {/* แถบสถานะบรรทัดเดียวตามต้นแบบ (.statusbar) — เดิมกระจายเป็น 4 บรรทัดในกล่องเทา */}
      {syncStatus ? (
        <div className="card-surface flex flex-wrap items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-secondary">
          <span className={c("stat")}>
            <span
              className={c(demoMode ? "d warn" : isLinked ? "d good" : "d gray")}
              aria-hidden="true"
            />
            <b className="font-medium">
              {demoMode
                ? "ใช้สต๊อกทดลองในเครื่อง"
                : isLinked
                  ? "เชื่อมกับ Anajak Stock อยู่"
                  : "ยังไม่ได้ตั้งค่าการเชื่อมต่อ"}
            </b>
          </span>
          <span className="h-4 w-px bg-divider" aria-hidden="true" />
          <span className="tabular-nums">
            {syncStatus.lastSyncAt
              ? `ดึงล่าสุด ${formatDateTime(syncStatus.lastSyncAt)}`
              : "ยังไม่เคยดึงยอด"}
            {" · สินค้าทั้งหมด "}
            {syncStatus.totalProducts} รายการ
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-2">
        {demoMode ? (
          <Section
            className="lg:col-span-2"
            title="ใช้สต๊อกทดลองในเครื่อง"
            icon={Database}
            tone="system"
            description="ยอดจอง เบิก และคืนจะเปลี่ยนเฉพาะข้อมูลสำหรับทดลองเท่านั้น"
          >
            <ContextPanel tone="info" title="พื้นที่ทดลองแยกจาก Anajak Stock">
              ข้อมูลในหน้านี้ไม่ถูกส่งไปคลังหลัก หากต้องการเริ่มใหม่ให้ผู้ดูแลระบบคืนข้อมูลตัวอย่าง แล้วทดลองเบิกจากจอสถานี
            </ContextPanel>
          </Section>
        ) : (
          <>
        {/* ─── Connection Section ─────────────────────────────── */}
        <Section
          title="การเชื่อมต่อ API"
          icon={Plug}
          tone="system"
          description="ใส่ API URL และ API Key จากระบบ Anajak Stock"
        >
          <div className="space-y-4">
            {settingsError ? (
              <QueryError
                message="โหลดค่าการเชื่อมต่อ Stock ไม่สำเร็จ"
                onRetry={() => void refetchSettings()}
              />
            ) : settingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            ) : (
              <>
                {/* API URL */}
                <div>
                  <div className="mb-1.5 flex items-center gap-1">
                    <label htmlFor="stock-api-url" className="text-sm font-medium text-secondary">
                      API URL
                    </label>
                    <HelpTip label="API URL">ดูได้ที่หน้า Integrations ในระบบ Stock</HelpTip>
                  </div>
                  <Input
                    id="stock-api-url"
                    value={apiUrl}
                        onChange={(e) =>
                          setDraft({ apiUrl: e.target.value, apiKey })
                        }
                    placeholder="https://stock.anajak.com/api"
                    className="font-mono"
                  />
                </div>

                {/* API Key */}
                <div>
                      <label
                        htmlFor="stock-api-key"
                        className="mb-1.5 block text-sm font-medium text-secondary"
                      >
                    API Key
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="stock-api-key"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                            onChange={(e) =>
                              setDraft({ apiUrl, apiKey: e.target.value })
                            }
                        placeholder="sk_xxxxxxxxxxxxxxxx"
                        className="pr-10 font-mono"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowApiKey(!showApiKey)}
                            aria-label={
                              showApiKey ? "ซ่อน API Key" : "แสดง API Key"
                            }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted"
                      >
                            {showApiKey ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                        สร้าง API Key ได้ที่ระบบ Stock &gt; ตั้งค่า &gt;
                        เชื่อมต่อระบบ &gt; เพิ่ม Custom ERP
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
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Plug />
                    )}
                        {testConnection.isPending
                          ? "กำลังทดสอบ..."
                          : "ทดสอบเชื่อมต่อ"}
                  </Button>
                  <Button
                    onClick={handleSave}
                        disabled={
                          saveSettings.isPending || isSaved || !hasCredentials
                        }
                    className="flex-1"
                  >
                    {saveSettings.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                        {saveSettings.isPending
                          ? "กำลังบันทึก..."
                          : isSaved
                            ? "บันทึกแล้ว"
                            : "บันทึก"}
                  </Button>
                </div>

                {/* Unsaved changes indicator */}
                {!isSaved && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    * มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
                  </p>
                )}

                {/* Connection result */}
                {connectionResult && (
                  <div
                    className={cn(
                      RADIUS.inner,
                      "flex items-center gap-2 border p-3 text-sm",
                      connectionResult.connected ? TINT.success : TINT.error,
                    )}
                  >
                    {connectionResult.connected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>
                          เชื่อมต่อสำเร็จ
                              {connectionResult.name &&
                                ` — ${connectionResult.name}`}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 shrink-0" />
                            <span>
                              {connectionResult.error ||
                                "ไม่สามารถเชื่อมต่อได้"}
                            </span>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Section>

        {/* ─── Sync Section ──────────────────────────────────── */}
        <Section title="ดึงข้อมูลสินค้า" icon={RefreshCw} tone="system" flush>
          <div className="space-y-4 px-4.5 pt-4">
            {/* Sync status summary */}
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              {statusError ? (
                <QueryError
                  message="โหลดสถานะ Stock ไม่สำเร็จ"
                  onRetry={() => void refetchStatus()}
                />
              ) : statusLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : syncStatus ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                        <span className="text-muted">
                          สินค้าจาก Anajak Stock
                        </span>
                    <span className="font-medium text-strong">
                      {syncStatus.totalStockProducts} รายการ
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                        <span className="text-muted">
                          สินค้าที่สร้างในระบบนี้
                        </span>
                    <span className="font-medium text-strong">
                      {syncStatus.totalLocalProducts} รายการ
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
                        <span className="text-muted">
                          สินค้าทั้งหมด
                        </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {syncStatus.totalProducts} รายการ
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">ไม่สามารถโหลดสถานะได้</p>
              )}
            </div>

            {/* ปุ่มดึงเฉพาะยอดคงเหลือย้ายขึ้นมุมขวาบนของหน้าแล้ว — ที่นี่เหลือการดึงรายการสินค้าทีละหน้า */}
            <Button
              onClick={() => setSyncDialogOpen(true)}
              disabled={!hasCredentials}
              className="w-full"
            >
              <Cloud />
              ดึงรายการสินค้า
            </Button>

            {/* Last stock sync result */}
            {lastStockResult && (
              <Alert variant="success">
                <p className="mb-1 text-sm font-medium text-green-700 dark:text-green-400">
                  ผลการดึงยอดคงเหลือ
                </p>
                <p className="text-xs text-green-600 dark:text-green-300">
                  อัปเดต: {lastStockResult.updated} รายการ
                </p>
                {lastStockResult.errors.length > 0 && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    ข้อผิดพลาด: {lastStockResult.errors.length} รายการ
                  </p>
                )}
              </Alert>
            )}
          </div>

          {/* แถบสรุปท้ายการ์ดตามต้นแบบ (.tfoot) — ที่นี่ไม่มีตารางยอด ต้องบอกว่าไปดูที่ไหน */}
          <div className={cn(c("tfoot"), "mt-4")}>
            ดึงยอดเมื่อกดสั่งเท่านั้น · ยอดคงเหลือรายสินค้าดูที่{" "}
            <Link href="/products" className="text-blue-600 dark:text-blue-400">
              หน้าสินค้า
            </Link>
          </div>
        </Section>
          </>
        )}

        {/* ─── Category Mapping ──────────────────────────────── */}
        <Section
          title="การแมปหมวดหมู่"
          icon={ArrowRightLeft}
          tone="system"
          description="ระบบแมปเข้ากลุ่มสินค้าให้อัตโนมัติ"
          flush
        >
          <DataTable.Root bordered={false}>
            <DataTable.Head>
              <tr>
                <DataTable.Th>หมวดหมู่ Stock</DataTable.Th>
                <DataTable.Th aria-label="แมปไปยัง" align="center">
                  →
                </DataTable.Th>
                <DataTable.Th>ประเภทสินค้า ERP</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {itemTypeMappings.map((mapping, i) => (
                <DataTable.Row key={i}>
                  <th
                    scope="row"
                    className="px-6 py-4 text-left text-sm font-normal text-strong"
                  >
                    {mapping.stockCategory}
                  </th>
                  <DataTable.Td
                    aria-hidden="true"
                    align="center"
                    className="text-muted"
                  >
                    →
                  </DataTable.Td>
                  <DataTable.Td
                    aria-label={`${mapping.erpItemType} ${mapping.erpCode}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-strong">
                        {mapping.erpItemType}
                      </span>
                      <Badge variant="secondary">
                        {mapping.erpCode}
                      </Badge>
                    </div>
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>
        </Section>

        {/* ─── Info / How-to Section ────────────────────────── */}
        {!demoMode ? (
        <Section title="วิธีเชื่อมต่อ" icon={Info} tone="system">
          <div className="space-y-3 text-sm text-secondary">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  1
                </div>
                <div>
                  <p className="font-medium text-strong">
                    สร้าง API Key ในระบบ Stock
                  </p>
                  <p className="text-xs">
                      ไปที่ Anajak Stock &gt; ตั้งค่า &gt; เชื่อมต่อระบบ &gt;
                      เพิ่มการเชื่อมต่อ &gt; เลือก &quot;Custom ERP&quot; &gt;
                      กด &quot;สร้าง&quot; API Key
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  2
                </div>
                <div>
                  <p className="font-medium text-strong">
                    คัดลอก API URL และ API Key
                  </p>
                  <p className="text-xs">
                      ในหน้า Integrations ของ Stock จะแสดง API URL (เช่น
                      https://stock.anajak.com/api) และ API Key ที่สร้างไว้
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  3
                </div>
                <div>
                  <p className="font-medium text-strong">
                    วาง URL + Key ในฟอร์มด้านบน แล้วกดบันทึก
                  </p>
                  <p className="text-xs">
                      กด &quot;ทดสอบเชื่อมต่อ&quot; เพื่อตรวจสอบ แล้วกด
                      &quot;บันทึก&quot; เพื่อเก็บไว้ในระบบ
                  </p>
                </div>
              </div>
            </div>

            <Alert variant="info" className="mt-4">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                  ใส่ค่าผ่านหน้านี้ได้เลย ไม่ต้องตั้งค่า ENV ที่เครื่องเซิร์ฟเวอร์
              </p>
            </Alert>
          </div>
        </Section>
        ) : null}
      </div>

      {/* ─── Sync Dialog ─────────────────────────────────────── */}
      {!demoMode ? (
      <SyncDialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
      />
      ) : null}
    </PageShell>
  );
}
