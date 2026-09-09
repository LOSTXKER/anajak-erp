const WORK_ORDER_DRAFT_CHECK_EVENT = "anajak:work-order-draft-check";

/** คำสั่งที่เปลี่ยนขั้นต้องรอให้ตารางที่เปิดอยู่บันทึกหรือคืนค่ายอดร่างก่อน */
export function canChangeWorkOrder(target: EventTarget | undefined = typeof window === "undefined" ? undefined : window): boolean {
  return !target || target.dispatchEvent(new Event(WORK_ORDER_DRAFT_CHECK_EVENT, { cancelable: true }));
}

export function guardWorkOrderDraft(target: EventTarget, onBlocked: () => void): () => void {
  const block = (event: Event) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    onBlocked();
  };
  target.addEventListener(WORK_ORDER_DRAFT_CHECK_EVENT, block);
  return () => target.removeEventListener(WORK_ORDER_DRAFT_CHECK_EVENT, block);
}
