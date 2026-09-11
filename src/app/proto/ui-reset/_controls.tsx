"use client";

import { useTheme } from "next-themes";
import { useId } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Surface = "desk" | "order" | "work-order";
type Scenario = "doing" | "pair" | "problem";

export function UiResetControls({ surface, onSurface, scenario, onScenario }: {
  surface: Surface;
  onSurface: (value: Surface) => void;
  scenario: Scenario;
  onScenario: (value: Scenario) => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const surfaceId = useId();
  const scenarioId = useId();
  return (
    <>
      <label htmlFor={surfaceId} className="flex items-center gap-2 text-sm">
        หน้าที่เทียบ
        <Select id={surfaceId} value={surface} onChange={(event) => onSurface(event.target.value as Surface)}>
          <option value="desk">คิวผลิต</option>
          <option value="order">ออเดอร์</option>
          <option value="work-order">ใบผลิต</option>
        </Select>
      </label>
      {surface === "work-order" && <label htmlFor={scenarioId} className="flex items-center gap-2 text-sm">
        สถานการณ์
        <Select id={scenarioId} value={scenario} onChange={(event) => onScenario(event.target.value as Scenario)}>
          <option value="doing">กำลังทำ</option>
          <option value="pair">ทำสองขั้นคู่กัน</option>
          <option value="problem">ติดปัญหา</option>
        </Select>
      </label>}
      <Button variant="outline" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
        สลับสว่าง/มืด
      </Button>
      <span className="text-sm text-muted">ข้อมูลตัวอย่าง · การกดในหน้าลองไม่บันทึกงานจริง</span>
    </>
  );
}
