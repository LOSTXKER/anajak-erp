import { router, protectedProcedure } from "../trpc";
import { getPrintQueue } from "@/server/services/print-run";
import { laneOf } from "@/lib/production-steps";
import { hasPermission, type Permission } from "@/lib/permissions";
// คิวรีด/แพ็ค + ด่านแพ็ค ใช้ร่วมกับทีวี /factory (UX4) — จุดเดียว กัน drift
import { packGateReady, buildPressQueue, buildPackQueue } from "@/server/services/factory-board";

// "งานของฉันวันนี้" — รวมสิ่งที่ค้างอยู่บนโต๊ะของผู้ใช้ จุดเดียว · ทุก role เรียกได้
// แต่ section โผล่ตามสิทธิ์จริงของคน (PERM3: default ตรงชุด role เดิมเป๊ะ — คนถูกติ๊ก
// เพิ่ม/ตัดสิทธิ์เห็นจอเช้าตรงกับงานที่ทำได้จริง)

// กองย่อยจอเช้าแอดมิน — นับทั้งกอง (เท่าที่ดึง) + โชว์รายการย่อ 5 แถวแรกพอให้กดต่อ
function pile<T>(items: T[]) {
  return { count: items.length, items: items.slice(0, 5) };
}

export const taskRouter = router({
  myToday: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.userRole ?? "";
    const can = (p: Permission) => hasPermission(ctx.userRole, ctx.permissionOverrides, p);
    // ไม่ใช่หัวหน้า = เห็นเฉพาะงานที่มอบให้ตัวเอง (default = PRODUCTION_STAFF เดิมเป๊ะ)
    const ownWorkOnly = !can("supervise_operations");
    const orderSelect = {
      id: true,
      orderNumber: true,
      title: true,
      deadline: true,
      internalStatus: true,
      customer: { select: { name: true } },
    } as const;

    // ---- งานผลิตของฉัน: ขั้นตอนที่ยังไม่เสร็จ (staff = ของฉัน/ยังไม่มีเจ้าของ · หัวหน้า = ทั้งหมด)
    // รวม FAILED/ON_HOLD ด้วย — งานมีปัญหาคืองานด่วนสุด ต้องเด่นในคิว ไม่ใช่หาย (audit ข้อ 20)
    // ไม่รวม DTF_PRINT/HEAT_PRESS — สองขั้นนี้มีคิวเฉพาะที่กรองเงื่อนไขแล้ว (printQueue/pressQueue)
    // โผล่ที่นี่ซ้ำ = รั่วงานติดเงื่อนไขเข้าคิวช่าง · ขั้นแพ็คก็กรองด้วยด่านแพ็คด้านล่าง ----
    const PROBLEM_FIRST: Record<string, number> = { FAILED: 0, ON_HOLD: 1, IN_PROGRESS: 2, PENDING: 3 };
    // ทุกก้อนล่างนี้อิสระต่อกัน — ประกอบเป็น promise แล้วยิงพร้อมกันใน Promise.all ท้ายฟังก์ชัน
    // (เดิม await เรียงคิว 9 คลื่น = จอเช้าช้าสะสมเท่าผลรวมทุกก้อน · perf audit 2026-07-07)
    const productionP = can("manage_production")
      ? ctx.prisma.productionStep
          .findMany({
            where: {
              status: { in: ["PENDING", "IN_PROGRESS", "FAILED", "ON_HOLD"] },
              stepType: { notIn: ["DTF_PRINT", "HEAT_PRESS"] },
              production: {
                order: { internalStatus: { in: ["PRODUCTION_QUEUE", "PRODUCING"] } },
              },
              ...(ownWorkOnly
                ? { OR: [{ assignedToId: ctx.userId }, { assignedToId: null }] }
                : {}),
            },
            select: {
              id: true,
              stepType: true,
              customStepName: true,
              status: true,
              assignedTo: { select: { id: true, name: true } },
              production: {
                select: {
                  id: true,
                  // ขั้นทั้งใบผลิต — ด่านแพ็คต้องเห็นว่าสายอื่นจบครบหรือยัง
                  steps: { select: { stepType: true, status: true } },
                  order: { select: orderSelect },
                },
              },
            },
            orderBy: [{ production: { order: { deadline: "asc" } } }, { sortOrder: "asc" }],
            take: 100,
          })
          .then((steps) =>
            steps
              // ขั้นแพ็คที่ของยังไม่พร้อม (สายอื่นยังไม่จบครบ) ห้ามโผล่ — ยังแพ็คไม่ได้จริง
              .filter((s) => laneOf(s.stepType) !== "PACK" || packGateReady(s.production.steps))
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
    const printQueueP = can("manage_production")
      ? getPrintQueue(ctx.prisma).then((q) => q.slice(0, 8))
      : [];

    // ---- คิวรีด: ขั้นรีดร้อนที่ผ่าน gate ฟิล์มเสร็จ∧เสื้อพร้อมเท่านั้น —
    // งานติดเงื่อนไขห้ามโผล่ในคิวช่าง (ช่างรีดไม่ต้องเดินไปนับเสื้อเอง) ----
    const pressQueueP = can("manage_production")
      ? buildPressQueue(ctx.prisma, { userId: ctx.userId, ownWorkOnly, limit: 8 })
      : [];

    // ---- คิวแพ็ค: ขั้นแพ็คที่ของพร้อมแพ็คจริงเท่านั้น (ทุกขั้นนอกเลน PACK จบครบ) —
    // งานติดเงื่อนไขห้ามโผล่ในคิวช่าง (คนแพ็คไม่ต้องเดินไปไล่เช็คว่าสายไหนยังค้าง) ----
    const packQueueP = can("manage_production")
      ? buildPackQueue(ctx.prisma, { userId: ctx.userId, ownWorkOnly, limit: 8 })
      : [];

    // ---- รอเปิดใบผลิต: ออเดอร์เข้าคิว/แบบผ่านแล้ว แต่ยังไม่มีใบผลิต — ก่อนหน้านี้หายจากทุกจอ
    // จนกว่าหัวหน้าจะบังเอิญเปิดหน้าออเดอร์เอง (audit ข้อ 28 · เปิดใบผลิต = อำนาจ OWNER/MANAGER) ----
    const awaitingProductionP = can("supervise_operations")
      ? ctx.prisma.order.findMany({
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
    const designP = can("manage_design_files")
      ? ctx.prisma.order
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
    const followUpP = can("create_sales_docs")
      ? ctx.prisma.order
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
    const adminTodayP = can("create_sales_docs")
      ? (async () => {
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
    const billingP = can("see_finance")
      ? (async () => {
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

    const [
      production,
      printQueue,
      pressQueue,
      packQueue,
      awaitingProduction,
      design,
      followUp,
      adminToday,
      billing,
    ] = await Promise.all([
      productionP,
      printQueueP,
      pressQueueP,
      packQueueP,
      awaitingProductionP,
      designP,
      followUpP,
      adminTodayP,
      billingP,
    ]);

    return {
      production,
      printQueue,
      pressQueue,
      packQueue,
      awaitingProduction,
      design,
      followUp,
      adminToday,
      billing,
    };
  }),

  // ตัวเลขงานค้างบนเมนู sidebar — นับเบาๆ (count ล้วน ไม่ดึงแถว) · ไม่มีข้อมูลเงิน เปิดทุก role
  navBadges: protectedProcedure.query(async ({ ctx }) => {
    const [production, outsource] = await Promise.all([
      ctx.prisma.order.count({ where: { internalStatus: "PRODUCING" } }),
      ctx.prisma.outsourceOrder.count({
        where: { status: { in: ["SENT", "IN_PROGRESS", "RECEIVED_BACK"] } },
      }),
    ]);
    return { production, outsource };
  }),
});
