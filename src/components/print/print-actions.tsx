"use client";

import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// แถบปุ่มบนหน้าพิมพ์ — โชว์บนจอเท่านั้น (print-hidden) · กดพิมพ์ = browser print → Save as PDF ได้
export function PrintActions({ backHref }: { backHref: string }) {
  // ต้นแบบ .ptools = แถวเดียวกว้างเท่ากระดาษ เว้นใต้ 14px · ซ้ายเป็นทางกลับ (ต้นแบบเป็น
  // ปุ่มสลับเอกสารซึ่งทำไม่ได้: ของจริงเป็น 5 route คนละ entity คนละสิทธิ์) ขวาเป็นปุ่มพิมพ์
  return (
    <nav aria-label="จัดการเอกสาร" className="print-hidden mx-auto mb-3.5 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
      <Button variant="outline" size="sm" asChild>
        <Link href={backHref}>
          <ArrowLeft />
          กลับ
        </Link>
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer />
        พิมพ์ / บันทึก PDF
      </Button>
    </nav>
  );
}
