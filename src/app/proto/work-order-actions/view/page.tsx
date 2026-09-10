"use client";

import { useProtoVariant } from "../../_kit/use-proto-variant";
import { WorkOrderActionsView } from "../_view";

export default function WorkOrderActionsPreview() {
  const [variant] = useProtoVariant("v", ["current", "compact", "panel"] as const, "current");
  const [scenario] = useProtoVariant("s", ["parallel", "single", "long"] as const, "parallel");
  const [phase] = useProtoVariant("p", ["start", "partial", "ready", "problem"] as const, "start");
  const [theme] = useProtoVariant("theme", ["light", "dark"] as const, "light");
  return <WorkOrderActionsView key={`${variant}:${scenario}:${phase}:${theme}`} variant={variant} scenario={scenario} phase={phase} theme={theme} />;
}
