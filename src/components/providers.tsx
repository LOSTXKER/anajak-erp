"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import superjson from "@/lib/superjson";
import { PUBLIC_CUSTOMER_PREFIXES } from "@/lib/public-routes";
import { OVERLAY_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

// หน้าที่บังคับโหมดสว่างเสมอ — หน้าที่ลูกค้าเปิด (รายชื่อจาก lib/public-routes.ts
// ที่เดียว) และ **หน้าเอกสารพิมพ์**
// (/print เพิ่ม 2026-08-02 จาก audit สี: เอกสารเป็นกระดาษ A4 ขาวบนโต๊ะเทาอยู่แล้ว
//  แต่ปุ่มกับป้ายในหน้ากลับตามธีมเครื่อง — เครื่องที่ตั้งโหมดมืดจะได้ปุ่มดำหลุดชุด
//  และเสี่ยงพิมพ์ออกมาเป็นแถบดำเปลืองหมึก)
const PUBLIC_LIGHT_PREFIXES = [...PUBLIC_CUSTOMER_PREFIXES, "/print"];

// next-themes ต้องรัน bootstrap ก่อน hydration ฝั่ง server เพื่อกันธีมกระพริบ
// แต่ React 19.2 จะเตือนเมื่อ Fast Refresh/Suspense สร้าง <script> ใหม่ฝั่ง client
// จึงเปลี่ยน client remount เป็น data block; effect ของ next-themes ยัง sync class ตามเดิม
const THEME_BOOTSTRAP_SCRIPT_PROPS = {
  type: typeof window === "undefined" ? "text/javascript" : "text/plain",
} as const;

function isPublicLightPath(pathname: string): boolean {
  return PUBLIC_LIGHT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    // แจ้งเตือนใช้ภาษาเดียวกับที่เหลือของเว็บ (เบสสั่ง 2026-07-31 "ใช้ของเราเอง")
    // มุมโค้ง 16px = ระดับ "กล่องเด้ง" ตามบันได · เงา overlay-surface ตัวเดียวกับเมนู/กล่องเด้ง
    // ปิด richColors ที่ย้อมทั้งใบ — ใช้ไอคอนสีบอกชนิดแทน พื้นขาวอ่านง่ายกว่าและเข้าชุดกับการ์ด
    <Toaster
      position="bottom-right"
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
      toastOptions={{
        classNames: {
          toast:
            cn(OVERLAY_PANEL, "border-0 gap-3 p-4 font-sans text-strong"),
          title: "text-sm font-medium",
          description: "text-xs text-muted",
          actionButton:
            "rounded-full bg-blue-600 px-3 text-xs font-semibold text-white",
          cancelButton:
            "rounded-full bg-surface-muted px-3 text-xs font-medium text-secondary",
          success: "[&_[data-icon]]:text-green-600",
          warning: "[&_[data-icon]]:text-amber-600",
          error: "[&_[data-icon]]:text-red-600",
        },
      }}
    />
  );
}

function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={isPublicLightPath(pathname) ? "light" : undefined}
      scriptProps={THEME_BOOTSTRAP_SCRIPT_PROPS}
    >
      {children}
    </ThemeProvider>
  );
}

function ThemeFallback({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={THEME_BOOTSTRAP_SCRIPT_PROPS}
    >
      {children}
    </ThemeProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5 * 1000, refetchOnWindowFocus: false },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Suspense
          fallback={
            <ThemeFallback>
              <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
              <ThemedToaster />
            </ThemeFallback>
          }
        >
          <AppThemeProvider>
            <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
            <ThemedToaster />
          </AppThemeProvider>
        </Suspense>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
