"use client";

import { toast } from "sonner";
import { WorkOrderView } from "@/components/production/work-order-page";
import { ItemsList } from "@/components/production/work-order-pieces";
import { ProductionDesignCard } from "@/components/production/production-design-card";
import type { WorkOrderVariant } from "@/components/production/work-order-steps";
import { Section } from "@/components/ui/section";
import { useProtoController } from "../work-order-states/_controller";
import { stateOf } from "../work-order-states/_fixtures";

export type UiResetWorkOrderScenario = "doing" | "pair" | "problem";

/** ใช้เฉพาะสถานการณ์ที่ไม่มีฟอร์มตรวจรับ/เบิกเสื้อซึ่งเชื่อมข้อมูลจริง */
export function UiResetWorkOrder({ variant, scenario = "doing" }: { variant: WorkOrderVariant; scenario?: UiResetWorkOrderScenario }) {
  const fixture = stateOf(scenario);
  const c = useProtoController(fixture, "boss");
  return (
    <WorkOrderView
      c={c}
      variant={variant}
      onNavigate={(label) => toast.message(`หน้าลอง — ${label} เป็นตัวอย่าง ยังไม่ได้เปิดข้อมูลหรือเอกสารจริง`)}
      itemsTab={
        <>
          <Section title="สินค้าในใบนี้"><ItemsList order={fixture.order} /></Section>
          <ProductionDesignCard order={fixture.order} focusStepType={fixture.steps[0]?.stepType} />
        </>
      }
    />
  );
}
