/**
 * verify B11 — product soft-delete + list MaterialUsage · integration จริงกับ DB
 * รัน: npm run verify:softdel
 * เน้น: ลบสินค้า = ตั้ง deletedAt (ไม่ลบแถว) · ประวัติเบิก MaterialUsage ไม่หาย ·
 *   ซ่อนจากทุก query ฝั่ง UI (list/searchForOrder/getById) · listMaterials คืนประวัติ ·
 *   ลบซ้ำ idempotent · resurrect (ล้าง deletedAt) กลับมาเห็น
 * ข้อมูล marker [SOFTDEL-VERIFY] ลบเกลี้ยงท้ายสคริปต์ · ห้ามรันบน DB ใช้งานจริง
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";

const MARK = "[SOFTDEL-VERIFY]";
let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { pass++; console.log(`PASS: ${name}`); }
  else { fails.push(name); console.log(`FAIL: ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`); }
}
async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return false; } catch { return true; }
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });

  const ids = { product: "", variant: "", garment: "", order: "", production: "", customer: "" };

  try {
    // ── setup: สินค้า RAW_MATERIAL + variant + ออเดอร์ + ใบผลิต + ประวัติเบิก 2 แถว ──
    const product = await prisma.product.create({
      data: {
        sku: `SOFTDEL-${Date.now()}`,
        name: `${MARK} ผ้าคอตตอน`,
        productType: "FABRIC",
        basePrice: 50,
        costPrice: 30,
        source: "LOCAL",
        itemType: "RAW_MATERIAL",
        unit: "M",
        totalStock: 100,
      },
    });
    ids.product = product.id;
    const variant = await prisma.productVariant.create({
      data: { productId: product.id, size: "-", color: "ขาว", sku: `SOFTDEL-V-${Date.now()}`, stock: 100 },
    });
    ids.variant = variant.id;

    const customer = await prisma.customer.create({ data: { name: `${MARK} ลูกค้า` } });
    ids.customer = customer.id;
    const order = await prisma.order.create({
      data: {
        orderNumber: `TEST-SOFTDEL-${Date.now()}`,
        orderType: "CUSTOM", channel: "LINE",
        customerId: customer.id, createdById: owner.id,
        internalStatus: "PRODUCING", customerStatus: "IN_PRODUCTION",
        title: `${MARK} งาน`, totalAmount: 0,
      },
    });
    ids.order = order.id;
    const production = await prisma.production.create({
      data: { orderId: order.id, status: "IN_PROGRESS" },
    });
    ids.production = production.id;

    // สินค้าเสื้อ (FINISHED_GOOD) — จำลองแถว garment-pick (ISSUE/RETURN unit "ตัว")
    // ผูก productionId เดียวกัน · listMaterials (การ์ดวัตถุดิบ) ต้อง "ไม่" รวมแถวพวกนี้
    const garment = await prisma.product.create({
      data: {
        sku: `SOFTDEL-G-${Date.now()}`,
        name: `${MARK} เสื้อเปล่า`,
        productType: "T_SHIRT",
        basePrice: 120,
        source: "STOCK",
        itemType: "FINISHED_GOOD",
        unit: "PCS",
        totalStock: 50,
      },
    });
    ids.garment = garment.id;

    await prisma.materialUsage.createMany({
      data: [
        // วัตถุดิบจริง (RAW_MATERIAL) — 2 แถว
        { productionId: production.id, productId: product.id, productVariantId: variant.id, quantity: 12, unit: "M", unitCost: 30, totalCost: 360, movementType: "ISSUE", stockMovementRef: "MV-TEST-1", deductedAt: new Date() },
        { productionId: production.id, productId: product.id, quantity: 3, unit: "M", unitCost: 30, totalCost: 90, movementType: "ISSUE", stockMovementRef: "MV-TEST-2", deductedAt: new Date() },
        // เสื้อจาก garment-pick (FINISHED_GOOD unit ตัว) — ต้องไม่โผล่ในการ์ดวัตถุดิบ
        { productionId: production.id, productId: garment.id, quantity: 10, unit: "ตัว", movementType: "ISSUE", stockMovementRef: "MV-GARMENT-1", deductedAt: new Date() },
        { productionId: production.id, productId: garment.id, quantity: 2, unit: "ตัว", movementType: "RETURN", stockMovementRef: "MV-GARMENT-2", deductedAt: new Date() },
      ],
    });

    // ── 1. listMaterials คืนเฉพาะวัตถุดิบ (ไม่รวมเสื้อ garment-pick) ──
    const before = await caller.stockSync.listMaterials({ productionId: production.id });
    check("1.1 listMaterials คืนเฉพาะวัตถุดิบ 2 แถว — ไม่รวมเสื้อ garment-pick (review B11)",
      before.length === 2 && before.every((u) => u.name === `${MARK} ผ้าคอตตอน`), before.map((u) => u.name));
    check("1.2 ไม่มีแถว unit 'ตัว' (เสื้อ) หลุดเข้ามา",
      before.every((u) => u.unit === "M"), before.map((u) => u.unit));
    check("1.3 unitCost/totalCost เป็น number (result extension)",
      typeof before[0].unitCost === "number" && typeof before[0].totalCost === "number");

    // ── 2. soft-delete — ตั้ง deletedAt ไม่ลบแถว + เก็บประวัติ ──
    const res = await caller.product.delete({ id: product.id });
    check("2.1 delete คืน deleted:true", res.deleted === true, res);
    const pAfter = await prisma.product.findUnique({ where: { id: product.id } });
    check("2.2 แถวสินค้ายังอยู่ + deletedAt ถูกตั้ง + isActive=false",
      !!pAfter && pAfter.deletedAt !== null && pAfter.isActive === false,
      { exists: !!pAfter, deletedAt: pAfter?.deletedAt, isActive: pAfter?.isActive });
    const usageAfter = await prisma.materialUsage.count({ where: { productId: product.id } });
    check("2.3 ประวัติเบิก MaterialUsage ของสินค้าที่ลบไม่หาย (ยังครบ 2 แถว) — หัวใจของ B11", usageAfter === 2, usageAfter);
    const variantAfter = await prisma.productVariant.count({ where: { productId: product.id } });
    check("2.4 variant ไม่ถูกลบ (เก็บไว้กับแถวสินค้า)", variantAfter === 1, variantAfter);

    // ── 2b. order.create ปฏิเสธสินค้าที่ลบแล้ว (เดิม hard-delete ล้ม FK · soft-delete รับเงียบถ้าไม่กัน) ──
    check("2.5 เปิดออเดอร์ด้วยสินค้าที่ลบแล้ว → ปฏิเสธชัด (ไม่รับเงียบ)",
      await expectThrow(() =>
        caller.order.create({
          customerId: ids.customer,
          title: `${MARK} ออเดอร์ใช้สินค้าที่ลบ`,
          items: [{
            products: [{
              productId: product.id,
              productType: "FABRIC",
              description: `${MARK} ผ้าที่ลบ`,
              baseUnitPrice: 50,
              itemSource: "FROM_STOCK",
              variants: [{ size: "-", quantity: 1 }],
            }],
            prints: [],
            addons: [],
          }],
        })
      ));

    // ── 3. ซ่อนจากทุก query ฝั่ง UI ──
    const list = await caller.product.list({ search: "SOFTDEL", limit: 50 });
    check("3.1 product.list ไม่เห็นสินค้าที่ลบแล้ว", !list.products.some((p) => p.id === product.id));
    const search = await caller.product.searchForOrder({ search: "SOFTDEL", itemType: "RAW_MATERIAL" });
    check("3.2 searchForOrder (เปิดออเดอร์) ไม่เห็นสินค้าที่ลบแล้ว", !search.some((p) => p.id === product.id));
    check("3.3 getById สินค้าที่ลบแล้ว → throw (เปิดหน้าไม่ได้)",
      await expectThrow(() => caller.product.getById({ id: product.id })));

    // ── 4. listMaterials ยังคืนประวัติแม้สินค้าถูกลบ (FK product ยังชี้แถวได้) ──
    const afterDel = await caller.stockSync.listMaterials({ productionId: production.id });
    check("4.1 listMaterials หลังลบสินค้า ยังคืนประวัติวัตถุดิบครบ 2 + ชื่อสินค้า resolve ได้",
      afterDel.length === 2 && afterDel.every((u) => u.name === `${MARK} ผ้าคอตตอน`), afterDel.length);

    // ── 5. ลบซ้ำ idempotent ──
    const res2 = await caller.product.delete({ id: product.id });
    check("5.1 ลบซ้ำ → deleted:true ไม่ error (idempotent)", res2.deleted === true);

    // ── 6. resurrect (sync ล้าง deletedAt เมื่อสินค้ากลับมาใน Stock) ──
    await prisma.product.update({ where: { id: product.id }, data: { deletedAt: null, isActive: true } });
    const list2 = await caller.product.list({ search: "SOFTDEL", limit: 50 });
    check("6.1 ล้าง deletedAt แล้ว product.list กลับมาเห็น (filter คือด่านเดียว → resurrect ได้)",
      list2.products.some((p) => p.id === product.id));
  } finally {
    // cleanup — ลบตามลำดับ FK (materialUsage → variant → product · production/order cascade)
    if (ids.production) await prisma.materialUsage.deleteMany({ where: { productionId: ids.production } });
    if (ids.variant) await prisma.productVariant.deleteMany({ where: { productId: ids.product } });
    if (ids.product) await prisma.product.deleteMany({ where: { id: ids.product } });
    if (ids.garment) await prisma.product.deleteMany({ where: { id: ids.garment } });
    if (ids.production) await prisma.production.deleteMany({ where: { id: ids.production } });
    if (ids.order) await prisma.order.deleteMany({ where: { id: ids.order } });
    if (ids.customer) await prisma.customer.deleteMany({ where: { id: ids.customer } });
  }

  console.log(`\n=== ผล: ผ่าน ${pass} · ตก ${fails.length} ===`);
  if (fails.length) { console.log("ตก:", fails); process.exitCode = 1; }
  await prisma.$disconnect();
}

main().catch((e) => { console.error("VERIFY CRASHED:", e); process.exit(1); });
