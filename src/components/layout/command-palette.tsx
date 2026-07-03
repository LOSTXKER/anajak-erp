"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Search,
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Users,
  Factory,
  Palette,
  Truck,
  Package,
  Scissors,
  FileText,
  BarChart3,
  Settings,
  Cloud,
  Plus,
  CornerDownLeft,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { FINANCE_ROLES, SALES_DOC_ROLES, roleAllows } from "@/lib/roles";
import type { Role } from "@prisma/client";

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  keywords?: string;
  action: () => void;
  // จำกัดบทบาท — ไม่ระบุ = ทุกคน (B12: กันช่างพิมพ์ "บิล" ใน ⌘K แล้วกดเข้า /billing โดน FORBIDDEN)
  roles?: Role[];
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { data: me } = trpc.user.me.useQuery();

  const navigate = React.useCallback(
    (path: string) => {
      router.push(path);
      onOpenChange(false);
    },
    [router, onOpenChange]
  );

  const allItems: CommandItem[] = React.useMemo(
    () => [
      {
        id: "new-order",
        label: "สร้างออเดอร์ใหม่",
        hint: "สร้าง",
        group: "การกระทำ",
        icon: Plus,
        keywords: "create order new add",
        action: () => navigate("/orders/new"),
        roles: SALES_DOC_ROLES,
      },
      {
        id: "new-quotation",
        label: "สร้างใบเสนอราคา",
        hint: "สร้าง",
        group: "การกระทำ",
        icon: Plus,
        keywords: "create quotation",
        action: () => navigate("/quotations/new"),
        roles: SALES_DOC_ROLES,
      },
      { id: "nav-dashboard", label: "Dashboard", group: "ไปที่", icon: LayoutDashboard, action: () => navigate("/") },
      { id: "nav-orders", label: "ออเดอร์", group: "ไปที่", icon: ShoppingCart, keywords: "order", action: () => navigate("/orders") },
      { id: "nav-quotations", label: "ใบเสนอราคา", group: "ไปที่", icon: ClipboardList, keywords: "quotation quote", action: () => navigate("/quotations") },
      { id: "nav-customers", label: "ลูกค้า", group: "ไปที่", icon: Users, keywords: "customer", action: () => navigate("/customers") },
      { id: "nav-production", label: "การผลิต", group: "ไปที่", icon: Factory, keywords: "production", action: () => navigate("/production") },
      { id: "nav-designs", label: "งานออกแบบ", group: "ไปที่", icon: Palette, keywords: "design", action: () => navigate("/designs") },
      { id: "nav-outsource", label: "Outsource", group: "ไปที่", icon: Truck, action: () => navigate("/outsource") },
      { id: "nav-products", label: "สินค้า", group: "ไปที่", icon: Package, keywords: "product", action: () => navigate("/products") },
      { id: "nav-patterns", label: "แพทเทิร์น", group: "ไปที่", icon: Scissors, keywords: "pattern", action: () => navigate("/settings/patterns") },
      { id: "nav-billing", label: "บิล/การเงิน", group: "ไปที่", icon: FileText, keywords: "billing invoice", action: () => navigate("/billing"), roles: FINANCE_ROLES },
      { id: "nav-billing-notes", label: "ใบวางบิล", group: "ไปที่", icon: FileText, keywords: "billing note", action: () => navigate("/billing/notes"), roles: FINANCE_ROLES },
      { id: "nav-aging", label: "ลูกหนี้ค้างชำระ", group: "ไปที่", icon: FileText, keywords: "aging receivable", action: () => navigate("/billing/aging"), roles: FINANCE_ROLES },
      { id: "nav-sales-tax", label: "ภาษีขาย", group: "ไปที่", icon: FileText, keywords: "sales tax vat peak ภาษี", action: () => navigate("/billing/tax"), roles: FINANCE_ROLES },
      { id: "nav-analytics", label: "สถิติ", group: "ไปที่", icon: BarChart3, keywords: "analytics statistics", action: () => navigate("/analytics"), roles: FINANCE_ROLES },
      { id: "nav-notifications", label: "การแจ้งเตือน", group: "ไปที่", icon: Bell, keywords: "notification", action: () => navigate("/notifications") },
      { id: "nav-settings", label: "ตั้งค่า", group: "ไปที่", icon: Settings, keywords: "settings", action: () => navigate("/settings") },
      { id: "nav-stock", label: "เชื่อมต่อ Stock", group: "ไปที่", icon: Cloud, keywords: "stock", action: () => navigate("/settings/stock") },
    ],
    [navigate]
  );

  // กรองตาม role ก่อน (B12) — ช่าง/กราฟิกไม่เห็นเมนูเงิน/สร้างเอกสารขายใน ⌘K
  const items = React.useMemo(
    () => allItems.filter((it) => roleAllows(me?.role, it.roles)),
    [allItems, me?.role]
  );

  const filtered = React.useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        (it.keywords ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.group) ?? [];
      arr.push(it);
      map.set(it.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  React.useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQuery("");
  }, [open]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIdx]?.action();
    }
  };

  let cursor = 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={handleKey}
          className="fixed left-1/2 top-[14%] z-50 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_24px_72px_rgba(0,0,0,0.18)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-slate-800/60 dark:bg-slate-900"
        >
          <DialogPrimitive.Title className="sr-only">ค้นหา</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            ค้นหาเมนู หน้า หรือคำสั่งที่ใช้บ่อย
          </DialogPrimitive.Description>

          <div className="flex items-center gap-3 border-b border-slate-100 px-5 dark:border-slate-800">
            <Search className="h-[18px] w-[18px] shrink-0 text-slate-400" strokeWidth={1.75} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเมนู, สร้างออเดอร์, ดูบิล..."
              className="flex-1 bg-transparent py-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            />
            <kbd className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline-block dark:bg-slate-800 dark:text-slate-400">
              ESC
            </kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-2.5">
            {grouped.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-400">
                ไม่พบรายการที่ค้นหา
              </p>
            )}
            {grouped.map(([group, list]) => (
              <div key={group} className="mb-1.5 px-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-medium text-slate-400">
                  {group}
                </p>
                {list.map((item) => {
                  const idx = cursor++;
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => item.action()}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] transition-colors",
                        active
                          ? "bg-blue-600 text-white"
                          : "text-slate-700 dark:text-slate-300"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0",
                          active ? "text-white" : "text-slate-400"
                        )}
                        strokeWidth={1.75}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-white/80" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400 dark:border-slate-800">
            <span className="flex items-center gap-1">
              <kbd className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                ↑
              </kbd>
              <kbd className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                ↓
              </kbd>
              เลื่อน
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                ↵
              </kbd>
              เลือก
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
