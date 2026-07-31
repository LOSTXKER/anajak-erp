import * as React from "react";
import { cn } from "@/lib/utils";
import { CONTROL_H } from "./control-size";

import { controlShapeClass, type ControlShape } from "./native-select";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { shape?: ControlShape }
>(
  ({ className, type, shape, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          controlShapeClass(shape),
          CONTROL_H,
          "flex w-full border border-slate-200/70 bg-white px-3 py-1 text-base text-slate-900 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/15 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-blue-400",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
