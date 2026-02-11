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
  ChevronLeft,
  Printer,
  ClipboardList,
  Package,
  Cloud,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "ออเดอร์", href: "/orders", icon: ShoppingCart },
  { name: "ใบเสนอราคา", href: "/quotations", icon: ClipboardList },
  { name: "สินค้า", href: "/products", icon: Package },
  { name: "ลูกค้า", href: "/customers", icon: Users },
  { name: "การผลิต", href: "/production", icon: Factory },
  { name: "งานออกแบบ", href: "/designs", icon: Palette },
  { name: "Outsource", href: "/outsource", icon: Truck },
  { name: "บิล/การเงิน", href: "/billing", icon: FileText },
  { name: "สถิติ", href: "/analytics", icon: BarChart3 },
  { name: "ตั้งค่า", href: "/settings", icon: Settings },
  { name: "เชื่อมต่อ Stock", href: "/settings/stock", icon: Cloud },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-950",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Printer className="h-4 w-4" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-slate-900 dark:text-white">
            Anajak Print
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse button */}
      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>
    </aside>
  );
}
