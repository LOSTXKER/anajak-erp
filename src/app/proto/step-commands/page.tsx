"use client";

/**
 * หน้าลอง "คำสั่งของขั้นควรอยู่ตรงไหน" (เบสทัก 2026-09-10: "บางอันมันจำเป็นต้องใช้ แต่ก็ไปซ่อน")
 *
 * ใบผลิตที่เห็นคือ `WorkOrderView` ตัวจริง — ปุ่ม ราง เช็คลิสต์ ตารางไซซ์ ชุดเดียวกับที่ทีมใช้
 * ต่างกันแค่ค่าเดียว: คำสั่งของขั้น (แจ้งปัญหา · มอบหมาย/แก้ให้ · พัก · ย้อนกลับ) ไปโผล่ที่ไหน
 * ข้อมูลเป็นของจำลองจาก `../work-order-states/_fixtures` (ชุดเดียวกับหน้าลองทุกสถานะ) ไม่แตะฐานข้อมูล
 */

import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Smartphone, Sun, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import { WorkOrderView, type StepCommandPlacement } from "@/components/production/work-order-page";
import type { RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { useProtoController } from "../work-order-states/_controller";
import { ORDER_ITEMS, STATES, stateOf } from "../work-order-states/_fixtures";

/** ทางที่ให้เลือก — ต่างกันที่ "คำสั่งของขั้นอยู่ที่ไหน" ไม่ใช่ต่างที่สี/ระยะ */
const WAYS = [
  {
    key: "header",
    name: "ปัจจุบัน",
    headline: "ทุกคำสั่งอยู่ในเมนู ⋯ บนหัวใบ",
    good: "ที่เดียวจบ หาที่เดิมได้เสมอ · คำสั่งที่ยังทำไม่ได้ยังเห็นอยู่ พร้อมเหตุผลว่าทำไมกดไม่ได้",
    trade: "ของที่หัวหน้าใช้ประจำ (แจ้งปัญหา · มอบหมาย) ต้องกด 2 ครั้งถึงถึง และมองจากหน้าจอไม่เห็นว่ามีอยู่",
  },
  {
    key: "step",
    name: "A · คำสั่งอยู่กับขั้น",
    headline: "คำสั่งทั้งหมดย้ายลงใต้การ์ดขั้นที่ทำอยู่ · หัวใบเหลือแค่ประวัติออเดอร์",
    good: "คำสั่งอยู่ตรงที่สายตาจับอยู่แล้ว กดครั้งเดียว · ชัดว่าคำสั่งนี้มีผลกับ “ขั้นนี้” ไม่ใช่ทั้งใบ",
    trade: "คำสั่งที่ยังทำไม่ได้จะหายไปเลย (กติกาห้ามวางปุ่มกดไม่ได้) — คนใหม่อาจไม่รู้ว่ามีคำสั่งนั้นอยู่ · การ์ดขั้นยาวขึ้น",
  },
  {
    key: "split",
    name: "B · แยกครึ่ง",
    headline: "แจ้งปัญหา + มอบหมาย อยู่กับขั้น · พัก · ย้อนกลับ · ประวัติ ยังอยู่ในเมนู ⋯",
    good: "ของที่ใช้ทุกวันกดครั้งเดียว ส่วนของที่นาน ๆ ใช้และย้อนยากยังถูกเก็บให้พ้นมือ",
    trade: "คำสั่งของขั้นเดียวกันอยู่ 2 ที่ — ต้องจำว่าอันไหนอยู่ไหน",
  },
] as const;

const WAY_KEYS = WAYS.map((w) => w.key);

/** เอาเฉพาะสถานะที่ทำให้เห็นความต่างของคำสั่ง (ครบทั้งตอนกดได้และตอนกดไม่ได้) */
const SHOWN = ["start", "doing", "hold", "problem", "reopen", "outsource-shop", "receive", "all-done"] as const;
const SHOWN_STATES = SHOWN.map((k) => STATES.find((s) => s.key === k)!).filter(Boolean);

export default function StepCommandsProto() {
  const [way, setWay] = useProtoVariant("v", WAY_KEYS, "header");
  const [key, setKey] = useProtoVariant("s", SHOWN as unknown as readonly string[], "start");
  const [boss, toggleBoss] = useProtoFlag("boss", true);
  const { resolvedTheme, setTheme } = useTheme();
  const fx = stateOf(key);
  const c = useProtoController(fx, boss ? "boss" : "staff");
  const current = WAYS.find((w) => w.key === way)!;
  const mobileHref = `/proto/step-commands/view?v=${way}&s=${encodeURIComponent(key)}${boss ? "" : "&boss=0"}`;

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-divider bg-surface lg:flex">
        <div className="space-y-2 border-b border-divider p-4">
          <Link href="/proto" className="inline-flex items-center gap-1 text-xs text-secondary hover:text-strong">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> หน้าลองทั้งหมด
          </Link>
          <p className="text-sm font-semibold text-strong">คำสั่งของขั้นควรอยู่ตรงไหน</p>
          <p className="text-xs text-secondary">
            แจ้งปัญหา · มอบหมาย/แก้ให้ · พักขั้น · ย้อนกลับ — ตอนนี้อยู่ในเมนู ⋯ บนหัวใบทั้งหมด
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
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

        <div className="space-y-2 border-b border-divider p-3">
          <p className="px-1 text-xs font-medium text-muted">เลือกทาง</p>
          {WAYS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setWay(w.key)}
              aria-current={w.key === way ? "page" : undefined}
              className={cn(
                "block w-full rounded-lg border px-3 py-2 text-left",
                w.key === way ? "border-transparent bg-surface-muted" : "border-divider hover:bg-surface-muted",
              )}
            >
              <span className={cn("block text-sm", w.key === way ? "font-semibold text-strong" : "font-medium text-secondary")}>{w.name}</span>
              <span className="mt-0.5 block text-xs text-secondary">{w.headline}</span>
            </button>
          ))}
        </div>

        <nav className="flex-1 overflow-y-auto p-2" aria-label="สถานะของใบ">
          <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted">ลองกับสถานะ</p>
          {SHOWN_STATES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setKey(s.key)}
              aria-current={s.key === key ? "page" : undefined}
              className={cn(
                "block w-full rounded-lg px-2 py-1.5 text-left text-sm",
                s.key === key ? "bg-surface-muted font-medium text-strong" : "text-secondary hover:bg-surface-muted hover:text-strong",
              )}
            >
              {s.title}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 border-b border-divider bg-surface px-3 py-2 lg:hidden">
          {WAYS.map((w) => (
            <Button key={w.key} size="sm" variant={w.key === way ? "default" : "outline"} onClick={() => setWay(w.key)}>
              {w.name}
            </Button>
          ))}
          {SHOWN_STATES.map((s) => (
            <Button key={s.key} size="sm" variant={s.key === key ? "default" : "outline"} onClick={() => setKey(s.key)}>
              {s.title}
            </Button>
          ))}
        </div>

        <div className="border-b border-divider bg-surface-muted px-4 py-3">
          <p className="text-sm font-semibold text-strong">{current.name} — {current.headline}</p>
          <p className="mt-1 text-xs text-secondary"><span className="font-medium text-strong">ได้:</span> {current.good}</p>
          <p className="mt-0.5 text-xs text-secondary"><span className="font-medium text-strong">แลกกับ:</span> {current.trade}</p>
        </div>

        <WorkOrderView
          key={`${way}:${key}:${boss ? "boss" : "staff"}`}
          c={c}
          commands={way as StepCommandPlacement}
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
