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
import { OVERLAY_PANEL } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

// หน้าที่บังคับโหมดสว่างเสมอ — หน้าที่ลูกค้าเปิด และ **หน้าเอกสารพิมพ์**
// (/print เพิ่ม 2026-08-02 จาก audit สี: เอกสารเป็นกระดาษ A4 ขาวบนโต๊ะเทาอยู่แล้ว
//  แต่ปุ่มกับป้ายในหน้ากลับตามธีมเครื่อง — เครื่องที่ตั้งโหมดมืดจะได้ปุ่มดำหลุดชุด
//  และเสี่ยงพิมพ์ออกมาเป็นแถบดำเปลืองหมึก)
const PUBLIC_LIGHT_PREFIXES = ["/approve", "/upload", "/status", "/quote", "/job", "/print"];

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
            cn(OVERLAY_PANEL, "border-0 gap-3 p-4 font-sans text-slate-900 dark:text-white"),
          title: "text-sm font-medium",
          description: "text-xs text-slate-500 dark:text-slate-400",
          actionButton:
            "rounded-full bg-blue-600 px-3 text-xs font-semibold text-white",
          cancelButton:
            "rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200",
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
