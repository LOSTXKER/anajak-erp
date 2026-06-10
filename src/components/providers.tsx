"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import superjson from "@/lib/superjson";

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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
          <ThemedToaster />
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
