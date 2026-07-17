import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  ClipboardList,
  Cloud,
  Factory,
  FileStack,
  FileText,
  Film,
  Hourglass,
  Landmark,
  LayoutDashboard,
  ListTodo,
  Monitor,
  Package,
  Printer,
  ReceiptText,
  Scissors,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { permAllows, type Permission } from "@/lib/permissions";

export type NavigationSurface = "sidebar" | "palette";
export type NavigationGroupId = "main" | "sales" | "production" | "products" | "finance" | "system";

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavigationGroupId;
  permission?: Permission | Permission[];
  aliases: readonly string[];
  surfaces: readonly NavigationSurface[];
  match?: "exact" | "section";
};

export type NavigationGroup = {
  id: NavigationGroupId;
  label: string | null;
};

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  { id: "main", label: null },
  { id: "sales", label: "ขาย" },
  { id: "production", label: "ผลิต" },
  { id: "products", label: "สินค้า" },
  { id: "finance", label: "การเงิน" },
  { id: "system", label: "ระบบ" },
];

const BOTH = ["sidebar", "palette"] as const;

/**
 * แหล่งเดียวของ navigation หลังบ้าน — Sidebar และ Command Palette ต้องอ่านจากชุดนี้
 * เพื่อให้ป้าย สิทธิ์ คำค้น และ route ไม่ drift คนละทางอีก
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    id: "dashboard",
    label: "แดชบอร์ด",
    href: "/",
    icon: LayoutDashboard,
    group: "main",
    aliases: ["dashboard", "overview", "ภาพรวม"],
    surfaces: BOTH,
    match: "exact",
  },
  {
    id: "my-tasks",
    label: "งานของฉัน",
    href: "/my-tasks",
    icon: ListTodo,
    group: "main",
    aliases: ["task", "today", "คิวงาน", "งานวันนี้"],
    surfaces: BOTH,
  },
  {
    id: "orders",
    label: "ออเดอร์",
    href: "/orders",
    icon: ShoppingCart,
    group: "sales",
    aliases: ["order", "job", "งาน", "ใบสอบถาม"],
    surfaces: BOTH,
  },
  {
    id: "quotations",
    label: "ใบเสนอราคา",
    href: "/quotations",
    icon: ClipboardList,
    group: "sales",
    permission: "see_order_money",
    aliases: ["quotation", "quote", "qt", "เสนอราคา"],
    surfaces: BOTH,
  },
  {
    id: "customers",
    label: "ลูกค้า",
    href: "/customers",
    icon: Users,
    group: "sales",
    aliases: ["customer", "crm", "ผู้ติดต่อ"],
    surfaces: BOTH,
  },
  {
    id: "production",
    label: "การผลิต",
    href: "/production",
    icon: Factory,
    group: "production",
    aliases: ["production", "ผลิต", "คิวผลิต"],
    surfaces: BOTH,
  },
  {
    id: "factory",
    label: "จอโรงงาน",
    href: "/factory",
    icon: Monitor,
    group: "production",
    permission: "supervise_operations",
    aliases: ["factory", "tv", "command center", "คิวรวม"],
    surfaces: BOTH,
  },
  {
    id: "print-runs",
    label: "รอบพิมพ์ฟิล์ม",
    href: "/production/print-runs",
    icon: Printer,
    group: "production",
    aliases: ["print run", "film run", "รอบพิมพ์"],
    surfaces: ["sidebar"],
  },
  {
    id: "films",
    label: "คลังฟิล์ม",
    href: "/production/films",
    icon: Film,
    group: "production",
    aliases: ["film", "ฟิล์ม", "คลังลาย"],
    surfaces: ["sidebar"],
  },
  {
    id: "outsource",
    label: "จ้างร้านนอก",
    href: "/outsource",
    icon: Truck,
    group: "production",
    aliases: ["outsource", "vendor", "ร้านนอก", "จ้างผลิต"],
    surfaces: BOTH,
  },
  {
    id: "products",
    label: "สินค้า",
    href: "/products",
    icon: Package,
    group: "products",
    aliases: ["product", "sku", "catalog", "สินค้า"],
    surfaces: BOTH,
  },
  {
    id: "patterns",
    label: "แพทเทิร์น",
    href: "/settings/patterns",
    icon: Scissors,
    group: "products",
    aliases: ["pattern", "แพทเทิร์น", "แบบเสื้อ"],
    surfaces: BOTH,
  },
  {
    id: "billing",
    label: "บิล/การเงิน",
    href: "/billing",
    icon: FileText,
    group: "finance",
    permission: "manage_billing_docs",
    aliases: ["billing", "invoice", "bill", "บิล", "การเงิน"],
    surfaces: BOTH,
  },
  {
    id: "billing-notes",
    label: "ใบวางบิล",
    href: "/billing/notes",
    icon: FileStack,
    group: "finance",
    permission: "manage_billing_docs",
    aliases: ["billing note", "วางบิล"],
    surfaces: BOTH,
  },
  {
    id: "aging",
    label: "ลูกหนี้",
    href: "/billing/aging",
    icon: Hourglass,
    group: "finance",
    permission: "manage_billing_docs",
    aliases: ["aging", "receivable", "overdue", "ลูกหนี้", "ค้างชำระ"],
    surfaces: BOTH,
  },
  {
    id: "wht",
    label: "หัก ณ ที่จ่าย",
    href: "/billing/wht",
    icon: ReceiptText,
    group: "finance",
    permission: "manage_billing_docs",
    aliases: ["wht", "withholding tax", "50 ทวิ", "หัก ณ ที่จ่าย"],
    surfaces: ["sidebar"],
  },
  {
    id: "sales-tax",
    label: "ภาษีขาย",
    href: "/billing/tax",
    icon: Landmark,
    group: "finance",
    permission: "manage_billing_docs",
    aliases: ["sales tax", "vat", "peak", "ภาษีขาย"],
    surfaces: BOTH,
  },
  {
    id: "analytics",
    label: "สถิติ",
    href: "/analytics",
    icon: BarChart3,
    group: "finance",
    permission: "see_finance",
    aliases: ["analytics", "statistics", "report", "รายงาน", "สถิติ"],
    surfaces: BOTH,
  },
  {
    id: "notifications",
    label: "การแจ้งเตือน",
    href: "/notifications",
    icon: Bell,
    group: "system",
    aliases: ["notification", "alert", "แจ้งเตือน"],
    surfaces: ["palette"],
  },
  {
    id: "settings",
    label: "ตั้งค่า",
    href: "/settings",
    icon: Settings,
    group: "system",
    aliases: ["settings", "config", "ตั้งค่า", "ระบบ"],
    surfaces: BOTH,
  },
  {
    id: "stock",
    label: "เชื่อมต่อ Stock",
    href: "/settings/stock",
    icon: Cloud,
    group: "system",
    aliases: ["stock", "sync", "คลัง", "เชื่อมต่อ"],
    surfaces: BOTH,
  },
];

function normalizePath(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

export function navigationItemMatchesPath(item: NavigationItem, pathname: string): boolean {
  const current = normalizePath(pathname);
  const href = normalizePath(item.href);
  if (item.match === "exact" || href === "/") return current === href;
  return current === href || current.startsWith(`${href}/`);
}

/** เลือก route ที่เจาะจงที่สุด เพื่อไม่ให้ /billing และ /billing/notes active พร้อมกัน */
export function findActiveNavigationItem(
  pathname: string,
  items: readonly NavigationItem[] = NAVIGATION_ITEMS
): NavigationItem | undefined {
  return items
    .filter((item) => navigationItemMatchesPath(item, pathname))
    .sort((a, b) => normalizePath(b.href).length - normalizePath(a.href).length)[0];
}

export function navigationItemsForSurface(
  surface: NavigationSurface,
  permissions?: readonly string[] | null
): NavigationItem[] {
  return NAVIGATION_ITEMS.filter(
    (item) => item.surfaces.includes(surface) && permAllows(permissions, item.permission)
  );
}

export function groupedNavigationItems(
  surface: NavigationSurface,
  permissions?: readonly string[] | null
): Array<NavigationGroup & { items: NavigationItem[] }> {
  const visible = navigationItemsForSurface(surface, permissions);
  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: visible.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
}
