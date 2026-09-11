import { UiResetDesk } from "./_desk";
import { UiResetOrder } from "./_order";
import { UiResetWorkOrder } from "./_work-order";

export function UiResetPreview({ variant, surface, scenario }: {
  variant: "current" | "a" | "b";
  surface: "desk" | "order" | "work-order";
  scenario: "doing" | "pair" | "problem";
}) {
  return <div className="min-h-screen min-w-0 bg-background p-4 text-foreground sm:p-6">
    {surface === "desk" ? <UiResetDesk variant={variant} /> :
      surface === "order" ? <UiResetOrder variant={variant} /> :
        <UiResetWorkOrder variant={variant} scenario={scenario} />}
  </div>;
}
