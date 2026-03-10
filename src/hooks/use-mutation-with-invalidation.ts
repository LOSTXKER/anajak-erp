type InvalidateTarget = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invalidate: (...args: any[]) => Promise<void>;
};

type AnyMutationProcedure = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useMutation: (opts?: Record<string, unknown>) => any;
};

interface MutationWithInvalidationOptions {
  invalidate: InvalidateTarget[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess?: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (...args: any[]) => void;
}

/**
 * Wraps a tRPC mutation procedure with automatic query invalidation on success.
 *
 * Invalidation targets are called without arguments, which invalidates all
 * cached entries for each query (the most common desired behavior).
 *
 * @example
 * const deleteMutation = useMutationWithInvalidation(
 *   trpc.customer.delete,
 *   {
 *     invalidate: [utils.customer.list, utils.customer.stats],
 *     onSuccess: () => setDialogOpen(false),
 *   }
 * );
 */
export function useMutationWithInvalidation<
  TProcedure extends AnyMutationProcedure,
>(
  procedure: TProcedure,
  options: MutationWithInvalidationOptions,
): ReturnType<TProcedure["useMutation"]> {
  const { invalidate, onSuccess, ...rest } = options;

  return procedure.useMutation({
    ...rest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (...args: any[]) => {
      for (const target of invalidate) {
        target.invalidate();
      }
      onSuccess?.(...args);
    },
  });
}
