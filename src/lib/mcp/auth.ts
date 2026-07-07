/**
 * MCP auth — กุญแจ agent (FLOW-REDESIGN ก้อน 5)
 *
 * แนวคิด: resolve API key → User จริง → คืน AuthInfo ที่บรรจุ { userId, userRole } ใน extra
 * ชั้น tool เอา context นี้ไป gate role (reuse Role เดิม) + ผ่าน FK ของ audit/createdBy
 *
 * - key เก็บเป็น sha256 hash ไม่ใช่ plaintext (ยกระดับจาก stock_api_key ใน settings ที่เป็น plaintext)
 * - fail-closed: ไม่มี key/หาไม่เจอ/ปิดใช้งาน/หมดอายุ/user ถูกปิด = undefined (withMcpAuth → 401)
 * - รองรับทั้ง Authorization: Bearer <key> (mcp-handler ดึง bearerToken ให้) และ X-API-Key
 *   (สอดคล้อง pattern X-API-Key ของท่อ Stock — เผื่อ client ที่ส่งแบบนั้น)
 */

import { createHash, randomBytes } from "crypto";
import type { Role } from "@prisma/client";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { prisma } from "@/lib/prisma";

export const AGENT_KEY_PREFIX = "ana_";

/** sha256 hex ของ raw key — เก็บลง DB (ไม่เก็บ plaintext) */
export function hashAgentKey(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

/** สร้างกุญแจใหม่ (ใช้ในสคริปต์สร้าง key) — raw โชว์ครั้งเดียว เก็บแต่ hash */
export function newAgentKey(): { raw: string; keyHash: string; keyPrefix: string } {
  const raw = AGENT_KEY_PREFIX + randomBytes(32).toString("hex");
  return { raw, keyHash: hashAgentKey(raw), keyPrefix: raw.slice(0, 12) };
}

/** context ของ agent ที่ resolve แล้ว — แนบไว้ใน AuthInfo.extra แล้วให้ tool ดึงไปใช้ */
export interface AgentContext {
  userId: string;
  userRole: Role;
  // override สิทธิ์รายคนจาก users.permissionOverrides (JSON ดิบ — hasPermission parse เอง
  // ข้อมูลเสีย fail กลับ default ตาม role) · null = ไม่มี override ใช้ default
  permissionOverrides: unknown;
  keyId: string;
  keyName: string;
}

/**
 * verifyToken สำหรับ withMcpAuth — คืน AuthInfo ถ้า key ใช้ได้ มิฉะนั้น undefined (401)
 */
export async function verifyAgentToken(
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  const raw = (bearerToken || req.headers.get("x-api-key") || "").trim();
  if (!raw) return undefined;

  const key = await prisma.agentApiKey.findUnique({
    where: { keyHash: hashAgentKey(raw) },
    select: {
      id: true,
      name: true,
      isActive: true,
      expiresAt: true,
      user: { select: { id: true, role: true, isActive: true, permissionOverrides: true } },
    },
  });

  if (!key || !key.isActive) return undefined;
  if (key.expiresAt && key.expiresAt < new Date()) return undefined;
  if (!key.user.isActive) return undefined; // user ถูกปิด → key ใช้ไม่ได้ (กัน key ลอยหลังปลดพนักงาน)

  // อัปเดต lastUsedAt แบบ fire-and-forget — ไม่ block การตอบ + ไม่ทำ request พังถ้า DB hiccup
  void prisma.agentApiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  const extra: AgentContext = {
    userId: key.user.id,
    userRole: key.user.role,
    permissionOverrides: key.user.permissionOverrides,
    keyId: key.id,
    keyName: key.name,
  };

  return {
    token: raw,
    scopes: [key.user.role], // เก็บ role เป็น scope ไว้ — gate จริงทำต่อ tool ในชั้น tool
    clientId: key.id,
    extra: extra as unknown as Record<string, unknown>,
  };
}

// Role ที่ระบบรู้จัก — กัน userRole แปลกปลอม (defense-in-depth: ปัจจุบัน extra สร้างจาก
// verifyAgentToken เท่านั้น client ฉีดไม่ได้ แต่ถ้ามีแหล่งใหม่ในอนาคต role มั่ว = ปฏิเสธชัดเจน)
const VALID_ROLES: ReadonlySet<string> = new Set([
  "OWNER", "MANAGER", "ACCOUNTANT", "PRODUCTION_STAFF", "DESIGNER", "SALES",
]);

/** ดึง AgentContext จาก AuthInfo (extra.authInfo ใน tool handler) — โยนถ้า auth ไม่สมบูรณ์ */
export function getAgentContext(authInfo: AuthInfo | undefined): AgentContext {
  const extra = authInfo?.extra as Partial<AgentContext> | undefined;
  if (!extra?.userId || !extra?.userRole || !extra?.keyId || !VALID_ROLES.has(extra.userRole)) {
    throw new Error("auth ไม่สมบูรณ์ — ไม่พบ agent context");
  }
  return {
    userId: extra.userId,
    userRole: extra.userRole,
    // ไม่มี field (AuthInfo จากแหล่งเก่า) = null → hasPermission ใช้ default ตาม role
    permissionOverrides: extra.permissionOverrides ?? null,
    keyId: extra.keyId,
    keyName: extra.keyName ?? "",
  };
}
