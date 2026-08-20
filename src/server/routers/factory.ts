import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseFactoryScan } from "@/lib/factory-scan";
import {
  factoryStationKeyForOrderStatus,
  type FactoryStationKey,
} from "@/lib/factory-station";
import { hasPermission } from "@/lib/permissions";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { getFactoryBoard } from "@/server/services/factory-board";
import { lockOrderRow } from "@/server/services/order-cost";
import { assertOrderPackingReadyToShip } from "@/server/services/packing-readiness";
import { transitionOrder } from "@/server/services/order-status";
import { createAuditLog } from "@/server/helpers";

const productionTeam = requirePermission("manage_production");

const activeProductionSelect = {
  id: true,
  status: true,
  createdAt: true,
  steps: {
    select: {
      id: true,
      stepType: true,
      customStepName: true,
      status: true,
      sortOrder: true,
      qtyDone: true,
      qtyTotal: true,
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.ProductionSelect;

const stationOrderSelect = {
  id: true,
  orderNumber: true,
  title: true,
  internalStatus: true,
  deadline: true,
  priority: true,
  blindShip: true,
  blindShipSenderName: true,
  shippingRecipientName: true,
  shippingPhone: true,
  shippingAddress: true,
  shippingSubDistrict: true,
  shippingDistrict: true,
  shippingProvince: true,
  shippingPostalCode: true,
  customer: {
    select: {
      name: true,
      phone: true,
      address: true,
    },
  },
  // เช็กลิสต์ QC แบบไม่มีราคา: รุ่น/สี/ไซส์/จำนวนและตำแหน่งพิมพ์เท่านั้น
  items: {
    orderBy: { sortOrder: "asc" },
    select: {
      totalQuantity: true,
      products: {
        orderBy: { sortOrder: "asc" },
        select: {
          description: true,
          fabricColor: true,
          totalQuantity: true,
          variants: {
            orderBy: { size: "asc" },
            select: { size: true, color: true, quantity: true },
          },
        },
      },
      prints: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          printType: true,
          printSize: true,
          designNote: true,
        },
      },
    },
  },
  productions: {
    where: { status: { not: "COMPLETED" } },
    select: activeProductionSelect,
    orderBy: { createdAt: "asc" },
  },
  deliveries: {
    where: { status: { not: "RETURNED" } },
    select: { id: true },
  },
} satisfies Prisma.OrderSelect;

const scannedProductionSelect = {
  id: true,
  status: true,
  order: { select: { id: true, orderNumber: true, internalStatus: true } },
} satisfies Prisma.ProductionSelect;

// คิวจอสถานีต้องไม่มีเงินโดยโครงสร้าง ไม่ว่าผู้เปิดจะเป็น OWNER/MANAGER ก็ตาม
// (ห้าม reuse production.kanban เพราะ readiness ของผู้มีสิทธิ์เงินมีรายละเอียดรับชำระ)
const stationQueueOrderSelect = {
  id: true,
  orderNumber: true,
  title: true,
  internalStatus: true,
  deadline: true,
  priority: true,
  blindShip: true,
  customer: { select: { name: true } },
  items: { select: { totalQuantity: true } },
  productions: {
    select: {
      id: true,
      status: true,
      steps: {
        select: {
          id: true,
          stepType: true,
          customStepName: true,
          status: true,
          sortOrder: true,
          qtyDone: true,
          qtyTotal: true,
          notes: true,
          qcNotes: true,
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  },
} satisfies Prisma.OrderSelect;

type StationOrderRow = Prisma.OrderGetPayload<{ select: typeof stationOrderSelect }>;

function notFound(message: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

function toStationContext(row: StationOrderRow) {
  const garmentLines: Array<{
    product: string;
    size: string | null;
    color: string | null;
    quantity: number;
  }> = [];
  for (const item of row.items) {
    for (const product of item.products) {
      const productName = [product.description, product.fabricColor]
        .filter(Boolean)
        .join(" · ");
      if (product.variants.length === 0) {
        garmentLines.push({
          product: productName || "สินค้า",
          size: null,
          color: product.fabricColor,
          quantity: product.totalQuantity,
        });
        continue;
      }
      for (const variant of product.variants) {
        garmentLines.push({
          product: productName || "สินค้า",
          size: variant.size,
          color: variant.color ?? product.fabricColor,
          quantity: variant.quantity,
        });
      }
    }
  }
  const printChecks = row.items.flatMap((item) =>
    item.prints.map((print) => ({
      position: print.position,
      printType: print.printType,
      printSize: print.printSize,
      note: print.designNote,
    })),
  );
  return {
    order: {
      id: row.id,
      orderNumber: row.orderNumber,
      title: row.title,
      internalStatus: row.internalStatus,
      deadline: row.deadline,
      priority: row.priority,
      blindShip: row.blindShip,
      blindShipSenderName: row.blindShipSenderName,
      shippingName: row.shippingRecipientName,
      shippingPhone: row.shippingPhone,
      shippingAddress: row.shippingAddress,
      shippingSubDistrict: row.shippingSubDistrict,
      shippingDistrict: row.shippingDistrict,
      shippingProvince: row.shippingProvince,
      shippingPostalCode: row.shippingPostalCode,
    },
    customer: {
      name: row.customer.name,
      phone: row.customer.phone,
      address: row.customer.address,
      hasAddress: Boolean(row.customer.address?.trim()),
    },
    activeProductions: row.productions,
    nonReturnedDeliveryCount: row.deliveries.length,
    inspection: { garmentLines, printChecks },
  };
}

function resolveOrderRow(row: StationOrderRow, station: FactoryStationKey | null) {
  const postProductionStation = factoryStationKeyForOrderStatus(row.internalStatus);
  const base = {
    orderId: row.id,
    orderNumber: row.orderNumber,
    internalStatus: row.internalStatus,
    station,
  };

  // สแกน “เลขออเดอร์” ที่มาถึง QC/แพ็กต้องเปิด workspace ของออเดอร์ ไม่ย้อนกลับไป
  // ใบผลิตค้างจากข้อมูลเก่า มิฉะนั้นช่างแพ็กจะไม่เห็นรายการนับ/ปุ่มพร้อมส่ง
  if (
    postProductionStation ||
    ["READY_TO_SHIP", "SHIPPED", "COMPLETED"].includes(row.internalStatus)
  ) {
    return {
      kind: "order" as const,
      ...base,
      // สถานะจริงชนะ station ที่ฝังมากับ QR เก่า/ลิงก์ค้างเสมอ — QC และแพ็กต้อง
      // เปิดที่ด่านของตัวเอง ไม่พาคนไปกดในสถานีที่เลือกไว้ก่อนหน้า
      station: postProductionStation ?? station,
    };
  }

  if (row.productions.length === 0) {
    return { kind: "order" as const, ...base };
  }
  if (row.productions.length === 1) {
    return {
      kind: "production" as const,
      ...base,
      productionId: row.productions[0].id,
      productionStatus: row.productions[0].status,
    };
  }
  return {
    kind: "multiple" as const,
    ...base,
    productions: row.productions,
  };
}

function allowedFactoryOrigins(): string[] {
  return [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"];
}

// ทีวีคิวรวมโรงงาน /factory — read-only ภาพรวมทั้งไลน์ (UX4)
// auth: protectedProcedure ธรรมดา — บัญชี "จอโรงงาน" login ค้างไว้ (เบสเคาะ · ไม่แตะ schema)
// getFactoryBoard ไม่มีฟิลด์เงินโดยโครงสร้าง → ปลอดภัยแม้ role ไหนเรียก (ทีวีห้ามมีเงิน)
export const factoryRouter = router({
  board: protectedProcedure.query(({ ctx }) => getFactoryBoard(ctx.prisma)),

  stationQueue: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.order.findMany({
      where: {
        internalStatus: { in: ["PRODUCING", "QUALITY_CHECK", "PACKING"] },
      },
      select: stationQueueOrderSelect,
      orderBy: { deadline: "asc" },
      take: 200,
    });

    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      title: row.title,
      internalStatus: row.internalStatus,
      deadline: row.deadline,
      priority: row.priority,
      blindShip: row.blindShip,
      customerName: row.customer.name,
      totalQuantity: row.items.reduce((sum, item) => sum + item.totalQuantity, 0),
      productions: row.productions,
      // จอสถานีไม่เปิดงานใหม่ จึงไม่ต้องรับ readiness ฝั่งชำระเงินแม้แต่ข้อความ
      readiness: null,
    }));
  }),

  // mutation เฉพาะจอสถานี: ใช้ status/evidence จริง แต่คืน ack ไม่มีเงินเสมอ
  markReadyToShip: protectedProcedure
    .use(productionTeam)
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (
        !hasPermission(
          ctx.userRole,
          ctx.permissionOverrides,
          "update_order_status_production",
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "บัญชีนี้ไม่มีสิทธิ์ยืนยันงานพร้อมส่ง",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await lockOrderRow(tx, input.orderId);
        const live = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          select: { id: true, internalStatus: true, customerStatus: true },
        });
        if (live.internalStatus !== "PACKING" && live.internalStatus !== "READY_TO_SHIP") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ยืนยันพร้อมส่งได้เฉพาะงานที่อยู่ขั้นแพ็กสุดท้าย",
          });
        }

        // retry หลัง request แรกสำเร็จต้องเป็น idempotent แต่ยังตรวจหลักฐานสดเสมอ
        await assertOrderPackingReadyToShip(tx, input.orderId);
        if (live.internalStatus === "READY_TO_SHIP") return live;

        const result = await transitionOrder(tx, {
          orderId: input.orderId,
          to: "READY_TO_SHIP",
          changedBy: ctx.userId,
          reason: "จอประจำสถานียืนยันแพ็กครบ",
        });
        const order = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          select: { id: true, internalStatus: true, customerStatus: true },
        });
        if (result.changed) {
          await createAuditLog(tx, {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "ORDER",
            entityId: input.orderId,
            oldValue: { internalStatus: result.from },
            newValue: { internalStatus: order.internalStatus },
            reason: "จอประจำสถานียืนยันแพ็กครบ",
          });
        }
        return order;
      });
    }),

  resolveStationScan: protectedProcedure
    .input(z.object({ value: z.string().max(2_048) }))
    .query(async ({ ctx, input }) => {
      const parsed = parseFactoryScan(input.value, {
        allowedOrigins: allowedFactoryOrigins(),
      });
      if (!parsed.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            parsed.reason === "external-url"
              ? "QR นี้ไม่ได้มาจากระบบ ERP"
              : "ไม่พบเลขออเดอร์หรือ QR ที่ระบบรองรับ",
        });
      }

      const target = parsed.target;
      if (target.kind === "production") {
        const production = await ctx.prisma.production.findUnique({
          where: { id: target.productionId },
          select: scannedProductionSelect,
        });
        if (!production) notFound("ไม่พบใบผลิตนี้");
        return {
          kind: "production" as const,
          productionId: production.id,
          productionStatus: production.status,
          orderId: production.order.id,
          orderNumber: production.order.orderNumber,
          internalStatus: production.order.internalStatus,
          station: target.station,
        };
      }

      const order = await ctx.prisma.order.findUnique({
        where:
          target.kind === "order-number"
            ? { orderNumber: target.orderNumber }
            : { id: target.orderId },
        select: stationOrderSelect,
      });
      if (!order) notFound("ไม่พบออเดอร์นี้");
      return resolveOrderRow(order, target.station);
    }),

  stationContext: protectedProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: stationOrderSelect,
      });
      if (!order) notFound("ไม่พบออเดอร์นี้");
      return toStationContext(order);
    }),
});
