import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { StockApiClient, getStockClientFromSettings } from "@/lib/stock-api";
import {
  syncProductPage,
  syncStockLevels,
  getSyncStatus,
} from "@/lib/stock-sync";

export const stockSyncRouter = router({
  // ── Test connection ───────────────────────────────────────
  testConnection: protectedProcedure
    .input(
      z
        .object({
          apiUrl: z.string().optional(),
          apiKey: z.string().optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      if (input?.apiUrl && input?.apiKey) {
        const client = new StockApiClient(input.apiUrl, input.apiKey);
        return client.testConnection();
      }
      const client = await getStockClientFromSettings();
      if (!client) {
        return {
          connected: false,
          error:
            "Stock API ยังไม่ได้ตั้งค่า — กรุณาใส่ API URL และ API Key ด้านบน",
        };
      }
      return client.testConnection();
    }),

  // ── Sync one page (client drives pagination) ──────────────
  syncPage: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        mode: z.enum(["full", "incremental"]).default("full"),
        updatedAfter: z.string().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const client = await getStockClientFromSettings();
      if (!client) {
        throw new Error(
          "Stock API ยังไม่ได้ตั้งค่า — ไปที่ ตั้งค่า > เชื่อมต่อ Stock"
        );
      }
      return syncProductPage(
        client,
        input.page,
        input.mode,
        input.updatedAfter
      );
    }),

  // ── Sync stock levels only ────────────────────────────────
  syncStock: protectedProcedure.mutation(async () => {
    const client = await getStockClientFromSettings();
    if (!client) {
      throw new Error(
        "Stock API ยังไม่ได้ตั้งค่า — ไปที่ ตั้งค่า > เชื่อมต่อ Stock"
      );
    }
    return syncStockLevels(client);
  }),

  // ── Sync status ───────────────────────────────────────────
  status: protectedProcedure.query(async () => {
    return getSyncStatus();
  }),

  // ── Issue materials to Stock ──────────────────────────────
  issueMaterials: protectedProcedure
    .input(
      z.object({
        productionId: z.string(),
        orderNumber: z.string(),
        materials: z.array(
          z.object({
            productId: z.string(),
            productVariantId: z.string().optional(),
            sku: z.string(),
            quantity: z.number().min(0.01),
            unit: z.string(),
            unitCost: z.number().default(0),
          })
        ),
        fromLocation: z.string().default("WH-MAIN"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getStockClientFromSettings();
      if (!client) {
        throw new Error(
          "Stock API ยังไม่ได้ตั้งค่า — ไปที่ ตั้งค่า > เชื่อมต่อ Stock"
        );
      }

      const movement = await client.createMovement({
        type: "ISSUE",
        refNo: input.orderNumber,
        note: `เบิกวัตถุดิบสำหรับออเดอร์ ${input.orderNumber}`,
        lines: input.materials.map((m) => ({
          sku: m.sku,
          fromLocation: input.fromLocation,
          qty: m.quantity,
          unitCost: m.unitCost,
          note: `Production: ${input.productionId}`,
        })),
      });

      for (const m of input.materials) {
        await ctx.prisma.materialUsage.create({
          data: {
            productionId: input.productionId,
            productId: m.productId,
            productVariantId: m.productVariantId,
            quantity: m.quantity,
            unit: m.unit,
            unitCost: m.unitCost,
            totalCost: m.quantity * m.unitCost,
            stockMovementRef: movement.data.docNumber,
            deductedAt: new Date(),
          },
        });
      }

      for (const m of input.materials) {
        if (m.productVariantId) {
          await ctx.prisma.productVariant.updateMany({
            where: { id: m.productVariantId },
            data: {
              stock: { decrement: Math.ceil(m.quantity) },
              totalStock: { decrement: Math.ceil(m.quantity) },
            },
          });
        }
        await ctx.prisma.product.updateMany({
          where: { id: m.productId },
          data: { totalStock: { decrement: Math.ceil(m.quantity) } },
        });
      }

      return {
        movementDocNumber: movement.data.docNumber,
        materialsIssued: input.materials.length,
      };
    }),

  // ── Receive finished goods ────────────────────────────────
  receiveFinished: protectedProcedure
    .input(
      z.object({
        orderNumber: z.string(),
        items: z.array(
          z.object({
            sku: z.string(),
            quantity: z.number().min(1),
            unitCost: z.number().default(0),
          })
        ),
        toLocation: z.string().default("WH-SHIP"),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const client = await getStockClientFromSettings();
      if (!client) {
        throw new Error(
          "Stock API ยังไม่ได้ตั้งค่า — ไปที่ ตั้งค่า > เชื่อมต่อ Stock"
        );
      }

      const movement = await client.createMovement({
        type: "RECEIVE",
        refNo: input.orderNumber,
        note:
          input.note ||
          `สินค้าสำเร็จรูปจากออเดอร์ ${input.orderNumber}`,
        lines: input.items.map((item) => ({
          sku: item.sku,
          toLocation: input.toLocation,
          qty: item.quantity,
          unitCost: item.unitCost,
        })),
      });

      return {
        movementDocNumber: movement.data.docNumber,
        itemsReceived: input.items.length,
      };
    }),
});
