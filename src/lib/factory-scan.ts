import {
  isFactoryStationKey,
  type FactoryStationKey,
} from "@/lib/factory-station";

type TargetBase = { station: FactoryStationKey | null };

export type FactoryScanTarget =
  | (TargetBase & { kind: "order-number"; orderNumber: string })
  | (TargetBase & { kind: "production"; productionId: string })
  | (TargetBase & { kind: "order"; orderId: string });

export type FactoryScanFailureReason =
  | "empty"
  | "external-url"
  | "unsupported"
  | "ambiguous"
  | "missing-context";

export type FactoryScanResult =
  | { ok: true; target: FactoryScanTarget }
  | { ok: false; reason: FactoryScanFailureReason };

export type FactoryScanOptions = {
  allowedOrigins?: readonly string[];
};

const ORDER_NUMBER_PATTERN = /^ORD-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const ERP_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const PARSE_BASE = "https://factory-scan.invalid";
const PARSE_BASE_ORIGIN = new URL(PARSE_BASE).origin;

function normalizedOrderNumber(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return ORDER_NUMBER_PATTERN.test(normalized) ? normalized : null;
}

function normalizedId(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return ERP_ID_PATTERN.test(normalized) ? normalized : null;
}

function decodedId(value: string): string | null {
  try {
    return normalizedId(decodeURIComponent(value));
  } catch {
    return null;
  }
}

function stationFrom(url: URL): FactoryStationKey | null | false {
  const raw = url.searchParams.get("station");
  if (raw == null || raw.trim() === "") return null;
  const station = raw.trim();
  return isFactoryStationKey(station) ? station : false;
}

function normalizedAllowedOrigins(origins: readonly string[]): Set<string> {
  const normalized = new Set<string>();
  for (const value of origins) {
    try {
      normalized.add(new URL(value).origin);
    } catch {
      // A malformed configured origin grants no access.
    }
  }
  return normalized;
}

export function parseFactoryScan(
  rawValue: string,
  options: FactoryScanOptions = {},
): FactoryScanResult {
  const value = rawValue.trim();
  if (!value) return { ok: false, reason: "empty" };

  const orderNumber = normalizedOrderNumber(value);
  if (orderNumber) {
    return {
      ok: true,
      target: { kind: "order-number", orderNumber, station: null },
    };
  }

  let url: URL;
  try {
    url = new URL(value, PARSE_BASE);
  } catch {
    return { ok: false, reason: "unsupported" };
  }

  // WHATWG URL มอง backslash บางรูปเป็น network-path เช่น \\evil.example\production\id
  // จึงห้ามตัดสินจาก regex scheme อย่างเดียว: ถ้า parser พาออกจาก origin จำลอง ต้องผ่าน
  // allowlist เสมอ รวมถึง URL เต็มที่บังเอิญใช้ชื่อเดียวกับ PARSE_BASE
  const explicitlyAbsolute = /^[A-Za-z][A-Za-z\d+.-]*:/.test(value);
  const escapedToAnotherOrigin = url.origin !== PARSE_BASE_ORIGIN;
  if (explicitlyAbsolute || escapedToAnotherOrigin || value.startsWith("//")) {
    const allowedOrigins = normalizedAllowedOrigins(options.allowedOrigins ?? []);
    if (!allowedOrigins.has(url.origin)) {
      return { ok: false, reason: "external-url" };
    }
  }

  const station = stationFrom(url);
  if (station === false) return { ok: false, reason: "unsupported" };

  const productionMatch = url.pathname.match(/^\/production\/([^/]+)\/?$/);
  if (productionMatch) {
    const productionId = decodedId(productionMatch[1]);
    return productionId
      ? { ok: true, target: { kind: "production", productionId, station } }
      : { ok: false, reason: "unsupported" };
  }

  const orderMatch = url.pathname.match(/^\/orders\/([^/]+)\/?$/);
  if (orderMatch) {
    const orderId = decodedId(orderMatch[1]);
    return orderId
      ? { ok: true, target: { kind: "order", orderId, station } }
      : { ok: false, reason: "unsupported" };
  }

  if (!/^\/factory\/station\/?$/.test(url.pathname)) {
    return { ok: false, reason: "unsupported" };
  }

  const contextKeys = ["productionId", "orderId", "orderNumber"] as const;
  if (contextKeys.some((key) => url.searchParams.getAll(key).length > 1)) {
    return { ok: false, reason: "ambiguous" };
  }

  const candidates: FactoryScanTarget[] = [];
  const productionId = normalizedId(url.searchParams.get("productionId"));
  const orderId = normalizedId(url.searchParams.get("orderId"));
  const stationOrderNumber = normalizedOrderNumber(url.searchParams.get("orderNumber") ?? "");

  if (url.searchParams.has("productionId") && !productionId) {
    return { ok: false, reason: "unsupported" };
  }
  if (url.searchParams.has("orderId") && !orderId) {
    return { ok: false, reason: "unsupported" };
  }
  if (url.searchParams.has("orderNumber") && !stationOrderNumber) {
    return { ok: false, reason: "unsupported" };
  }

  if (productionId) candidates.push({ kind: "production", productionId, station });
  if (orderId) candidates.push({ kind: "order", orderId, station });
  if (stationOrderNumber) {
    candidates.push({ kind: "order-number", orderNumber: stationOrderNumber, station });
  }

  if (candidates.length === 0) return { ok: false, reason: "missing-context" };
  if (candidates.length > 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, target: candidates[0] };
}
