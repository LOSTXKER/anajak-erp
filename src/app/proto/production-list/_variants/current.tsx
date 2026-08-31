"use client";

/**
 * ของจริงตอนนี้ — เรียก `ProductionControlWorklist` **ตัวจริง** จาก
 * `src/components/production/` ตรง ๆ ไม่ได้วาดใหม่
 *
 * ผลพลอยได้ที่ตั้งใจ: ถ้าของจริงถูกแก้เมื่อไหร่ ช่อง "ของจริงตอนนี้" ในหน้าลอง
 * เปลี่ยนตามทันที — จึงไม่มีวันเทียบกับภาพเก่าที่ค้างอยู่ (เคยพลาดมาแล้ว)
 */

import { ProductionControlWorklist } from "@/components/production/production-control-worklist";

import type { ProtoBoard } from "../_data";
import { ProtoFreshness } from "../_shell";
import type { WorklistState } from "../_ui";

export function CurrentVariant({
  board,
  state,
}: {
  board: ProtoBoard;
  state: WorklistState;
}) {
  return (
    <ProductionControlWorklist
      board={board}
      jobs={state.jobs}
      lens={state.lens}
      sort={state.sort}
      searchDefault={state.search}
      searchInputRef={null}
      onSelectLens={state.setLens}
      onSelectSort={state.setSort}
      onSearchChange={state.setSearch}
      canCreateProduction={false}
      freshness={<ProtoFreshness />}
    />
  );
}
