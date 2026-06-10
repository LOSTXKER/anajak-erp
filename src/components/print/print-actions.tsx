"use client";

import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// แถบปุ่มบนหน้าพิมพ์ — โชว์บนจอเท่านั้น (print-hidden) · กดพิมพ์ = browser print → Save as PDF ได้
export function PrintActions({ backHref }: { backHref: string }) {
  return (
    <div className="print-hidden mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between">
      <Button variant="outline" size="sm" asChild>
        <a href={backHref}>
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </a>
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        พิมพ์ / บันทึก PDF
      </Button>
    </div>
  );
}
