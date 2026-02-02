import { z } from 'zod';

// Hero exp table is simply an array of exp values, where index = level
export const HeroExpTableSchema = z.array(z.number().nonnegative().int());

export type HeroExpTable = z.infer<typeof HeroExpTableSchema>;
