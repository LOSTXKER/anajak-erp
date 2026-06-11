"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Factory,
  Palette,
  Truck,
  FileText,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  ClipboardList,
  Package,
  Cloud,
  Scissors,
  FileStack,
  Hourglass,
  ListTodo,
} from "lucide-react";
import { useState, type ComponentType } from "react";

type NavItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
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
      { name: "ใบเสนอราคา", href: "/quotations", icon: ClipboardList },
      { name: "ลูกค้า", href: "/customers", icon: Users },
    ],
  },
  {
    label: "ผลิต",
    items: [
      { name: "การผลิต", href: "/production", icon: Factory },
      { name: "งานออกแบบ", href: "/designs", icon: Palette },
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
    label: "การเงิน",
    items: [
      { name: "บิล/การเงิน", href: "/billing", icon: FileText },
      { name: "ใบวางบิล", href: "/billing/notes", icon: FileStack },
      { name: "ลูกหนี้", href: "/billing/aging", icon: Hourglass },
      { name: "สถิติ", href: "/analytics", icon: BarChart3 },
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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "flex-col transition-[width] duration-200",
        mobile
          ? "flex h-full w-64 bg-[#f5f5f7] dark:bg-slate-950"
          : cn(
              "hidden h-screen bg-[#f5f5f7]/80 backdrop-blur-xl md:flex dark:bg-black/60",
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
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Printer className="h-3.5 w-3.5" />
          </div>
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
              Anajak Print
            </span>
          )}
        </Link>
        {!mobile && (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
            aria-label={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-6 pt-2">
        {groups.map((group, idx) => (
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
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
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
                        <span className="truncate">{item.name}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
