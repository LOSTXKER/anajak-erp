export function getStartOfMonth(date?: Date): Date {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function getStartOfLastMonth(date?: Date): Date {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

export function getMonthRange(offset = 0, referenceDate?: Date): { start: Date; end: Date } {
  const d = referenceDate ?? new Date();
  const start = new Date(d.getFullYear(), d.getMonth() - offset, 1);
  const end = new Date(d.getFullYear(), d.getMonth() - offset + 1, 1);
  return { start, end };
}
