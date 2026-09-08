"use client";

import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// แถบปุ่มบนหน้าพิมพ์ — โชว์บนจอเท่านั้น (print-hidden) · กดพิมพ์ = browser print → Save as PDF ได้
export function PrintActions({ backHref }: { backHref: string }) {
  return (
    <nav aria-label="จัดการเอกสาร" className="print-hidden mx-auto mb-4 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
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
