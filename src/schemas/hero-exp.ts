import { z } from 'zod';

export const HeroExpEntrySchema = z.object({
  level: z.number().positive().int(),
  exp: z.number().nonnegative().int(),
});

export const HeroExpTableSchema = z.array(HeroExpEntrySchema);

export type HeroExpEntry = z.infer<typeof HeroExpEntrySchema>;
export type HeroExpTable = z.infer<typeof HeroExpTableSchema>;
