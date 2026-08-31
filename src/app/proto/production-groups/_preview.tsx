"use client";

/** ตัวหน้าจริงที่กำลังเทียบ — ใช้ทั้งในหน้าเทียบ และในหน้า /view ที่เปิดเต็มจอ */

import { PROTO_BOARD, PROTO_BOARD_BUSY } from "../production-list/_data";
import { ProductionShell } from "../production-list/_shell";
import { useWorklist } from "../production-list/_ui";
import { BarVariant } from "../production-list/_variants/bar";

import {
  FlatBar,
  FoldedBar,
  GroupFirstBar,
  LabelledBar,
  PipelineBar,
  TwoRowBar,
} from "./_filters";

export type ProductionGroupVariant =
  | "current"
  | "label"
  | "rows"
  | "fold"
  | "pipeline"
  | "groupfirst";
export type ProductionSortControl = "select" | "toggle" | "none";

function Inner({
  variant,
  sortControl,
  busy,
}: {
  variant: ProductionGroupVariant;
  sortControl: ProductionSortControl;
  busy: boolean;
}) {
  const board = busy ? PROTO_BOARD_BUSY : PROTO_BOARD;
  const state = useWorklist(board);

  return (
    <ProductionShell>
      <BarVariant
        state={state}
        desktopSort={sortControl}
        filter={
          variant === "label" ? (
            <LabelledBar state={state} />
          ) : variant === "rows" ? (
            <TwoRowBar state={state} />
          ) : variant === "fold" ? (
            <FoldedBar state={state} />
          ) : variant === "pipeline" ? (
            <PipelineBar state={state} />
          ) : variant === "groupfirst" ? (
            <GroupFirstBar state={state} />
          ) : (
            <FlatBar state={state} />
          )
        }
      />
    </ProductionShell>
  );
}

export function ProductionGroupsPreview({
  variant,
  sortControl,
  busy,
}: {
  variant: ProductionGroupVariant;
  sortControl: ProductionSortControl;
  busy: boolean;
}) {
  /* key = แบบที่เลือก → สลับแบบแล้วตัวกรองที่ค้างอยู่ถูกล้างเสมอ
     (เช่น กางร้านนอกค้างไว้ในแบบ C แล้วสลับไปแบบอื่น) */
  return (
    <Inner key={variant} variant={variant} sortControl={sortControl} busy={busy} />
  );
}
