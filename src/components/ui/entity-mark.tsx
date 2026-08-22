import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { VISUAL_TONE_CLASSES, type VisualTone } from "@/lib/visual-tone";

type EntityMarkSize = "sm" | "md" | "lg";

const SIZE: Record<EntityMarkSize, { frame: string; icon: string; image: number }> = {
  sm: { frame: "h-8 w-8 rounded-lg text-2xs", icon: "h-4 w-4", image: 32 },
  md: { frame: "h-10 w-10 rounded-lg text-xs", icon: "h-5 w-5", image: 40 },
  lg: { frame: "h-12 w-12 rounded-lg text-sm", icon: "h-6 w-6", image: 48 },
};

function initialsOf(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  return `${Array.from(words[0])[0] ?? ""}${Array.from(words.at(-1) ?? "")[0] ?? ""}`.toUpperCase();
}

export function EntityMark({
  label,
  imageSrc,
  initials,
  icon: Icon = Box,
  size = "md",
  shape = "square",
  fallback = "initials",
  className,
  tone = "system",
}: {
  label: string;
  imageSrc?: string | null;
  initials?: string | null;
  icon?: LucideIcon;
  size?: EntityMarkSize;
  shape?: "square" | "avatar";
  fallback?: "initials" | "icon";
  className?: string;
  tone?: VisualTone;
}) {
  const styles = SIZE[size];
  const fallbackInitials = fallback === "initials" ? initials?.trim() || initialsOf(label) : "";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold ring-1 ring-inset",
        VISUAL_TONE_CLASSES[tone].soft,
        VISUAL_TONE_CLASSES[tone].border,
        styles.frame,
        shape === "avatar" && "rounded-full",
        className
      )}
      aria-hidden="true"
      data-entity-mark={imageSrc ? "image" : fallbackInitials ? "initials" : "icon"}
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          width={styles.image}
          height={styles.image}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : fallbackInitials ? (
        <span>{fallbackInitials}</span>
      ) : (
        <Icon className={styles.icon} strokeWidth={1.8} />
      )}
    </span>
  );
}

export { initialsOf };
