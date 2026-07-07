"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Factory,
  Truck,
  FileText,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Film,
  ClipboardList,
  Package,
  Cloud,
  Scissors,
  FileStack,
  Hourglass,
  ListTodo,
  ReceiptText,
  Landmark,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS } from "@/lib/roles";
import { permAllows, type Permission } from "@/lib/permissions";

type NavItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  // จำกัดสิทธิ์ที่เห็นเมนูนี้ — ไม่ระบุ = ทุกคน (B12+PERM4: เมนูตามสิทธิ์จริงของคน ตรงด่าน server)
  permission?: Permission;
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: null,
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "งานของฉัน", href: "/my-tasks", icon: ListTodo },
    ],
  },
  {
    label: "ขาย",
    items: [
      { name: "ออเดอร์", href: "/orders", icon: ShoppingCart },
      // ใบเสนอ = ราคาขายล้วน — ช่าง/กราฟิกไม่เห็น (Policy ⑦ · server requireRole แล้ว กดเข้าก็ FORBIDDEN)
      { name: "ใบเสนอราคา", href: "/quotations", icon: ClipboardList, permission: "see_order_money" },
      { name: "ลูกค้า", href: "/customers", icon: Users },
    ],
  },
  {
    label: "ผลิต",
    items: [
      { name: "การผลิต", href: "/production", icon: Factory },
      { name: "รอบพิมพ์ฟิล์ม", href: "/production/print-runs", icon: Printer },
      { name: "คลังฟิล์ม", href: "/production/films", icon: Film },
      { name: "Outsource", href: "/outsource", icon: Truck },
    ],
  },
  {
    label: "สินค้า",
    items: [
      { name: "สินค้า", href: "/products", icon: Package },
      { name: "แพทเทิร์น", href: "/settings/patterns", icon: Scissors },
    ],
  },
  {
    // ทั้งกลุ่มจำกัดทีมการเงิน — server ทุกหน้าใช้ billingStaff (OWNER/MANAGER/ACCOUNTANT)
    // ช่าง/กราฟิก/ขาย ไม่เห็น (เดิมโชว์ทุก role กดแล้วโดน FORBIDDEN)
    label: "การเงิน",
    items: [
      { name: "บิล/การเงิน", href: "/billing", icon: FileText, permission: "manage_billing_docs" },
      { name: "ใบวางบิล", href: "/billing/notes", icon: FileStack, permission: "manage_billing_docs" },
      { name: "ลูกหนี้", href: "/billing/aging", icon: Hourglass, permission: "manage_billing_docs" },
      { name: "หัก ณ ที่จ่าย", href: "/billing/wht", icon: ReceiptText, permission: "manage_billing_docs" },
      { name: "ภาษีขาย", href: "/billing/tax", icon: Landmark, permission: "manage_billing_docs" },
      { name: "สถิติ", href: "/analytics", icon: BarChart3, permission: "see_finance" },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { name: "ตั้งค่า", href: "/settings", icon: Settings },
      { name: "เชื่อมต่อ Stock", href: "/settings/stock", icon: Cloud },
    ],
  },
];

export function Sidebar({
  mobile = false,
  onNavigate,
}: {
  // โหมด drawer บนมือถือ — พื้นทึบ เต็มสูง ไม่ย่อ (audit ข้อ 30: เดิม sidebar กิน 2/3 จอมือถือ)
  mobile?: boolean;
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: me } = trpc.user.me.useQuery();
  const { data: navBadges } = trpc.task.navBadges.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // ตัวเลขงานค้างบนเมนู — โชว์เฉพาะที่มีค่า > 0
  const badgeFor = (href: string): number | undefined => {
    const n =
      href === "/production"
        ? navBadges?.production
        : href === "/outsource"
          ? navBadges?.outsource
          : undefined;
    return n && n > 0 ? n : undefined;
  };

  // กรองเมนูตาม role — ซ่อนทั้งกลุ่มที่ไม่เหลือรายการ (กลุ่มการเงินหายทั้งก้อนสำหรับช่าง)
  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => permAllows(me?.permissions, it.permission)) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside
      className={cn(
        "flex-col transition-[width] duration-200",
        mobile
          ? "flex h-full w-64 bg-[#f5f5f7] dark:bg-slate-950"
          : cn(
              "hidden h-screen border-r border-black/[0.07] bg-[#f5f5f7]/80 backdrop-blur-xl md:flex dark:border-white/[0.06] dark:bg-black/60",
              collapsed ? "w-[68px]" : "w-64"
            )
      )}
    >
      {/* Brand row */}
      <div className="flex h-14 items-center justify-between gap-2 px-3.5">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Printer className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
              Anajak Print
            </span>
          )}
        </Link>
        {!mobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed((v) => !v)}
            className="h-7 w-7 shrink-0 text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
            aria-label={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-6 pt-2">
        {visibleGroups.map((group, idx) => (
          <div key={idx} className={idx === 0 ? "" : "mt-5"}>
            {group.label && !collapsed && (
              <p className="px-3 pb-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-white/10 dark:text-white"
                          : "text-slate-600 hover:bg-black/[0.04] hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0",
                          active
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-500 dark:text-slate-500"
                        )}
                        strokeWidth={1.75}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.name}</span>
                          {badgeFor(item.href) !== undefined && (
                            <Badge
                              variant={active ? "accent" : "default"}
                              size="sm"
                              className="ml-auto shrink-0 font-semibold tabular-nums"
                            >
                              {badgeFor(item.href)}
                            </Badge>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* การ์ดผู้ใช้ท้ายแถบเมนู (แนวภาพ A) — ย่อเหลือ avatar ตอน collapse */}
      {me && (
        <div className={cn("pb-3", collapsed ? "px-2" : "px-3")}>
          {collapsed ? (
            <div
              title={me.name ?? undefined}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[12px] font-semibold text-white"
            >
              {me.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-white/5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[12px] font-semibold text-white">
                {me.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-slate-900 dark:text-white">
                  {me.name ?? "..."}
                </p>
                <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                  {me.role ? ROLE_LABELS[me.role] ?? me.role : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
