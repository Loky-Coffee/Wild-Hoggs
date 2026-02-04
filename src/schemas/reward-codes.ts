import { z } from 'zod';

export const ApiRewardCodeSchema = z.object({
  code: z.string().min(1),
  description: z.string().optional(),
  timestamp: z.number().optional()
});

export const ApiResponseSchema = z.object({
  codes: z.array(ApiRewardCodeSchema),
  fetchedAt: z.string(),
  source: z.string(),
  count: z.number()
});

export type ApiRewardCode = z.infer<typeof ApiRewardCodeSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
