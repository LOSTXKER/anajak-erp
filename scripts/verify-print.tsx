// render หน้าพิมพ์จริงเป็น HTML + assert ข้อมูลบังคับของเอกสาร — ลบข้อมูลทดสอบเกลี้ยงตอนจบ
// (เลขเอกสารใช้ TEST-xxx ตรงๆ ไม่ผ่าน DocumentSequence — เลขจริงไม่ขยับ ไม่เกิดรูเลข)
import React from "react";
// tsx แปลง JSX ของไฟล์ page เป็น classic runtime — ต้องมี React เป็น global ตอน render นอก Next
(globalThis as Record<string, unknown>).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "../src/lib/prisma";
import { COMPANY_PROFILE_KEY } from "../src/lib/company-profile";
import PrintQuotationPage from "../src/app/(print)/print/quotation/[id]/page";
import PrintInvoicePage from "../src/app/(print)/print/invoice/[id]/page";
import PrintJobTicketPage from "../src/app/(print)/print/job-ticket/[id]/page";

let pass = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log("PASS:", name);
  } else {
    fails.push(name);
    console.log("FAIL:", name);
  }
}

async function main() {
  const prevCompany = await prisma.setting.findUnique({ where: { key: COMPANY_PROFILE_KEY } });
  const ids: { customer?: string; order?: string; quotation?: string; invoices: string[] } = {
    invoices: [],
  };

  try {
    await prisma.setting.upsert({
      where: { key: COMPANY_PROFILE_KEY },
      update: {
        value: JSON.stringify({
          name: "บริษัท ทดสอบพิมพ์ จำกัด",
          address: "99 หมู่ 9 ต.ทดสอบ อ.เมือง จ.ทดสอบ 99999",
          taxId: "0105599999999",
          branch: "สำนักงานใหญ่",
          phone: "02-999-9999",
          email: "test@test.local",
        }),
      },
      create: {
        key: COMPANY_PROFILE_KEY,
        value: JSON.stringify({
          name: "บริษัท ทดสอบพิมพ์ จำกัด",
          address: "99 หมู่ 9 ต.ทดสอบ อ.เมือง จ.ทดสอบ 99999",
          taxId: "0105599999999",
          branch: "สำนักงานใหญ่",
          phone: "02-999-9999",
          email: "test@test.local",
        }),
      },
    });

    const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
    const customer = await prisma.customer.create({
      data: {
        name: "คุณทดสอบ พิมพ์ดี",
        company: "บริษัท ลูกค้าทดสอบ จำกัด",
        taxId: "0105588888888",
        branchNumber: "00000",
        billingAddress: "11 ถนนทดสอบ กรุงเทพฯ 10110",
        phone: "081-111-1111",
      },
    });
    ids.customer = customer.id;

    const order = await prisma.order.create({
      data: {
        orderNumber: "TEST-ORD-PRINT",
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "CONFIRMED",
        customerStatus: "ORDER_RECEIVED",
        title: "เสื้อทีมทดสอบการพิมพ์",
        priority: "URGENT",
        deadline: new Date("2026-06-25"),
        notes: "งานรีบ ลูกค้าใช้ออกบูธ",
        subtotalItems: 1200,
        taxRate: 7,
        taxAmount: 84,
        totalAmount: 1284,
        items: {
          create: [
            {
              sortOrder: 0,
              description: "เสื้อทีมงานบูธ",
              totalQuantity: 12,
              subtotal: 1200,
              products: {
                create: [
                  {
                    sortOrder: 0,
                    productType: "T_SHIRT",
                    description: "เสื้อยืดคอกลมสีดำ",
                    baseUnitPrice: 80,
                    totalQuantity: 12,
                    subtotal: 960,
                    itemSource: "CUSTOM_MADE",
                    fabricType: "COTTON",
                    fabricColor: "ดำ",
                    variants: {
                      create: [
                        { size: "M", color: "ดำ", quantity: 5 },
                        { size: "L", color: "ดำ", quantity: 7 },
                      ],
                    },
                  },
                ],
              },
              prints: {
                create: [
                  {
                    position: "FRONT",
                    printType: "SILK_SCREEN",
                    colorCount: 2,
                    width: 25,
                    height: 30,
                    designNote: "โลโก้กลางอก ห้ามเพี้ยนสี",
                    unitPrice: 20,
                  },
                ],
              },
              addons: {
                create: [
                  { addonType: "POLY_BAG", name: "ถุงแพค OPP", pricingType: "PER_PIECE", unitPrice: 3 },
                ],
              },
            },
          ],
        },
        productions: {
          create: [
            {
              steps: {
                create: [
                  { stepType: "SCREEN_PRINTING", sortOrder: 1 },
                  { stepType: "PACKAGING", sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    });
    ids.order = order.id;

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber: "TEST-QT-PRINT",
        customerId: customer.id,
        createdById: owner.id,
        title: "งานเสื้อทีมทดสอบ",
        validUntil: new Date("2026-07-10"),
        subtotal: 1000,
        discount: 100,
        tax: 70,
        totalAmount: 970,
        terms: "มัดจำ 50% ก่อนเริ่มงาน",
        items: {
          create: [
            { sortOrder: 0, name: "เสื้อยืดสกรีนหน้า", quantity: 10, unit: "ตัว", unitPrice: 100, totalPrice: 1000 },
          ],
        },
      },
    });
    ids.quotation = quotation.id;

    const receipt = await prisma.invoice.create({
      data: {
        invoiceNumber: "TEST-REC-PRINT",
        orderId: order.id,
        customerId: customer.id,
        type: "RECEIPT",
        amount: 1200,
        discount: 0,
        tax: 84,
        totalAmount: 1284,
        paymentStatus: "PAID",
        paidAt: new Date(),
        payments: { create: [{ amount: 1284, method: "BANK_TRANSFER", reference: "TX-001" }] },
      },
    });
    ids.invoices.push(receipt.id);

    const deposit = await prisma.invoice.create({
      data: {
        invoiceNumber: "TEST-INVD-PRINT",
        orderId: order.id,
        customerId: customer.id,
        type: "DEPOSIT_INVOICE",
        amount: 642,
        discount: 0,
        tax: 0,
        totalAmount: 642,
        dueDate: new Date("2026-06-20"),
      },
    });
    ids.invoices.push(deposit.id);

    const voidedCn = await prisma.invoice.create({
      data: {
        invoiceNumber: "TEST-CN-PRINT",
        orderId: order.id,
        customerId: customer.id,
        type: "CREDIT_NOTE",
        amount: 100,
        discount: 0,
        tax: 7,
        totalAmount: 107,
        isVoided: true,
        voidedReason: "ออกผิดใบ",
        paymentStatus: "VOIDED",
      },
    });
    ids.invoices.push(voidedCn.id);

    // ---------- render จริง ----------
    const qHtml = renderToStaticMarkup(
      await PrintQuotationPage({ params: Promise.resolve({ id: quotation.id }) })
    );
    ok("ใบเสนอราคา: หัวเอกสาร", qHtml.includes("ใบเสนอราคา") && qHtml.includes("TEST-QT-PRINT"));
    ok("ใบเสนอราคา: ข้อมูลกิจการ + ลูกค้า", qHtml.includes("บริษัท ทดสอบพิมพ์ จำกัด") && qHtml.includes("บริษัท ลูกค้าทดสอบ จำกัด"));
    ok("ใบเสนอราคา: ตัวอักษรจำนวนเงิน", qHtml.includes("เก้าร้อยเจ็ดสิบบาทถ้วน"));
    ok("ใบเสนอราคา: รายการ + เงื่อนไข", qHtml.includes("เสื้อยืดสกรีนหน้า") && qHtml.includes("มัดจำ 50%"));

    const rHtml = renderToStaticMarkup(
      await PrintInvoicePage({ params: Promise.resolve({ id: receipt.id }) })
    );
    ok("ใบกำกับภาษี: ชื่อเอกสารเต็มรูป", rHtml.includes("ใบเสร็จรับเงิน / ใบกำกับภาษี"));
    ok("ใบกำกับภาษี: ต้นฉบับ + สำเนา 2 หน้า", rHtml.includes("ต้นฉบับ (สำหรับลูกค้า)") && rHtml.includes("สำเนา (สำหรับผู้ขาย)"));
    ok("ใบกำกับภาษี: เลขผู้เสียภาษีทั้งสองฝั่ง", rHtml.includes("0105599999999") && rHtml.includes("0105588888888"));
    ok("ใบกำกับภาษี: แยก VAT ชัด", rHtml.includes("ภาษีมูลค่าเพิ่ม") && rHtml.includes("มูลค่าก่อนภาษีมูลค่าเพิ่ม"));
    ok("ใบกำกับภาษี: ตัวอักษรจำนวนเงิน", rHtml.includes("หนึ่งพันสองร้อยแปดสิบสี่บาทถ้วน"));
    ok("ใบกำกับภาษี: ชำระโดย", rHtml.includes("ชำระโดย") && rHtml.includes("โอนเงิน") && rHtml.includes("TX-001"));
    ok("ใบกำกับภาษี: อ้างอิงออเดอร์", rHtml.includes("TEST-ORD-PRINT"));

    const dHtml = renderToStaticMarkup(
      await PrintInvoicePage({ params: Promise.resolve({ id: deposit.id }) })
    );
    ok("ใบแจ้งหนี้มัดจำ: ชื่อ + ใบเดียว (ไม่มีสำเนา)", dHtml.includes("ใบแจ้งหนี้ (มัดจำ)") && !dHtml.includes("สำเนา (สำหรับผู้ขาย)"));
    ok("ใบแจ้งหนี้มัดจำ: ครบกำหนดชำระ", dHtml.includes("ครบกำหนดชำระ"));

    const cHtml = renderToStaticMarkup(
      await PrintInvoicePage({ params: Promise.resolve({ id: voidedCn.id }) })
    );
    ok("ใบลดหนี้ที่ถูก void: ลายน้ำยกเลิก + เหตุผล", cHtml.includes("ยกเลิก") && cHtml.includes("ออกผิดใบ") && cHtml.includes("ใบลดหนี้"));

    const jHtml = renderToStaticMarkup(
      await PrintJobTicketPage({ params: Promise.resolve({ id: order.id }) })
    );
    ok("Job Ticket: หัวใบงาน + QR", jHtml.includes("JOB TICKET") && jHtml.includes("TEST-ORD-PRINT") && jHtml.includes("<svg"));
    ok("Job Ticket: กำหนดส่ง + ความเร่งด่วนเด่น", jHtml.includes("กำหนดส่ง") && jHtml.includes("เร่งด่วน"));
    ok("Job Ticket: ตารางไซซ์", jHtml.includes("× 5") && jHtml.includes("× 7") && jHtml.includes("รวม 12"));
    ok("Job Ticket: ลายพิมพ์ครบ", jHtml.includes("Silk Screen") && jHtml.includes("25 × 30 ซม.") && jHtml.includes("ห้ามเพี้ยนสี"));
    ok("Job Ticket: ขั้นตอนผลิต + ส่วนเสริม", jHtml.includes("สกรีน/พิมพ์") && jHtml.includes("แพ็คกิ้ง") && jHtml.includes("ถุงแพค OPP"));
    ok("Job Ticket: ไม่มีราคา/เงินบนใบ", !jHtml.includes("฿") && !jHtml.includes("ราคา") && !jHtml.includes("จำนวนเงิน") && !jHtml.includes("บาท"));
  } finally {
    // ลบข้อมูลทดสอบเกลี้ยง + คืนค่า company profile เดิม
    await prisma.payment.deleteMany({ where: { invoice: { invoiceNumber: { startsWith: "TEST-" } } } });
    await prisma.invoice.deleteMany({ where: { invoiceNumber: { startsWith: "TEST-" } } });
    if (ids.quotation) await prisma.quotation.delete({ where: { id: ids.quotation } }).catch(() => {});
    if (ids.order) await prisma.order.delete({ where: { id: ids.order } }).catch(() => {});
    if (ids.customer) await prisma.customer.delete({ where: { id: ids.customer } }).catch(() => {});
    if (prevCompany) {
      await prisma.setting.update({ where: { key: COMPANY_PROFILE_KEY }, data: { value: prevCompany.value } });
    } else {
      await prisma.setting.deleteMany({ where: { key: COMPANY_PROFILE_KEY } });
    }
  }

  console.log(`\n=== ผล: ผ่าน ${pass} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("ตก:", fails);
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("CRASHED:", e);
  process.exit(1);
});
