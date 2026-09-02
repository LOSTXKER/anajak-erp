"use client";

/** มุมมองเต็มจอของหน้าลองจอสถานี — เปิดเป็นหน้าต่างจอทัช 1024×768 / เต็มจอ */

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import type { Role } from "../_pieces";
import { Preview, ROLE_VALUES, VALUES, useProtoNav, type Variant } from "../_preview";

export default function StationViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "queue");
  const [role] = useProtoVariant<Role>("role", ROLE_VALUES, "worker");
  const [empty] = useProtoFlag("empty");
  const nav = useProtoNav();
  return (
    <main className="min-h-screen bg-bg px-4 py-4 text-strong sm:px-6">
      <Preview variant={variant} role={role} empty={empty} nav={nav} />
    </main>
  );
}
