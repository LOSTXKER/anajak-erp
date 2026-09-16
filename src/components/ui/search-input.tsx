import * as React from "react";
import { Search } from "lucide-react";
import { c } from "@/components/kit/kit";
import type { ControlSurface } from "./tokens";

/* ============================================================
   ช่องค้นหาของแถบเครื่องมือ — ใช้หน้าตา `.sinput` ของชุดกลาง (kit.module.css)
   ชุดเดียวกับช่องค้นหาบนหน้าออเดอร์/งานในโรงงาน (รวมสไตล์ 2026-09-17)
   ============================================================ */

interface SearchInputProps extends Omit<React.ComponentProps<"input">, "type" | "size"> {
  containerClassName?: string;
  /** คงไว้ให้ caller เดิมเรียกได้ — ช่องค้นหามีผิวเดียวแล้ว */
  surface?: ControlSurface;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, surface, ...props }, ref) => {
    void surface;
    return (
      <label className={[c("sinput"), containerClassName ?? ""].filter(Boolean).join(" ")}>
        <Search aria-hidden="true" />
        <input
          ref={ref}
          type="search"
          aria-label={props["aria-label"] ?? props.placeholder ?? "ค้นหา"}
          className={className}
          {...props}
        />
      </label>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
