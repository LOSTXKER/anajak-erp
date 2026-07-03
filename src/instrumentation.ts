// Next.js instrumentation — รันครั้งเดียวตอน server instance เริ่ม (Gate B15)
// ใช้ตรวจ env ให้ fail-fast · เฉพาะ nodejs runtime (edge/build ไม่ต้องตรวจซ้ำ)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateEnv } = await import("@/lib/env");
  validateEnv();
}
