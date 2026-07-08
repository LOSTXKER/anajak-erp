import { router, protectedProcedure } from "../trpc";
import { getFactoryBoard } from "@/server/services/factory-board";

// ทีวีคิวรวมโรงงาน /factory — read-only ภาพรวมทั้งไลน์ (UX4)
// auth: protectedProcedure ธรรมดา — บัญชี "จอโรงงาน" login ค้างไว้ (เบสเคาะ · ไม่แตะ schema)
// getFactoryBoard ไม่มีฟิลด์เงินโดยโครงสร้าง → ปลอดภัยแม้ role ไหนเรียก (ทีวีห้ามมีเงิน)
export const factoryRouter = router({
  board: protectedProcedure.query(({ ctx }) => getFactoryBoard(ctx.prisma)),
});
