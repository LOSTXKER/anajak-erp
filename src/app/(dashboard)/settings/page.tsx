"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Settings, SlidersHorizontal } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FOCUS_BUTTON, INTERACTIVE_PAGE_PRESSED } from "@/components/ui/tokens";
import { c, CardHead } from "@/components/kit/kit";
import { trpc } from "@/lib/trpc";
import { hasPermission, permAllows } from "@/lib/permissions";
import { SETTING_LINKS, SETTING_SUMMARY_HREFS, type SettingLink } from "@/lib/settings-nav";
import { cn, formatDateShort, formatDateTime } from "@/lib/utils";

// หน้าตั้งค่า = ทางเข้าหน้าตั้งค่าจริงเท่านั้น (Gate B8) — ฟอร์มปลอม 4 section เดิม
// (ข้อมูลโรงงาน/การผลิต/ความปลอดภัย/เชื่อมต่อภายนอก) ถูกถอดทิ้ง: input ไม่ผูกอะไร
// ปุ่ม "บันทึก" แค่ปิดแถบ = ระบบโกหกผู้ใช้ (audit 2026-07-02 จัด BLOCKER ความเชื่อใจ)
// 2026-09-16: เมนูข้างย้ายไป layout แล้ว หน้านี้จึงเหลือรายการพร้อมคำอธิบายว่าแต่ละหัวข้อตั้งอะไร
// 2026-09-17 (ต้นแบบทั้งเว็บ): การ์ดสรุป 6 ทางเข้าที่ใช้บ่อย + การ์ด "ยังไม่ได้ตั้ง" + การ์ด "ตั้งค่าอื่น"
//   บรรทัดรองของ 6 แถวบนเป็น "ค่าที่ตั้งไว้จริง" ไม่ใช่คำอธิบายตายตัว — ดึงจาก query ที่มีอยู่แล้ว
//   ไม่แตะ API · ไม่มีสิทธิ์/โหลดไม่สำเร็จ = ตกกลับไปใช้คำอธิบายเดิม (ห้ามโชว์ 0 หรือค่าว่างลอยๆ)
//   กลุ่มหัวข้อไม่ซ้ำในหน้านี้แล้ว เพราะเมนูข้างแบ่งกลุ่มอยู่ติดกันอยู่แล้ว

/** แถวในการ์ด — ไอคอนกล่องเทากลางทุกแถว (สีเก็บไว้ให้การ์ด "ยังไม่ได้ตั้ง" เท่านั้น) */
function SettingRow({ link, fact }: { link: SettingLink; fact?: string }) {
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 border-b border-divider/60 px-4.5 py-3 last:border-b-0",
        FOCUS_BUTTON,
        INTERACTIVE_PAGE_PRESSED,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-surface-muted text-muted">
        <link.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-strong">{link.title}</span>
        <span className="mt-0.5 block text-xs text-secondary">{fact ?? link.meta}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
    </Link>
  );
}

export default function SettingsPage() {
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const ready = Boolean(me);

  const visibleLinks = SETTING_LINKS.filter(
    (link) =>
      !link.permissionsAny ||
      link.permissionsAny.some((permission) => permAllows(me?.permissions, permission)),
  );
  const canSee = (href: string) => visibleLinks.some((link) => link.href === href);

  // ---- ข้อเท็จจริงของแต่ละหัวข้อ · ยิงเฉพาะหัวข้อที่ผู้ใช้เห็นและมีสิทธิ์อ่านข้อมูลนั้นจริง ----
  // user.list เป็น OWNER เท่านั้น (manage_users override ไม่ได้) · auditLog ต้องมี view_admin_reports
  const canReadUsers = ready && canSee("/settings/users") && permAllows(me?.permissions, "manage_users");
  const canReadBackupLog =
    ready && canSee("/settings/backup") && permAllows(me?.permissions, "view_admin_reports");

  const companyQuery = trpc.settings.companyProfile.useQuery(undefined, {
    enabled: ready && canSee("/settings/company"),
  });
  const usersQuery = trpc.user.list.useQuery(undefined, { enabled: canReadUsers });
  const servicesQuery = trpc.serviceCatalog.list.useQuery(
    {},
    { enabled: ready && canSee("/settings/services") },
  );
  const stockQuery = trpc.stockSync.status.useQuery(undefined, {
    enabled: ready && canSee("/settings/stock"),
  });
  const vendorsQuery = trpc.outsource.listVendors.useQuery(
    {},
    { enabled: ready && canSee("/settings/vendors") },
  );
  const backupQuery = trpc.analytics.auditLog.useQuery(
    { entityType: "DATABASE_BACKUP", page: 1, limit: 1 },
    { enabled: canReadBackupLog },
  );

  const company = companyQuery.data;
  const users = usersQuery.data;
  const services = servicesQuery.data;
  const stock = stockQuery.data;
  const vendors = vendorsQuery.data;
  const lastBackup = backupQuery.data?.logs?.[0];

  const facts: Record<string, string | undefined> = {};

  if (company) {
    const parts = [company.name || "ยังไม่ได้กรอกชื่อกิจการ"];
    if (company.taxId) parts.push(`เลขภาษี ${company.taxId}`);
    facts["/settings/company"] = parts.join(" · ");
  }

  if (users) {
    // "เห็นเงิน" อ่านจากสิทธิ์ผลลัพธ์จริงของแต่ละคน (role + override) ไม่ใช่เดาจากตำแหน่ง
    const active = users.filter((user) => user.isActive);
    const moneyCount = active.filter((user) =>
      hasPermission(user.role, user.permissionOverrides, "see_order_money"),
    ).length;
    facts["/settings/users"] = `${active.length} คนที่ใช้งานอยู่ · เห็นเงินได้ ${moneyCount} คน`;
  }

  if (services) {
    const activeCount = services.filter((item) => item.isActive).length;
    const latest = services.reduce<Date | null>((newest, item) => {
      const at = new Date(item.updatedAt);
      return !newest || at > newest ? at : newest;
    }, null);
    facts["/settings/services"] = latest
      ? `${activeCount} บริการที่เปิดใช้ · แก้ล่าสุด ${formatDateShort(latest)}`
      : `${activeCount} บริการที่เปิดใช้`;
  }

  if (stock) {
    facts["/settings/stock"] = stock.lastSyncAt
      ? `เสื้อจาก Anajak Stock ${stock.totalStockProducts} รายการ · ดึงล่าสุด ${formatDateTime(stock.lastSyncAt)}`
      : "ยังไม่เคยดึงข้อมูลจาก Anajak Stock";
  }

  if (vendors) {
    facts["/settings/vendors"] =
      vendors.length > 0 ? `${vendors.length} ร้านที่ใช้งานอยู่` : "ยังไม่มีร้านรับจ้าง";
  }

  if (backupQuery.data) {
    facts["/settings/backup"] = lastBackup
      ? `ล่าสุด ${formatDateTime(lastBackup.createdAt)}`
      : "ยังไม่เคยสำรองข้อมูล";
  }

  // ---- ยังไม่ได้ตั้ง: เฉพาะเงื่อนไขที่ตรวจได้จริงจากข้อมูลที่โหลดมาแล้ว ----
  // ต้นแบบยกตัวอย่าง "ตารางวัดแพทเทิร์น" กับ "ค่าส่งเริ่มต้น" ซึ่งระบบจริงไม่มีฟิลด์เหล่านั้น
  // ใส่ตามต้นแบบ = ป้ายปลอม (ขัด Gate B8) จึงเปลี่ยนไปใช้เงื่อนไขที่อ่านจาก DB ได้จริง
  const pending: { href: string; title: string; reason: string }[] = [];
  if (company && canSee("/settings/company") && (!company.taxId || !company.address)) {
    pending.push({
      href: "/settings/company",
      title: "ข้อมูลกิจการ",
      reason: "ยังไม่มีเลขผู้เสียภาษีหรือที่อยู่ ใบกำกับภาษีเต็มรูปจึงยังออกไม่ได้",
    });
  }
  if (services && canSee("/settings/services") && services.every((item) => !item.isActive)) {
    pending.push({
      href: "/settings/services",
      title: "บริการและราคา",
      reason: "ยังไม่มีบริการที่เปิดใช้ ตอนเปิดออเดอร์จะไม่มีรายการให้เลือก",
    });
  }
  if (vendors && canSee("/settings/vendors") && vendors.length === 0) {
    pending.push({
      href: "/settings/vendors",
      title: "ร้านรับจ้างภายนอก",
      reason: "ยังไม่มีร้าน ส่งขั้นผลิตออกไปทำข้างนอกไม่ได้",
    });
  }
  if (backupQuery.data && canSee("/settings/backup") && !lastBackup) {
    pending.push({
      href: "/settings/backup",
      title: "สำรองข้อมูล",
      reason: "ยังไม่เคยดาวน์โหลดไฟล์สำรอง หากฐานข้อมูลเสียจะกู้ไม่ได้",
    });
  }

  // ชิป "ตั้งครบแล้ว" = คำตัดสิน จึงขึ้นได้ต่อเมื่อเงื่อนไขทุกข้อที่ผู้ใช้คนนี้ตรวจได้ โหลดครบและผ่านหมด
  const checkedAll =
    (!canSee("/settings/company") || Boolean(company)) &&
    (!canSee("/settings/services") || Boolean(services)) &&
    (!canSee("/settings/vendors") || Boolean(vendors)) &&
    (!canReadBackupLog || Boolean(backupQuery.data));
  const allSet = checkedAll && pending.length === 0;

  const summaryLinks = SETTING_SUMMARY_HREFS.map((href) =>
    visibleLinks.find((link) => link.href === href),
  ).filter((link): link is SettingLink => Boolean(link));
  const otherLinks = visibleLinks.filter(
    (link) => !SETTING_SUMMARY_HREFS.some((href) => href === link.href),
  );

  return (
    <PageShell
      title="ตั้งค่า"
      description="ค่าที่ตั้งครั้งเดียวแล้วทั้งระบบใช้ต่อ"
      loading={meQuery.isLoading}
      error={
        meQuery.isError
          ? { message: "โหลดสิทธิ์สำหรับหน้าตั้งค่าไม่สำเร็จ", onRetry: () => void meQuery.refetch() }
          : null
      }
      skeleton={<Skeleton className="h-[420px] rounded-2xl" />}
    >
      {summaryLinks.length > 0 && (
        <section className="card-surface overflow-hidden rounded-2xl">
          <CardHead
            icon={Settings}
            tone="blue"
            title="สรุปการตั้งค่าที่ใช้อยู่"
            right={allSet ? <span className={c("chip good")}>ตั้งครบแล้ว</span> : undefined}
          />
          <div className="border-t border-divider/60">
            {summaryLinks.map((link) => (
              <SettingRow key={link.href} link={link} fact={facts[link.href]} />
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="card-surface overflow-hidden rounded-2xl">
          <CardHead icon={AlertTriangle} tone="warn" title="ยังไม่ได้ตั้ง" />
          <div className="border-t border-divider/60">
            {pending.map((item) => (
              <div
                key={item.href}
                className="flex flex-wrap items-center gap-3 border-b border-divider/60 px-4.5 py-3 last:border-b-0"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-strong">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-secondary">{item.reason}</span>
                </span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={item.href}>ไปตั้ง</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {otherLinks.length > 0 && (
        <section className="card-surface overflow-hidden rounded-2xl">
          <CardHead icon={SlidersHorizontal} title="ตั้งค่าอื่น" />
          <div className="border-t border-divider/60">
            {otherLinks.map((link) => (
              <SettingRow key={link.href} link={link} />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
