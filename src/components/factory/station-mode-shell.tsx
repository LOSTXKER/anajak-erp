"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { ArrowLeft, Factory } from "lucide-react";

export type StationNavItem<K extends string = string> = {
  key: K;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

export function StationModeShell<K extends string>({
  stations,
  station,
  userName,
  readOnly,
  onSelectStation,
  children,
}: {
  stations: readonly StationNavItem<K>[];
  station: K | null;
  userName?: string | null;
  readOnly: boolean;
  onSelectStation: (station: K) => void;
  children: ReactNode;
}) {
  const current = stations.find((item) => item.key === station) ?? null;

  return (
    <div className="min-h-screen bg-bg text-strong">
      <header className="sticky top-0 z-30 border-b border-divider bg-bg/95 backdrop-blur">
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Factory className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-strong">จอประจำสถานี</p>
              <p className="truncate text-xs text-muted">
                {current?.label ?? "เลือกจุดทำงานก่อนเริ่ม"}
              </p>
            </div>
          </div>

          <div className="ml-auto hidden min-w-0 text-right md:block">
            <p className="truncate text-sm font-medium text-strong">{userName || "ผู้ใช้งาน"}</p>
            <p className="text-xs text-muted">บันทึกการทำงานในชื่อบัญชีนี้</p>
          </div>
          {readOnly && (
            <Badge variant="outline" size="sm">
              ดูอย่างเดียว
            </Badge>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/production">
              <ArrowLeft />
              <span className="hidden sm:inline">กลับ ERP</span>
              <span className="sm:hidden">กลับ</span>
            </Link>
          </Button>
        </div>

        <nav
          aria-label="เลือกสถานีผลิต"
          className="overflow-x-auto border-t border-divider px-4 sm:px-6"
        >
          <div className="mx-auto flex min-w-max gap-1 py-2 xl:max-w-7xl">
            {stations.map((item) => {
              const Icon = item.icon;
              const selected = item.key === station;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onSelectStation(item.key)}
                  className={cn(
                    FOCUS_BUTTON,
                    "flex min-h-11 min-w-32 touch-manipulation items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors",
                    selected
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-secondary hover:bg-interactive-hover hover:text-strong",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="lg:hidden">{item.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
