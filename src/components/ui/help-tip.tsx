"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON, OVERLAY_PANEL } from "@/components/ui/tokens";

export function HelpTip({
  label,
  children,
  className,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`ดูคำอธิบาย: ${label}`}
          className={cn(
            FOCUS_BUTTON,
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-interactive-hover hover:text-strong [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
            className,
          )}
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            OVERLAY_PANEL,
            "z-50 max-w-xs px-3 py-2 text-xs leading-relaxed text-secondary",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 motion-reduce:animate-none",
          )}
        >
          {children}
          <PopoverPrimitive.Arrow className="fill-surface-elevated" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
