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

const PUBLIC_LIGHT_PREFIXES = ["/approve", "/upload", "/status", "/quote", "/job"];

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
    <Toaster
      richColors
      position="bottom-right"
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-slate-200 dark:border-slate-800",
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
