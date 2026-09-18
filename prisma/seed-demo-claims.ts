// ใบเคลม/งานแก้หลังลูกค้ารับของ — ชุดตัวอย่างสำหรับฐานทดลอง
//
// ทำไมต้อง seed: หน้าจอเปิดใบเคลมเองได้ก็จริง แต่สถานะ "ยกเลิกเรื่อง" ไม่มีปุ่มบนจอ
// และการปิดใบสายเงินต้องมีใบลดหนี้/ใบเพิ่มหนี้ผูกใบเคลม ซึ่งจอออกเอกสารยังไม่มีช่องให้เลือก
// ถ้าไม่ seed เบสจะไม่มีทางเห็นหน้าตาของเรื่องที่ "จบครบ" เลย
//
// ยอดในใบเคลมเป็นแค่ "ข้อตกลง" — ยอดทางบัญชีอยู่ที่ Invoice เสมอ (ตามหมายเหตุใน schema)
// ที่นี่จึงออกใบ CN/DN คู่กับใบเคลมให้ยอดตรงกัน ตามด่านปิดใบใน lib/claim.ts

import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1_000;

export interface DemoClaimSeedInput {
  period: string;
  ownerId: string;
  /** เวลาอ้างอิงชุดเดียวกับ seed หลัก เพื่อให้วันที่บนจอเรียงกันสมจริง */
  now: Date;
  /** รูปหลักฐานตัวอย่าง (ภายใน ไม่ออกไปฝั่งลูกค้า) */
  art: string;
}

export interface DemoClaimSeedResult {
  claims: number;
  creditNotes: number;
  debitNotes: number;
}

/** สำเนาผู้ซื้อบนเอกสาร — ใบลดหนี้/เพิ่มหนี้ต้องมีที่อยู่ผู้ซื้อเหมือนใบกำกับ */
async function buyerSnapshotOf(tx: Tx, customerId: string) {
  const customer = await tx.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: {
      name: true,
      company: true,
      taxId: true,
      phone: true,
      branchNumber: true,
      billingAddress: true,
      billingSubDistrict: true,
      billingDistrict: true,
      billingProvince: true,
      billingPostalCode: true,
    },
  });
  return {
    buyerName: customer.name,
    buyerCompany: customer.company,
    buyerTaxId: customer.taxId,
    buyerPhone: customer.phone,
    buyerBranchNumber: customer.branchNumber,
    buyerAddress: customer.billingAddress,
    buyerSubDistrict: customer.billingSubDistrict,
    buyerDistrict: customer.billingDistrict,
    buyerProvince: customer.billingProvince,
    buyerPostalCode: customer.billingPostalCode,
  };
}

/** แยกภาษีออกจากยอดรวม (ราคารวม VAT แล้ว) — เหมือนที่ seed หลักทำกับใบแจ้งหนี้ */
function splitVat(total: number) {
  const tax = Math.round(((total * 7) / 107) * 100) / 100;
  return { amount: Math.round((total - tax) * 100) / 100, tax, total };
}

export async function seedDemoClaims(
  tx: Tx,
  input: DemoClaimSeedInput,
): Promise<DemoClaimSeedResult> {
  const { period, ownerId, now, art } = input;
  const at = (days: number, hours = 0) =>
    new Date(now.getTime() + days * DAY_MS + hours * 60 * 60 * 1_000);
  const claimNumber = (n: number) =>
    `CLM-${period}-${String(n).padStart(4, "0")}`;

  const orderIds = [
    "demo-order-completed",
    "demo-order-shipped",
    "demo-order-packing",
    "demo-order-ready-to-ship",
  ];
  const orders = new Map(
    (
      await tx.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, customerId: true },
      })
    ).map((order) => [order.id, order.customerId]),
  );
  for (const id of orderIds) {
    if (!orders.has(id)) throw new Error(`Demo claim ต้องมีออเดอร์ ${id}`);
  }
  const customerOf = (orderId: string) => orders.get(orderId)!;

  // ประวัติออเดอร์ต้องเล่าได้ว่ามีรอบแก้เกิดขึ้น — ของจริงเขียนโดย addOrderRevision()
  const revisions: Prisma.OrderRevisionCreateManyInput[] = [];
  const revisionVersion = new Map<string, number>();
  const revision = (
    orderId: string,
    description: string,
    createdAt: Date,
  ) => {
    const version = (revisionVersion.get(orderId) ?? 0) + 1;
    revisionVersion.set(orderId, version);
    revisions.push({
      id: `demo-revision-claim-${orderId}-${version}`,
      orderId,
      version,
      changedBy: ownerId,
      changeType: "CLAIM",
      description,
      createdAt,
    });
  };

  // ── 1) จบครบแล้ว: ลูกค้ารับของไป แลกกับลดราคา + ออกใบลดหนี้ตรงยอด ───────────
  const closedOrder = "demo-order-completed";
  const closedCustomer = customerOf(closedOrder);
  await tx.orderClaim.create({
    data: {
      id: "demo-claim-completed-r1",
      claimNumber: claimNumber(1),
      orderId: closedOrder,
      customerId: closedCustomer,
      state: "CLOSED",
      source: "CUSTOMER_REPORT",
      fault: "SHOP",
      round: 1,
      title: "ลายลอกที่ขอบ 5 ตัว ลูกค้าเจอตอนแจกของ",
      detail:
        "ลูกค้าส่งรูปมาทางไลน์ — ลายที่อกซ้ายล่อนตามขอบ เฉพาะกล่องที่รีดรอบบ่าย",
      faultNote: "อุณหภูมิรีดรอบบ่ายต่ำกว่าสเปก ตรวจกับช่างแล้ว",
      reportedAt: at(-2),
      photoUrls: [art],
      resolution: "DISCOUNT",
      resolutionNote: "ลูกค้าไม่อยากรอแก้ ขอลดราคาแทน ตกลงกันที่ 1,500 บาท",
      agreedCredit: 1_500,
      customerMessage: "รับเรื่องแล้วค่ะ ทางร้านสรุปกับลูกค้าเรียบร้อย",
      openedById: ownerId,
      decidedById: ownerId,
      decidedAt: at(-1, -6),
      closedById: ownerId,
      closedAt: at(-1),
      closeNote: "ออกใบลดหนี้และแจ้งลูกค้าแล้ว",
      createdAt: at(-2),
      updatedAt: at(-1),
      lines: {
        create: [
          { size: "S", color: "ขาว", qtyClaimed: 2, qtyAccepted: 2 },
          { size: "M", color: "ขาว", qtyClaimed: 3, qtyAccepted: 3 },
        ],
      },
    },
  });
  revision(closedOrder, `เปิดใบเคลม ${claimNumber(1)} (รอบที่ 1): ลายลอกที่ขอบ 5 ตัว`, at(-2));
  revision(closedOrder, `ปิดใบเคลม ${claimNumber(1)} — ลดราคา 1,500 บาท`, at(-1));

  const creditMoney = splitVat(1_500);
  await tx.invoice.create({
    data: {
      id: "demo-invoice-claim-credit",
      invoiceNumber: `CN-${period}-0001`,
      orderId: closedOrder,
      customerId: closedCustomer,
      claimId: "demo-claim-completed-r1",
      type: "CREDIT_NOTE",
      amount: creditMoney.amount,
      tax: creditMoney.tax,
      totalAmount: creditMoney.total,
      paymentStatus: "UNPAID",
      dueDate: null, // ใบลดหนี้ไม่มีสถานะค้างชำระ (กัน sweep ตั้ง OVERDUE ปลอม)
      issueDate: at(-1),
      originalInvoiceId: "demo-invoice-completed",
      adjustmentReason: "ลดราคาตามใบเคลม CLM — ลายลอก 5 ตัว",
      notes: "เอกสาร demo local",
      ...(await buyerSnapshotOf(tx, closedCustomer)),
      createdAt: at(-1),
      updatedAt: at(-1),
    },
  });

  // ── 2) เพิ่งแจ้งเข้ามา รอเบสตัดสิน ───────────────────────────────────────────
  await tx.orderClaim.create({
    data: {
      id: "demo-claim-completed-r2",
      claimNumber: claimNumber(2),
      orderId: closedOrder,
      customerId: closedCustomer,
      state: "OPEN",
      source: "CUSTOMER_REPORT",
      fault: "UNDETERMINED",
      round: 2,
      title: "ไซซ์ M เล็กกว่าตัวอย่าง 8 ตัว",
      detail: "ลูกค้าวัดตัวอย่างเทียบแล้วสั้นกว่าประมาณ 2 ซม. ขอให้ตรวจล็อตผ้า",
      reportedAt: at(0, -5),
      photoUrls: [art],
      openedById: ownerId,
      createdAt: at(0, -4),
      updatedAt: at(0, -4),
      lines: {
        create: [{ size: "M", color: "ขาว", qtyClaimed: 8 }],
      },
    },
  });
  revision(closedOrder, `เปิดใบเคลม ${claimNumber(2)} (รอบที่ 2): ไซซ์ M เล็กกว่าตัวอย่าง 8 ตัว`, at(0, -4));

  // ── 3) ตัดสินว่าซ่อมแล้ว แต่ยังไม่ได้สั่งเข้าสายผลิต — ปุ่ม "สั่งงานแก้" ต้องกดเอง
  //      (ตั้งใจไม่ seed ขั้นงานแก้ไว้ เพราะการกดปุ่มคือของจริงที่ต้องลอง:
  //       ถอยสถานะทีละขั้นผ่าน transitionOrder แล้วเปิดขั้นงานแก้ในใบผลิต)
  const reworkOrder = "demo-order-shipped";
  await tx.orderClaim.create({
    data: {
      id: "demo-claim-shipped-r1",
      claimNumber: claimNumber(3),
      orderId: reworkOrder,
      customerId: customerOf(reworkOrder),
      state: "DECIDED",
      source: "DELIVERY_RETURN",
      fault: "SHOP",
      round: 1,
      title: "ป้ายคอผิดแบบทั้งกล่อง ตีกลับมาแก้",
      detail: "ลูกค้าเปิดกล่องแล้วเจอป้ายคอรุ่นเก่า ขอให้เปลี่ยนป้ายแล้วส่งกลับ",
      faultNote: "หยิบป้ายผิดล็อตตอนแพ็ก",
      reportedAt: at(-2),
      photoUrls: [art],
      resolution: "REWORK",
      resolutionNote: "เปลี่ยนป้ายคอทั้ง 64 ตัว แล้วส่งกลับให้ลูกค้าใหม่",
      customerMessage: "รับเรื่องแล้วค่ะ กำลังเปลี่ยนป้ายให้ใหม่ทั้งชุด",
      openedById: ownerId,
      decidedById: ownerId,
      decidedAt: at(-1),
      sourceDeliveryId: "demo-delivery-shipped",
      createdAt: at(-2),
      updatedAt: at(-1),
      lines: {
        create: [
          { size: "S", color: "ดำ", qtyClaimed: 16, qtyAccepted: 16 },
          { size: "M", color: "ดำ", qtyClaimed: 25, qtyAccepted: 25 },
          { size: "L", color: "ดำ", qtyClaimed: 23, qtyAccepted: 23 },
        ],
      },
    },
  });
  revision(reworkOrder, `เปิดใบเคลม ${claimNumber(3)} (รอบที่ 1): ป้ายคอผิดแบบทั้งกล่อง ตีกลับมาแก้`, at(-2));

  // ── 4) เปิดผิดใบแล้วยกเลิกเรื่อง — สถานะนี้ไม่มีปุ่มบนจอ ถ้าไม่ seed จะไม่เคยเห็น ──
  const cancelledOrder = "demo-order-packing";
  await tx.orderClaim.create({
    data: {
      id: "demo-claim-packing-r1",
      claimNumber: claimNumber(4),
      orderId: cancelledOrder,
      customerId: customerOf(cancelledOrder),
      state: "CANCELLED",
      source: "INTERNAL_FOUND",
      fault: "NONE",
      round: 1,
      title: "กล่องที่ 2 ป้ายคอผิดแบบ",
      detail: "แจ้งผิดใบ — ของที่เจอเป็นของอีกออเดอร์หนึ่ง",
      reportedAt: at(-4),
      openedById: ownerId,
      closedById: ownerId,
      closedAt: at(-4, 3),
      closeNote: "เปิดผิดใบ ยกเลิกเรื่องและเปิดใหม่ให้ถูกออเดอร์แล้ว",
      createdAt: at(-4),
      updatedAt: at(-4, 3),
    },
  });
  revision(cancelledOrder, `เปิดใบเคลม ${claimNumber(4)} (รอบที่ 1): กล่องที่ 2 ป้ายคอผิดแบบ`, at(-4));
  revision(cancelledOrder, `ยกเลิกใบเคลม ${claimNumber(4)} — เปิดผิดใบ`, at(-4, 3));

  // ── 5) ลูกค้าขอเปลี่ยน เก็บเงินเพิ่ม + ออกใบเพิ่มหนี้ตรงยอดแล้ว → กด "ปิดใบ" ได้เลย ──
  const chargeOrder = "demo-order-ready-to-ship";
  const chargeCustomer = customerOf(chargeOrder);
  await tx.orderClaim.create({
    data: {
      id: "demo-claim-ready-r1",
      claimNumber: claimNumber(5),
      orderId: chargeOrder,
      customerId: chargeCustomer,
      state: "DECIDED",
      source: "CUSTOMER_REPORT",
      fault: "CUSTOMER",
      round: 1,
      title: "ลูกค้าขอเพิ่มปักชื่อ 20 ตัวหลังเห็นตัวอย่างจริง",
      detail: "ขอปักชื่อพนักงานที่อกขวาเพิ่ม 20 ตัว ตกลงคิดเพิ่มตัวละ 90 บาท",
      reportedAt: at(-3),
      resolution: "EXTRA_CHARGE",
      resolutionNote: "คิดเพิ่ม 1,800 บาท ออกใบเพิ่มหนี้แล้ว",
      agreedCharge: 1_800,
      customerMessage: "รับเรื่องแล้วค่ะ ทางร้านจะทำเพิ่มให้ตามที่คุยกันไว้",
      openedById: ownerId,
      decidedById: ownerId,
      decidedAt: at(-2),
      createdAt: at(-3),
      updatedAt: at(-2),
      lines: {
        create: [{ size: "M", color: "กรม", qtyClaimed: 20, qtyAccepted: 20 }],
      },
    },
  });
  revision(chargeOrder, `เปิดใบเคลม ${claimNumber(5)} (รอบที่ 1): ลูกค้าขอเพิ่มปักชื่อ 20 ตัว`, at(-3));

  const debitMoney = splitVat(1_800);
  await tx.invoice.create({
    data: {
      id: "demo-invoice-claim-debit",
      invoiceNumber: `DN-${period}-0001`,
      orderId: chargeOrder,
      customerId: chargeCustomer,
      claimId: "demo-claim-ready-r1",
      type: "DEBIT_NOTE",
      amount: debitMoney.amount,
      tax: debitMoney.tax,
      totalAmount: debitMoney.total,
      paymentStatus: "UNPAID",
      dueDate: at(7),
      issueDate: at(-2),
      originalInvoiceId: "demo-invoice-ready-to-ship",
      adjustmentReason: "เก็บเพิ่มตามใบเคลม CLM — ปักชื่อเพิ่ม 20 ตัว",
      notes: "เอกสาร demo local",
      ...(await buyerSnapshotOf(tx, chargeCustomer)),
      createdAt: at(-2),
      updatedAt: at(-2),
    },
  });

  await tx.orderRevision.createMany({ data: revisions });

  return { claims: 5, creditNotes: 1, debitNotes: 1 };
}
