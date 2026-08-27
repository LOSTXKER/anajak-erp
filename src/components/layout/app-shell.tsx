"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronRight,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Search,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  findActiveNavigationItem,
  groupedNavigationItems,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CONTROL_H, CONTROL_MIN_H } from "@/components/ui/control-size";
import {
  FOCUS_BUTTON,
  FOCUS_INSET,
  INTERACTIVE_CHROME_HOVER,
  INTERACTIVE_CHROME_PRESSED,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  RADIUS,
  SUNK_PANEL,
} from "@/components/ui/tokens";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { CommandPalette } from "@/components/layout/command-palette";
import { UserMenu } from "@/components/layout/user-menu";

const MOBILE_NAV_IDS = ["dashboard", "my-tasks", "orders", "production"] as const;
const MOBILE_EXCLUDED_IDS = new Set<string>(MOBILE_NAV_IDS);

/* เมนูซ้ายจำสถานะหุบ/กางไว้ในเครื่องผู้ใช้ (เบสสั่ง 2026-08-26)
   ใช้ useSyncExternalStore แทน useState+useEffect เพื่อไม่ให้ SSR กับ client
   เห็นค่าคนละอย่างตอน hydrate · ค่าเริ่มต้นฝั่งเซิร์ฟเวอร์คือ "กาง" เสมอ */
const SIDEBAR_COLLAPSED_KEY = "anajak.sidebar.collapsed";
const SIDEBAR_EVENT = "anajak:sidebar-collapsed";

function subscribeSidebarCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_EVENT, onChange);
  };
}

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    // โหมดส่วนตัวของบางเบราว์เซอร์โยน error ตอนอ่าน localStorage — ถือว่ากางไว้
    return false;
  }
}

function writeSidebarCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    // เขียนไม่ได้ก็ยังต้องหุบ/กางให้ทันที แค่ไม่ถูกจำข้ามครั้ง
  }
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

function sidebarNavItemClass({
  active,
  onChrome = false,
  collapsed = false,
}: {
  active: boolean;
  onChrome?: boolean;
  collapsed?: boolean;
}) {
  return cn(
    CONTROL_MIN_H,
    FOCUS_INSET,
    RADIUS.item,
    "group/sidebar-item relative flex scroll-m-4 items-center gap-3 px-3 py-2 text-sm transition-colors",
    // ตอนหุบเป็น "ปุ่มสี่เหลี่ยมจัตุรัส 40px วางกลางราง" ไม่ใช่แถบเต็มความกว้าง
    // เดิมปล่อยให้ยืดตามกล่องแม่ แล้วโดนบีบเหลือกว้าง 24px สูง 36px = อ่านเป็นเม็ดยา
    // (วัดจริง 2026-08-26 หลังเบสทัก "sidebar ตอนหุบ UI ก็ไม่ดี")
    collapsed && "mx-auto h-10 w-10 justify-center gap-0 px-0 py-0",
    active
      ? // แบบ ก (เบสเคาะ 2026-08-26) — เมนูที่กำลังเปิดอยู่เลิกเป็นพิลฟ้า
        // เหลือพื้นเทากลาง ๆ + ขีดสีแบรนด์บาง ๆ ริมซ้ายของแถบ + ตัวหนังสือเข้มขึ้น
        // น้ำเงินจึงเหลือหน้าที่เดียวในแถบเมนูคือบอกว่า "อยู่ตรงนี้"
        // ⚠️ ตอนหุบไม่มีขีด — ขีดที่ริมรางห่างจากไอคอนจนอ่านเป็นคนละชิ้น
        // พื้นเทาเต็มปุ่มสี่เหลี่ยมบอก "อยู่ตรงนี้" ได้ชัดกว่าบนรางแคบ 64px
        cn(
          "font-medium text-strong",
          onChrome ? "bg-interactive-chrome-pressed" : "bg-interactive-pressed",
          !collapsed &&
            "before:absolute before:inset-y-1.5 before:-left-3 before:w-0.5 before:rounded-r-full before:bg-blue-600 before:content-[''] dark:before:bg-blue-400",
        )
      : cn(
          "font-normal",
          "text-secondary",
          onChrome ? INTERACTIVE_CHROME_HOVER : INTERACTIVE_HOVER,
          onChrome ? INTERACTIVE_CHROME_PRESSED : INTERACTIVE_PRESSED,
        ),
  );
}

function SidebarGroupLabel({
  label,
}: {
  label: string | null;
}) {
  if (!label) return null;

  return (
    <p className="px-3 pb-1.5 text-xs font-medium text-muted">{label}</p>
  );
}

/* เคยมี NavPendingMark = จุดเล็กกะพริบในเมนูระหว่างที่หน้าใหม่ยังโหลด (เฟส 4)
   ถอดออก 2026-08-26 — เบสบอก "ไม่ชอบเวลากดเลือกหัวข้อแล้วมีจุด"
   ไม่ได้เสียสัญญาณ "ระบบรับรู้แล้ว" ไป เพราะ src/app/(dashboard)/loading.tsx
   ขึ้นโครงร่างหน้าใหม่ให้อยู่แล้ว ซึ่งเป็นทางหลักที่ Next แนะนำ · จุดในเมนู
   เป็นแค่ตัวเสริมระหว่าง prefetch เท่านั้น */

/* ตราสัญลักษณ์ desktop ใช้ชิ้นเดียวทั้งตอนกางและหุบ
   เพื่อให้สี ขนาด และน้ำหนักไอคอนไม่ drift ตามสถานะ */
function SidebarBrandMark() {
  return (
    <span
      aria-hidden="true"
      className={cn(
        RADIUS.inner,
        // ⚠️ ตราสัญลักษณ์คือที่ที่สีแบรนด์ควรอยู่โดยธรรมชาติ — เคยเปลี่ยนเป็นเทา
        // ตอนเก็บ "สงวนน้ำเงินให้ปุ่มหลัก/สิ่งที่เลือก/โฟกัส" ซึ่งคิดผิด
        // กติกานั้นมีไว้กันสีลิงก์โรยทั่วตาราง ไม่ได้มีไว้ถอดแบรนด์ออกจากตราของตัวเอง
        // (เบสทัก 2026-08-26 "อย่าลืมสีฟ้าที่เป็น asset เรา")
        "flex h-7 w-7 shrink-0 items-center justify-center bg-blue-600 text-white",
      )}
    >
      <Printer className="!h-3.5 !w-3.5" strokeWidth={1.75} />
    </span>
  );
}

/* ปุ่มหุบ/กางเมนูแยกจากตราอย่างชัดเจน (เบสสั่ง 2026-08-27)
   ตราคงหน้าที่พากลับหน้าหลัก ส่วน trigger อยู่กลาง action slot 56px แรกของ topbar:
   สัญลักษณ์บอกการเปิด/ปิดแผงซ้ายโดยตรง ไม่อ่านเป็นปุ่ม Back · ปุ่มตัวเดิมอยู่ตลอดเพื่อรักษา focus */
function SidebarCollapseButton({
  collapsed,
}: {
  collapsed: boolean;
}) {
  const label = collapsed ? "กางเมนู" : "หุบเมนู";
  return (
    <span
      data-sidebar-collapse-slot
      className="absolute left-full top-0 z-40 hidden h-14 w-14 items-center justify-center lg:flex"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => writeSidebarCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="app-sidebar-navigation"
        aria-label={label}
        title={label}
        data-sidebar-collapse-toggle
        className={cn(
          INTERACTIVE_CHROME_HOVER,
          INTERACTIVE_CHROME_PRESSED,
          "shrink-0 bg-transparent p-0 text-muted shadow-none",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="!size-4" strokeWidth={1.75} />
        ) : (
          <PanelLeftClose className="!size-4" strokeWidth={1.75} />
        )}
      </Button>
    </span>
  );
}

function sidebarNavIconClass(active: boolean) {
  return active
    ? "text-strong"
    : "text-muted group-hover/sidebar-item:text-secondary group-active/sidebar-item:text-strong";
}

function MoreMenu({
  open,
  permissions,
  user,
  activeNavigationId,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  permissions?: readonly string[];
  user?: { name: string; role: string };
  activeNavigationId?: string;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const groups = groupedNavigationItems("sidebar", permissions)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !MOBILE_EXCLUDED_IDS.has(item.id)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
        className="bottom-0 left-0 right-0 top-auto max-h-[82dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-b-none p-0 pr-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:p-0 sm:pr-0"
      >
        <DialogHeader className="border-b border-divider px-5 pb-4 pt-5 pr-14 text-left">
          <DialogTitle>พื้นที่ทำงานทั้งหมด</DialogTitle>
          <DialogDescription className={user ? undefined : "sr-only"}>
            {user
              ? `${user.name} · ${ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}`
              : "เมนูเพิ่มเติม"}
          </DialogDescription>
        </DialogHeader>

        <nav aria-label="เมนูเพิ่มเติม" className="min-h-0 overflow-y-auto px-3 py-3">
          {groups.map((group) => (
            <div key={group.id} className="mb-4 last:mb-0">
              <SidebarGroupLabel
                label={group.label}
              />
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={activeNavigationId === item.id ? "page" : undefined}
                      className={sidebarNavItemClass({
                        active: activeNavigationId === item.id,
                      })}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4",
                          sidebarNavIconClass(activeNavigationId === item.id),
                        )}
                        strokeWidth={1.75}
                      />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform group-hover/sidebar-item:translate-x-0.5",
                          sidebarNavIconClass(activeNavigationId === item.id),
                        )}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

      </DialogContent>
    </Dialog>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const activeSidebarRef = useRef<HTMLAnchorElement>(null);
  const { data: me } = trpc.user.me.useQuery();
  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const sidebarGroups = useMemo(
    () => groupedNavigationItems("sidebar", me?.permissions),
    [me?.permissions],
  );

  const mobileItems = useMemo(() => {
    const byId = new Map(
      sidebarGroups.flatMap((group) => group.items).map((item) => [item.id, item]),
    );
    return MOBILE_NAV_IDS.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [sidebarGroups]);

  const closeMoreMenu = () => {
    setMoreOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => moreTriggerRef.current?.focus());
    });
  };

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const count = unreadCount ?? 0;
  const activeNavigationId = findActiveNavigationItem(pathname)?.id;
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    readSidebarCollapsed,
    () => false,
  );
  const mobileMoreActive = sidebarGroups.some(
    (group) =>
      group.items.some(
        (item) =>
          !MOBILE_EXCLUDED_IDS.has(item.id) && item.id === activeNavigationId,
      ),
  );

  useEffect(() => {
    let positionFrame = 0;
    const openFrame = requestAnimationFrame(() => {
      positionFrame = requestAnimationFrame(() => {
        activeSidebarRef.current?.scrollIntoView({ block: "nearest" });
      });
    });
    return () => {
      cancelAnimationFrame(openFrame);
      cancelAnimationFrame(positionFrame);
    };
  }, [activeNavigationId, sidebarGroups]);

  return (
    <div
      className="app-workspace grid h-dvh grid-cols-1 grid-rows-[3.5rem_minmax(0,1fr)] overflow-hidden bg-bg lg:grid-cols-[var(--app-sidebar-w)_minmax(0,1fr)]"
      style={
        {
          "--app-bottom-nav-offset":
            "calc(5rem + env(safe-area-inset-bottom))",
          // หุบ = พอให้ไอคอน 16px ยืนกลางช่องที่หัก px-3 ออกแล้ว · กาง = 240px เท่าเดิม
          "--app-sidebar-w": sidebarCollapsed ? "4rem" : "15rem",
        } as CSSProperties
      }
    >
      <a
        href="#main-content"
        className={cn(
          CONTROL_MIN_H,
          FOCUS_BUTTON,
          RADIUS.inner,
          "fixed left-4 top-4 z-[100] inline-flex -translate-y-24 items-center bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0 dark:bg-white dark:text-slate-950",
        )}
      >
        ข้ามไปเนื้อหาหลัก
      </a>

      {/* เมนูซ้ายอยู่ก่อนแถบบนใน DOM โดยตั้งใจ (แก้ 2026-08-26)
          บนจอกว้าง aside กินแถวที่ 1 ด้วย ตราจึงนั่งมุมซ้ายบนสุดของจอ
          ถ้า header มาก่อนใน DOM คนกด Tab จะได้ ค้นหา → กระดิ่ง → บัญชี (มุมขวาบน)
          แล้วเด้งข้ามจอกลับมาที่ตรา (มุมซ้ายบน) = ลำดับโฟกัสเดินขวาไปซ้าย (WCAG 2.4.3) */}
      <aside className="hidden min-h-0 border-r border-divider bg-chrome lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col">
        {/* ตราย้ายลงมาอยู่หัวเมนูซ้าย เพราะแถบบนไม่พาดทับคอลัมน์นี้แล้ว
            ความสูง 3rem เท่าแถบบน เส้นล่างจึงต่อกันเป็นเส้นเดียวข้ามทั้งจอ
            (เดิมช่องตรากว้าง 240px แต่มีของจริงแค่ ~126px และเส้นแนวตั้งหักกลางคัน) */}
        {/* ตราเป็นลิงก์หน้าหลักเสมอ ส่วนลูกศรเป็นปุ่มหุบ/กางแยกที่ขอบ sidebar
            DOM ยังเรียง Link → Button → nav ตรงกับภาพและลำดับ Tab (WCAG 2.4.3) */}
        <div
          data-sidebar-brand-header
          className={cn(
            // ⚠️ ความสูงต้องเท่าแถบบนเสมอ (h-14 = 56px = แถวแรกของกริด 3.5rem)
            // ไม่งั้นเส้นล่างของตรากับของแถบบนจะไม่ต่อกันเป็นเส้นเดียวข้ามจอ
            "relative flex h-14 shrink-0 items-center border-b border-divider",
            sidebarCollapsed ? "justify-center" : "pl-6 pr-2",
          )}
        >
          <Link
            href="/"
            // ชื่อที่เห็นคือ "Anajak Print" — ห้ามตั้ง aria-label เป็นคำอื่น
            // ไม่งั้นคนที่สั่งงานด้วยเสียงพูดว่า "คลิก Anajak Print" แล้วไม่โดน (WCAG 2.5.3)
            className={cn(
              FOCUS_BUTTON,
              RADIUS.item,
              // ตรงแนวกับไอคอนเมนูข้างล่าง (nav px-3 + แถวเมนู px-3 = 24px)
              "flex min-w-0 items-center gap-3",
              sidebarCollapsed && "h-10 w-10 min-w-10 justify-center gap-0",
            )}
            title={sidebarCollapsed ? "Anajak Print" : undefined}
          >
            <SidebarBrandMark />
            <span
              className={cn(
                "truncate text-sm font-semibold text-strong",
                sidebarCollapsed && "sr-only",
              )}
            >
              Anajak Print
            </span>
          </Link>
          <SidebarCollapseButton collapsed={sidebarCollapsed} />
        </div>

        {/* ตอนหุบ: จองรางแถบเลื่อน "ทั้งสองข้าง" ไม่งั้นแถบเลื่อนที่กินที่จริง 10px
            (::-webkit-scrollbar ใน globals.css) จะดันไอคอนไปทางซ้าย 5px
            วัดจริงแล้ว: ไอคอนเมนูอยู่กลางที่ 26.5 ส่วนตราอยู่ที่ 31.5
            ตอนกางไม่ใช้ both-edges เพราะจะกินความกว้างของชื่อเมนูไป 20px เปล่า ๆ */}
        <nav
          id="app-sidebar-navigation"
          aria-label="เมนูหลัก"
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-3 py-3",
            // ตอนหุบถอดระยะขอบข้างออก แล้วให้ปุ่ม 40px จัดกลางเอง
            // (px-3 + รางแถบเลื่อนสองข้าง เหลือเนื้อที่จริงแค่ 19px ปุ่มเลยถูกบีบ)
            sidebarCollapsed && "px-0 [scrollbar-gutter:stable_both-edges]",
          )}
        >
          {/* ตอนกางมีหัวกลุ่มอธิบายช่องว่าง 16px · ตอนหุบหัวกลุ่มหายไป
              ช่องว่างเท่าเดิมจึงอ่านเป็น "เว้นมั่ว" — ย่อเหลือ 12px ให้ยังแยกกลุ่มออก
              แต่ไม่ห่างจนดูเหมือนลืมใส่อะไร */}
          <div className={cn(sidebarCollapsed ? "space-y-3" : "space-y-4")}>
            {sidebarGroups.map((group) => (
              <div key={group.id}>
                <SidebarGroupLabel label={sidebarCollapsed ? null : group.label} />
                <ul aria-label={group.label ?? undefined} className="space-y-1">
                  {group.items.map((item) => {
                    const active = activeNavigationId === item.id;
                    return (
                      <li key={item.id}>
                        <Link
                          ref={active ? activeSidebarRef : undefined}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          // ตอนหุบ ชื่อเมนูหายไปจากจอ จึงต้องเหลือชื่อไว้ให้ทั้งเมาส์
                          // (title) และเครื่องอ่านหน้าจอ (aria-label) ไม่งั้นเหลือแต่ไอคอนเปล่า
                          title={sidebarCollapsed ? item.label : undefined}
                          aria-label={sidebarCollapsed ? item.label : undefined}
                          className={sidebarNavItemClass({
                            active,
                            onChrome: true,
                            collapsed: sidebarCollapsed,
                          })}
                        >
                          <item.icon
                            className={cn("h-4 w-4 shrink-0", sidebarNavIconClass(active))}
                            strokeWidth={1.75}
                          />
                          {!sidebarCollapsed && <span>{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

      </aside>

      {/* แถบบนอยู่เหนือ "เฉพาะฝั่งเนื้อหา" บนจอกว้าง ไม่พาดทับเมนูซ้ายอีกแล้ว
          (UI-2026 เฟส 6 · เบสเคาะ 2026-08-26 "ไม่มีแถบบนแต่ขอมี navbar")
          เดิมพาดเต็มจอโดยมีของอยู่ 3 ชิ้น เหลือที่ว่างกลางแถบราว 1,000px บนจอ 1920
          ความสูง 64 → 48 (เฟส 2) → 56px (เฟส 10 · เบสบอก "ดูต่ำไป" หลังทั้งเว็บโค้งมนขึ้น
          ของในหน้าสูงขึ้นทั้งชุด แถบ 48px จึงกลายเป็นแถบที่แน่นกว่าเนื้อหาที่มันครอบอยู่)
          จอแคบไม่มีเมนูซ้าย แถบจึงยังพาดเต็มจอและถือตราไว้เหมือนเดิม
          ⚠️ อยู่หลัง <aside> ใน DOM โดยตั้งใจ — ดูเหตุผลที่คอมเมนต์เหนือ <aside> */}
      <header className="relative z-30 col-span-full row-start-1 flex h-14 min-w-0 items-center border-b border-divider bg-chrome lg:col-span-1 lg:col-start-2 lg:pr-[var(--app-scrollbar-w)]">
        <Link
          href="/"
          aria-label="ภาพรวม"
          className={cn(
            FOCUS_BUTTON,
            "flex h-full w-14 shrink-0 items-center justify-center lg:hidden",
          )}
        >
          <div
            className={cn(
              RADIUS.inner,
              "flex h-7 w-7 items-center justify-center bg-blue-600 text-white",
            )}
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
        </Link>

        {/* ไม่มีชื่อหมวดบนแถบแล้ว (เบสสั่ง 2026-08-26) — ตำแหน่งที่อยู่บอกด้วยเมนูซ้าย
            ที่ไฮไลต์อยู่แล้ว เขียนซ้ำบนแถบก็เป็นคำเดียวกันสองที่
            แถบนี้จึงเหลือหน้าที่เดียว: ของที่ใช้ได้ทุกหน้า (ค้นหา · แจ้งเตือน · บัญชี)
            จอกว้างจึงดันไปชิดขวาทั้งชุด ไม่ต้องมีอะไรมาถ่วงฝั่งซ้าย */}
        {/* กล่องเดียวกับเนื้อหาในหน้า (mx-auto max-w-screen-2xl + ระยะขอบชุดเดียวกัน)
            ตอนแถบบนพาดเต็มจอมันอ้างอิงขอบจอ ไม่มีใครเห็นว่าเยื้อง · พอย้ายมาวางเหนือ
            คอลัมน์เนื้อหาพอดี ขอบขวาสองอันต้องตรงกัน ไม่งั้นรูปผู้ใช้จะล้ำขอบการ์ด 16px
            ส่วน --app-scrollbar-w ที่ตัว <header> ชดเชยรางแถบเลื่อนที่ <main> จองไว้ */}
        <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-1 items-center gap-2 px-4 sm:px-6 lg:px-8">
          <button
            ref={searchTriggerRef}
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="ค้นหาเมนู ออเดอร์ ลูกค้า ใบเสนอราคา หรือบิล"
            aria-haspopup="dialog"
            className={cn(
              CONTROL_H,
              FOCUS_BUTTON,
              RADIUS.field,
              // chrome กลับมาเป็นขาวแล้ว (2026-08-26) ช่องค้นหาจึงต้องเป็น "ช่องจม"
              // ไม่ใช่ขาวบนขาวที่เห็นแค่เส้นขอบ — SUNK_PANEL ให้พื้นเทาอ่อนกว่าแถบหนึ่งขั้น
              SUNK_PANEL,
              "border border-border",
              INTERACTIVE_HOVER,
              INTERACTIVE_PRESSED,
              // จอแคบยังยืดเต็มที่ · จอกว้างหดเป็นชิปกว้างคงที่แล้วดันไปชิดขวา
              "group flex min-w-0 flex-1 items-center gap-2 px-3 text-sm text-muted transition-colors sm:max-w-lg sm:px-4 lg:ml-auto lg:w-60 lg:max-w-60 lg:flex-none",
            )}
          >
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-left">ค้นหาเลขงาน ลูกค้า หรือเมนู</span>
            <kbd className="hidden text-xs sm:inline">⌘K</kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            {/* ปุ่มบนแถบบนยืนบน chrome (เทา) ไม่ใช่ surface (ขาว) — hover ชุดปกติ
                จึงเกือบเท่าพื้นตัวเอง ต้องใช้ชุด chrome ที่เข้มกว่าหนึ่งขั้น */}
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={cn(INTERACTIVE_CHROME_HOVER, INTERACTIVE_CHROME_PRESSED, "relative shrink-0")}
            >
              <Link
                href="/notifications"
                aria-label={count > 0 ? `การแจ้งเตือน ยังไม่อ่าน ${count} รายการ` : "การแจ้งเตือน"}
              >
                <Bell />
                {count > 0 && (
                  <span className="absolute right-0 top-0 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-2xs font-semibold tabular-nums text-white ring-2 ring-chrome">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="relative col-start-1 row-start-2 min-h-0 min-w-0 overflow-y-auto outline-none [scrollbar-gutter:stable] lg:col-start-2"
      >
        <div className="mx-auto w-full max-w-screen-2xl px-4 pb-[calc(var(--app-bottom-nav-offset)+2rem)] pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10">
          {children}
        </div>
      </main>

      <nav
        aria-label="เมนูหลักบนมือถือ"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-chrome px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1 lg:hidden"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {mobileItems.map((item) => {
            const active = activeNavigationId === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  CONTROL_MIN_H,
                  FOCUS_INSET,
                  RADIUS.item,
                  INTERACTIVE_CHROME_PRESSED,
                  "flex flex-col items-center justify-center gap-1 px-1 py-2 text-xs transition-colors",
                  active
                    ? cn(
                        "relative bg-interactive-chrome-pressed font-semibold text-strong",
                        "before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-b-full before:bg-blue-600 before:content-[''] dark:before:bg-blue-400",
                      )
                    : "font-medium text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 min-w-10 items-center justify-center",
                  )}
                >
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            ref={moreTriggerRef}
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={mobileMoreActive ? "page" : undefined}
            className={cn(
              CONTROL_MIN_H,
              FOCUS_INSET,
              RADIUS.item,
              INTERACTIVE_CHROME_PRESSED,
              "flex flex-col items-center justify-center gap-1 px-1 py-2 text-xs transition-colors",
              mobileMoreActive
                ? cn(
                    "relative bg-interactive-chrome-pressed font-semibold text-strong",
                    "before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-b-full before:bg-blue-600 before:content-[''] dark:before:bg-blue-400",
                  )
                : "font-medium text-muted",
            )}
          >
            <span
              className={cn(
                "flex h-6 min-w-10 items-center justify-center",
              )}
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span>เพิ่มเติม</span>
          </button>
        </div>
      </nav>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        returnFocusRef={searchTriggerRef}
      />
      <MoreMenu
        open={moreOpen}
        permissions={me?.permissions}
        user={me ? { name: me.name, role: me.role } : undefined}
        activeNavigationId={activeNavigationId}
        onClose={closeMoreMenu}
        returnFocusRef={moreTriggerRef}
      />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="app-workspace h-dvh overflow-hidden bg-bg px-6 pt-6">
          <ListPageSkeleton rows={6} />
        </div>
      }
    >
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}
