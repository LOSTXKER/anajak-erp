import * as React from "react";
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
        bordered &&
          "overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/80",
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
  ({ className, align = "left", ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "px-5 py-3 text-[11.5px] font-medium text-slate-500 dark:text-slate-400",
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

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
}

const Td = React.forwardRef<HTMLTableCellElement, TdProps>(
  ({ className, align = "left", ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-5 py-3 text-[13px] text-slate-700 dark:text-slate-300",
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

export const DataTable = { Root, Head, Body, Row, Th, Td };
