"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FOCUS_INSET,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  TABLE_HEAD_SURFACE,
} from "./tokens";

/**
 * Minimal table primitive that gives every list page the same look-and-feel:
 * - one bordered panel that groups the whole dataset
 * - sentence-cased header (no UPPERCASE noise)
 * - a quiet full-width header band and uniform row hover
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

/* prop `flush` (ตารางวางบนผืนหน้าไม่มีกล่องครอบ) ถูกถอดออก 2026-08-26 — เบสเห็นของจริง
   บนจอกว้างแล้วบอกว่า "ดูแปลกๆ และไม่ชอบ" · มันพังสองชั้นพร้อมกัน:
   1) ธีมสว่างไม่เคยมีชั้นความลึกจริง (การ์ดต่างจากผืนหน้า 1.03 เท่า) สิ่งที่ตาเห็นว่า
      เป็นกล่องคือเส้นขอบล้วน ๆ พอถอดกล่อง เส้นหายไปด้วย เลยไม่เหลือขอบเขตอะไรเลย
   2) คำสั่ง "ให้เซลล์แรกชิดขอบ" ไปลงที่ <th> แต่ `SortableTh` วาง p-0 ไว้ที่ <th>
      และ px-5 ไว้ที่ <button> ข้างใน คำสั่งจึงไม่โดน — หัวคอลัมน์แรกเยื้องขวากว่า
      ข้อมูล 20px ซึ่งตรงกับสิ่งที่ prop ตัวนี้เขียนคอมเมนต์ไว้เองว่าจะป้องกัน
   ตอนนี้ตารางระดับบนสุดใช้ `bordered` ปริยาย = การ์ดครอบ; ตั้งแต่ 2026-08-27
   ผืน Light เป็น near-white และการ์ดแยกขอบเขตหลักด้วย edge+shadow กลาง */
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
      TABLE_HEAD_SURFACE,
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
      // Vercel-like dataset panel ใช้ divider บางช่วยไล่แถว โดยไม่ทำ cell grid
      // ข้อมูลทุกระดับในเซลล์ใช้ 14px; control ที่จงใจใช้ density แบบ sm/dense
      // รักษาขนาดจาก primitive ของตัวเอง ไม่ถูกกฎข้อมูลตารางทับ
      "divide-y divide-divider [&_td]:text-sm [&_td_:not(:is(button,button_*,input,input_*,select,select_*,textarea,textarea_*,[role=combobox],[role=combobox]_*))]:text-sm",
      className
    )}
    {...props}
  />
));
Body.displayName = "DataTable.Body";

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** แถวกดได้ทั้งแถว — hover เต็มแถวสัญญากับผู้ใช้แล้วต้องทำตาม (benchmark 2026-08-04)
   *  ลิงก์จริงในแถว (เลขออเดอร์) คงไว้เป็นทาง keyboard/เปิดแท็บใหม่ ·
   *  ปุ่มในแถวที่ไม่อยากให้พาไป ให้ stopPropagation เอง */
  href?: string;
}

const Row = React.forwardRef<HTMLTableRowElement, RowProps>(
  ({ className, href, onClick, ...props }, ref) => {
    const router = useRouter();
    return (
      <tr
        ref={ref}
        onClick={
          href
            ? (e) => {
                onClick?.(e);
                if (e.defaultPrevented) return;
                // อย่าแย่งคลิกจาก control/ลิงก์จริงข้างใน
                const t = e.target as HTMLElement;
                if (t.closest("a,button,input,select,textarea,[role=combobox]")) return;
                router.push(href);
              }
            : onClick
        }
        className={cn(
          // ชี้แถวไหนต้องรู้ทันที — ตารางกว้างแล้วกดผิดแถวคือกดผิดออเดอร์
          INTERACTIVE_HOVER,
          "group transition-colors hover:[&_.text-muted]:text-secondary hover:[&_.text-muted]:text-secondary dark:hover:[&_.text-muted]:text-secondary dark:hover:[&_.text-muted]:text-secondary",
          href && cn("cursor-pointer", INTERACTIVE_PRESSED),
          className
        )}
        {...props}
      />
    );
  }
);
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
        // หัวคอลัมน์ไม่ตัดกลางวลี — "กำหนดส่ง" ที่ขึ้นบรรทัดใหม่กลางคำอ่านสะดุด
        // และทำให้หัวตารางสูงไม่เท่ากันทีละคอลัมน์ · ตารางมี overflow-x อยู่แล้ว
        "whitespace-nowrap px-6 py-3 text-xs font-semibold text-secondary",
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
            // ไม่ย้อมพื้นตอนเอาเมาส์ชี้ (เบสสั่ง 2026-08-02 "ไม่ชอบหัวตารางเปลี่ยนสีตอนชี้") —
            // แถบเทาโผล่เฉพาะช่องที่ชี้อยู่ ทำให้หัวตารางดูขาดเป็นท่อนๆ
            // บอกว่า "กดได้" ด้วยตัวหนังสือกับลูกศรที่เข้มขึ้นแทน — เบากว่าและไม่ทำให้แถวขาด
            "group flex w-full cursor-pointer touch-manipulation items-center gap-1.5 whitespace-nowrap px-6 py-3 text-xs font-semibold transition-colors [@media(pointer:coarse)]:min-h-11",
            FOCUS_INSET,
            active
              ? "font-semibold text-blue-700 dark:text-blue-300"
              : "text-secondary hover:text-strong",
            align === "right" && "justify-end",
            align === "center" && "justify-center"
          )}
        >
          {children}
          <Arrow
            aria-hidden="true"
            className={cn(
              "h-3 w-3 shrink-0 transition-colors",
              active
                ? "text-blue-600 dark:text-blue-400"
                : "text-muted group-hover:text-secondary"
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
        // แถวหายใจขึ้น (เฟส 10 · เบสเคาะ "นุ่มเต็มที่") — py 12 → 16px · เซลล์ 20 → 24px
        "px-6 py-4 text-sm text-secondary",
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
