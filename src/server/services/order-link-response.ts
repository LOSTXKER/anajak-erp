const ORDER_LINK_FIELDS = [
  "statusToken",
  "statusTokenExpiresAt",
  "uploadToken",
  "uploadTokenExpiresAt",
] as const;

/** Customer links are read through their permission-gated endpoints only. */
export function withoutOrderLinkTokens<T extends object>(
  order: T,
): Omit<T, typeof ORDER_LINK_FIELDS[number]> {
  const response = { ...order };
  for (const field of ORDER_LINK_FIELDS) Reflect.deleteProperty(response, field);
  return response;
}
