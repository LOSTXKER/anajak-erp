import { router, protectedProcedure } from "../trpc";
import { getPrintQueue } from "@/server/services/print-run";
import { evaluateHeatPressGate } from "@/lib/production-steps";

// "งานของฉันวันนี้" — รวมสิ่งที่ค้างอยู่บนโต๊ะของผู้ใช้ตามบทบาท จุดเดียว
// ทุก role เรียกได้ แต่ section จะมีข้อมูลเฉพาะที่เกี่ยวกับบทบาทตัวเอง
// (OWNER/MANAGER เห็นทุก section · staff เห็นเฉพาะของตัว)
const PRODUCTION_ROLES = ["OWNER", "MANAGER", "PRODUCTION_STAFF"];
const DESIGN_ROLES = ["OWNER", "MANAGER", "DESIGNER"];
const SALES_ROLES = ["OWNER", "MANAGER", "SALES"];
const FINANCE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"];

// กองย่อยจอเช้าแอดมิน — นับทั้งกอง (เท่าที่ดึง) + โชว์รายการย่อ 5 แถวแรกพอให้กดต่อ
function pile<T>(items: T[]) {
  return { count: items.length, items: items.slice(0, 5) };
}

export const taskRouter = router({
  myToday: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.userRole ?? "";
    const orderSelect = {
      id: true,
      orderNumber: true,
      title: true,
      deadline: true,
      internalStatus: true,
      customer: { select: { name: true } },
    } as const;

    // ---- งานผลิตของฉัน: ขั้นตอนที่ยังไม่เสร็จ (staff = ของฉัน/ยังไม่มีเจ้าของ · หัวหน้า = ทั้งหมด)
    // รวม FAILED/ON_HOLD ด้วย — งานมีปัญหาคืองานด่วนสุด ต้องเด่นในคิว ไม่ใช่หาย (audit ข้อ 20) ----
    const PROBLEM_FIRST: Record<string, number> = { FAILED: 0, ON_HOLD: 1, IN_PROGRESS: 2, PENDING: 3 };
    const production = PRODUCTION_ROLES.includes(role)
      ? await ctx.prisma.productionStep
          .findMany({
            where: {
              status: { in: ["PENDING", "IN_PROGRESS", "FAILED", "ON_HOLD"] },
              production: {
                order: { internalStatus: { in: ["PRODUCTION_QUEUE", "PRODUCING"] } },
              },
              ...(role === "PRODUCTION_STAFF"
                ? { OR: [{ assignedToId: ctx.userId }, { assignedToId: null }] }
                : {}),
            },
            select: {
              id: true,
              stepType: true,
              customStepName: true,
              status: true,
              assignedTo: { select: { id: true, name: true } },
              production: { select: { id: true, order: { select: orderSelect } } },
            },
            orderBy: [{ production: { order: { deadline: "asc" } } }, { sortOrder: "asc" }],
            take: 100,
          })
          .then((steps) =>
            steps
              .map((s) => ({
                stepId: s.id,
                stepType: s.stepType,
                customStepName: s.customStepName,
                status: s.status,
                assignedToId: s.assignedTo?.id ?? null,
                assignedToName: s.assignedTo?.name ?? null,
                productionId: s.production.id,
                order: s.production.order,
              }))
              .sort(
                (a, b) => (PROBLEM_FIRST[a.status] ?? 9) - (PROBLEM_FIRST[b.status] ?? 9)
              )
          )
      : [];

    // ---- คิวพิมพ์ฟิล์ม: เฉพาะงานที่ลงมือพิมพ์ได้ตอนนี้จริง (FLOW-REDESIGN ข้อ 8 —
    // ไฟล์ไม่พร้อม/ติดรอบ active ถูกกรองใน service แล้ว · เรียงกำหนดส่งมาแล้ว) ----
    const printQueue = PRODUCTION_ROLES.includes(role)
      ? (await getPrintQueue(ctx.prisma)).slice(0, 8)
      : [];

    // ---- คิวรีด: ขั้นรีดร้อนที่ผ่าน gate ฟิล์มเสร็จ∧เสื้อพร้อมเท่านั้น —
    // งานติดเงื่อนไขห้ามโผล่ในคิวช่าง (ช่างรีดไม่ต้องเดินไปนับเสื้อเอง) ----
    const pressQueue = PRODUCTION_ROLES.includes(role)
      ? await ctx.prisma.productionStep
          .findMany({
            where: {
              stepType: "HEAT_PRESS",
              status: { in: ["PENDING", "IN_PROGRESS"] },
              production: { order: { internalStatus: { notIn: ["CANCELLED", "ON_HOLD"] } } },
              ...(role === "PRODUCTION_STAFF"
                ? { OR: [{ assignedToId: ctx.userId }, { assignedToId: null }] }
                : {}),
            },
            select: {
              id: true,
              qtyDone: true,
              qtyTotal: true,
              production: {
                select: {
                  id: true,
                  // ขั้นทั้งใบผลิต — gate ต้องเห็นสายพิมพ์+เตรียมเสื้อ/ตัดเย็บครบ
                  steps: { select: { stepType: true, status: true } },
                  order: {
                    select: {
                      orderNumber: true,
                      title: true,
                      deadline: true,
                      customer: { select: { name: true } },
                    },
                  },
                },
              },
            },
            orderBy: { production: { order: { deadline: "asc" } } },
            take: 100,
          })
          .then((steps) =>
            steps
              .filter((s) => evaluateHeatPressGate(s.production.steps).ready)
              .slice(0, 8)
              .map((s) => ({
                stepId: s.id,
                productionId: s.production.id,
                orderNumber: s.production.order.orderNumber,
                title: s.production.order.title,
                customerName: s.production.order.customer.name,
                deadline: s.production.order.deadline,
                qtyDone: s.qtyDone,
                qtyTotal: s.qtyTotal,
              }))
          )
      : [];

    // ---- รอเปิดใบผลิต: ออเดอร์เข้าคิว/แบบผ่านแล้ว แต่ยังไม่มีใบผลิต — ก่อนหน้านี้หายจากทุกจอ
    // จนกว่าหัวหน้าจะบังเอิญเปิดหน้าออเดอร์เอง (audit ข้อ 28 · เปิดใบผลิต = อำนาจ OWNER/MANAGER) ----
    const awaitingProduction = ["OWNER", "MANAGER"].includes(role)
      ? await ctx.prisma.order.findMany({
          where: {
            internalStatus: { in: ["PRODUCTION_QUEUE", "DESIGN_APPROVED"] },
            productions: { none: {} },
          },
          select: orderSelect,
          orderBy: { deadline: "asc" },
          take: 100,
        })
      : [];

    // ---- งานออกแบบ: ออเดอร์ที่กำลังออกแบบ + สถานะแบบล่าสุด ----
    const design = DESIGN_ROLES.includes(role)
      ? await ctx.prisma.order
          .findMany({
            where: { internalStatus: "DESIGNING" },
            select: {
              ...orderSelect,
              designs: {
                orderBy: { versionNumber: "desc" },
                take: 1,
                select: { versionNumber: true, approvalStatus: true },
              },
            },
            orderBy: { deadline: "asc" },
            take: 100,
          })
          .then((orders) =>
            orders.map((o) => {
              const latest = o.designs[0];
              return {
                order: { id: o.id, orderNumber: o.orderNumber, title: o.title, deadline: o.deadline, internalStatus: o.internalStatus, customer: o.customer },
                latestVersion: latest?.versionNumber ?? null,
                latestApproval: latest?.approvalStatus ?? null,
              };
            })
          )
      : [];

    // ---- ติดตามลูกค้า: ออเดอร์ที่ยังเป็นการสอบถาม (รอตกลง → ยืนยัน) ----
    const followUp = SALES_ROLES.includes(role)
      ? await ctx.prisma.order
          .findMany({
            where: { internalStatus: "INQUIRY" },
            select: { ...orderSelect, totalAmount: true, _count: { select: { items: true } } },
            orderBy: { createdAt: "asc" },
            take: 100,
          })
          .then((orders) =>
            orders.map((o) => ({
              order: { id: o.id, orderNumber: o.orderNumber, title: o.title, deadline: o.deadline, internalStatus: o.internalStatus, customer: o.customer },
              totalAmount: o.totalAmount,
              itemCount: o._count.items,
            }))
          )
      : [];

    // ---- ของเข้า-ออกวันนี้ (จอเช้าแอดมิน): 4 กองที่ต้องวิ่งตามวันนี้ — ops ล้วน ห้ามมีเงิน ----
    const adminToday = SALES_ROLES.includes(role)
      ? await (async () => {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          const endOfTomorrow = new Date(endOfToday);
          endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

          const [outsourceDueRaw, awaitingInspectionRaw, designsAwaitingRaw, dueSoonRaw] =
            await Promise.all([
              // ร้านนอกครบกำหนดรับ — lte สิ้นวันนี้ = รวมเลยกำหนด (ยิ่งช้ายิ่งต้องตาม)
              ctx.prisma.outsourceOrder.findMany({
                where: {
                  status: { in: ["SENT", "IN_PROGRESS"] },
                  expectedBackAt: { lte: endOfToday },
                },
                select: {
                  id: true,
                  expectedBackAt: true,
                  vendor: { select: { name: true } },
                  productionStep: {
                    select: {
                      production: { select: { order: { select: { orderNumber: true } } } },
                    },
                  },
                },
                orderBy: { expectedBackAt: "asc" },
                take: 100,
              }),
              // รอตรวจรับเสื้อลูกค้า — เฉพาะออเดอร์ที่ยังเดินอยู่ (ส่ง/จบ/ยกเลิก/พัก = ไม่มีอะไรให้ตรวจแล้ว)
              ctx.prisma.order.findMany({
                where: {
                  internalStatus: { notIn: ["CANCELLED", "ON_HOLD", "SHIPPED", "COMPLETED"] },
                  items: {
                    some: {
                      products: {
                        some: { itemSource: "CUSTOMER_PROVIDED", receivedInspected: false },
                      },
                    },
                  },
                },
                select: { id: true, orderNumber: true, title: true },
                orderBy: { deadline: "asc" },
                take: 100,
              }),
              // ลูกค้าค้างอนุมัติแบบ — ต้องดู version "ล่าสุด" ยัง PENDING เท่านั้น
              // (version เก่าค้าง PENDING ได้ตอนdesignerอัปโหลดทับ — เช็คจาก some อย่างเดียวจะนับผี)
              ctx.prisma.order.findMany({
                where: {
                  internalStatus: "DESIGNING",
                  designs: { some: { approvalStatus: "PENDING" } },
                },
                select: {
                  id: true,
                  orderNumber: true,
                  title: true,
                  designs: {
                    orderBy: { versionNumber: "desc" },
                    take: 1,
                    select: { approvalStatus: true },
                  },
                },
                orderBy: { deadline: "asc" },
                take: 100,
              }),
              // ครบกำหนดส่งวันนี้-พรุ่งนี้ — เฉพาะที่ยังเดินอยู่ (ส่งแล้วไม่ต้องลุ้นแล้ว)
              ctx.prisma.order.findMany({
                where: {
                  internalStatus: { notIn: ["CANCELLED", "ON_HOLD", "SHIPPED", "COMPLETED"] },
                  deadline: { gte: startOfToday, lte: endOfTomorrow },
                },
                select: { id: true, orderNumber: true, title: true, deadline: true },
                orderBy: { deadline: "asc" },
                take: 100,
              }),
            ]);

          return {
            outsourceDue: pile(
              outsourceDueRaw.map((o) => ({
                id: o.id,
                vendorName: o.vendor.name,
                orderNumber: o.productionStep.production.order.orderNumber,
                expectedBackAt: o.expectedBackAt,
              }))
            ),
            awaitingInspection: pile(
              awaitingInspectionRaw.map((o) => ({
                orderId: o.id,
                orderNumber: o.orderNumber,
                title: o.title,
              }))
            ),
            designsAwaiting: pile(
              designsAwaitingRaw
                .filter((o) => o.designs[0]?.approvalStatus === "PENDING")
                .map((o) => ({ orderId: o.id, orderNumber: o.orderNumber, title: o.title }))
            ),
            dueSoon: pile(
              dueSoonRaw.map((o) => ({
                orderId: o.id,
                orderNumber: o.orderNumber,
                title: o.title,
                deadline: o.deadline,
              }))
            ),
          };
        })()
      : {
          outsourceDue: pile([]),
          awaitingInspection: pile([]),
          designsAwaiting: pile([]),
          dueSoon: pile([]),
        };

    // ---- การเงิน: บิลเลยกำหนด + ออเดอร์ส่งแล้วรอวางบิล/ปิดงาน ----
    const billing = FINANCE_ROLES.includes(role)
      ? await (async () => {
          const [overdue, shipped] = await Promise.all([
            ctx.prisma.invoice.findMany({
              where: { paymentStatus: "OVERDUE", isVoided: false },
              select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                dueDate: true,
                order: { select: { id: true, orderNumber: true } },
                customer: { select: { name: true } },
              },
              orderBy: { dueDate: "asc" },
              take: 100,
            }),
            ctx.prisma.order.findMany({
              where: { internalStatus: "SHIPPED" },
              select: orderSelect,
              orderBy: { deadline: "asc" },
              take: 100,
            }),
          ]);
          return {
            overdueInvoices: overdue.map((i) => ({
              id: i.id,
              invoiceNumber: i.invoiceNumber,
              totalAmount: i.totalAmount,
              dueDate: i.dueDate,
              orderId: i.order.id,
              orderNumber: i.order.orderNumber,
              customerName: i.customer.name,
            })),
            shippedOrders: shipped,
          };
        })()
      : { overdueInvoices: [], shippedOrders: [] };

    return {
      role,
      production,
      printQueue,
      pressQueue,
      awaitingProduction,
      design,
      followUp,
      adminToday,
      billing,
    };
  }),
});
