"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Moon, Sun, LogOut, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { createClient } from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/roles";

const menuItemClass =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 outline-none transition-colors data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900 dark:text-slate-300 dark:data-[highlighted]:bg-slate-800 dark:data-[highlighted]:text-white";

export function UserMenu() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { data: me } = trpc.user.me.useQuery();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
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
          className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
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
            "z-50 min-w-[200px] rounded-xl border border-slate-200/70 bg-white p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.10)]",
            "dark:border-slate-800/60 dark:bg-slate-900",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <div className="px-2 pt-1.5 pb-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {me?.name ?? "..."}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {me?.email ?? ""}
              {me?.role ? ` · ${ROLE_LABELS[me.role] ?? me.role}` : ""}
            </p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={menuItemClass}>
              {themeIcon}
              ธีม
              <span className="ml-auto text-xs text-slate-400">
                {theme === "system" ? "ระบบ" : theme === "dark" ? "มืด" : "สว่าง"}
              </span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={4}
                className="z-50 min-w-[150px] rounded-xl border border-slate-200/70 bg-white p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.10)] dark:border-slate-800/60 dark:bg-slate-900"
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

          <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

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
