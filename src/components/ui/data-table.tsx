import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal table primitive that gives every list page the same look-and-feel:
 * - subtle bordered container
 * - sentence-cased header (no UPPERCASE noise)
 * - uniform row hover & dividers
 *
 * Usage:
 *   <DataTable.Root>
 *     <DataTable.Head>
 *       <DataTable.Row>
 *         <DataTable.Th>Order</DataTable.Th>
 *         ...
 *       </DataTable.Row>
 *     </DataTable.Head>
 *     <DataTable.Body>...</DataTable.Body>
 *   </DataTable.Root>
 */

interface RootProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

const Root = React.forwardRef<HTMLDivElement, RootProps>(
  ({ className, bordered = true, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        bordered && "card-surface overflow-hidden rounded-2xl",
        className
      )}
      {...props}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
);
Root.displayName = "DataTable.Root";

const Head = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "border-b border-slate-100 bg-slate-50/60 text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400",
      className
    )}
    {...props}
  />
));
Head.displayName = "DataTable.Head";

const Body = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      "divide-y divide-slate-100 dark:divide-slate-800/70",
      className
    )}
    {...props}
  />
));
Body.displayName = "DataTable.Body";

const Row = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40",
      className
    )}
    {...props}
  />
));
Row.displayName = "DataTable.Row";

interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
}

const Th = React.forwardRef<HTMLTableCellElement, ThProps>(
  ({ className, align = "left", scope = "col", ...props }, ref) => (
    <th
      ref={ref}
      scope={scope}
      className={cn(
        "px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className
      )}
      {...props}
    />
  )
);
Th.displayName = "DataTable.Th";

interface SortableThProps extends Omit<ThProps, "onClick"> {
  /** ทิศที่กำลังเรียงอยู่ · null = คอลัมน์นี้ยังไม่ได้เป็นตัวเรียง */
  direction?: "asc" | "desc" | null;
  /** ทิศที่จะได้ตอนกดครั้งแรก — วันที่/ยอดเงินเริ่มมาก→น้อย, กำหนดส่งเริ่มใกล้สุด */
  defaultDirection?: "asc" | "desc";
  onSort: (direction: "asc" | "desc") => void;
}

/** กดหัวคอลัมน์แล้วได้ทิศไหนต่อ — คอลัมน์ที่เรียงอยู่ = สลับทิศ · คอลัมน์อื่น = ทิศตั้งต้นของมัน */
function nextSortDirection(
  direction: "asc" | "desc" | null,
  defaultDirection: "asc" | "desc"
): "asc" | "desc" {
  if (direction === null) return defaultDirection;
  return direction === "asc" ? "desc" : "asc";
}

/**
 * หัวคอลัมน์ที่กดเรียงได้ — กดซ้ำสลับทิศ
 * ลูกศรค้างไว้จางๆ ทุกคอลัมน์ที่เรียงได้ (บอกว่ากดได้) และเข้มขึ้นเมื่อเป็นตัวเรียงอยู่
 * (เบสเคาะ 2026-07-31 จาก mockup orders-sort-in-header)
 */
const SortableTh = React.forwardRef<HTMLTableCellElement, SortableThProps>(
  (
    {
      className,
      align = "left",
      scope = "col",
      direction = null,
      defaultDirection = "asc",
      onSort,
      children,
      ...props
    },
    ref
  ) => {
    const active = direction !== null;
    const nextDirection = nextSortDirection(direction, defaultDirection);
    const Arrow = (active ? direction : defaultDirection) === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        ref={ref}
        scope={scope}
        aria-sort={
          active ? (direction === "asc" ? "ascending" : "descending") : "none"
        }
        className={cn("p-0", className)}
        {...props}
      >
        <button
          type="button"
          onClick={() => onSort(nextDirection)}
          className={cn(
            "flex w-full items-center gap-1.5 px-5 py-3 text-xs font-medium transition-colors",
            "hover:bg-slate-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-slate-800/50",
            active
              ? "font-semibold text-blue-700 dark:text-blue-300"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            align === "right" && "justify-end",
            align === "center" && "justify-center"
          )}
        >
          {children}
          <Arrow
            aria-hidden="true"
            className={cn(
              "h-3 w-3 shrink-0",
              active ? "text-blue-600 dark:text-blue-400" : "text-slate-300 dark:text-slate-600"
            )}
          />
        </button>
      </th>
    );
  }
);
SortableTh.displayName = "DataTable.SortableTh";

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
}

const Td = React.forwardRef<HTMLTableCellElement, TdProps>(
  ({ className, align = "left", ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-5 py-3 text-sm text-slate-700 dark:text-slate-300",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className
      )}
      {...props}
    />
  )
);
Td.displayName = "DataTable.Td";

export const DataTable = { Root, Head, Body, Row, Th, SortableTh, Td };
