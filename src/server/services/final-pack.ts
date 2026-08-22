import { badRequest } from "@/server/errors";
import type { ReportOutputCommand } from "@/server/services/manufacturing-commands";

type PackLine = NonNullable<ReportOutputCommand["quantityLines"]>[number];

/**
 * Final Pack ต้องรายงานที่ระดับสินค้า/สี/ไซซ์เสมอ เพื่อให้ยอดรวมตรวจย้อนกลับได้
 * และไม่ผูกกับ Delivery ซึ่งเป็นคำสั่งส่งของของออฟฟิศคนละขอบเขตสิทธิ์.
 */
export function assertFinalPackOutput(input: {
  qtyGood: number;
  qtyScrap: number;
  qtyRework: number;
  quantityLines?: PackLine[];
}) {
  if (!input.quantityLines?.length) {
    badRequest("Final Pack ต้องระบุจำนวนแพ็กแยกตามสินค้า สี และไซซ์");
  }
  if (input.qtyScrap !== 0 || input.qtyRework !== 0) {
    badRequest("Final Pack บันทึกได้เฉพาะจำนวนแพ็ก ของเสียต้องย้อนกลับไป QC");
  }
  if (
    input.quantityLines.some(
      (line) => line.qtyScrap !== 0 || line.qtyRework !== 0,
    )
  ) {
    badRequest("Final Pack บันทึกได้เฉพาะจำนวนแพ็ก ของเสียต้องย้อนกลับไป QC");
  }
}
