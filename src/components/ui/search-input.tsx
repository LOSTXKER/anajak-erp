import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "size"> {
  containerClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, ...props }, ref) => {
    return (
      <div className={cn("relative", containerClassName)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {/* ช่องค้นหาอยู่ในแถบเครื่องมือเสมอ จึงเป็นแคปซูลให้เข้าชุดกับปุ่มข้างกัน */}
        <Input ref={ref} shape="pill" aria-label={props["aria-label"] ?? props.placeholder ?? "ค้นหา"} className={cn("pl-9", className)} {...props} />
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
