"use client";

import Link from "next/link";
import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { CASE_VALUES, Preview, VALUES, type Case, type Variant } from "../_preview";

export default function WorkOrderDeskView() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "wizard");
  const [scenario] = useProtoVariant<Case>("case", CASE_VALUES, "overdue");
  const [boss] = useProtoFlag("boss", true);
  return <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-8">
    <div className="mx-auto max-w-[1320px] space-y-5"><div className="flex flex-wrap justify-between gap-2 border-b border-divider pb-3 text-xs text-secondary"><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/proto/work-order-desk?v=${variant}&case=${scenario}&boss=${boss ? "1" : "0"}`}>กลับไปเทียบแบบ</Link><span className="inline-flex min-h-11 items-center">หน้าลอง ข้อมูลและปุ่มจำลอง</span></div><Preview variant={variant} scenario={scenario} boss={boss} idPrefix="full" /></div>
  </main>;
}
