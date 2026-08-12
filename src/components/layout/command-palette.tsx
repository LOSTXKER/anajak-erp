"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, ShoppingCart, ClipboardList, Users, FileText, Plus, CornerDownLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OVERLAY_PANEL } from "@/components/ui/tokens";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { navigationItemsForSurface } from "@/lib/navigation";
import { Spinner } from "@/components/ui/spinner";
import { CONTROL_MIN_H } from "@/components/ui/control-size";

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  keywords?: string;
  action: () => void;
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
}

export function CommandPalette({
  open,
  onOpenChange,
  returnFocusRef,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [activeIdx, setActiveIdx] = React.useState(0);
  // รายการที่เลือกต้องอยู่ในจอเสมอ (benchmark: Linear/Raycast) — เดิมกดลูกศร
  // เกินครึ่งลิสต์แล้วตัวเลือกหลุดจอ มองไม่เห็นว่า Enter จะโดนอะไร
  const activeRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { data: me } = trpc.user.me.useQuery();

  const navigate = React.useCallback(
    (path: string) => {
      router.push(path);
      onOpenChange(false);
    },
    [router, onOpenChange]
  );

  const items = React.useMemo(() => {
    const result: CommandItem[] = [];
    const showCreateOrder = canCreateOrderWithPricing(me?.permissions);

    if (showCreateOrder) {
      result.push({
        id: "new-order",
        label: "เปิดงานใหม่",
        hint: "สร้างใบสอบถาม",
        group: "การกระทำ",
        icon: Plus,
        keywords: "create order new add เปิดงาน ใบสอบถาม",
        action: () => navigate("/orders/new"),
      });
    }
    if (showCreateOrder) {
      result.push({
        id: "new-quotation",
        label: "เปิดงานเพื่อทำใบเสนอ",
        hint: "เริ่มจากใบสอบถามเดียวกัน",
        group: "การกระทำ",
        icon: Plus,
        keywords: "create quotation quote ใบเสนอราคา",
        action: () => navigate("/orders/new?next=quote"),
      });
    }

    result.push(
      ...navigationItemsForSurface("palette", me?.permissions).map((item) => ({
        id: `nav-${item.id}`,
        label: item.label,
        group: "ไปที่",
        icon: item.icon,
        keywords: item.aliases.join(" "),
        action: () => navigate(item.href),
      }))
    );
    return result;
  }, [me?.permissions, navigate]);

  React.useEffect(() => {
    const trimmed = query.trim();
    const timer = window.setTimeout(
      () => setDebouncedQuery(open ? trimmed : ""),
      open ? 250 : 0
    );
    return () => window.clearTimeout(timer);
  }, [open, query]);

  const entityQuery = trpc.search.global.useQuery(
    { q: debouncedQuery, limit: 5 },
    { enabled: open && debouncedQuery.length >= 2 }
  );

  const entityItems = React.useMemo<CommandItem[]>(() => {
    const data = entityQuery.data;
    if (!data || debouncedQuery !== query.trim()) return [];

    return [
      ...data.orders.map((item) => ({
        id: `entity-order-${item.id}`,
        label: item.title,
        hint: item.subtitle ?? undefined,
        group: "ออเดอร์",
        icon: ShoppingCart,
        action: () => navigate(item.href),
      })),
      ...data.customers.map((item) => ({
        id: `entity-customer-${item.id}`,
        label: item.title,
        hint: item.subtitle ?? undefined,
        group: "ลูกค้า",
        icon: Users,
        action: () => navigate(item.href),
      })),
      ...data.quotations.map((item) => ({
        id: `entity-quotation-${item.id}`,
        label: item.title,
        hint: item.subtitle ?? undefined,
        group: "ใบเสนอราคา",
        icon: ClipboardList,
        action: () => navigate(item.href),
      })),
      ...data.invoices.map((item) => ({
        id: `entity-invoice-${item.id}`,
        label: item.title,
        hint: item.subtitle ?? undefined,
        group: "บิล",
        icon: FileText,
        action: () => navigate(item.href),
      })),
    ];
  }, [debouncedQuery, entityQuery.data, navigate, query]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLocaleLowerCase("th");
    const matchingNavigation = items.filter(
      (it) =>
        it.label.toLocaleLowerCase("th").includes(q) ||
        (it.keywords ?? "").toLocaleLowerCase("th").includes(q)
    );
    return [...matchingNavigation, ...entityItems];
  }, [entityItems, items, query]);

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
    const timer = window.setTimeout(() => {
      if (open) inputRef.current?.focus();
      else {
        setQuery("");
        setActiveIdx(0);
      }
    }, open ? 30 : 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const safeActiveIdx = Math.min(activeIdx, Math.max(filtered.length - 1, 0));
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [safeActiveIdx]);
  const trimmedQuery = query.trim();
  const entitySearchIsCurrent = debouncedQuery === trimmedQuery;
  const entitySearchPending =
    trimmedQuery.length >= 2 && (!entitySearchIsCurrent || entityQuery.isFetching);
  const entitySearchFailed = entitySearchIsCurrent && entityQuery.isError;

  const handleKey = (e: React.KeyboardEvent) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((safeActiveIdx + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((safeActiveIdx - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[safeActiveIdx]?.action();
    }
  };

  let cursor = 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-backdrop backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          onKeyDown={handleKey}
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef?.current) return;
            event.preventDefault();
            returnFocusRef.current.focus();
          }}
          className={cn(
            OVERLAY_PANEL,
            "fixed left-1/2 top-4 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:animate-none sm:top-[14%] sm:max-h-[calc(86dvh-1rem)]",
          )}
        >
          <DialogPrimitive.Title className="sr-only">ค้นหา</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            ค้นหาเมนู หน้า หรือคำสั่งที่ใช้บ่อย
          </DialogPrimitive.Description>

          <div className="flex items-center gap-3 border-b border-divider px-5">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted" strokeWidth={1.75} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              placeholder="ค้นหาเมนู เลขออเดอร์ ลูกค้า ใบเสนอ หรือบิล..."
              aria-label="ค้นหาในระบบ"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-4 text-base text-strong outline-none placeholder:text-placeholder sm:text-sm"
            />
            <kbd className="hidden rounded-lg bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-muted sm:inline-block">
              ESC
            </kbd>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="ปิดหน้าค้นหา"
                className="shrink-0 sm:hidden"
              >
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-2.5">
            {grouped.length === 0 && !entitySearchPending && !entitySearchFailed && (
              <p className="px-4 py-10 text-center text-sm text-muted">
                {query.trim().length === 1
                  ? "พิมพ์อีก 1 ตัวอักษรเพื่อค้นหาออเดอร์ ลูกค้า และเอกสาร"
                  : "ไม่พบรายการที่ค้นหา"}
              </p>
            )}
            {grouped.map(([group, list]) => (
              <div key={group} className="mb-1.5 px-2">
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">
                  {group}
                </p>
                {list.map((item) => {
                  const idx = cursor++;
                  const active = idx === safeActiveIdx;
                  return (
                    <button
                      key={item.id}
                      ref={active ? activeRef : undefined}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => item.action()}
                      className={cn(
                        CONTROL_MIN_H, "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-blue-600 text-white"
                          : "text-secondary"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0",
                          active ? "text-white" : "text-muted"
                        )}
                        strokeWidth={1.75}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.label}</span>
                        {item.hint && (
                          <span
                            className={cn(
                              "block truncate text-xs",
                              active ? "text-white" : "text-muted"
                            )}
                          >
                            {item.hint}
                          </span>
                        )}
                      </span>
                      {active && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-white/80" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            <div aria-live="polite" className="px-5 py-1 text-xs text-muted">
              {entitySearchPending && (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  กำลังค้นหาข้อมูลจริง...
                </span>
              )}
              {entitySearchFailed && (
                <span role="alert" className="flex items-center justify-between gap-3">
                  <span>ค้นหาข้อมูลไม่สำเร็จ — ยังเลือกเมนูที่พบด้านบนได้</span>
                  <button
                    type="button"
                    onClick={() => entityQuery.refetch()}
                    className={cn(CONTROL_MIN_H, "shrink-0 rounded-lg px-3 font-medium text-blue-700 hover:bg-interactive-hover dark:text-blue-300 dark:hover:bg-interactive-hover")}
                  >
                    ลองใหม่
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-divider px-5 py-2.5 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-lg bg-surface-muted px-1.5 py-0.5 text-xs">
                ↑
              </kbd>
              <kbd className="rounded-lg bg-surface-muted px-1.5 py-0.5 text-xs">
                ↓
              </kbd>
              เลื่อน
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-lg bg-surface-muted px-1.5 py-0.5 text-xs">
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
