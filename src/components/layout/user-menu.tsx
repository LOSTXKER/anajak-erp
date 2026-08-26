"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Moon, Sun, LogOut, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { createClient } from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/roles";
import { requestAppNavigation } from "@/lib/navigation-request";
import {
  FOCUS_BUTTON,
  INTERACTIVE_CHROME_HOVER,
  MENU_SEPARATOR,
  OVERLAY_PANEL,
} from "@/components/ui/tokens";
import { CONTROL_H, CONTROL_MIN_H } from "@/components/ui/control-size";

const menuItemClass = cn(
  CONTROL_MIN_H,
  // โหมดมืด: แถบไฮไลต์เคยเป็น slate-800 ซึ่ง **เข้มกว่า** พื้นเมนู = ทำผิดทิศ
  // ไล่ลูกศรบนคีย์บอร์ดแล้วมองไม่ออกว่าค้างบรรทัดไหน (audit สี 2026-08-02)
  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-secondary outline-none transition-colors data-[highlighted]:bg-interactive-hover data-[highlighted]:text-strong",
);

export function UserMenu() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { data: me } = trpc.user.me.useQuery();

  const signOutAndNavigate = async (
    href: string,
    mode: "push" | "replace",
  ) => {
    const supabase = createClient();
    await supabase.auth.signOut();
    if (mode === "replace") router.replace(href);
    else router.push(href);
    router.refresh();
  };
  const handleLogout = () => {
    // ออกจากระบบเป็นการนำทางที่ย้อนค่าในฟอร์มกลับไม่ได้: ขอผ่าน guard กลางก่อน
    // แล้วค่อย sign out เมื่อไม่มีข้อมูลค้างหรือผู้ใช้ยืนยันว่าจะทิ้งจริง
    requestAppNavigation("/login", {
      push: (href) => void signOutAndNavigate(href, "push"),
      replace: (href) => void signOutAndNavigate(href, "replace"),
    });
  };
  const themeIcon =
    resolvedTheme === "dark" ? (
      <Moon className="h-3.5 w-3.5" />
    ) : (
      <Sun className="h-3.5 w-3.5" />
    );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          /* 1) ความกว้างต้องเดินตามความสูงทุกจุด — CONTROL_H มี [@media(pointer:coarse)]:h-11
                แต่ความกว้างเดิมค้างที่ sm:w-9 ทำให้บนจอทัชโรงงานวงกลมกลายเป็นวงรี 36×44
             2) เลิกเป็นวงกลมน้ำเงินทึบ (เฟส 6 · เบสเคาะ 2026-08-26) — เดิมมีน้ำเงินสองก้อน
                คนละมุมของแถบเดียวกัน ตรากับรูปคนแย่งกันเป็นตัวแทนแบรนด์
                น้ำเงินเหลืออยู่ที่ตราชิ้นเดียว ที่นี่เป็นวงเงียบมีขอบ
             3) เลิก hover:scale — ทั้งเว็บบอก hover ด้วยสี ไม่ใช่การขยายตัว */
          className={cn(CONTROL_H, "flex w-11 items-center justify-center rounded-full bg-surface text-sm font-semibold text-strong ring-1 ring-border transition-colors sm:w-9 [@media(pointer:coarse)]:w-11", INTERACTIVE_CHROME_HOVER, FOCUS_BUTTON)}
          aria-label="เมนูผู้ใช้"
        >
          {me?.name?.charAt(0).toUpperCase() ?? "?"}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            OVERLAY_PANEL,
            "z-50 min-w-[200px] p-2",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <div className="px-2 pt-1.5 pb-1">
            <p className="text-sm font-semibold text-strong">
              {me?.name ?? "..."}
            </p>
            <p className="text-2xs text-muted">
              {me?.email ?? ""}
              {me?.role ? ` · ${ROLE_LABELS[me.role] ?? me.role}` : ""}
            </p>
          </div>
          <DropdownMenu.Separator className={MENU_SEPARATOR} />

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={menuItemClass}>
              {themeIcon}
              ธีม
              <span className="ml-auto text-xs text-muted">
                {theme === "system" ? "ระบบ" : theme === "dark" ? "มืด" : "สว่าง"}
              </span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={4}
                className={cn(OVERLAY_PANEL, "z-50 min-w-[150px] p-2", "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95")}
              >
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={() => setTheme("light")}
                >
                  <Sun className="h-3.5 w-3.5" />
                  สว่าง
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={() => setTheme("dark")}
                >
                  <Moon className="h-3.5 w-3.5" />
                  มืด
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={() => setTheme("system")}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  ตามระบบ
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className={MENU_SEPARATOR} />

          <DropdownMenu.Item
            className={cn(
              menuItemClass,
              "text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-950/40"
            )}
            onSelect={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
