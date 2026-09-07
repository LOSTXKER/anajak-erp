"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { CASE_VALUES, Preview, VALUES, type Case, type Variant } from "../_preview";

export default function ResetFullPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "record");
  const [scenario] = useProtoVariant<Case>("case", CASE_VALUES, "overdue");
  const [boss] = useProtoFlag("boss", true);
  return <main className="min-h-screen bg-bg px-4 py-4 text-strong sm:px-8 sm:py-6"><div className="mx-auto max-w-5xl space-y-5"><div className="flex items-center justify-between gap-3"><Link href={`/proto/work-order-reset?v=${variant}&case=${scenario}&boss=${boss ? 1 : 0}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary"><ArrowLeft className="size-4" />เทียบแบบ</Link><span className="text-xs text-secondary">หน้าลอง / ข้อมูลจำลอง</span></div><Preview variant={variant} scenario={scenario} boss={boss} idPrefix="full" /></div></main>;
}
