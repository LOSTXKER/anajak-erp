/* ============================================================
   สูตรขั้นงาน (Routing) — ตรรกะกลางของหน้าตั้งค่า "สูตรขั้นงาน"

   ทำไมต้องมีชั้นนี้ (เบสสั่ง 2026-09-01): "ใบการผลิตคือการเอาแต่ละโมดูลมาต่อกัน
   เราไม่สามารถที่จะ fix ได้ … ฉันว่ามันควรที่จะยืดหยุ่นมาก ๆ"
   → ลำดับขั้นและเงื่อนไข "ต้องเสร็จก่อน" ต้องเป็น **ข้อมูลที่เบสแก้เองได้**
   ไม่ใช่ค่าคงที่ในโค้ดที่ต้องรอ dev

   กติกาที่ยึด (มาจากสัญญาเดิมของ Production V2 — ห้ามผ่อน):
   ① เวอร์ชันที่ **ใช้งานจริงแล้ว (RELEASED) แก้ไม่ได้** — ใบผลิตที่เปิดไปแล้วอ้างอิงอยู่
      จะแก้สูตร = สร้างเวอร์ชันใหม่จากของเดิม แก้ที่ร่าง แล้วค่อยประกาศใช้
   ② เส้น "ต้องเสร็จก่อน" **ห้ามวนกลับ** — วนเมื่อไหร่ = งานค้างตลอดกาลเพราะทุกขั้นรอกันเอง
   ③ ตรวจทุกอย่างที่ server — UI เป็นแค่ผิว
   ============================================================ */

import { TRPCError } from "@trpc/server";
import type { ExtendedPrismaClient } from "@/lib/prisma";

export type RoutingOperationDraft = {
  /** รหัสขั้น — ใช้อ้างอิงเส้น "ต้องเสร็จก่อน" ภายในสูตรเดียวกัน */
  code: string;
  name: string;
  sequence: number;
  phase: "PREPARATION" | "MANUFACTURING" | "OUTSOURCE" | "QUALITY" | "PACKING";
  executionMode: "IN_HOUSE" | "OUTSOURCE";
  workCenterId: string | null;
  standardMinutes: number | null;
};

/** [รหัสขั้นที่ต้องเสร็จก่อน, รหัสขั้นที่รออยู่] */
export type RoutingDependencyDraft = [string, string];

export type RoutingDraft = {
  operations: RoutingOperationDraft[];
  dependencies: RoutingDependencyDraft[];
};

function fail(message: string, code: TRPCError["code"] = "BAD_REQUEST"): never {
  throw new TRPCError({ code, message });
}

/**
 * ตรวจร่างสูตรก่อนบันทึก — pure function เพื่อให้เทสต์ครอบเคสขอบได้โดยไม่ต้องมี DB
 *
 * สิ่งที่ตรวจ: มีขั้นอย่างน้อยหนึ่ง · รหัสขั้นไม่ซ้ำ · เส้น "ต้องเสร็จก่อน" ชี้ไปขั้นที่มีจริง ·
 * ไม่ชี้ตัวเอง · ไม่ซ้ำ · **ไม่วนกลับ**
 */
export function validateRoutingDraft(draft: RoutingDraft): void {
  if (draft.operations.length === 0) {
    fail("สูตรต้องมีอย่างน้อยหนึ่งขั้นงาน");
  }

  const codes = new Set<string>();
  for (const operation of draft.operations) {
    const code = operation.code.trim();
    if (!code) fail("ทุกขั้นต้องมีรหัสขั้น");
    if (!operation.name.trim()) fail(`ขั้น "${code}" ยังไม่มีชื่อ`);
    if (codes.has(code)) fail(`รหัสขั้น "${code}" ซ้ำกันในสูตรเดียวกัน`);
    codes.add(code);
  }

  const seen = new Set<string>();
  for (const [before, after] of draft.dependencies) {
    if (!codes.has(before) || !codes.has(after)) {
      fail(`เส้น "ต้องเสร็จก่อน" ชี้ไปขั้นที่ไม่มีในสูตร (${before} → ${after})`);
    }
    if (before === after) fail(`ขั้น "${before}" รอตัวเองไม่ได้`);
    const key = `${before}→${after}`;
    if (seen.has(key)) fail(`เส้น "${before} → ${after}" ซ้ำ`);
    seen.add(key);
  }

  const cycle = findDependencyCycle(draft);
  if (cycle) {
    fail(
      `เงื่อนไข "ต้องเสร็จก่อน" วนกลับเป็นวงกลม (${cycle.join(" → ")}) — งานจะค้างเพราะทุกขั้นรอกันเอง`,
    );
  }
}

/** หาวงวนด้วย DFS — คืนเส้นทางที่วน (ไว้บอกผู้ใช้ว่าวนตรงไหน) หรือ null ถ้าไม่มี */
export function findDependencyCycle(draft: RoutingDraft): string[] | null {
  const next = new Map<string, string[]>();
  for (const [before, after] of draft.dependencies) {
    next.set(before, [...(next.get(before) ?? []), after]);
  }

  const visiting = new Set<string>();
  const done = new Set<string>();
  const path: string[] = [];

  function walk(code: string): string[] | null {
    if (done.has(code)) return null;
    if (visiting.has(code)) return [...path.slice(path.indexOf(code)), code];
    visiting.add(code);
    path.push(code);
    for (const child of next.get(code) ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    path.pop();
    visiting.delete(code);
    done.add(code);
    return null;
  }

  for (const operation of draft.operations) {
    const found = walk(operation.code);
    if (found) return found;
  }
  return null;
}

/** สูตรทั้งหมด + เวอร์ชัน (ใหม่สุดก่อน) — ใช้ในหน้าตั้งค่า */
export async function listRoutings(prisma: ExtendedPrismaClient) {
  const routings = await prisma.routing.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          state: true,
          releasedAt: true,
          _count: { select: { operations: true, productionOrders: true } },
        },
      },
    },
  });
  return routings.map((routing) => ({
    id: routing.id,
    code: routing.code,
    name: routing.name,
    description: routing.description,
    isActive: routing.isActive,
    versions: routing.versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      state: version.state,
      releasedAt: version.releasedAt,
      operationCount: version._count.operations,
      /** ใบผลิตที่อ้างเวอร์ชันนี้ — มีมากกว่า 0 = ห้ามแตะเด็ดขาด */
      workOrderCount: version._count.productionOrders,
    })),
  }));
}

/** รายละเอียดเวอร์ชันหนึ่ง — ขั้นงาน + เส้น "ต้องเสร็จก่อน" (แปลงเป็นรหัสขั้นให้ UI ใช้ง่าย) */
export async function getRoutingVersion(prisma: ExtendedPrismaClient, versionId: string) {
  const version = await prisma.routingVersion.findUnique({
    where: { id: versionId },
    include: {
      routing: true,
      operations: {
        orderBy: { sequence: "asc" },
        include: {
          workCenter: { select: { id: true, code: true, name: true } },
          predecessorLinks: {
            include: { predecessorOperation: { select: { operationCode: true } } },
          },
        },
      },
      _count: { select: { productionOrders: true } },
    },
  });
  if (!version) fail("ไม่พบสูตรเวอร์ชันนี้", "NOT_FOUND");

  return {
    id: version.id,
    routingId: version.routingId,
    routingName: version.routing.name,
    routingCode: version.routing.code,
    versionNumber: version.versionNumber,
    state: version.state,
    releasedAt: version.releasedAt,
    workOrderCount: version._count.productionOrders,
    operations: version.operations.map((operation) => ({
      id: operation.id,
      code: operation.operationCode,
      name: operation.name,
      sequence: operation.sequence,
      phase: operation.phase,
      executionMode: operation.executionMode,
      workCenterId: operation.workCenterId,
      workCenterName: operation.workCenter?.name ?? null,
      standardMinutes: operation.standardMinutes,
      /** รหัสขั้นที่ต้องเสร็จก่อนขั้นนี้ */
      waitsFor: operation.predecessorLinks.map(
        (link) => link.predecessorOperation.operationCode,
      ),
    })),
  };
}

async function requireDraft(prisma: ExtendedPrismaClient, versionId: string) {
  const version = await prisma.routingVersion.findUnique({
    where: { id: versionId },
    select: { id: true, state: true, versionNumber: true, routingId: true },
  });
  if (!version) fail("ไม่พบสูตรเวอร์ชันนี้", "NOT_FOUND");
  if (version.state !== "DRAFT") {
    fail(
      `เวอร์ชัน ${version.versionNumber} ประกาศใช้ไปแล้ว แก้ไม่ได้ — กด "แก้สูตร" เพื่อสร้างเวอร์ชันใหม่จากของเดิม`,
    );
  }
  return version;
}

/**
 * สร้างร่างเวอร์ชันใหม่จากเวอร์ชันที่มีอยู่ (คัดลอกขั้นและเส้นทั้งหมด)
 * ถ้ามีร่างค้างอยู่แล้ว คืนร่างนั้นแทน — กันสร้างร่างซ้อนกันหลายอันจนงง
 */
export async function createDraftFromVersion(
  prisma: ExtendedPrismaClient,
  sourceVersionId: string,
) {
  const source = await prisma.routingVersion.findUnique({
    where: { id: sourceVersionId },
    include: {
      operations: {
        include: {
          predecessorLinks: {
            include: { predecessorOperation: { select: { operationCode: true } } },
          },
        },
      },
    },
  });
  if (!source) fail("ไม่พบสูตรเวอร์ชันที่จะคัดลอก", "NOT_FOUND");

  const openDraft = await prisma.routingVersion.findFirst({
    where: { routingId: source.routingId, state: "DRAFT" },
    orderBy: { versionNumber: "desc" },
    select: { id: true },
  });
  if (openDraft) return { versionId: openDraft.id, reusedExistingDraft: true };

  const latest = await prisma.routingVersion.findFirst({
    where: { routingId: source.routingId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  const versionId = await prisma.$transaction(async (tx) => {
    const draft = await tx.routingVersion.create({
      data: {
        routingId: source.routingId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
      },
    });

    const idByCode = new Map<string, string>();
    for (const operation of source.operations) {
      const copy = await tx.routingOperation.create({
        data: {
          routingVersionId: draft.id,
          operationCode: operation.operationCode,
          name: operation.name,
          description: operation.description,
          sequence: operation.sequence,
          executionMode: operation.executionMode,
          phase: operation.phase,
          workCenterId: operation.workCenterId,
          standardMinutes: operation.standardMinutes,
          instructions: operation.instructions ?? undefined,
        },
      });
      idByCode.set(operation.operationCode, copy.id);
    }

    const links = source.operations.flatMap((operation) =>
      operation.predecessorLinks.map((link) => ({
        predecessorOperationId: idByCode.get(link.predecessorOperation.operationCode)!,
        successorOperationId: idByCode.get(operation.operationCode)!,
      })),
    );
    if (links.length > 0) {
      await tx.routingOperationDependency.createMany({ data: links });
    }

    return draft.id;
  });

  return { versionId, reusedExistingDraft: false };
}

/** เขียนทับขั้นงานทั้งชุดของร่าง — ง่ายกว่าไล่แก้ทีละขั้น และกันสถานะครึ่ง ๆ กลาง ๆ */
export async function saveDraftOperations(
  prisma: ExtendedPrismaClient,
  versionId: string,
  draft: RoutingDraft,
) {
  await requireDraft(prisma, versionId);
  validateRoutingDraft(draft);

  await prisma.$transaction(async (tx) => {
    // ลบขั้นเดิมของร่าง (dependency ถูกลบตาม cascade)
    await tx.routingOperation.deleteMany({ where: { routingVersionId: versionId } });

    const idByCode = new Map<string, string>();
    for (const operation of draft.operations) {
      const created = await tx.routingOperation.create({
        data: {
          routingVersionId: versionId,
          operationCode: operation.code.trim(),
          name: operation.name.trim(),
          sequence: operation.sequence,
          phase: operation.phase,
          executionMode: operation.executionMode,
          workCenterId: operation.workCenterId,
          standardMinutes: operation.standardMinutes,
        },
      });
      idByCode.set(operation.code.trim(), created.id);
    }

    if (draft.dependencies.length > 0) {
      await tx.routingOperationDependency.createMany({
        data: draft.dependencies.map(([before, after]) => ({
          predecessorOperationId: idByCode.get(before)!,
          successorOperationId: idByCode.get(after)!,
        })),
      });
    }
  });

  return getRoutingVersion(prisma, versionId);
}

/** ประกาศใช้ร่าง — หลังจากนี้แก้ไม่ได้อีก ต้องสร้างเวอร์ชันใหม่ */
export async function releaseRoutingVersion(
  prisma: ExtendedPrismaClient,
  versionId: string,
  releasedById: string,
) {
  await requireDraft(prisma, versionId);

  const operations = await prisma.routingOperation.findMany({
    where: { routingVersionId: versionId },
    include: {
      predecessorLinks: {
        include: { predecessorOperation: { select: { operationCode: true } } },
      },
    },
  });

  // ตรวจซ้ำก่อนประกาศใช้ — ข้อมูลอาจถูกแก้จากที่อื่นหลังบันทึกร่างครั้งล่าสุด
  validateRoutingDraft({
    operations: operations.map((operation) => ({
      code: operation.operationCode,
      name: operation.name,
      sequence: operation.sequence,
      phase: operation.phase,
      executionMode: operation.executionMode,
      workCenterId: operation.workCenterId,
      standardMinutes: operation.standardMinutes,
    })),
    dependencies: operations.flatMap((operation) =>
      operation.predecessorLinks.map(
        (link) =>
          [link.predecessorOperation.operationCode, operation.operationCode] as
            RoutingDependencyDraft,
      ),
    ),
  });

  /* ทุกขั้นต้องมีศูนย์งาน — ไม่ใช่กฎของหน้านี้ แต่เป็นเงื่อนไขของการเปิดใบสั่งผลิต
     (manufacturing-work-order.ts: "Routing ทุกขั้นต้องระบุศูนย์งานก่อนเปิดใบสั่งผลิต")
     ถ้าปล่อยให้ประกาศใช้ทั้งที่ยังว่าง สูตรจะดูใช้งานได้แต่เปิดใบจริงไม่ได้ =
     ไปพังตอนหน้างาน แทนที่จะพังตรงนี้ที่ยังแก้ง่าย */
  const missingCenter = operations.filter((operation) => !operation.workCenterId);
  if (missingCenter.length > 0) {
    fail(
      `ยังไม่ได้เลือกศูนย์งานให้ขั้น: ${missingCenter
        .map((operation) => operation.name)
        .join(" · ")} — ต้องเลือกครบก่อนเริ่มใช้ ไม่งั้นเปิดใบสั่งผลิตไม่ได้`,
    );
  }

  await prisma.routingVersion.update({
    where: { id: versionId },
    data: { state: "RELEASED", releasedAt: new Date(), releasedById },
  });

  return getRoutingVersion(prisma, versionId);
}

/** ทิ้งร่าง — ใช้ตอนแก้ไปแล้วเปลี่ยนใจ · เวอร์ชันที่ประกาศใช้แล้วลบไม่ได้ */
export async function discardDraft(prisma: ExtendedPrismaClient, versionId: string) {
  await requireDraft(prisma, versionId);
  await prisma.routingVersion.delete({ where: { id: versionId } });
}
