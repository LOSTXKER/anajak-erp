/**
 * verify คลังลายต่อลูกค้า (ก้อน 4 ชิ้น 2) — integration จริงกับ DB
 * รัน: npm run verify:artwork · ข้อมูลใช้ marker [ART-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 *
 * ครอบ: promote ตอน QC ผ่าน (dedupe/ข้ามลายไม่มีรูป) · duplicate พา artworkId ·
 * นับใช้ต่อออเดอร์ · ผูกฟิล์มย้อนหลัง · เช็คฟิล์มตอนสั่งซ้ำ · router create/update/gate
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";

const MARK = "[ART-VERIFY]";
const IMG_A = "/api/files/designs/orders/art-verify/a.png";
const IMG_B = "/api/files/designs/orders/art-verify/b.png";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fails.push(name);
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

type PrintSeed = { position: string; designImageUrl?: string };

async function makeOrder(
  customerId: string,
  userId: string,
  suffix: string,
  prints: PrintSeed[] = [{ position: "FRONT", designImageUrl: IMG_A }]
) {
  return prisma.order.create({
    data: {
      orderNumber: `TEST-ART-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${MARK} งานทดสอบคลังลาย ${suffix}`,
      customerId,
      createdById: userId,
      internalStatus: "QUALITY_CHECK",
      items: {
        create: [
          {
            description: `${MARK} เสื้อ`,
            totalQuantity: 5,
            products: {
              create: [
                {
                  productType: "TSHIRT",
                  description: `${MARK} เสื้อยืด`,
                  baseUnitPrice: 0,
                  variants: { create: [{ size: "M", color: "ดำ", quantity: 5 }] },
                },
              ],
            },
            prints: {
              create: prints.map((p) => ({
                position: p.position,
                printType: "DTF",
                width: 21,
                height: 29.7,
                designImageUrl: p.designImageUrl,
                unitPrice: 0,
              })),
            },
          },
        ],
      },
    },
    include: { items: { include: { prints: true } } },
  });
}

async function qcPassAll(caller: ReturnType<typeof appRouter.createCaller>, orderId: string) {
  return caller.qc.create({ orderId, qtyGood: 5, defects: [], notes: `${MARK}` });
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const accountantCaller = appRouter.createCaller({
    prisma,
    userId: owner.id,
    userRole: "ACCOUNTANT",
  });

  const customer = await prisma.customer.create({
    data: { name: `${MARK} ลูกค้าทดสอบ`, customerType: "INDIVIDUAL" },
  });
  const orderIds: string[] = [];

  try {
    // ── 1. promote ตอน QC ผ่านครบ + ย้อนผูกฟิล์มที่เกิดก่อน QC ──
    const A = await makeOrder(customer.id, owner.id, "A");
    orderIds.push(A.id);
    // ฟิล์มเผื่อเกิดตอนปิดรอบพิมพ์ (ก่อน QC) — ตอนนั้นลายยังไม่เข้าคลัง artworkId=null
    const film = await prisma.filmStock.create({
      data: {
        customerId: customer.id,
        orderId: A.id,
        label: `${MARK} ฟิล์มลาย A`,
        qty: 12,
        initialQty: 12,
      },
    });
    const qcA = await qcPassAll(caller, A.id);
    check("1.1 QC ผ่านครบ → เด้งแพ็ค", qcA.movedToPacking === true);

    const artworksAfterA = await prisma.customerArtwork.findMany({
      where: { customerId: customer.id },
    });
    check(
      "1.2 ลายมีรูปเข้าคลัง 1 ลาย",
      artworksAfterA.length === 1,
      `ได้ ${artworksAfterA.length}`
    );
    const art = artworksAfterA[0];
    check(
      "1.3 สเปก+ชื่อ auto ติดมา (หน้า · DTF · 21×29.7 ซม.)",
      art?.name === "หน้า · DTF · 21×29.7 ซม." &&
        art?.widthCm === 21 &&
        art?.sourceOrderId === A.id,
      art?.name
    );
    const printsA = await prisma.orderItemPrint.findMany({
      where: { orderItem: { orderId: A.id } },
    });
    check("1.4 print ถูกผูก artworkId", printsA[0]?.artworkId === art?.id);
    const filmAfter = await prisma.filmStock.findUniqueOrThrow({ where: { id: film.id } });
    check(
      "1.5 ฟิล์มที่เกิดก่อน QC ถูกย้อนผูกลาย (ไม่กำกวม — ลายเดียว)",
      filmAfter.artworkId === art?.id
    );

    // ── 2. duplicate พา artworkId + เช็คฟิล์มตอนสั่งซ้ำ ──
    const dup = await caller.order.duplicate({ id: A.id });
    orderIds.push(dup.id);
    check("2.1 duplicate ตอบ filmStockCount", dup.filmStockCount === 1, `${dup.filmStockCount}`);
    const dupPrints = await prisma.orderItemPrint.findMany({
      where: { orderItem: { orderId: dup.id } },
    });
    check(
      "2.2 ลายในใบสำเนาพา artworkId มาด้วย",
      dupPrints.find((p) => p.designImageUrl)?.artworkId === art?.id
    );

    // ── 3. QC ใบสำเนา → ไม่สร้างลายซ้ำ + นับ 2 ออเดอร์ + ย้อนผูกฟิล์ม ──
    await prisma.order.update({ where: { id: dup.id }, data: { internalStatus: "QUALITY_CHECK" } });
    const qcDup = await qcPassAll(caller, dup.id);
    check("3.1 QC ใบสำเนาผ่าน", qcDup.movedToPacking === true);
    const artworksAfterDup = await prisma.customerArtwork.findMany({
      where: { customerId: customer.id },
    });
    check(
      "3.2 dedupe — ยังมีลายเดียว ไม่สร้างซ้ำ",
      artworksAfterDup.length === 1,
      `ได้ ${artworksAfterDup.length}`
    );

    // ── 4. listByCustomer — นับใช้/ฟิล์ม/ออเดอร์ล่าสุด ──
    const list = await caller.artwork.listByCustomer({ customerId: customer.id });
    check("4.1 list คืนลายพร้อมตัวนับ", list.length === 1);
    check("4.2 ใช้ไป 2 ออเดอร์ (A + สำเนา)", list[0]?.usedOrderCount === 2, `${list[0]?.usedOrderCount}`);
    check("4.3 ออเดอร์ล่าสุด = ใบสำเนา", list[0]?.latestOrder?.id === dup.id);
    check("4.4 ฟิล์มค้างต่อลาย = 12", list[0]?.filmQty === 12, `${list[0]?.filmQty}`);

    // ── 5. router create/update + gate ──
    const manual = await caller.artwork.create({
      customerId: customer.id,
      name: `${MARK} ลายเพิ่มมือ`,
      imageUrl: IMG_B,
    });
    check("5.1 เพิ่มลายมือได้", manual.name === `${MARK} ลายเพิ่มมือ`);

    let dupImageBlocked = false;
    try {
      await caller.artwork.create({
        customerId: customer.id,
        name: `${MARK} รูปซ้ำ`,
        imageUrl: IMG_A,
      });
    } catch {
      dupImageBlocked = true;
    }
    check("5.2 รูปซ้ำกับลายเดิมถูกปฏิเสธ (CONFLICT)", dupImageBlocked);

    const updated = await caller.artwork.update({
      id: manual.id,
      heatTempC: 160,
      heatPressSec: 15,
      heatPressure: "กลาง",
    });
    check("5.3 แก้สเปกรีดได้", updated.heatTempC === 160 && updated.heatPressSec === 15);

    let accountantBlocked = false;
    try {
      await accountantCaller.artwork.update({ id: manual.id, name: "x" });
    } catch {
      accountantBlocked = true;
    }
    check("5.4 ACCOUNTANT แก้ลายไม่ได้ (FORBIDDEN)", accountantBlocked);

    // ── 6. แก้รายการออเดอร์ (updateItems ลบ-สร้างใหม่) — artworkId ไม่หลุด ──
    // จำลอง echo จากฟอร์ม: map ค่าเดิมกลับเข้า updateItems (เหมือน order-items-editor)
    await prisma.order.update({ where: { id: dup.id }, data: { internalStatus: "CONFIRMED" } });
    const dupFull = await caller.order.getById({ id: dup.id });
    await caller.order.updateItems({
      id: dup.id,
      items: dupFull.items.map((it) => ({
        description: it.description ?? "",
        notes: it.notes ?? undefined,
        products: it.products.map((p) => ({
          productType: p.productType,
          description: p.description,
          baseUnitPrice: Number(p.baseUnitPrice),
          variants: p.variants.map((v) => ({
            size: v.size,
            color: v.color ?? undefined,
            quantity: v.quantity,
          })),
        })),
        prints: it.prints.map((pr) => ({
          position: pr.position,
          printType: pr.printType,
          designImageUrl: pr.designImageUrl ?? undefined,
          artworkId: pr.artworkId ?? undefined,
          unitPrice: Number(pr.unitPrice),
        })),
        addons: [],
      })),
    });
    const printsAfterEdit = await prisma.orderItemPrint.findMany({
      where: { orderItem: { orderId: dup.id } },
    });
    check(
      "6.1 แก้รายการแล้ว artworkId ยังอยู่ (ร้อยครบ pipeline)",
      printsAfterEdit.find((p) => p.designImageUrl)?.artworkId === art?.id
    );

    // 6.2 เปลี่ยนรูปบนแถว (echo artworkId เดิม + รูปใหม่) → sanitize ตัด artworkId
    await caller.order.updateItems({
      id: dup.id,
      items: dupFull.items.map((it) => ({
        description: it.description ?? "",
        products: it.products.map((p) => ({
          productType: p.productType,
          description: p.description,
          baseUnitPrice: Number(p.baseUnitPrice),
          variants: p.variants.map((v) => ({
            size: v.size,
            color: v.color ?? undefined,
            quantity: v.quantity,
          })),
        })),
        prints: it.prints.map((pr) => ({
          position: pr.position,
          printType: pr.printType,
          designImageUrl: "/api/files/designs/orders/art-verify/changed.png",
          artworkId: art?.id, // echo ลายเดิมทั้งที่รูปเปลี่ยน — ต้องโดนตัด
          unitPrice: Number(pr.unitPrice),
        })),
        addons: [],
      })),
    });
    const printsAfterImgChange = await prisma.orderItemPrint.findMany({
      where: { orderItem: { orderId: dup.id } },
    });
    check(
      "6.2 เปลี่ยนรูปแล้ว artworkId เดิมถูกตัด (identity=รูป)",
      printsAfterImgChange[0]?.artworkId === null
    );

    // 6.3 ลายข้ามลูกค้าถูกตัด (sanitize กันผูกข้ามลูกค้า)
    const otherCust = await prisma.customer.create({
      data: { name: `${MARK} ลูกค้าอื่น`, customerType: "INDIVIDUAL" },
    });
    const crossOrder = await makeOrder(otherCust.id, owner.id, "CROSS", [
      { position: "FRONT", designImageUrl: "/api/files/designs/orders/art-verify/cross.png" },
    ]);
    orderIds.push(crossOrder.id);
    await prisma.order.update({
      where: { id: crossOrder.id },
      data: { internalStatus: "CONFIRMED" },
    });
    const crossFull = await caller.order.getById({ id: crossOrder.id });
    await caller.order.updateItems({
      id: crossOrder.id,
      items: crossFull.items.map((it) => ({
        description: it.description ?? "",
        products: it.products.map((p) => ({
          productType: p.productType,
          description: p.description,
          baseUnitPrice: Number(p.baseUnitPrice),
          variants: p.variants.map((v) => ({
            size: v.size,
            color: v.color ?? undefined,
            quantity: v.quantity,
          })),
        })),
        prints: it.prints.map((pr) => ({
          position: pr.position,
          printType: pr.printType,
          designImageUrl: pr.designImageUrl ?? undefined,
          artworkId: art?.id, // ลายของลูกค้า customer แต่ออเดอร์ของ otherCust
          unitPrice: Number(pr.unitPrice),
        })),
        addons: [],
      })),
    });
    const crossPrints = await prisma.orderItemPrint.findMany({
      where: { orderItem: { orderId: crossOrder.id } },
    });
    check("6.3 ลายข้ามลูกค้าถูกตัด artworkId", crossPrints[0]?.artworkId === null);
    await prisma.order.delete({ where: { id: crossOrder.id } });
    orderIds.pop();
    await prisma.customer.delete({ where: { id: otherCust.id } });

    // ── 7. ออเดอร์หลายลาย (มีรูป+ไม่มีรูป) → ฟิล์มกำกวม artworkId null ──
    const B = await makeOrder(customer.id, owner.id, "B", [
      { position: "FRONT", designImageUrl: "/api/files/designs/orders/art-verify/b-front.png" },
      { position: "BACK" }, // ไม่มีรูป — ทำให้ทั้งออเดอร์กำกวม
    ]);
    orderIds.push(B.id);
    const filmB = await prisma.filmStock.create({
      data: {
        customerId: customer.id,
        orderId: B.id,
        label: `${MARK} ฟิล์มออเดอร์ B`,
        qty: 5,
        initialQty: 5,
      },
    });
    await qcPassAll(caller, B.id);
    const printsB = await prisma.orderItemPrint.findMany({
      where: { orderItem: { orderId: B.id } },
    });
    check(
      "7.1 ลายมีรูปเข้าคลัง · ลายไม่มีรูป artworkId null",
      printsB.find((p) => p.designImageUrl)?.artworkId != null &&
        printsB.find((p) => !p.designImageUrl)?.artworkId === null
    );
    const filmBAfter = await prisma.filmStock.findUniqueOrThrow({ where: { id: filmB.id } });
    check("7.2 ฟิล์มออเดอร์กำกวม (มีลายไม่ผูก) ไม่ถูกย้อนผูก = null", filmBAfter.artworkId === null);

    // ── 8. เข้าแพ็คด้วยมือ (updateStatus dropdown) → promote วิ่งเหมือนเส้น QC ──
    const C = await makeOrder(customer.id, owner.id, "C", [
      { position: "FRONT", designImageUrl: "/api/files/designs/orders/art-verify/c.png" },
    ]);
    orderIds.push(C.id);
    // ดันเข้า PACKING ด้วยมือผ่าน updateStatus (ไม่ผ่าน qc.create)
    await caller.order.updateStatus({ id: C.id, internalStatus: "PACKING" });
    const printsC = await prisma.orderItemPrint.findMany({
      where: { orderItem: { orderId: C.id } },
    });
    check("8.1 เข้าแพ็คมือ → ลายเข้าคลัง (promote idempotent)", printsC[0]?.artworkId != null);
  } finally {
    // ── cleanup — ลบเกลี้ยง รวม AuditLog (pattern เดียวกับ verify-ops/verify-e2e) ──
    const artIds = (
      await prisma.customerArtwork.findMany({
        where: { customerId: customer.id },
        select: { id: true },
      })
    ).map((a) => a.id);
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityType: "CUSTOMER_ARTWORK", entityId: { in: artIds } },
          { entityType: "ORDER", entityId: { in: orderIds } },
        ],
      },
    });
    await prisma.filmStock.deleteMany({ where: { customerId: customer.id } });
    await prisma.customerArtwork.deleteMany({ where: { customerId: customer.id } });
    for (const id of orderIds) {
      await prisma.qcRecord.deleteMany({ where: { orderId: id } });
      try {
        await prisma.order.delete({ where: { id } });
      } catch (e) {
        console.error(`cleanup: ลบ order ${id} ไม่สำเร็จ —`, e);
      }
    }
    await prisma.customer.delete({ where: { id: customer.id } });
  }

  console.log(`\n${pass} PASS / ${fails.length} FAIL`);
  if (fails.length > 0) {
    console.log("FAILED:", fails.join(" · "));
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
