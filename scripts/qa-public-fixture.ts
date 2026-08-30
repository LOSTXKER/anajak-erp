/**
 * Browser-only fixture for the five public token surfaces.
 *
 * The process intentionally stays alive while QA is running. Send SIGINT/SIGTERM
 * to remove every row and the private token file. Tokens are never printed.
 * This script refuses every database except the isolated local demo database.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DEMO_DATABASE_TARGET,
  validateDemoDatabaseUrl,
} from "../src/lib/demo-seed-plan";

const CONTAINER_NAME = "anajak-postgres";
const MARK = "[PUBLIC-VISUAL-QA]";

function readContainerEnv(name: "POSTGRES_USER" | "POSTGRES_PASSWORD") {
  const value = execFileSync("docker", ["exec", CONTAINER_NAME, "printenv", name], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  if (!value) throw new Error(`ไม่พบ ${name} ใน Docker ${CONTAINER_NAME}`);
  return value;
}

function demoDatabaseUrl() {
  const username = encodeURIComponent(readContainerEnv("POSTGRES_USER"));
  const password = encodeURIComponent(readContainerEnv("POSTGRES_PASSWORD"));
  const url =
    `postgresql://${username}:${password}` +
    `@${DEMO_DATABASE_TARGET.hostname}:${DEMO_DATABASE_TARGET.port}` +
    `/${DEMO_DATABASE_TARGET.database}?schema=public`;
  validateDemoDatabaseUrl(url);
  return url;
}

function token() {
  return randomBytes(32).toString("hex");
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath || !path.resolve(outputPath).startsWith("/tmp/")) {
    throw new Error("ต้องส่ง path ชั่วคราวใต้ /tmp สำหรับเก็บ URL ส่วนตัว");
  }

  const databaseUrl = demoDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = databaseUrl;
  process.env.ANAJAK_ERP_DEMO_MODE = "1";
  process.env.ANAJAK_STOCK_API_URL = "";
  process.env.ANAJAK_STOCK_API_KEY = "";

  const { prisma } = await import("../src/lib/prisma");
  const ids = {
    customer: "",
    orders: [] as string[],
    quotations: [] as string[],
    vendor: "",
    outsource: "",
  };

  try {
    // เก็บซากจาก process ที่ถูก kill -9/terminal หาย โดยแตะเฉพาะ marker ของสคริปต์นี้
    // และเฉพาะฐาน demo ที่ผ่าน guard ด้านบนแล้วเท่านั้น
    const staleCustomers = await prisma.customer.findMany({
      where: { name: { startsWith: MARK } },
      select: { id: true },
    });
    const staleCustomerIds = staleCustomers.map((item) => item.id);
    if (staleCustomerIds.length > 0) {
      const staleOrders = await prisma.order.findMany({
        where: { customerId: { in: staleCustomerIds } },
        select: {
          id: true,
          productions: {
            select: { steps: { select: { outsourceOrders: { select: { id: true } } } } },
          },
        },
      });
      const staleOrderIds = staleOrders.map((item) => item.id);
      const staleOutsourceIds = staleOrders.flatMap((order) =>
        order.productions.flatMap((production) =>
          production.steps.flatMap((step) => step.outsourceOrders.map((item) => item.id)),
        ),
      );
      const staleQuotes = await prisma.quotation.findMany({
        where: { customerId: { in: staleCustomerIds }, quotationNumber: { startsWith: "QT-QA-" } },
        select: { id: true },
      });
      const staleEntityIds = [
        ...staleOrderIds,
        ...staleOutsourceIds,
        ...staleQuotes.map((item) => item.id),
      ];
      await prisma.notification.deleteMany({ where: { entityId: { in: staleEntityIds } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: staleEntityIds } } });
      await prisma.quotation.deleteMany({ where: { id: { in: staleQuotes.map((item) => item.id) } } });
      await prisma.order.deleteMany({ where: { id: { in: staleOrderIds } } });
      await prisma.vendor.deleteMany({ where: { name: { startsWith: MARK } } });
      await prisma.customer.deleteMany({ where: { id: { in: staleCustomerIds } } });
    }

    const owner = await prisma.user.findFirstOrThrow({
      where: { role: "OWNER", isActive: true },
      select: { id: true },
    });
    const stamp = Date.now();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);

    const customer = await prisma.customer.create({
      data: {
        name: `${MARK} บริษัทตัวอย่าง`,
        company: "บริษัท สีสัน จำกัด",
        customerType: "CORPORATE",
      },
    });
    ids.customer = customer.id;

    const designToken = token();
    const uploadToken = token();
    const designOrder = await prisma.order.create({
      data: {
        orderNumber: `QA-PUB-${stamp}-DESIGN`,
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "DESIGNING",
        customerStatus: "PREPARING",
        deadline: expiresAt,
        uploadToken,
        uploadTokenExpiresAt: expiresAt,
        designs: {
          create: {
            versionNumber: 1,
            fileUrl: "/demo-mockups/front.svg",
            thumbnailUrl: "/demo-mockups/front.svg",
            approvalStatus: "PENDING",
            approvalToken: designToken,
            tokenExpiresAt: expiresAt,
          },
        },
      },
    });
    ids.orders.push(designOrder.id);

    const statusToken = token();
    const statusOrder = await prisma.order.create({
      data: {
        orderNumber: `QA-PUB-${stamp}-STATUS`,
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "PRODUCING",
        customerStatus: "IN_PRODUCTION",
        deadline: expiresAt,
        blindShip: true,
        blindShipSenderName: "สีสันยูนิฟอร์ม",
        statusToken,
        statusTokenExpiresAt: expiresAt,
      },
    });
    ids.orders.push(statusOrder.id);

    const quoteToken = token();
    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber: `QT-QA-${stamp}`,
        customerId: customer.id,
        createdById: owner.id,
        status: "SENT",
        sentAt: new Date(),
        description: "เสื้อคอกลมสีดำ พร้อมสกรีนหน้าอก",
        validUntil: expiresAt,
        subtotal: 14_400,
        discount: 400,
        tax: 980,
        totalAmount: 14_980,
        confirmToken: quoteToken,
        items: {
          create: [
            {
              name: "เสื้อคอกลมพร้อมสกรีน",
              quantity: 120,
              unit: "ตัว",
              unitPrice: 120,
              totalPrice: 14_400,
            },
          ],
        },
      },
    });
    ids.quotations.push(quotation.id);

    const expiredQuoteToken = token();
    const expiredQuotation = await prisma.quotation.create({
      data: {
        quotationNumber: `QT-QA-${stamp}-EXPIRED`,
        customerId: customer.id,
        createdById: owner.id,
        status: "SENT",
        sentAt: new Date(Date.now() - 3 * 86_400_000),
        validUntil: new Date(Date.now() - 2 * 86_400_000),
        subtotal: 14_400,
        discount: 400,
        tax: 980,
        totalAmount: 14_980,
        confirmToken: expiredQuoteToken,
        items: {
          create: [
            {
              name: "เสื้อคอกลมพร้อมสกรีน",
              quantity: 120,
              unit: "ตัว",
              unitPrice: 120,
              totalPrice: 14_400,
            },
          ],
        },
      },
    });
    ids.quotations.push(expiredQuotation.id);

    const shareToken = token();
    const outsourceOrder = await prisma.order.create({
      data: {
        orderNumber: `QA-PUB-${stamp}-JOB`,
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "PRODUCING",
        customerStatus: "IN_PRODUCTION",
        items: {
          create: {
            description: "เสื้อโปโลสีกรม",
            totalQuantity: 30,
            products: {
              create: {
                productType: "POLO",
                description: "เสื้อโปโลสีกรม",
                baseUnitPrice: 0,
                totalQuantity: 30,
                variants: {
                  create: [
                    { size: "M", color: "กรม", quantity: 12 },
                    { size: "L", color: "กรม", quantity: 18 },
                  ],
                },
              },
            },
            prints: {
              create: {
                position: "FRONT",
                printType: "EMBROIDERY",
                printSize: "A5",
                colorCount: 3,
                designNote: "ปักอกซ้าย สูง 7 ซม.",
                unitPrice: 0,
              },
            },
          },
        },
        productions: {
          create: {
            status: "IN_PROGRESS",
            steps: {
              create: {
                stepType: "EMBROIDERY",
                status: "IN_PROGRESS",
                sortOrder: 1,
                qtyTotal: 30,
              },
            },
          },
        },
      },
      include: { productions: { include: { steps: true } } },
    });
    ids.orders.push(outsourceOrder.id);

    const vendor = await prisma.vendor.create({
      data: { name: `${MARK} ร้านปักริมคลอง`, capabilities: ["ปัก"] },
    });
    ids.vendor = vendor.id;
    const job = await prisma.outsourceOrder.create({
      data: {
        productionStepId: outsourceOrder.productions[0].steps[0].id,
        vendorId: vendor.id,
        status: "SENT",
        description: "ปักโลโก้อกซ้าย",
        quantity: 30,
        unitCost: 0,
        totalCost: 0,
        sentAt: new Date(),
        expectedBackAt: expiresAt,
        notes: "แยกมัดตามไซส์ก่อนส่งคืน",
        shareToken,
        shareTokenExpiresAt: expiresAt,
      },
    });
    ids.outsource = job.id;

    writeFileSync(
      outputPath,
      JSON.stringify(
        {
          quote: `/quote/${quoteToken}`,
          expired: `/quote/${expiredQuoteToken}`,
          design: `/approve/design/${designToken}`,
          status: `/status/${statusToken}`,
          upload: `/upload/${uploadToken}`,
          outsource: `/job/${shareToken}`,
          error: "/quote/token-invalid-for-visual-qa",
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log("Public QA fixture พร้อมแล้ว (URL อยู่ในไฟล์ชั่วคราวส่วนตัว)");

    const keepAlive = setInterval(() => undefined, 60_000);
    await new Promise<void>((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
    clearInterval(keepAlive);
  } finally {
    rmSync(outputPath, { force: true });
    const entityIds = [...ids.orders, ...ids.quotations, ids.outsource].filter(Boolean);
    await prisma.notification.deleteMany({ where: { entityId: { in: entityIds } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
    if (ids.quotations.length > 0) {
      await prisma.quotation.deleteMany({ where: { id: { in: ids.quotations } } });
    }
    if (ids.orders.length > 0) await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
    if (ids.vendor) await prisma.vendor.deleteMany({ where: { id: ids.vendor } });
    if (ids.customer) await prisma.customer.deleteMany({ where: { id: ids.customer } });
    await prisma.$disconnect();
    console.log("ล้าง Public QA fixture แล้ว");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
