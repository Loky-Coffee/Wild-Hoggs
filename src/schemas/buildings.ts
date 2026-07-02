import { z } from 'zod';

export const BuildingCostSchema = z.object({
  level: z.number().positive().int(),
  wood: z.number().nonnegative().int(),
  food: z.number().nonnegative().int(),
  steel: z.number().nonnegative().int(),
  zent: z.number().nonnegative().int(),
  time: z.number().nonnegative().int(),
  requiredBuildings: z.string().optional(),
  requires: z.array(z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    level: z.number().int(),
  })).optional(),
  heroLevelCap: z.number().nonnegative().int().optional(),
  power: z.number().nonnegative().int().optional(),
});

export const SingleBuildingSchema = z.object({
  id: z.string(),
  nameKey: z.string(),
  gameNameKey: z.string().optional(),
  image: z.string().optional(),
  maxLevel: z.number().positive().int(),
  displayMaxLevel: z.number().positive().int().optional(),
  costs: z.array(BuildingCostSchema),
}).refine(
  (building) => building.costs.length === building.maxLevel,
  {
    message: "Building costs array length must equal maxLevel",
    path: ["costs"],
  }
);

export const BuildingSchema = z.array(SingleBuildingSchema);

export type BuildingCost = z.infer<typeof BuildingCostSchema>;
export type Building = z.infer<typeof SingleBuildingSchema>;
