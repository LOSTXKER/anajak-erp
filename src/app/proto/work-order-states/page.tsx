"use client";

/**
 * หน้าลอง "ใบผลิตทุกสถานะ" (เบสสั่ง 2026-09-09 "ทำ proto ทุกสถานะ ขั้นตอนมาให้ดู จะได้ปรับ UX/UI ได้ง่าย")
 * ซ้าย = รายชื่อสถานะ · ขวา = ใบผลิตตัวจริง (WorkOrderView) ในสถานะนั้น — ปุ่ม/ราง/เช็คลิสต์เป็นชุดเดียวกับของจริง
 * ตัวเลือกอยู่ใน URL (?s=… &boss=1) ก๊อปลิงก์ส่งกลับได้เลย
 */
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Smartphone, Sun, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { WorkOrderView } from "@/components/production/work-order-page";
import type { RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { useProtoController } from "./_controller";
import { DEFAULT_STATE, ORDER_ITEMS, STATES, STATE_KEYS, stateOf } from "./_fixtures";

export default function WorkOrderStatesProto() {
  const [key, setKey] = useProtoVariant("s", STATE_KEYS, DEFAULT_STATE);
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { resolvedTheme, setTheme } = useTheme();
  const fx = stateOf(key);
  const c = useProtoController(fx, boss ? "boss" : "staff");
  const groups = [...new Set(STATES.map((s) => s.group))];
  const mobileHref = `/proto/work-order-states/view?s=${encodeURIComponent(key)}${boss ? "" : "&boss=0"}`;

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-divider bg-surface lg:flex">
        <div className="space-y-2 border-b border-divider p-4">
          <Link href="/proto" className="inline-flex items-center gap-1 text-xs text-secondary hover:text-strong">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> หน้าลองทั้งหมด
          </Link>
          <p className="text-sm font-semibold text-strong">ใบผลิต — ทุกสถานะ</p>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant={boss ? "default" : "outline"} onClick={toggleBoss}>
              <UserRound /> {boss ? "หัวหน้า" : "ช่าง"}
            </Button>
            <Button size="sm" variant="outline" aria-label="สลับธีม" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(mobileHref, "proto-mobile", "width=390,height=820,noopener")}>
              <Smartphone /> 390
            </Button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="สถานะ">
          {groups.map((g) => (
            <div key={g} className="mb-2">
              <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted">{g}</p>
              {STATES.filter((s) => s.group === g).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setKey(s.key)}
                  aria-current={s.key === key ? "page" : undefined}
                  className={cn("block w-full rounded-lg px-2 py-1.5 text-left text-sm", s.key === key ? "bg-surface-muted font-medium text-strong" : "text-secondary hover:bg-surface-muted hover:text-strong")}
                >
                  {s.title}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-divider bg-surface px-3 py-2 lg:hidden">
          {STATES.map((s) => (
            <Button key={s.key} size="sm" variant={s.key === key ? "default" : "outline"} onClick={() => setKey(s.key)}>
              {s.title}
            </Button>
          ))}
        </div>
        <WorkOrderView
          key={`${key}:${boss ? "boss" : "staff"}`}
          c={c}
          scannedMockup={fx.flags?.scannedMockup ?? Number.NaN}
          itemsTab={
            <>
              <OrderItemsDisplay orderId={fx.order.orderNumber} items={ORDER_ITEMS as RouterOutput["order"]["getById"]["items"]} fees={[]} showMoney={false} canEditReceiveTracking={false} />
              <ProductionDesignCard order={fx.order} />
            </>
          }
        />
      </div>
    </div>
  );
}
