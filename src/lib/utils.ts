import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

type DocNumberMode =
  | { mode: "random" }
  | { mode: "sequence"; countFn: (prefix: string) => Promise<number> };

function getYearMonthPrefix(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  return `${prefix}-${year}${month}-`;
}

export async function generateDocumentNumber(
  prefix: string,
  opts: DocNumberMode = { mode: "random" }
): Promise<string> {
  const full = getYearMonthPrefix(prefix);
  if (opts.mode === "sequence") {
    const count = await opts.countFn(full);
    return `${full}${(count + 1).toString().padStart(4, "0")}`;
  }
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${full}${random}`;
}

const INVOICE_PREFIXES: Record<string, string> = {
  QUOTATION: "QT",
  DEPOSIT_INVOICE: "INV-D",
  FINAL_INVOICE: "INV-F",
  RECEIPT: "REC",
  CREDIT_NOTE: "CN",
  DEBIT_NOTE: "DN",
};

export async function generateOrderNumber(
  prisma: { order: { count: (args: { where: { orderNumber: { startsWith: string } } }) => Promise<number> } }
): Promise<string> {
  return generateDocumentNumber("ORD", {
    mode: "sequence",
    countFn: (prefix) =>
      prisma.order.count({ where: { orderNumber: { startsWith: prefix } } }),
  });
}

export function generateInvoiceNumber(type: string): string {
  const prefix = INVOICE_PREFIXES[type] || "DOC";
  const full = getYearMonthPrefix(prefix);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${full}${random}`;
}

export function generateQuotationNumber(): string {
  const full = getYearMonthPrefix("QT");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${full}${random}`;
}
