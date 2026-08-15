export function validateStepQtyInput(value: string, remaining: number) {
  const parsed = Number(value);
  if (value.trim() === "" || !Number.isFinite(parsed)) {
    return { added: 0, error: "กรอกจำนวนที่ทำเพิ่ม" } as const;
  }
  if (!Number.isInteger(parsed)) {
    return { added: 0, error: "จำนวนต้องเป็นจำนวนเต็ม" } as const;
  }
  if (parsed <= 0) {
    return { added: 0, error: "จำนวนต้องมากกว่า 0" } as const;
  }
  if (parsed > remaining) {
    return {
      added: 0,
      error: `ทำเพิ่มได้ไม่เกิน ${remaining} ตัว — แก้ตัวเลขก่อนบันทึก`,
    } as const;
  }
  return { added: parsed, error: null } as const;
}
