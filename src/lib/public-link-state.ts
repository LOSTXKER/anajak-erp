export type PublicQueryError = { data?: { code?: string } | null };

/** Permission/token failures must hide cached private data immediately. */
export function isPublicLinkUnavailable(error: PublicQueryError | null | undefined) {
  return !!error && ["NOT_FOUND", "BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "PRECONDITION_FAILED"].includes(error.data?.code ?? "");
}

export function retryPublicQuery(failureCount: number, error: PublicQueryError) {
  return failureCount < 2 && !isPublicLinkUnavailable(error);
}
