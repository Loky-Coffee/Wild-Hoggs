import { HeroExpTableSchema } from '../../schemas/hero-exp';
import heroExpData from '../hero-exp-table.json';

// Validate hero exp table at import time
export const validatedHeroExpTable = HeroExpTableSchema.parse(heroExpData);
