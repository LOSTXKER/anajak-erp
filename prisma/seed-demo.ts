/**
 * ชุดข้อมูลสำหรับลอง ERP/Station บนฐาน local แยกเท่านั้น
 *
 * ปลอดภัยโดยตั้งใจ:
 * - ไม่ใช่ canonical `prisma/seed.ts` และไม่ถูกเรียกอัตโนมัติ
 * - ยอมทำงานเฉพาะ 127.0.0.1:5433/anajak_erp_demo + --reset + token ตรงกัน
 * - เก็บ auth mapping, settings และ master ที่ sync/จัดการไว้ แล้วล้างเฉพาะข้อมูลธุรกิจ
 * - ปฏิเสธฐานที่มี Stock credentials เพื่อกัน demo ไปตัดสต๊อคจริง
 */
import { Prisma, PrismaClient, type CustomerStatus, type InternalStatus } from "@prisma/client";
import {
  assertDemoSeedPlan,
  buildDemoResetTableNames,
  DEMO_SEED_SCENARIOS,
  type DemoSeedFeature,
  validateDemoDatabaseUrl,
  validateDemoSeedInvocation,
} from "../src/lib/demo-seed-plan";

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1_000;
const DEMO_ART =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="#f4f4f5"/><circle cx="320" cy="210" r="112" fill="#2563eb"/><path d="M252 218h136v32H252z" fill="white"/><text x="320" y="390" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#18181b">ANAJAK DEMO</text></svg>',
  );

const money = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const fromNow = (days: number, hours = 0) =>
  new Date(Date.now() + days * DAY_MS + hours * 60 * 60 * 1_000);
const variantAvailable = (variant: { stock: number; totalStock: number }) =>
  Math.max(variant.stock, variant.totalStock);

function bangkokPeriod() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("สร้างงวดเลขเอกสาร demo ไม่ได้");
  return `${year}${month}`;
}

function splitQuantity(quantity: number, color: string) {
  const small = Math.floor(quantity * 0.25);
  const medium = Math.floor(quantity * 0.4);
  return [
    { size: "S", color, quantity: small },
    { size: "M", color, quantity: medium },
    { size: "L", color, quantity: quantity - small - medium },
  ];
}

function orderPrice(quantity: number) {
  const productUnit = money(105);
  const printUnit = money(65);
  const subtotalItems = productUnit.plus(printUnit).mul(quantity);
  const subtotalFees = money(500);
  const taxable = subtotalItems.plus(subtotalFees);
  const taxAmount = taxable.mul(7).div(100).toDecimalPlaces(2);
  return {
    productUnit,
    printUnit,
    subtotalItems,
    subtotalFees,
    taxAmount,
    totalAmount: taxable.plus(taxAmount),
  };
}

function productionEndDays(status: InternalStatus) {
  switch (status) {
    case "QUALITY_CHECK":
      return -2;
    case "PACKING":
      return -4;
    case "READY_TO_SHIP":
      return -5;
    case "SHIPPED":
      return -7;
    case "COMPLETED":
      return -8;
    default:
      return null;
  }
}

const customerSeeds = [
  {
    id: "demo-customer-northstar",
    name: "คุณเมย์",
    company: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
    customerType: "CORPORATE" as const,
    segment: "WHOLESALE" as const,
    phone: "02-000-1101",
    email: "purchasing@northstar.example.invalid",
    taxId: "0105550001101",
    tags: ["B2B", "เครดิต 30 วัน"],
    defaultPaymentTerms: "NET_30",
    creditLimit: money(250_000),
  },
  {
    id: "demo-customer-runclub",
    name: "คุณนนท์",
    company: "Bangkok Run Club",
    customerType: "CORPORATE" as const,
    segment: "REGULAR" as const,
    phone: "080-000-2202",
    email: "team@runclub.example.invalid",
    taxId: "0105550002202",
    tags: ["อีเวนต์", "สั่งซ้ำ"],
    defaultPaymentTerms: "DEPOSIT_50",
    creditLimit: money(100_000),
  },
  {
    id: "demo-customer-campus",
    name: "คุณแพรว",
    company: "ชมรมศิษย์เก่าคณะสถาปัตย์",
    customerType: "CORPORATE" as const,
    segment: "REGULAR" as const,
    phone: "081-000-3303",
    email: "alumni@campus.example.invalid",
    taxId: "0105550003303",
    tags: ["มหาวิทยาลัย"],
    defaultPaymentTerms: "NET_30",
    creditLimit: money(150_000),
  },
  {
    id: "demo-customer-river-cafe",
    name: "คุณออม",
    company: "River Yard Cafe",
    customerType: "CORPORATE" as const,
    segment: "NEW" as const,
    phone: "082-000-4404",
    email: "hello@riveryard.example.invalid",
    taxId: "0105550004404",
    tags: ["ร้านอาหาร", "นำเสื้อมาเอง"],
    defaultPaymentTerms: "FULL_PREPAY",
    creditLimit: money(50_000),
  },
  {
    id: "demo-customer-sea-project",
    name: "คุณต้น",
    company: "โครงการรักษ์ทะเลไทย",
    customerType: "CORPORATE" as const,
    segment: "VIP" as const,
    phone: "083-000-5505",
    email: "project@seathai.example.invalid",
    taxId: "0105550005505",
    tags: ["องค์กร", "งานด่วน"],
    defaultPaymentTerms: "DEPOSIT_50",
    creditLimit: money(300_000),
  },
  {
    id: "demo-customer-studio",
    name: "คุณฟ้า",
    company: "Sunday Studio",
    customerType: "CORPORATE" as const,
    segment: "REGULAR" as const,
    phone: "084-000-6606",
    email: "studio@sunday.example.invalid",
    taxId: "0105550006606",
    tags: ["แบรนด์", "Blind ship"],
    defaultPaymentTerms: "NET_15",
    creditLimit: money(120_000),
  },
] satisfies Prisma.CustomerCreateManyInput[];

type SeededOrder = {
  id: string;
  number: string;
  itemId: string;
  productLineId: string;
  customerId: string;
  quantity: number;
  createdAt: Date;
  blockerReason: string | null;
  variants: Array<{ size: string; color: string; quantity: number }>;
  stepIds: Partial<Record<"garment" | "dtf" | "heat" | "outsource", string>>;
};

async function main() {
  validateDemoSeedInvocation(process.argv.slice(2), process.env.DEMO_SEED_RESET_TOKEN);
  validateDemoDatabaseUrl(process.env.DATABASE_URL);
  assertDemoSeedPlan(DEMO_SEED_SCENARIOS);

  const stockCredentialCount = await prisma.setting.count({
    where: { key: { in: ["stock_api_url", "stock_api_key"] } },
  });
  if (stockCredentialCount > 0) {
    throw new Error(
      "Demo seed ถูกปิดไว้: ฐานนี้มี Stock credentials — ลบออกก่อนเพื่อกันเขียนสต๊อคจริง",
    );
  }

  const owner = await prisma.user.findFirst({
    where: { role: "OWNER", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) {
    throw new Error("Demo seed ต้องมี active OWNER ที่ copy จาก Supabase เพื่อให้ login ได้");
  }

  const stockProducts = await prisma.product.findMany({
    where: { deletedAt: null, isActive: true, variants: { some: { isActive: true } } },
    include: { variants: { where: { isActive: true }, orderBy: { sku: "asc" } } },
    orderBy: { sku: "asc" },
  });
  const blockedQty =
    DEMO_SEED_SCENARIOS.find((scenario) => scenario.key === "blocked-stock")?.quantity ?? 0;
  const expectedPerVariant = Math.floor(blockedQty / 3);
  const stockProduct = stockProducts
    .map((product) => {
      const variantsByAvailability = [...product.variants].sort(
        (a, b) => variantAvailable(b) - variantAvailable(a) || a.sku.localeCompare(b.sku),
      );
      const enough = variantsByAvailability.find(
        (variant) => variantAvailable(variant) >= expectedPerVariant,
      );
      const short = [...variantsByAvailability]
        .reverse()
        .find((variant) => variantAvailable(variant) < expectedPerVariant);
      const third = variantsByAvailability.find(
        (variant) => variant.id !== enough?.id && variant.id !== short?.id,
      );
      if (!enough || !short || !third) return null;
      return { ...product, variants: [enough, third, short].sort((a, b) => a.sku.localeCompare(b.sku)) };
    })
    .find((product) => product !== null);
  if (!stockProduct || stockProduct.variants.length === 0) {
    throw new Error("Demo seed ต้องมี Product mirror ที่แสดงทั้งไซส์พอและไซส์ขาดได้");
  }

  const tableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT tablename AS table_name
    FROM pg_tables
    WHERE schemaname = current_schema()
    ORDER BY tablename
  `;
  const resetTables = buildDemoResetTableNames(tableRows.map((row) => row.table_name));
  for (const table of resetTables) {
    if (!/^[a-z0-9_]+$/.test(table)) throw new Error(`ชื่อตารางไม่ปลอดภัย: ${table}`);
  }

  const period = bangkokPeriod();
  const seeded = new Map<string, SeededOrder>();
  const dtfTimelines = {
    printing: {
      createdAt: fromNow(-1),
      printedAt: null,
      completedAt: null,
    },
    printed: {
      createdAt: fromNow(-1),
      printedAt: fromNow(0, -2),
      completedAt: null,
    },
    completed: {
      createdAt: fromNow(-5),
      printedAt: fromNow(-4),
      completedAt: fromNow(-3),
    },
    historical: {
      createdAt: fromNow(-11),
      printedAt: fromNow(-10.5),
      completedAt: fromNow(-10),
    },
  } as const;

  await prisma.$transaction(
    async (tx) => {
      if (resetTables.length > 0) {
        const quotedTables = resetTables.map((table) => `"${table}"`).join(", ");
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);
      }

      const demoStaff = [
        {
          id: "demo-user-supervisor",
          supabaseId: "demo-local-supervisor",
          email: "supervisor@demo.invalid",
          name: "พี่ก้อย · หัวหน้าผลิต",
          role: "MANAGER" as const,
        },
        {
          id: "demo-user-prep",
          supabaseId: "demo-local-prep",
          email: "prep@demo.invalid",
          name: "นัท · เตรียมเสื้อ",
          role: "PRODUCTION_STAFF" as const,
        },
        {
          id: "demo-user-dtf",
          supabaseId: "demo-local-dtf",
          email: "dtf@demo.invalid",
          name: "บาส · พิมพ์ DTF",
          role: "PRODUCTION_STAFF" as const,
        },
        {
          id: "demo-user-press",
          supabaseId: "demo-local-press",
          email: "press@demo.invalid",
          name: "มิ้น · รีดร้อนและ QC",
          role: "PRODUCTION_STAFF" as const,
        },
      ];
      for (const staff of demoStaff) {
        await tx.user.upsert({
          where: { id: staff.id },
          create: { ...staff, isActive: true },
          update: { name: staff.name, role: staff.role, isActive: true },
        });
      }

      await tx.customer.createMany({ data: customerSeeds });
      await tx.vendor.createMany({
        data: [
          {
            id: "demo-vendor-embroidery",
            name: "โรงปักศรีนครินทร์",
            contactName: "คุณเล็ก",
            phone: "085-000-7101",
            capabilities: ["EMBROIDERY", "TAGGING"],
            qualityRating: 4.6,
            timeRating: 4.1,
            priceRating: 4.3,
          },
          {
            id: "demo-vendor-screen",
            name: "เจริญสกรีน",
            contactName: "คุณเอก",
            phone: "085-000-7202",
            capabilities: ["SCREEN_PRINTING"],
            qualityRating: 4.4,
            timeRating: 3.8,
            priceRating: 4.5,
          },
          {
            id: "demo-vendor-sewing",
            name: "บ้านช่างเย็บ",
            contactName: "คุณนิด",
            phone: "085-000-7303",
            capabilities: ["SEWING"],
            qualityRating: 4.7,
            timeRating: 4.2,
            priceRating: 4.0,
          },
        ],
      });

      let quotationNumber = 0;
      let depositInvoiceNumber = 0;
      let finalInvoiceNumber = 0;
      let receiptNumber = 0;

      for (const [index, scenario] of DEMO_SEED_SCENARIOS.entries()) {
        const id = `demo-order-${scenario.key}`;
        const number = `ORD-${period}-${String(scenario.sequence).padStart(4, "0")}`;
        const customer = customerSeeds[scenario.customerIndex];
        const price = orderPrice(scenario.quantity);
        const features = new Set<DemoSeedFeature>(scenario.features);
        const orderCreatedAt = fromNow(-scenario.ageDays);
        const orderCompletedAt =
          scenario.internalStatus === "COMPLETED" ? fromNow(-1) : null;
        const isBlockedStock = features.has("BLOCKED_STOCK");
        const received =
          scenario.internalStatus === "PRODUCTION_QUEUE" ||
          (features.has("GARMENT_RECEIVE") && scenario.key !== "garment-receive");
        const color = ["ดำ", "ขาว", "กรม", "ครีม", "เขียวเข้ม", "เทา"][scenario.customerIndex];
        const blockedStockQtyPerVariant = Math.floor(
          scenario.quantity / stockProduct.variants.length,
        );
        const variants = isBlockedStock
          ? stockProduct.variants.map((variant, variantIndex) => ({
              size: variant.size,
              color: variant.color,
              quantity:
                variantIndex === stockProduct.variants.length - 1
                  ? scenario.quantity -
                    blockedStockQtyPerVariant * (stockProduct.variants.length - 1)
                  : blockedStockQtyPerVariant,
            }))
          : splitQuantity(scenario.quantity, color);
        const stockShortages = isBlockedStock
          ? variants
              .map((variant, variantIndex) => ({
                ...variant,
                shortage: Math.max(
                  variant.quantity - variantAvailable(stockProduct.variants[variantIndex]),
                  0,
                ),
              }))
              .filter((variant) => variant.shortage > 0)
          : [];
        const stockBlockerReason = isBlockedStock
          ? `สต๊อก snapshot ${stockShortages
              .map(
                (variant) =>
                  `${variant.size}${variant.color ? ` ${variant.color}` : ""} ขาด ${variant.shortage}`,
              )
              .join(", ")} ตัว — ฐาน demo ปิดการเชื่อม Stock จริง`
          : null;

        await tx.order.create({
          data: {
            id,
            orderNumber: number,
            orderType: "CUSTOM",
            channel: index % 4 === 0 ? "WEBSITE" : index % 3 === 0 ? "PHONE" : "LINE",
            customerId: customer.id,
            createdById: owner.id,
            customerStatus: scenario.customerStatus as CustomerStatus,
            internalStatus: scenario.internalStatus as InternalStatus,
            title: scenario.title,
            description: "งานตัวอย่างจากวันทำงานจริง เพื่อทดลอง ERP และ Station Mode",
            deadline: fromNow(scenario.deadlineInDays, 10),
            subtotalItems: price.subtotalItems,
            subtotalFees: price.subtotalFees,
            discount: money(0),
            taxRate: money(7),
            taxAmount: price.taxAmount,
            totalAmount: price.totalAmount,
            priority:
              scenario.deadlineInDays <= 1
                ? "URGENT"
                : scenario.deadlineInDays <= 3
                  ? "HIGH"
                  : "NORMAL",
            paymentTerms: customer.defaultPaymentTerms,
            poNumber: customer.customerType === "CORPORATE" ? `PO-${period}-${index + 101}` : null,
            shippingRecipientName: customer.company ?? customer.name,
            shippingPhone: customer.phone,
            shippingAddress: `${99 + index}/1 ถนนตัวอย่าง`,
            shippingSubDistrict: "บางนาเหนือ",
            shippingDistrict: "บางนา",
            shippingProvince: "กรุงเทพมหานคร",
            shippingPostalCode: "10260",
            blindShip: scenario.key === "packing",
            blindShipSenderName: scenario.key === "packing" ? customer.company : null,
            stockReservationError: stockBlockerReason,
            completedAt: orderCompletedAt,
            notes: "ข้อมูล demo local — ชื่อและข้อมูลติดต่อเป็นข้อมูลสมมติ",
            createdAt: orderCreatedAt,
            updatedAt: orderCompletedAt ?? fromNow(0, -1),
          },
        });

        const itemId = `demo-item-${scenario.key}`;
        const productLineId = `demo-item-product-${scenario.key}`;
        await tx.orderItem.create({
          data: {
            id: itemId,
            orderId: id,
            description: isBlockedStock ? stockProduct.name : `เสื้อยืด Cotton 100% สี${color}`,
            totalQuantity: scenario.quantity,
            subtotal: price.subtotalItems,
            taxLineType: "HIRE_OF_WORK",
          },
        });
        await tx.orderItemProduct.create({
          data: {
            id: productLineId,
            orderItemId: itemId,
            productId: isBlockedStock ? stockProduct.id : null,
            productType: isBlockedStock ? stockProduct.productType : "T_SHIRT",
            description: isBlockedStock ? stockProduct.name : `เสื้อยืด Cotton 100% สี${color}`,
            material: isBlockedStock ? null : "Cotton 100%",
            baseUnitPrice: price.productUnit,
            totalQuantity: scenario.quantity,
            subtotal: price.productUnit.mul(scenario.quantity),
            itemSource: isBlockedStock ? "FROM_STOCK" : "CUSTOMER_PROVIDED",
            garmentCondition: received ? "สภาพดี พร้อมผลิต" : null,
            receivedInspected: received,
            receiveNote: received ? "ตรวจจำนวนและสภาพครบตามใบรับ" : null,
          },
        });
        await tx.orderItemVariant.createMany({
          data: variants.map((variant) => ({
            id: `demo-variant-${scenario.key}-${variant.size}-${variant.color}`,
            orderItemProductId: productLineId,
            ...variant,
          })),
        });
        await tx.orderItemPrint.create({
          data: {
            id: `demo-print-${scenario.key}`,
            orderItemId: itemId,
            position: index % 2 === 0 ? "FRONT" : "BACK",
            printType: features.has("OUTSOURCE_OVERDUE")
              ? "EMBROIDERY"
              : "HEAT_TRANSFER",
            printSize: index % 3 === 0 ? "A3" : "A4",
            width: index % 3 === 0 ? 28 : 20,
            height: index % 3 === 0 ? 35 : 25,
            designNote: "วางกึ่งกลางตาม mockup ที่อนุมัติ",
            designImageUrl: DEMO_ART,
            unitPrice: price.printUnit,
          },
        });
        await tx.orderFee.create({
          data: {
            id: `demo-fee-${scenario.key}`,
            orderId: id,
            feeType: "DESIGN_FEE",
            name: "ค่าเตรียมไฟล์และวางแบบ",
            amount: price.subtotalFees,
          },
        });

        if (scenario.internalStatus !== "INQUIRY") {
          const approved = scenario.internalStatus !== "DESIGNING";
          await tx.designVersion.create({
            data: {
              id: `demo-design-${scenario.key}`,
              orderId: id,
              versionNumber: 1,
              fileUrl: DEMO_ART,
              thumbnailUrl: DEMO_ART,
              approvalStatus: approved ? "APPROVED" : "PENDING",
              designerNotes: approved ? "ลูกค้าอนุมัติขนาดและตำแหน่งแล้ว" : "รอลูกค้าตรวจตัวสะกด",
              approvedAt: approved ? fromNow(-Math.max(1, scenario.ageDays - 2)) : null,
              createdAt: fromNow(-Math.max(1, scenario.ageDays - 1)),
            },
          });
        }

        if (features.has("QUOTATION")) {
          quotationNumber += 1;
          const quotationSentAt = fromNow(-Math.max(1, scenario.ageDays - 1));
          const quotationAcceptedAt =
            scenario.internalStatus === "INQUIRY" ? null : fromNow(-2);
          await tx.quotation.create({
            data: {
              id: `demo-quotation-${scenario.key}`,
              quotationNumber: `QT-${period}-${String(quotationNumber).padStart(4, "0")}`,
              orderId: id,
              customerId: customer.id,
              createdById: owner.id,
              status: scenario.internalStatus === "INQUIRY" ? "SENT" : "ACCEPTED",
              title: scenario.title,
              validUntil: fromNow(10),
              terms: customer.defaultPaymentTerms,
              subtotal: price.subtotalItems.plus(price.subtotalFees),
              tax: price.taxAmount,
              totalAmount: price.totalAmount,
              sentAt: quotationSentAt,
              acceptedAt: quotationAcceptedAt,
              buyerName: customer.name,
              buyerCompany: customer.company,
              buyerTaxId: customer.taxId,
              buyerPhone: customer.phone,
              createdAt: orderCreatedAt,
              updatedAt: quotationAcceptedAt ?? quotationSentAt,
              items: {
                create: {
                  name: scenario.title,
                  quantity: scenario.quantity,
                  unitPrice: price.subtotalItems.div(scenario.quantity),
                  totalPrice: price.subtotalItems,
                },
              },
            },
          });
        }

        const stepIds: SeededOrder["stepIds"] = {};
        const productionStatuses: InternalStatus[] = [
          "PRODUCING",
          "QUALITY_CHECK",
          "PACKING",
          "READY_TO_SHIP",
          "SHIPPED",
          "COMPLETED",
        ];
        if (productionStatuses.includes(scenario.internalStatus as InternalStatus)) {
          const productionId = `demo-production-${scenario.key}`;
          const productionComplete = scenario.internalStatus !== "PRODUCING";
          const productionCreatedAt = fromNow(-Math.max(1, scenario.ageDays - 2));
          const productionEndOffset = productionEndDays(
            scenario.internalStatus as InternalStatus,
          );
          const productionEndedAt =
            productionEndOffset === null ? null : fromNow(productionEndOffset);
          await tx.production.create({
            data: {
              id: productionId,
              orderId: id,
              status: productionComplete ? "COMPLETED" : "IN_PROGRESS",
              startDate: productionCreatedAt,
              endDate: productionEndedAt,
              notes: "ใบผลิต demo local สำหรับทดลอง workflow",
              createdAt: productionCreatedAt,
              updatedAt: productionEndedAt ?? fromNow(0, -1),
            },
          });

          if (isBlockedStock) {
            stepIds.garment = `demo-step-${scenario.key}-garment`;
            await tx.productionStep.createMany({
              data: [
                {
                  id: stepIds.garment,
                  productionId,
                  stepType: "GARMENT_PICK",
                  status: "FAILED",
                  sortOrder: 10,
                  qtyDone: 0,
                  qtyTotal: scenario.quantity,
                  assignedToId: "demo-user-prep",
                  notes: `[แจ้งปัญหาจากสถานี] ${stockBlockerReason}`,
                  startedAt: fromNow(-1, -2),
                  createdAt: productionCreatedAt,
                  updatedAt: fromNow(-1, -2),
                },
                {
                  id: `demo-step-${scenario.key}-dtf`,
                  productionId,
                  stepType: "DTF_PRINT",
                  status: "PENDING",
                  sortOrder: 20,
                  qtyDone: 0,
                  qtyTotal: scenario.quantity,
                  createdAt: productionCreatedAt,
                  updatedAt: productionCreatedAt,
                },
                {
                  id: `demo-step-${scenario.key}-heat`,
                  productionId,
                  stepType: "HEAT_PRESS",
                  status: "PENDING",
                  sortOrder: 30,
                  qtyDone: 0,
                  qtyTotal: scenario.quantity,
                  createdAt: productionCreatedAt,
                  updatedAt: productionCreatedAt,
                },
              ],
            });
          } else if (features.has("OUTSOURCE_OVERDUE")) {
            stepIds.garment = `demo-step-${scenario.key}-garment`;
            stepIds.outsource = `demo-step-${scenario.key}-outsource`;
            await tx.productionStep.createMany({
              data: [
                {
                  id: stepIds.garment,
                  productionId,
                  stepType: "GARMENT_RECEIVE",
                  status: "COMPLETED",
                  sortOrder: 10,
                  qtyDone: scenario.quantity,
                  qtyTotal: scenario.quantity,
                  assignedToId: "demo-user-prep",
                  startedAt: fromNow(-8),
                  completedAt: fromNow(-7),
                  createdAt: productionCreatedAt,
                  updatedAt: fromNow(-7),
                },
                {
                  id: stepIds.outsource,
                  productionId,
                  stepType: "EMBROIDERY",
                  status: "IN_PROGRESS",
                  sortOrder: 20,
                  qtyDone: 0,
                  qtyTotal: scenario.quantity,
                  assignedToId: "demo-user-supervisor",
                  startedAt: fromNow(-5),
                  notes: "ร้านแจ้งเครื่องปักเสีย กำลังเร่งส่งกลับ",
                  createdAt: productionCreatedAt,
                  updatedAt: fromNow(-1),
                },
              ],
            });
          } else {
            const garmentPending = scenario.key === "garment-receive";
            const dtfPrinting = features.has("DTF_PRINTING");
            const dtfPrinted = features.has("DTF_PRINTED");
            const heatReady = features.has("HEAT_PRESS");
            const downstreamComplete = productionComplete;
            const garmentStartedAt = downstreamComplete ? fromNow(-12) : fromNow(-8);
            const garmentCompletedAt = downstreamComplete ? fromNow(-11) : fromNow(-7);
            const dtfTimeline = dtfPrinting
              ? dtfTimelines.printing
              : dtfPrinted
                ? dtfTimelines.printed
                : heatReady
                  ? dtfTimelines.completed
                  : downstreamComplete
                    ? dtfTimelines.historical
                    : null;
            const dtfStartedAt = dtfTimeline?.createdAt ?? null;
            const dtfCompletedAt = dtfTimeline?.completedAt ?? null;
            const heatStartedAt =
              downstreamComplete && productionEndOffset !== null
                ? fromNow(productionEndOffset - 1)
                : null;
            stepIds.garment = `demo-step-${scenario.key}-garment`;
            stepIds.dtf = `demo-step-${scenario.key}-dtf`;
            stepIds.heat = `demo-step-${scenario.key}-heat`;
            await tx.productionStep.createMany({
              data: [
                {
                  id: stepIds.garment,
                  productionId,
                  stepType: "GARMENT_RECEIVE",
                  status: garmentPending ? "PENDING" : "COMPLETED",
                  sortOrder: 10,
                  qtyDone: garmentPending ? 0 : scenario.quantity,
                  qtyTotal: scenario.quantity,
                  assignedToId: garmentPending ? null : "demo-user-prep",
                  startedAt: garmentPending ? null : garmentStartedAt,
                  completedAt: garmentPending ? null : garmentCompletedAt,
                  createdAt: productionCreatedAt,
                  updatedAt: garmentPending ? productionCreatedAt : garmentCompletedAt,
                },
                {
                  id: stepIds.dtf,
                  productionId,
                  stepType: "DTF_PRINT",
                  status: dtfPrinting || dtfPrinted ? "IN_PROGRESS" : downstreamComplete || heatReady ? "COMPLETED" : "PENDING",
                  sortOrder: 20,
                  qtyDone: downstreamComplete || heatReady ? scenario.quantity : 0,
                  qtyTotal: scenario.quantity,
                  assignedToId: dtfPrinting || dtfPrinted ? "demo-user-dtf" : downstreamComplete || heatReady ? "demo-user-dtf" : null,
                  startedAt:
                    dtfPrinting || dtfPrinted || downstreamComplete || heatReady
                      ? dtfStartedAt
                      : null,
                  completedAt: dtfCompletedAt,
                  createdAt: productionCreatedAt,
                  updatedAt: dtfCompletedAt ?? dtfStartedAt ?? productionCreatedAt,
                },
                {
                  id: stepIds.heat,
                  productionId,
                  stepType: "HEAT_PRESS",
                  status: downstreamComplete ? "COMPLETED" : "PENDING",
                  sortOrder: 30,
                  qtyDone: downstreamComplete ? scenario.quantity : 0,
                  qtyTotal: scenario.quantity,
                  assignedToId: downstreamComplete ? "demo-user-press" : null,
                  startedAt: heatStartedAt,
                  completedAt: downstreamComplete ? productionEndedAt : null,
                  createdAt: productionCreatedAt,
                  updatedAt: downstreamComplete
                    ? (productionEndedAt ?? productionCreatedAt)
                    : productionCreatedAt,
                },
              ],
            });
          }
        }

        if (received) {
          await tx.goodsReceipt.create({
            data: {
              id: `demo-receipt-${scenario.key}`,
              orderId: id,
              receiptType: "CUSTOMER_GARMENT",
              notes: "รับครบตามไซส์ ตรวจสภาพก่อนเข้าผลิตแล้ว",
              receivedById: "demo-user-prep",
              receivedAt: fromNow(-Math.max(2, scenario.ageDays - 2)),
              createdAt: fromNow(-Math.max(2, scenario.ageDays - 2)),
              lines: {
                create: variants.map((variant) => ({
                  orderItemProductId: productLineId,
                  description: isBlockedStock ? stockProduct.name : `เสื้อยืด Cotton 100% สี${color}`,
                  size: variant.size,
                  color: variant.color,
                  qtyExpected: variant.quantity,
                  qtyCounted: variant.quantity,
                })),
              },
            },
          });
        }

        if (features.has("QC")) {
          const isPartialCheck = scenario.key === "quality-check";
          const productionEndOffset = productionEndDays(
            scenario.internalStatus as InternalStatus,
          );
          const checkedAt = isPartialCheck
            ? fromNow(-1, -3)
            : productionEndOffset === null
              ? fromNow(-1)
              : fromNow(productionEndOffset, 6);
          await tx.qcRecord.create({
            data: {
              id: `demo-qc-${scenario.key}`,
              orderId: id,
              qtyGood: isPartialCheck ? 20 : scenario.quantity,
              qtyDefect: 0,
              notes: isPartialCheck
                ? "ตรวจรอบแรกผ่าน 20 ตัว เหลือ 30 ตัวรอตรวจต่อ"
                : "ผ่านครบ พร้อมเข้าขั้นถัดไป",
              checkedById: "demo-user-press",
              checkedAt,
              createdAt: checkedAt,
            },
          });
        }

        const deliveryFeature = scenario.features.find((feature) => feature.startsWith("DELIVERY_"));
        if (features.has("PACKING") || deliveryFeature) {
          const partial = features.has("PACKING");
          const deliveryStatus =
            deliveryFeature === "DELIVERY_COMPLETED"
              ? "DELIVERED"
              : deliveryFeature === "DELIVERY_SHIPPED"
                ? "SHIPPED"
                : "PREPARING";
          const deliveryCreatedAt =
            deliveryStatus === "DELIVERED"
              ? fromNow(-5)
              : deliveryStatus === "SHIPPED"
                ? fromNow(-4)
                : fromNow(-3);
          const shippedAt =
            deliveryStatus === "DELIVERED"
              ? fromNow(-3)
              : deliveryStatus === "SHIPPED"
                ? fromNow(-2)
                : null;
          const deliveredAt = deliveryStatus === "DELIVERED" ? fromNow(-2) : null;
          await tx.delivery.create({
            data: {
              id: `demo-delivery-${scenario.key}`,
              orderId: id,
              recipientName: customer.company ?? customer.name,
              phone: customer.phone ?? "02-000-0000",
              address: `${99 + index}/1 ถนนตัวอย่าง`,
              subDistrict: "บางนาเหนือ",
              district: "บางนา",
              province: "กรุงเทพมหานคร",
              postalCode: "10260",
              shippingMethod: scenario.key === "packing" ? "FLASH" : "KERRY",
              trackingNumber: deliveryStatus === "PREPARING" ? null : `THDEMO${period}${index + 1}`,
              shippingCost: money(120),
              isPaid: true,
              status: deliveryStatus,
              shippedAt,
              deliveredAt,
              notes: scenario.key === "packing" ? "Blind ship — ห้ามใส่เอกสารชื่อ Anajak" : null,
              createdAt: deliveryCreatedAt,
              updatedAt: deliveredAt ?? shippedAt ?? deliveryCreatedAt,
              lines: {
                create: variants.map((variant) => ({
                  description: scenario.title,
                  size: variant.size,
                  color: variant.color,
                  qty: partial ? Math.floor(variant.quantity / 2) : variant.quantity,
                })),
              },
            },
          });
        }

        if (features.has("FINANCE")) {
          const isShipped = scenario.internalStatus === "SHIPPED";
          const isCompleted = scenario.internalStatus === "COMPLETED";
          const invoiceTotal =
            isShipped || isCompleted
              ? price.totalAmount
              : price.totalAmount.div(2).toDecimalPlaces(2);
          const invoiceTax = invoiceTotal.mul(7).div(107).toDecimalPlaces(2);
          const invoiceAmount = invoiceTotal.minus(invoiceTax);
          const paymentDate = fromNow(-2);
          const invoiceType = isCompleted
            ? "RECEIPT"
            : isShipped
              ? "FINAL_INVOICE"
              : "DEPOSIT_INVOICE";
          const paymentStatus = isShipped
            ? "OVERDUE"
            : scenario.internalStatus === "DESIGNING"
              ? "UNPAID"
              : "PAID";
          const documentNumber = isCompleted
            ? `REC-${period}-${String(++receiptNumber).padStart(4, "0")}`
            : isShipped
              ? `INV-F-${period}-${String(++finalInvoiceNumber).padStart(4, "0")}`
              : `INV-D-${period}-${String(++depositInvoiceNumber).padStart(4, "0")}`;
          const invoiceId = `demo-invoice-${scenario.key}`;
          const invoiceIssueDate = isCompleted
            ? paymentDate
            : fromNow(-Math.max(1, scenario.ageDays - 1));
          await tx.invoice.create({
            data: {
              id: invoiceId,
              invoiceNumber: documentNumber,
              orderId: id,
              customerId: customer.id,
              type: invoiceType,
              amount: invoiceAmount,
              tax: invoiceTax,
              totalAmount: invoiceTotal,
              paymentStatus,
              dueDate: isCompleted ? null : isShipped ? fromNow(-5) : fromNow(7),
              paidAt: paymentStatus === "PAID" ? paymentDate : null,
              issueDate: invoiceIssueDate,
              buyerName: customer.name,
              buyerCompany: customer.company,
              buyerTaxId: customer.taxId,
              buyerPhone: customer.phone,
              notes: "เอกสาร demo local",
              createdAt: invoiceIssueDate,
              updatedAt: paymentStatus === "PAID" ? paymentDate : invoiceIssueDate,
            },
          });
          if (paymentStatus === "PAID") {
            const paymentId = `demo-payment-${scenario.key}`;
            await tx.payment.create({
              data: {
                id: paymentId,
                invoiceId,
                amount: invoiceTotal,
                method: index % 2 === 0 ? "QR" : "TRANSFER",
                reference: `DEMO-${period}-${index + 1}`,
                notes: "รับเงินในชุดข้อมูล demo",
                createdAt: paymentDate,
              },
            });
            if (!isCompleted) {
              await tx.invoice.create({
                data: {
                  id: `demo-receipt-${scenario.key}`,
                  invoiceNumber: `REC-${period}-${String(++receiptNumber).padStart(4, "0")}`,
                  orderId: id,
                  customerId: customer.id,
                  type: "RECEIPT",
                  amount: invoiceAmount,
                  tax: invoiceTax,
                  totalAmount: invoiceTotal,
                  paymentStatus: "PAID",
                  dueDate: null,
                  paidAt: paymentDate,
                  issueDate: paymentDate,
                  forPaymentId: paymentId,
                  buyerName: customer.name,
                  buyerCompany: customer.company,
                  buyerTaxId: customer.taxId,
                  buyerPhone: customer.phone,
                  notes: `ใบเสร็จของงวดรับเงิน ${documentNumber} · demo local`,
                  createdAt: paymentDate,
                  updatedAt: paymentDate,
                },
              });
            }
          }
        }

        seeded.set(scenario.key, {
          id,
          number,
          itemId,
          productLineId,
          customerId: customer.id,
          quantity: scenario.quantity,
          createdAt: orderCreatedAt,
          blockerReason: stockBlockerReason,
          variants,
          stepIds,
        });
      }

      const printing = seeded.get("dtf-printing");
      const printed = seeded.get("dtf-printed");
      const completedRunOrder = seeded.get("heat-press");
      const historicalRunOrders = [
        "quality-check",
        "packing",
        "ready-to-ship",
        "shipped",
        "completed",
      ].map((key) => seeded.get(key));
      if (!printing?.stepIds.dtf || !printed?.stepIds.dtf || !completedRunOrder?.stepIds.dtf) {
        throw new Error("Demo DTF scenario ไม่ครบ");
      }
      if (historicalRunOrders.some((order) => !order?.stepIds.dtf)) {
        throw new Error("Demo DTF history scenario ไม่ครบ");
      }
      await tx.printRun.create({
        data: {
          id: "demo-print-run-printing",
          runNumber: `FR-${period}-0001`,
          status: "PRINTING",
          note: "ม้วนเช้า — ฟิล์มด้าน 60 ซม.",
          createdById: "demo-user-dtf",
          createdAt: dtfTimelines.printing.createdAt,
          updatedAt: dtfTimelines.printing.createdAt,
          items: {
            create: {
              productionStepId: printing.stepIds.dtf,
              orderId: printing.id,
              qty: printing.quantity,
              createdAt: dtfTimelines.printing.createdAt,
            },
          },
        },
      });
      await tx.printRun.create({
        data: {
          id: "demo-print-run-printed",
          runNumber: `FR-${period}-0002`,
          status: "PRINTED",
          note: "พิมพ์เสร็จ รอตัดแยกและติดป้าย",
          createdById: "demo-user-dtf",
          printedAt: dtfTimelines.printed.printedAt,
          createdAt: dtfTimelines.printed.createdAt,
          updatedAt: dtfTimelines.printed.printedAt,
          items: {
            create: {
              productionStepId: printed.stepIds.dtf,
              orderId: printed.id,
              qty: printed.quantity,
              createdAt: dtfTimelines.printed.createdAt,
            },
          },
        },
      });
      const completedRun = await tx.printRun.create({
        data: {
          id: "demo-print-run-completed",
          runNumber: `FR-${period}-0003`,
          status: "COMPLETED",
          note: "ตัดแยกครบ มีฟิล์มเผื่อ 3 ชิ้น",
          createdById: "demo-user-dtf",
          printedAt: dtfTimelines.completed.printedAt,
          completedAt: dtfTimelines.completed.completedAt,
          createdAt: dtfTimelines.completed.createdAt,
          updatedAt: dtfTimelines.completed.completedAt,
          items: {
            create: {
              productionStepId: completedRunOrder.stepIds.dtf,
              orderId: completedRunOrder.id,
              qty: completedRunOrder.quantity,
              extraQty: 3,
              createdAt: dtfTimelines.completed.createdAt,
            },
          },
        },
      });
      await tx.filmStock.create({
        data: {
          id: "demo-film-stock-extra",
          customerId: completedRunOrder.customerId,
          orderId: completedRunOrder.id,
          printRunId: completedRun.id,
          label: "โลโก้ครบรอบ อกหน้า A4",
          qty: 3,
          initialQty: 3,
          note: "ฟิล์มเผื่อจากรอบ demo",
          createdAt: fromNow(-3),
          updatedAt: fromNow(-3),
        },
      });
      await tx.printRun.create({
        data: {
          id: "demo-print-run-historical",
          runNumber: `FR-${period}-0004`,
          status: "COMPLETED",
          note: "รอบประวัติรวมงานที่ส่งต่อเข้ารีดร้อนแล้ว",
          createdById: "demo-user-dtf",
          printedAt: dtfTimelines.historical.printedAt,
          completedAt: dtfTimelines.historical.completedAt,
          createdAt: dtfTimelines.historical.createdAt,
          updatedAt: dtfTimelines.historical.completedAt,
          items: {
            create: historicalRunOrders.map((order) => ({
              productionStepId: order!.stepIds.dtf!,
              orderId: order!.id,
              qty: order!.quantity,
              createdAt: dtfTimelines.historical.createdAt,
            })),
          },
        },
      });

      const outsource = seeded.get("outsource-overdue");
      if (!outsource?.stepIds.outsource) throw new Error("Demo outsource scenario ไม่ครบ");
      await tx.outsourceOrder.create({
        data: {
          id: "demo-outsource-overdue",
          productionStepId: outsource.stepIds.outsource,
          vendorId: "demo-vendor-embroidery",
          status: "IN_PROGRESS",
          description: "ปักโลโก้อกซ้าย 1 ตำแหน่ง",
          quantity: outsource.quantity,
          unitCost: money(32),
          totalCost: money(32).mul(outsource.quantity),
          sentAt: fromNow(-5),
          expectedBackAt: fromNow(-1),
          notes: "เกินกำหนด 1 วัน — โทรตามแล้วช่วงเช้า",
          createdAt: fromNow(-6),
          updatedAt: fromNow(-1),
        },
      });

      const shipped = seeded.get("shipped");
      if (!shipped) throw new Error("Demo shipped scenario ไม่ครบ");
      const overdueInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: "demo-invoice-shipped" },
      });
      await tx.billingNote.create({
        data: {
          id: "demo-billing-note-overdue",
          billingNoteNumber: `BN-${period}-0001`,
          customerId: shipped.customerId,
          billingDate: fromNow(-7),
          dueDate: fromNow(-5),
          totalAmount: overdueInvoice.totalAmount,
          notes: "รอบวางบิล demo — เกินกำหนดชำระ",
          createdAt: fromNow(-7),
          updatedAt: fromNow(-7),
          items: {
            create: { invoiceId: overdueInvoice.id, amount: overdueInvoice.totalAmount },
          },
        },
      });

      const settledPayments = await tx.payment.findMany({
        select: {
          amount: true,
          whtAmount: true,
          invoice: { select: { customerId: true } },
        },
      });
      for (const customer of customerSeeds) {
        const orders = [...seeded.values()].filter((order) => order.customerId === customer.id);
        const spent = settledPayments
          .filter((payment) => payment.invoice.customerId === customer.id)
          .reduce(
            (sum, payment) => sum.plus(payment.amount).plus(payment.whtAmount),
            money(0),
          );
        const lastOrderAt = orders.reduce<Date | null>(
          (latest, order) =>
            latest === null || order.createdAt > latest ? order.createdAt : latest,
          null,
        );
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalOrders: orders.length,
            totalSpent: spent,
            lastOrderAt,
          },
        });
      }

      await tx.documentSequence.createMany({
        data: [
          {
            docType: "ORDER",
            period,
            lastNumber: Math.max(...DEMO_SEED_SCENARIOS.map((scenario) => scenario.sequence)),
          },
          { docType: "QUOTATION", period, lastNumber: quotationNumber },
          { docType: "DEPOSIT_INVOICE", period, lastNumber: depositInvoiceNumber },
          { docType: "FINAL_INVOICE", period, lastNumber: finalInvoiceNumber },
          { docType: "RECEIPT", period, lastNumber: receiptNumber },
          { docType: "PRINT_RUN", period, lastNumber: 4 },
          { docType: "BILLING_NOTE", period, lastNumber: 1 },
        ],
      });
      const blockedStock = seeded.get("blocked-stock");
      if (!blockedStock?.blockerReason || !blockedStock.stepIds.garment) {
        throw new Error("Demo blocked Stock scenario ไม่ครบ");
      }
      await tx.notification.createMany({
        data: [
          {
            id: "demo-notification-stock",
            userId: owner.id,
            type: "SYSTEM",
            title: "งานผลิตติดปัญหาสต๊อค",
            message: `${blockedStock.number} ${blockedStock.blockerReason}`,
            link: `/production/${blockedStock.id}`,
            entityType: "ORDER",
            entityId: blockedStock.id,
          },
          {
            id: "demo-notification-outsource",
            userId: owner.id,
            type: "DEADLINE",
            title: "ร้านนอกเกินกำหนดรับกลับ",
            message: `${seeded.get("outsource-overdue")?.number} เกินกำหนด 1 วัน`,
            link: "/outsource",
            entityType: "OUTSOURCE_ORDER",
            entityId: "demo-outsource-overdue",
          },
        ],
      });
      await tx.auditLog.createMany({
        data: [
          {
            id: "demo-audit-seed",
            userId: owner.id,
            action: "DEMO_SEED_CREATED",
            entityType: "SYSTEM",
            reason: "สร้างชุดข้อมูล local สำหรับลอง ERP/Station",
          },
          {
            id: "demo-audit-problem",
            userId: "demo-user-prep",
            action: "REPORT_PROBLEM",
            entityType: "PRODUCTION_STEP",
            entityId: blockedStock.stepIds.garment,
            reason: blockedStock.blockerReason,
          },
        ],
      });

      const [
        orderCount,
        productionRows,
        stepRows,
        runItems,
        printRuns,
        qcRows,
        deliveries,
        invoices,
      ] = await Promise.all([
        tx.order.count(),
        tx.production.findMany({
          select: { id: true, createdAt: true, startDate: true, endDate: true },
        }),
        tx.productionStep.findMany({
          select: {
            id: true,
            stepType: true,
            status: true,
            qtyDone: true,
            qtyTotal: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
          },
        }),
        tx.printRunItem.findMany({
          include: {
            printRun: { select: { createdAt: true, completedAt: true } },
            productionStep: { include: { production: { select: { orderId: true } } } },
          },
        }),
        tx.printRun.findMany({
          select: { id: true, createdAt: true, printedAt: true, completedAt: true },
        }),
        tx.qcRecord.findMany({ include: { defects: true } }),
        tx.delivery.findMany({
          include: {
            order: {
              select: {
                internalStatus: true,
                completedAt: true,
                productions: { select: { endDate: true } },
              },
            },
          },
        }),
        tx.invoice.findMany({
          include: {
            forPayment: true,
            payments: { include: { receiptInvoice: true } },
          },
        }),
      ]);
      if (orderCount !== DEMO_SEED_SCENARIOS.length || productionRows.length < 8) {
        throw new Error("Demo seed จำนวนออเดอร์หรือใบผลิตไม่ครบ");
      }
      for (const production of productionRows) {
        if (production.startDate && production.startDate < production.createdAt) {
          throw new Error(`Demo production ${production.id} เริ่มก่อนสร้างใบผลิต`);
        }
        if (
          production.startDate &&
          production.endDate &&
          production.endDate < production.startDate
        ) {
          throw new Error(`Demo production ${production.id} จบก่อนเริ่ม`);
        }
      }
      for (const step of stepRows) {
        if (step.qtyDone < 0 || (step.qtyTotal !== null && step.qtyDone > step.qtyTotal)) {
          throw new Error(`Demo step ${step.id} มีจำนวนเกินขอบเขต`);
        }
        if (step.startedAt && step.startedAt < step.createdAt) {
          throw new Error(`Demo step ${step.id} เริ่มก่อนสร้างขั้น`);
        }
        if (step.startedAt && step.completedAt && step.completedAt < step.startedAt) {
          throw new Error(`Demo step ${step.id} จบก่อนเริ่ม`);
        }
        if (step.stepType === "DTF_PRINT" && step.status === "COMPLETED") {
          const printedQty = runItems
            .filter((item) => item.productionStepId === step.id)
            .reduce((sum, item) => sum + item.qty, 0);
          if (printedQty < step.qtyDone) {
            throw new Error(`Demo DTF step ${step.id} ไม่มีหลักฐาน Print Run ครบ`);
          }
        }
      }
      for (const item of runItems) {
        if (item.orderId !== item.productionStep.production.orderId) {
          throw new Error(`Demo print run item ${item.id} อ้างคนละออเดอร์กับ step`);
        }
        if (
          !item.productionStep.startedAt ||
          item.productionStep.startedAt.getTime() !== item.printRun.createdAt.getTime()
        ) {
          throw new Error(`Demo print run item ${item.id} เริ่ม step ไม่ตรงเวลาเปิดรอบ`);
        }
        if (
          item.printRun.completedAt &&
          (!item.productionStep.completedAt ||
            item.productionStep.completedAt < item.printRun.completedAt)
        ) {
          throw new Error(`Demo print run item ${item.id} ปิด step ก่อนรอบพิมพ์เสร็จ`);
        }
      }
      for (const run of printRuns) {
        if (run.printedAt && run.printedAt < run.createdAt) {
          throw new Error(`Demo Print Run ${run.id} พิมพ์ก่อนสร้างรอบ`);
        }
        if (run.printedAt && run.completedAt && run.completedAt < run.printedAt) {
          throw new Error(`Demo Print Run ${run.id} จบก่อนพิมพ์`);
        }
      }
      for (const qc of qcRows) {
        const defectSum = qc.defects.reduce((sum, defect) => sum + defect.qty, 0);
        if (defectSum !== qc.qtyDefect) throw new Error(`Demo QC ${qc.id} รวมของเสียไม่ตรง`);
      }
      for (const delivery of deliveries) {
        const latestQcAt = qcRows
          .filter((qc) => qc.orderId === delivery.orderId)
          .reduce<Date | null>(
            (latest, qc) => (!latest || qc.checkedAt > latest ? qc.checkedAt : latest),
            null,
          );
        if (
          !latestQcAt ||
          delivery.createdAt < latestQcAt ||
          (delivery.shippedAt && delivery.shippedAt < latestQcAt) ||
          (delivery.deliveredAt && delivery.deliveredAt < latestQcAt) ||
          (delivery.order.completedAt && delivery.order.completedAt < latestQcAt)
        ) {
          throw new Error(`Demo delivery ${delivery.id} เกิดก่อนผ่าน QC`);
        }
        if (delivery.shippedAt && delivery.shippedAt < delivery.createdAt) {
          throw new Error(`Demo delivery ${delivery.id} ส่งก่อนสร้างใบส่ง`);
        }
        if (
          delivery.shippedAt &&
          delivery.deliveredAt &&
          delivery.deliveredAt < delivery.shippedAt
        ) {
          throw new Error(`Demo delivery ${delivery.id} ถึงก่อนส่ง`);
        }
        if (delivery.order.internalStatus === "COMPLETED") {
          const latestProductionEnd = delivery.order.productions.reduce<Date | null>(
            (latest, production) =>
              production.endDate && (!latest || production.endDate > latest)
                ? production.endDate
                : latest,
            null,
          );
          if (
            !delivery.order.completedAt ||
            (delivery.deliveredAt && delivery.order.completedAt < delivery.deliveredAt) ||
            (latestProductionEnd && delivery.order.completedAt < latestProductionEnd)
          ) {
            throw new Error(`Demo order ของ delivery ${delivery.id} ปิดก่อนงานจริงเสร็จ`);
          }
        }
      }
      for (const invoice of invoices) {
        if (invoice.type === "RECEIPT" && invoice.dueDate !== null) {
          throw new Error(`Demo receipt ${invoice.id} ต้องไม่มีวันครบกำหนด`);
        }
        if (invoice.forPaymentId) {
          if (
            invoice.type !== "RECEIPT" ||
            !invoice.forPayment ||
            !invoice.issueDate ||
            invoice.issueDate.getTime() !== invoice.forPayment.createdAt.getTime()
          ) {
            throw new Error(`Demo receipt ${invoice.id} ผูกงวดรับเงินไม่ตรง tax point`);
          }
        }
        if (["DEPOSIT_INVOICE", "FINAL_INVOICE", "DEBIT_NOTE"].includes(invoice.type)) {
          for (const payment of invoice.payments) {
            if (payment.amount.plus(payment.whtAmount).gt(0) && !payment.receiptInvoice) {
              throw new Error(`Demo payment ${payment.id} ไม่มีใบเสร็จผูกงวด`);
            }
          }
        }
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  const summary = await Promise.all([
    prisma.customer.count(),
    prisma.order.count(),
    prisma.production.count(),
    prisma.productionStep.count(),
    prisma.printRun.count(),
    prisma.outsourceOrder.count(),
    prisma.qcRecord.count(),
    prisma.delivery.count(),
    prisma.invoice.count(),
  ]);
  console.log("Demo seed สำเร็จบน 127.0.0.1:5433/anajak_erp_demo");
  console.log(
    `customers=${summary[0]} orders=${summary[1]} productions=${summary[2]} steps=${summary[3]} print_runs=${summary[4]} outsource=${summary[5]} qc=${summary[6]} deliveries=${summary[7]} invoices=${summary[8]}`,
  );
  console.log("Stock credentials=0 · ไม่มีการเรียก Anajak Stock");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
