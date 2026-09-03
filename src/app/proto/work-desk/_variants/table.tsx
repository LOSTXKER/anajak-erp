"use client";

/**
 * A · ใบผลิตเป็นตารางขั้นงาน — เปิดมาเห็นทั้ง 7 ขั้นทันที กดแถว = กางโซนลงมือ + แก้ให้ ใต้แถวนั้น
 * ไม่มีแท็บ "ขั้นงาน" อีก (ตารางอยู่บนสุดเสมอ) · ข้อมูลอ้างอิง (ทำอะไร / ข้อมูลใบ / ประวัติ) เป็นแท็บใต้ตาราง
 * หัวใบ + การ์ดปัญหาเหมือน D
 */

import { useState } from "react";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STEPS, currentStep } from "../../work-order/_data";
import { ProblemCard, WorkOrderHeader } from "../../work-order/_pieces";
import { EventsColumn, GarmentColumn, ItemsColumn, OrderFactsColumn, PlanColumn, PrintsColumn } from "../../work-order/_variants/tabs";
import { StepsTable } from "../_pieces";

const REF_TABS = [
  { value: "make", label: "ทำอะไร" },
  { value: "info", label: "ข้อมูลใบ" },
  { value: "history", label: "ประวัติ" },
] as const;

export function TableVariant({ boss }: { boss: boolean }) {
  const [selected, setSelected] = useState<string | null>(() => currentStep(STEPS).id);
  const problems = STEPS.filter((s) => s.problem);
  const twoCol = "grid gap-5 lg:grid-cols-2";
  return (
    <div className="space-y-6">
      <WorkOrderHeader steps={STEPS} />
      {problems.length > 0 ? (
        <div className={twoCol}>
          {problems.map((s) => (
            <ProblemCard key={s.id} step={s} />
          ))}
        </div>
      ) : null}

      <StepsTable steps={STEPS} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} boss={boss} />

      <Tabs defaultValue="make" className="space-y-6">
        <TabsBar>
          <TabsList aria-label="ข้อมูลอ้างอิงของใบผลิต">
            {REF_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </TabsBar>
        <TabsContent value="make">
          <div className={twoCol}>
            <ItemsColumn />
            <PrintsColumn />
          </div>
        </TabsContent>
        <TabsContent value="info">
          <div className={twoCol}>
            <OrderFactsColumn />
            <GarmentColumn />
          </div>
        </TabsContent>
        <TabsContent value="history">
          <div className={twoCol}>
            <EventsColumn />
            <PlanColumn />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
