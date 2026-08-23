/**
 * Temporary rollout seam for the manufacturing V2 surfaces.
 *
 * The flag is intentionally server-readable and opt-in. Routes choose the old
 * or new component, so both implementations never render or write together.
 * Remove this file together with the legacy UI after the accepted rollback
 * window.
 */
export function productionV2Enabled(
  value: string | undefined = process.env.PRODUCTION_V2_ENABLED,
): boolean {
  return value === "1" || value === "true";
}
