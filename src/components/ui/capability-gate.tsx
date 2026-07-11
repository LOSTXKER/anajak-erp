import type { ReactNode } from "react";
import { permAllows, type Permission } from "@/lib/permissions";

export interface CapabilityGateProps {
  permissions: readonly string[] | null | undefined;
  required: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function CapabilityGate({
  permissions,
  required,
  children,
  fallback = null,
}: CapabilityGateProps) {
  return permAllows(permissions, required) ? children : fallback;
}
