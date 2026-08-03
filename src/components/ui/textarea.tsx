import * as React from "react";
import { cn } from "@/lib/utils";
import { FIELD_SURFACE, FOCUS_FIELD, RADIUS } from "./tokens";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          RADIUS.field,
          FIELD_SURFACE,
          FOCUS_FIELD,
          // ความสูงขั้นต่ำ ~3 บรรทัด — ยืดตามเนื้อหา จึงไม่ผูกกับ CONTROL_H
          "flex min-h-24 w-full px-3 py-2 text-base sm:text-sm disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
