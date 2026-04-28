import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  INTERNAL_STATUS_LABELS,
} from "@/lib/order-status";
import type { CustomerStatus, InternalStatus } from "@prisma/client";

interface OrderStatusBadgeProps {
  customerStatus?: CustomerStatus;
  internalStatus?: InternalStatus;
  /** When true, renders compactly (e.g. inside table cells). */
  compact?: boolean;
}

/**
 * Minimal dual-status display:
 *   • dot + customer status (the "headline")
 *   • internal status as muted secondary text underneath
 *
 * No more nested colored pills.
 */
export function OrderStatusBadge({
  customerStatus,
  internalStatus,
  compact,
}: OrderStatusBadgeProps) {
  if (!customerStatus && !internalStatus) return null;

  const colors =
    customerStatus &&
    (CUSTOMER_STATUS_COLORS[customerStatus] ?? {
      bg: "",
      text: "text-slate-700 dark:text-slate-300",
      dot: "bg-slate-400",
    });

  return (
    <div className={compact ? "flex flex-col leading-tight" : "flex flex-col gap-0.5"}>
      {customerStatus && colors && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-slate-200">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`} />
          {CUSTOMER_STATUS_LABELS[customerStatus] ?? customerStatus}
        </span>
      )}
      {internalStatus && (
        <span
          className={`text-[11px] text-slate-500 dark:text-slate-400 ${
            customerStatus ? "pl-3" : ""
          }`}
        >
          {INTERNAL_STATUS_LABELS[internalStatus] ?? internalStatus}
        </span>
      )}
    </div>
  );
}
