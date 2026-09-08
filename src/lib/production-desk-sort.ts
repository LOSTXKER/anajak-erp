import type { BoardOrderLike } from "./production-board";
import type { DeskRow, DeskStepLike } from "./production-desk";

export type DeskSortKey = "deadline" | "order" | "quantity";
export type DeskSort = { key: DeskSortKey; direction: "asc" | "desc" };

export function resolveDeskSort(key: string | null, direction: string | null): DeskSort {
  return {
    key: key === "order" || key === "quantity" ? key : "deadline",
    direction: direction === "desc" ? "desc" : "asc",
  };
}

/** One continuous worklist. Missing deadlines stay last in either direction. */
export function sortDeskRows<S extends DeskStepLike, O extends BoardOrderLike<S>>(
  rows: readonly DeskRow<S, O>[],
  sort: DeskSort,
): DeskRow<S, O>[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const byNumber = a.job.order.orderNumber.localeCompare(b.job.order.orderNumber, "th", { numeric: true });
    if (sort.key === "order") return byNumber * direction;
    if (sort.key === "quantity") {
      return ((a.job.order.totalQuantity ?? 0) - (b.job.order.totalQuantity ?? 0)) * direction || byNumber;
    }
    if (a.dueInDays === null && b.dueInDays !== null) return 1;
    if (b.dueInDays === null && a.dueInDays !== null) return -1;
    return ((a.dueInDays ?? 0) - (b.dueInDays ?? 0)) * direction || byNumber;
  });
}
