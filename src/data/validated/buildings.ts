import { BuildingSchema } from '../../schemas/buildings';
import buildingsData from '../buildings.json';

// Validate buildings data at import time
export const validatedBuildings = BuildingSchema.parse(buildingsData);
