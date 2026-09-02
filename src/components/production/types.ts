import type { RouterOutput } from "@/lib/trpc";

// ใบผลิต + ขั้นตอน — shape เดียวกับ production.getById (และ steps ตรงกับ getByOrderId)
export type ProductionDetail = RouterOutput["production"]["getById"];
export type ProductionStep = ProductionDetail["steps"][number];
