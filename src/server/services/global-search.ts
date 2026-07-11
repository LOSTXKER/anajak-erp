import type { ExtendedPrismaClient } from "@/lib/prisma";

export type GlobalSearchResult = {
  id: string;
  type: "order" | "customer" | "quotation" | "invoice";
  title: string;
  subtitle: string | null;
  href: string;
};

export type GlobalSearchAccess = {
  canSeeQuotations: boolean;
  canSeeInvoices: boolean;
};

export async function globalSearch(
  prisma: ExtendedPrismaClient,
  input: { query: string; limit: number; access: GlobalSearchAccess }
): Promise<{
  orders: GlobalSearchResult[];
  customers: GlobalSearchResult[];
  quotations: GlobalSearchResult[];
  invoices: GlobalSearchResult[];
}> {
  const query = input.query.trim();
  const textFilter = { contains: query, mode: "insensitive" as const };

  const [orders, customers, quotations, invoices] = await Promise.all([
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: textFilter },
          { title: textFilter },
          { customer: { name: textFilter } },
          { customer: { company: textFilter } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        orderNumber: true,
        title: true,
        customer: { select: { name: true, company: true } },
      },
    }),
    prisma.customer.findMany({
      where: {
        OR: [
          { name: textFilter },
          { company: textFilter },
          { email: textFilter },
          { phone: textFilter },
          { lineId: textFilter },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: input.limit,
      select: { id: true, name: true, company: true, phone: true, email: true },
    }),
    input.access.canSeeQuotations
      ? prisma.quotation.findMany({
          where: {
            OR: [
              { quotationNumber: textFilter },
              { title: textFilter },
              { customer: { name: textFilter } },
              { customer: { company: textFilter } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
          select: {
            id: true,
            quotationNumber: true,
            title: true,
            customer: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    input.access.canSeeInvoices
      ? prisma.invoice.findMany({
          where: {
            OR: [
              { invoiceNumber: textFilter },
              { order: { orderNumber: textFilter } },
              { order: { title: textFilter } },
              { customer: { name: textFilter } },
              { customer: { company: textFilter } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
          select: {
            id: true,
            invoiceNumber: true,
            orderId: true,
            order: { select: { orderNumber: true } },
            customer: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    orders: orders.map((order) => ({
      id: order.id,
      type: "order" as const,
      title: order.orderNumber,
      subtitle: [order.title, order.customer.name].filter(Boolean).join(" · ") || null,
      href: `/orders/${order.id}`,
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      type: "customer" as const,
      title: customer.company || customer.name,
      subtitle:
        [customer.company ? customer.name : null, customer.phone, customer.email]
          .filter(Boolean)
          .join(" · ") || null,
      href: `/customers/${customer.id}`,
    })),
    quotations: quotations.map((quotation) => ({
      id: quotation.id,
      type: "quotation" as const,
      title: quotation.quotationNumber,
      subtitle: [quotation.title, quotation.customer.name].filter(Boolean).join(" · ") || null,
      href: `/quotations/${quotation.id}`,
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      type: "invoice" as const,
      title: invoice.invoiceNumber,
      subtitle: [invoice.order.orderNumber, invoice.customer.name].filter(Boolean).join(" · ") || null,
      href: `/orders/${invoice.orderId}?tab=money`,
    })),
  };
}
