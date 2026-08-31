"use client";

/** ตัวหน้าจริงที่กำลังเทียบ — ใช้ทั้งในหน้าเทียบ และในหน้า /view ที่เปิดเต็มจอ */

import { PROTO_BOARD, PROTO_BOARD_BUSY } from "../production-list/_data";
import { ProductionShell } from "../production-list/_shell";
import { BarVariant } from "../production-list/_variants/bar";

import { LensChips, StationChips, TwoChips } from "./_filters";
import { useFilterProto } from "./_state";

export type ProductionFilterVariant = "current" | "lane" | "two" | "none";

function Inner({
  variant,
  busy,
}: {
  variant: ProductionFilterVariant;
  busy: boolean;
}) {
  const board = busy ? PROTO_BOARD_BUSY : PROTO_BOARD;
  const state = useFilterProto(board);

  return (
    <ProductionShell>
      <BarVariant
        state={state}
        filter={
          variant === "lane" ? (
            <StationChips state={state} />
          ) : variant === "two" ? (
            <TwoChips state={state} />
          ) : variant === "none" ? null : (
            <LensChips state={state} />
          )
        }
      />
    </ProductionShell>
  );
}

export function ProductionFilterPreview({
  variant,
  busy,
}: {
  variant: ProductionFilterVariant;
  busy: boolean;
}) {
  /* key = แบบที่เลือก → สลับแบบแล้วตัวกรองที่ค้างอยู่ถูกล้างเสมอ
     ไม่งั้นเลือก "DTF" ในแบบ A แล้วสลับไปแบบที่ไม่มีชิปสาย ตารางจะยังกรองอยู่
     ทั้งที่ไม่มีอะไรบนจอบอกว่ากรองค้าง = หน้าลองโกหก */
  return <Inner key={variant} variant={variant} busy={busy} />;
}
