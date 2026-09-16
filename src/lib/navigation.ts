import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  ClipboardList,
  Cloud,
  Factory,
  FileStack,
  FileText,
  Gauge,
  Hourglass,
  Landmark,
  LayoutDashboard,
  ListTodo,
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
/** ตัวเลขงานค้างท้ายรายการเมนู — ชื่อแหล่งข้อมูลจริง ไม่ใช่ตัวเลขตายตัว (ต้นแบบ NAV2 .cnt) */
export type NavigationBadge = "outsource" | "notifications";
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
  /** ขอตัวเลขงานค้างท้ายรายการ (เมนูซ้ายเท่านั้น) — ไม่ใส่ = ไม่มีตัวเลข */
  badge?: NavigationBadge;
};

export type NavigationGroup = {
  id: NavigationGroupId;
  label: string | null;
};

/* หัวกลุ่มกลับมาครบ 5 หัว + กลุ่มท้ายไม่มีหัวข้อ (ต้นแบบทั้งเว็บที่เบสเคาะ 2026-09-16)
   ต้นแบบจัด "สินค้า · แพทเทิร์น · สต๊อกเสื้อ" ไว้ใต้หัวข้อ "ของและสินค้า" ด้วยกัน
   และให้กลุ่มท้าย (การแจ้งเตือน · ตั้งค่า) ไม่มีหัวข้อ แต่มี **เส้นคั่น** แทน
   — การแบ่งหมวดนี้มาจากต้นแบบของเจ้าของเอง ไม่ใช่การเดาของโค้ด
   หัวกลุ่มเล็กและจางระดับ ink-4 จึงไม่แย่งสายตากับรายการเมนู (ดู .app-rail-group) */
export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  { id: "main", label: "ภาพรวม" },
  { id: "sales", label: "งานขาย" },
  { id: "production", label: "การผลิต" },
  { id: "products", label: "ของและสินค้า" },
  { id: "finance", label: "การเงิน" },
  { id: "system", label: null },
];

const BOTH = ["sidebar", "palette"] as const;

/**
 * แหล่งเดียวของ navigation หลังบ้าน — Sidebar และ Command Palette ต้องอ่านจากชุดนี้
 * เพื่อให้ป้าย สิทธิ์ คำค้น และ route ไม่ drift คนละทางอีก
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    id: "dashboard",
    label: "หน้าแรก",
    href: "/",
    icon: LayoutDashboard,
    group: "main",
    aliases: ["dashboard", "overview", "ภาพรวม", "แดชบอร์ด"],
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
    label: "คิวงานผลิต",
    href: "/production",
    icon: Factory,
    group: "production",
    aliases: ["production", "ผลิต", "คิวผลิต", "โต๊ะงาน", "การผลิต"],
    surfaces: BOTH,
  },
  /* เมนูย่อยของการผลิต 3 รายการ (ต้นแบบ NAV2 · เบสสั่ง 2026-09-16 "ทำตามต้นแบบทุกหน้า")
     route ทั้งสามมีจริงอยู่แล้วและเปิดให้ทุกบทบาทอ่านได้ (router เป็น protectedProcedure
     ล้วน สิทธิ์ไปตัดที่ปุ่มบันทึกในหน้า) จึงไม่ผูก permission เพิ่ม — ให้ตรงกับแถบเมนูย่อย
     ในหัวโมดูล (PRODUCTION_MODULE_LINKS) ที่แสดงทั้งสี่ลิงก์ให้ทุกคนเหมือนกัน */
  {
    id: "print-runs",
    label: "พิมพ์ DTF",
    href: "/production/print-runs",
    icon: Printer,
    group: "production",
    aliases: ["print run", "dtf", "พิมพ์", "รอบพิมพ์"],
    surfaces: BOTH,
  },
  {
    id: "outsource",
    label: "ร้านนอก",
    href: "/production/outsource",
    icon: Truck,
    group: "production",
    aliases: ["outsource", "vendor", "ร้านนอก", "จ้างนอก"],
    surfaces: BOTH,
    badge: "outsource",
  },
  {
    id: "production-metrics",
    label: "ตัวชี้วัด",
    href: "/production/metrics",
    icon: Gauge,
    group: "production",
    aliases: ["metrics", "oee", "ตัวชี้วัด", "ประสิทธิภาพ"],
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
    id: "stock",
    label: "สต๊อกเสื้อ",
    href: "/settings/stock",
    icon: Cloud,
    group: "products",
    aliases: ["stock", "sync", "คลัง", "เชื่อมต่อ", "สต๊อก"],
    surfaces: BOTH,
  },
  {
    id: "billing",
    label: "บิลและการเงิน",
    href: "/billing",
    icon: Landmark,
    group: "finance",
    permission: "manage_billing_docs",
    aliases: ["billing", "invoice", "bill", "บิล", "การเงิน", "บิล/การเงิน"],
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
    icon: FileText,
    group: "finance",
    permission: "manage_billing_docs",
    aliases: ["wht", "withholding tax", "50 ทวิ", "หัก ณ ที่จ่าย"],
    surfaces: ["sidebar"],
  },
  {
    id: "sales-tax",
    label: "ภาษีขาย",
    href: "/billing/tax",
    icon: ReceiptText,
    group: "finance",
    permission: "manage_billing_docs",
    aliases: ["sales tax", "vat", "peak", "ภาษีขาย"],
    surfaces: BOTH,
  },
  {
    id: "analytics",
    label: "รายงาน",
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
    surfaces: BOTH,
    badge: "notifications",
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
