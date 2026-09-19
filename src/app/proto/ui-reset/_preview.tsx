import { UiResetDesk } from "./_desk";
import { UiResetOrder } from "./_order";

export function UiResetPreview({ variant, surface }: {
  variant: "current" | "a" | "b";
  surface: "desk" | "order";
}) {
  return <div className="min-h-screen min-w-0 bg-background p-4 text-foreground sm:p-6">
    {surface === "desk" ? <UiResetDesk variant={variant} /> : <UiResetOrder variant={variant} />}
  </div>;
}
