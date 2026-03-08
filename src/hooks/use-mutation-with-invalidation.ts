type InvalidateTarget = {
  invalidate: (...args: any[]) => Promise<void>;
};

type AnyMutationProcedure = {
  useMutation: (opts?: any) => any;
};

interface MutationWithInvalidationOptions {
  invalidate: InvalidateTarget[];
  onSuccess?: (...args: any[]) => void;
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
    onSuccess: (...args: unknown[]) => {
      for (const target of invalidate) {
        target.invalidate();
      }
      onSuccess?.(...args);
    },
  });
}
