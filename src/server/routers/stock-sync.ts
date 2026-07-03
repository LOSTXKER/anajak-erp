import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { StockApiClient, getStockClientFromSettings } from "@/lib/stock-api";
import { DEFAULT_STOCK_LOCATION } from "@/lib/stock-constants";
import { badRequest } from "@/server/errors";
import {
  syncProductPage,
  syncStockLevels,
  getSyncStatus,
} from "@/lib/stock-sync";

const managerUp = requireRole("OWNER", "MANAGER");
const productionUp = requireRole("OWNER", "MANAGER", "PRODUCTION_STAFF");

export const stockSyncRouter = router({
  // ── Test connection ───────────────────────────────────────
  testConnection: protectedProcedure
    .use(managerUp)
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
    .use(managerUp)
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
        badRequest("Stock API ยังไม่ได้ตั้งค่า — ไปที่ ตั้งค่า > เชื่อมต่อ Stock");
      }
      return syncProductPage(
        client,
        input.page,
        input.mode,
        input.updatedAfter
      );
    }),

  // ── Sync stock levels only ────────────────────────────────
  syncStock: protectedProcedure
    .use(managerUp)
    .mutation(async () => {
    const client = await getStockClientFromSettings();
    if (!client) {
      badRequest("Stock API ยังไม่ได้ตั้งค่า — ไปที่ ตั้งค่า > เชื่อมต่อ Stock");
    }
    return syncStockLevels(client);
  }),

  // ── Sync status ───────────────────────────────────────────
  status: protectedProcedure.query(async () => {
    return getSyncStatus();
  }),

  // ── Issue materials to Stock ──────────────────────────────
  // B11: รายการวัตถุดิบที่เบิกของใบผลิต — เดิม UI จำเฉพาะ local state หลังกดเบิก reload หาย
  // ขอบเขต = เฉพาะ RAW_MATERIAL/CONSUMABLE (วัตถุดิบ) · **ไม่รวมการเบิก/คืนเสื้อจาก
  // garment-pick** ที่เขียน MaterialUsage ผูก productionId เดียวกัน (unit "ตัว" · โชว์ใน
  // GarmentPickCard แยกแล้ว) — ไม่กรองจะปนกัน + แถว RETURN โดนป้าย "เบิกแล้ว" (review B11 จับ)
  // orderBy [createdAt, id] — createMany ให้ createdAt เท่ากันทั้ง batch id เป็น tiebreak คงที่
  listMaterials: protectedProcedure
    .use(productionUp)
    .input(z.object({ productionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const usages = await ctx.prisma.materialUsage.findMany({
        where: {
          productionId: input.productionId,
          product: { itemType: { in: ["RAW_MATERIAL", "CONSUMABLE"] } },
        },
        include: { product: { select: { name: true, sku: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return usages.map((u) => ({
        id: u.id,
        productId: u.productId,
        productVariantId: u.productVariantId,
        name: u.product.name,
        sku: u.product.sku,
        quantity: u.quantity,
        unit: u.unit,
        unitCost: u.unitCost, // Decimal→number ผ่าน result extension
        totalCost: u.totalCost,
        movementType: u.movementType,
        stockMovementRef: u.stockMovementRef,
        deductedAt: u.deductedAt ? u.deductedAt.toISOString() : null,
      }));
    }),

  issueMaterials: protectedProcedure
    .use(productionUp)
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
        fromLocation: z.string().default(DEFAULT_STOCK_LOCATION),
        // กันยิงซ้ำ (กดเบิ้ล/เน็ตสะดุด) — Stock คืนใบเดิมเมื่อ key ซ้ำ ไม่ตัดสต๊อคซ้ำ
        idempotencyKey: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getStockClientFromSettings();
      if (!client) {
        badRequest("Stock API ยังไม่ได้ตั้งค่า — ไปที่ ตั้งค่า > เชื่อมต่อ Stock");
      }

      const movement = await client.createMovement({
        type: "ISSUE",
        refNo: input.orderNumber,
        idempotencyKey: input.idempotencyKey,
        note: `เบิกวัตถุดิบสำหรับออเดอร์ ${input.orderNumber}`,
        lines: input.materials.map((m) => ({
          sku: m.sku,
          fromLocation: input.fromLocation,
          qty: m.quantity,
          unitCost: m.unitCost,
          note: `Production: ${input.productionId}`,
        })),
      });

      // B11: บันทึกฝั่ง ERP ทั้งก้อนใน $transaction เดียว — เดิม 2 loop นอก tx
      // (materialUsage.create + ตัด stock mirror) ถ้าพังกลางคัน ประวัติเบิก/ยอด mirror ค้างครึ่ง
      // Stock (แหล่งจริง) ตัดผ่าน createMovement (นอก tx — HTTP rollback ไม่ได้) แล้ว ·
      // **idempotent ต่อเลขเอกสาร Stock**: replay (client retry ด้วย idempotencyKey เดิม —
      // Stock คืน docNumber เดิม ไม่ตัดซ้ำ) เจอแถวเดิม → ข้าม ไม่เบิ้ล materialUsage/ไม่ตัด mirror
      // ซ้ำ · ถ้ารอบแรก tx ล้ม (ยังไม่มีแถว) retry key เดิม → docNumber เดิม → เขียนสำเร็จได้ ·
      // ⚠️ ต้องคู่กับ client ส่ง idempotencyKey "คงที่ต่อ batch" (ไม่ใช่ UUID ใหม่ทุกคลิก)
      const deductedAt = new Date();
      await ctx.prisma.$transaction(async (tx) => {
        const already = await tx.materialUsage.findFirst({
          where: { stockMovementRef: movement.data.docNumber },
          select: { id: true },
        });
        if (already) return; // เอกสารนี้บันทึกฝั่ง ERP ไปแล้ว — replay เป็น no-op (happy path)

        // Stock บอกว่าใบนี้ออกไปแล้ว (idempotencyKey ซ้ำ · ไม่ตัดสต๊อคใหม่) แต่ ERP ไม่มีบันทึก
        // = สถานะกำกวม: รอบก่อน Stock ตัดสำเร็จแต่ ERP tx ล้ม · input.materials รอบนี้อาจถูก
        // ผู้ใช้แก้ (ลบ/เพิ่ม/แก้จำนวน) ไม่ตรงของที่ Stock ตัดจริง — เขียนตามจะได้ประวัติผิด
        // ปฏิเสธไว้ ให้คนไปกระทบยอดจริงที่ Stock (Stock API ไม่คืน lines กลับมาให้ replay
        // อัตโนมัติ — reconcile sweep เป็นงานแยก · review B11 จับ)
        if (movement.data.duplicated) {
          badRequest(
            `การเบิกนี้ถูกส่งไปตัดสต๊อคแล้ว (${movement.data.docNumber}) แต่ระบบบันทึกไม่สำเร็จรอบก่อน — รีเฟรชหน้าและตรวจสอบยอดที่ Stock ก่อนเบิกใหม่`
          );
        }

        await tx.materialUsage.createMany({
          data: input.materials.map((m) => ({
            productionId: input.productionId,
            productId: m.productId,
            productVariantId: m.productVariantId,
            quantity: m.quantity,
            unit: m.unit,
            unitCost: m.unitCost,
            totalCost: m.quantity * m.unitCost,
            stockMovementRef: movement.data.docNumber,
            deductedAt,
          })),
        });

        for (const m of input.materials) {
          if (m.productVariantId) {
            await tx.productVariant.updateMany({
              where: { id: m.productVariantId },
              data: {
                stock: { decrement: Math.ceil(m.quantity) },
                totalStock: { decrement: Math.ceil(m.quantity) },
              },
            });
          }
          await tx.product.updateMany({
            where: { id: m.productId },
            data: { totalStock: { decrement: Math.ceil(m.quantity) } },
          });
        }
      });

      return {
        movementDocNumber: movement.data.docNumber,
        materialsIssued: input.materials.length,
      };
    }),

  // ── Receive finished goods ────────────────────────────────
  receiveFinished: protectedProcedure
    .use(productionUp)
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
        badRequest("Stock API ยังไม่ได้ตั้งค่า — ไปที่ ตั้งค่า > เชื่อมต่อ Stock");
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
