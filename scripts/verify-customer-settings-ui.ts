import assert from "node:assert/strict";
import { prisma, type ExtendedPrismaClient } from "../src/lib/prisma";
import { validateDemoDatabaseUrl } from "../src/lib/demo-seed-plan";
import { customerRouter } from "../src/server/routers/customer";
import { settingsRouter } from "../src/server/routers/settings";
import { packagingRouter } from "../src/server/routers/packaging";
import { patternRouter } from "../src/server/routers/pattern";
import { buildCustomerCreatePayload, buildCustomerUpdatePayload, buildCustomerCommunicationPayload, customerEditFormFromRecord, emptyCustomerForm, validateCustomerEditForm } from "../src/lib/customer-form";
import type { Context } from "../src/server/trpc";

const prefix = `verify-customer-settings-${Date.now()}`;
const rollback = new Error("ROLLBACK_CUSTOMER_SETTINGS_FIXTURES");
let customerId: string | undefined;
let patternId: string | undefined;
let packagingId: string | undefined;

async function main() {
  validateDemoDatabaseUrl(process.env.DATABASE_URL);
  assert.equal(process.env.ANAJAK_ERP_DEMO_MODE, "1");
  assert.equal(await prisma.setting.count({ where: { key: { in: ["stock_api_url", "stock_api_key"] } } }), 0);
  const settingsBefore = await prisma.setting.findMany({ orderBy: { key: "asc" } });
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true }, select: { id: true } });
  try {
    await prisma.$transaction(async (tx) => {
      const client = new Proxy(tx, { get(target, property, receiver) {
        if (property === "$transaction") return (work: (transaction: typeof tx) => Promise<unknown>) => work(tx);
        return Reflect.get(target, property, receiver);
      } }) as unknown as ExtendedPrismaClient;
      const context: Context = { prisma: client, userId: owner.id, userRole: "OWNER", permissionOverrides: null };
      const customers = customerRouter.createCaller(context);
      const form = { ...emptyCustomerForm(), name: prefix, phone: "081-234-5678", chatName: "ห้องแชทลูกค้า", chatUrl: "https://example.com/customer", notes: "งานทดลอง\nตรวจหลังบันทึก", creditLimit: "0" };
      assert.deepEqual(validateCustomerEditForm(form), {});
      const created = await customers.create(buildCustomerCreatePayload(form, true));
      customerId = created.id;
      let detail = await customers.getById({ id: created.id });
      assert.equal(detail.phone, "0812345678");
      assert.equal(detail.creditLimit, 0);
      assert.equal(detail.chatUrl, form.chatUrl);
      assert.equal((await customers.creditStatus({ customerId: created.id })).available, 0);

      const edit = { ...customerEditFormFromRecord(detail), creditLimit: "", address: "", billingAddress: "", notes: "แก้โน้ตแล้ว\nยังอยู่ครบ" };
      await customers.update(buildCustomerUpdatePayload(created.id, edit, true));
      detail = await customers.getById({ id: created.id });
      assert.equal(detail.creditLimit, null);
      assert.equal(detail.address, null);
      assert.equal(detail.notes, edit.notes);
      assert.equal((await customers.creditStatus({ customerId: created.id })).available, null);
      await customers.addCommunicationLog(buildCustomerCommunicationPayload(created.id, { channel: "LINE", subject: " ตรวจการคุย ", content: " ขอยืนยันวันส่ง\nรอลูกค้าตอบ " }));
      const contact = (await customers.getById({ id: created.id })).communicationLogs[0]!;
      assert.equal(contact.content, "ขอยืนยันวันส่ง\nรอลูกค้าตอบ");

      const sales = customerRouter.createCaller({ ...context, userRole: "SALES" });
      await sales.update(buildCustomerUpdatePayload(created.id, { ...edit, name: `${prefix}-sales` }, false));
      await assert.rejects(sales.update({ id: created.id, creditLimit: 100 }), { code: "FORBIDDEN" });
      await assert.rejects(sales.create({ name: prefix, creditLimit: 0 }), { code: "FORBIDDEN" });
      const restricted = customerRouter.createCaller({ ...context, userRole: "PRODUCTION_STAFF", permissionOverrides: { manage_customers: true, see_order_money: false } });
      const restrictedDetail = await restricted.getById({ id: created.id });
      assert.equal(restrictedDetail.totalSpent, null);
      assert.equal(restrictedDetail.creditLimit, null);
      await assert.rejects(restricted.creditStatus({ customerId: created.id }), { code: "FORBIDDEN" });
      const worker = customerRouter.createCaller({ ...context, userRole: "PRODUCTION_STAFF" });
      await assert.rejects(worker.update({ id: created.id, name: "ไม่ควรบันทึก" }), { code: "FORBIDDEN" });

      const packaging = packagingRouter.createCaller(context);
      const option = await packaging.create({ name: prefix }); packagingId = option.id;
      await packaging.update({ id: option.id, name: `${prefix}-edited` });
      await packaging.update({ id: option.id, isActive: false });
      assert(!(await packaging.list()).some((item) => item.id === option.id));
      assert((await packaging.list({ includeInactive: true })).some((item) => item.id === option.id && !item.isActive));
      await packaging.update({ id: option.id, isActive: true });
      assert((await packaging.list()).some((item) => item.id === option.id && item.name === `${prefix}-edited`));
      await assert.rejects(packagingRouter.createCaller({ ...context, userRole: "SALES" }).update({ id: option.id, isActive: false }), { code: "FORBIDDEN" });

      const patterns = patternRouter.createCaller(context);
      const pattern = await patterns.create({ name: prefix }); patternId = pattern.id;
      await patterns.update({ id: pattern.id, isActive: false });
      assert((await patterns.list({})).patterns.some((item) => item.id === pattern.id && !item.isActive));
      assert(!(await patterns.list({ isActive: true })).patterns.some((item) => item.id === pattern.id));
      await patterns.update({ id: pattern.id, isActive: true });
      assert((await patterns.list({ isActive: true })).patterns.some((item) => item.id === pattern.id));

      const settings = settingsRouter.createCaller(context);
      const profile = { name: prefix, address: "99 ถนนทดสอบ", taxId: "0105555555555", branch: "00000", phone: "", email: "" };
      await settings.setCompanyProfile(profile);
      assert.deepEqual(await settings.companyProfile(), profile);
      const rates = { filmRatePerMeter: 0, filmRollWidthCm: 60, laborPerPiece: 0, overheadPerPiece: 0, costDeviationAlertPct: 10 };
      await settings.setCostRates(rates);
      assert.deepEqual(await settings.costRates(), rates);
      await assert.rejects(settings.setCostRates({ ...rates, filmRollWidthCm: 0 }), { code: "BAD_REQUEST" });
      await assert.rejects(settingsRouter.createCaller({ ...context, userRole: "SALES" }).setCompanyProfile(profile), { code: "FORBIDDEN" });
      await assert.rejects(settingsRouter.createCaller({ ...context, userRole: "SALES" }).costRates(), { code: "FORBIDDEN" });
      console.log("ผ่าน: ลูกค้าเพิ่ม→เปิด→แก้→ติดต่อ, วงเงินว่าง/0, SALES/ช่าง/override, แพ็คเกจและแพทเทิร์นปิด→เปิด, กิจการ/ต้นทุนอ่านหลังบันทึกและ permission");
      throw rollback;
    }, { timeout: 30_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    if (customerId) assert.equal(await prisma.customer.count({ where: { id: customerId } }), 0);
    if (patternId) assert.equal(await prisma.pattern.count({ where: { id: patternId } }), 0);
    if (packagingId) assert.equal(await prisma.packagingOption.count({ where: { id: packagingId } }), 0);
    assert.deepEqual(await prisma.setting.findMany({ orderBy: { key: "asc" } }), settingsBefore);
  }
  console.log("rollback แล้ว: ลูกค้า/catalog/audit ไม่ค้าง และ settings ทุกค่าคืนตรงก่อนตรวจ ไม่มีการแก้ผู้ใช้/Auth/Stock");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
