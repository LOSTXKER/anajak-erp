"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Factory, RefreshCw, UserRound } from "lucide-react";

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
  onChangeStation,
  children,
}: {
  stations: readonly StationNavItem<K>[];
  station: K | null;
  userName?: string | null;
  readOnly: boolean;
  onChangeStation: () => void;
  children: ReactNode;
}) {
  const current = stations.find((item) => item.key === station) ?? null;
  const CurrentIcon = current?.icon ?? Factory;

  return (
    <div className="min-h-screen bg-bg text-strong">
      <header className="sticky top-0 z-30 border-b border-divider bg-bg/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-module-production-text">
              <CurrentIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted">
                จอประจำสถานี
              </p>
              <p className="truncate text-base font-semibold text-strong">
                {current?.label ?? "เลือกสถานีผลิต"}
              </p>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-2 border-r border-divider pr-3 md:flex">
            <UserRound
              className="h-4 w-4 shrink-0 text-muted"
              aria-hidden="true"
            />
            <p className="max-w-44 truncate text-sm font-medium text-secondary">
              {userName || "ผู้ใช้งาน"}
            </p>
          </div>
          {readOnly && (
            <Badge variant="outline" size="sm">
              ดูอย่างเดียว
            </Badge>
          )}
          {current && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onChangeStation}
              aria-label="เปลี่ยนสถานี"
              className="min-h-11"
            >
              <RefreshCw />
              <span className="hidden lg:inline">เปลี่ยนสถานี</span>
            </Button>
          )}
          <Button variant="outline" size="sm" className="min-h-11" asChild>
            <Link href="/production" aria-label="กลับหน้าการผลิตใน ERP">
              <ArrowLeft />
              <span className="hidden sm:inline">กลับ ERP</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
