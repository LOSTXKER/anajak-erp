"use client";

/** ตัวหน้าจริงที่กำลังเทียบ — ใช้ทั้งในหน้าเทียบ และในหน้า /view ที่เปิดเต็มจอ */

import { PROTO_BOARD, PROTO_BOARD_BUSY } from "./_data";
import { ProductionShell } from "./_shell";
import { useWorklist } from "./_ui";
import { BarVariant } from "./_variants/bar";
import { CurrentVariant } from "./_variants/current";
import { DenseVariant } from "./_variants/dense";
import { FocusVariant } from "./_variants/focus";

export type ProductionListVariant = "current" | "dense" | "focus" | "bar";

export function ProductionListPreview({
  variant,
  busy,
}: {
  variant: ProductionListVariant;
  busy: boolean;
}) {
  const board = busy ? PROTO_BOARD_BUSY : PROTO_BOARD;
  const state = useWorklist(board);

  return (
    <ProductionShell>
      {variant === "dense" ? (
        <DenseVariant state={state} />
      ) : variant === "focus" ? (
        <FocusVariant state={state} />
      ) : variant === "bar" ? (
        <BarVariant state={state} />
      ) : (
        <CurrentVariant board={board} state={state} />
      )}
    </ProductionShell>
  );
}
