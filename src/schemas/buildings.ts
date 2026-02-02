import { z } from 'zod';

export const BuildingCostSchema = z.object({
  level: z.number().positive().int(),
  wood: z.number().nonnegative().int(),
  food: z.number().nonnegative().int(),
  steel: z.number().nonnegative().int(),
  zinc: z.number().nonnegative().int(),
  time: z.number().nonnegative().int(),
  requiredBuildings: z.string().optional(),
  heroLevelCap: z.number().positive().int().optional(),
  power: z.number().nonnegative().int().optional(),
});

export const BuildingSchema = z.object({
  id: z.string(),
  name: z.object({
    de: z.string(),
    en: z.string(),
  }),
  maxLevel: z.number().positive().int(),
  costs: z.array(BuildingCostSchema),
});

export type BuildingCost = z.infer<typeof BuildingCostSchema>;
export type Building = z.infer<typeof BuildingSchema>;
