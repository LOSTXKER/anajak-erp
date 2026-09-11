"use client";

import { ProtoCompare } from "../_kit/proto-compare";
import { useProtoVariant } from "../_kit/use-proto-variant";
import { UiResetControls } from "./_controls";
import { UiResetPreview } from "./_preview";

const VARIANTS = [
  { key: "current", label: "ปัจจุบัน", tradeoff: "โครงที่ทีมใช้อยู่" },
  { key: "a", label: "A · เอกสารโปร่ง", tradeoff: "เห็นเนื้อหางานก่อน ลดกรอบซ้อน" },
  { key: "b", label: "B · พื้นที่ทำงาน", tradeoff: "เห็นบริบทข้างงาน ใช้พื้นที่สองส่วน" },
] as const;
const SURFACES = ["desk", "order", "work-order"] as const;
const SCENARIOS = ["doing", "pair", "problem"] as const;

export default function UiResetPage() {
  const [surface, setSurface] = useProtoVariant("surface", SURFACES, "desk");
  const [scenario, setScenario] = useProtoVariant("case", SCENARIOS, "doing");
  return (
    <ProtoCompare
      title="โครงแบบไหนช่วยให้เห็นงานและลงมือได้ง่ายกว่า"
      variants={VARIANTS}
      desktopHeight={900}
      controls={<UiResetControls surface={surface} onSurface={setSurface} scenario={scenario} onScenario={setScenario} />}
      render={(variant) => <UiResetPreview key={`${surface}:${variant}:${scenario}`} variant={variant} surface={surface} scenario={scenario} />}
    />
  );
}
