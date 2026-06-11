import { router, protectedProcedure } from "../trpc";

// "งานของฉันวันนี้" — รวมสิ่งที่ค้างอยู่บนโต๊ะของผู้ใช้ตามบทบาท จุดเดียว
// ทุก role เรียกได้ แต่ section จะมีข้อมูลเฉพาะที่เกี่ยวกับบทบาทตัวเอง
// (OWNER/MANAGER เห็นทุก section · staff เห็นเฉพาะของตัว)
const PRODUCTION_ROLES = ["OWNER", "MANAGER", "PRODUCTION_STAFF"];
const DESIGN_ROLES = ["OWNER", "MANAGER", "DESIGNER"];
const SALES_ROLES = ["OWNER", "MANAGER", "SALES"];
const FINANCE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"];

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

    return { role, production, awaitingProduction, design, followUp, billing };
  }),
});
