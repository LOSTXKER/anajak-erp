interface OrderListFilterState {
  search?: string;
  channel?: string;
  orderType?: string;
  internalStatus?: string;
  attention?: string;
  createdAfter?: string;
  createdBefore?: string;
}

/** ตัวกรองทุกชนิดที่ทำให้ empty state หมายถึง “หาไม่เจอ” ไม่ใช่ “ยังไม่มีข้อมูล” */
export function hasActiveOrderListFilters(filters: OrderListFilterState) {
  return Object.values(filters).some(Boolean);
}
