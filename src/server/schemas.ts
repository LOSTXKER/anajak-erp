import { z } from "zod";

export const byIdInput = z.object({ id: z.string() });

export const paginationInput = z.object({
  page: z.number().default(1),
  limit: z.number().default(20),
});

export const searchInput = z.object({
  search: z.string().optional(),
});

export const paginatedSearchInput = paginationInput.merge(searchInput);
