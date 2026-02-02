import { ResearchTreeSchema } from '../../schemas/research';

// Import all research category data
import allianceRecognitionRaw from '../research/alliance-recognition.json';
import unitSpecialTrainingRaw from '../research/unit-special-training.json';
import fullyArmedAllianceRaw from '../research/fully-armed-alliance.json';
import fieldRaw from '../research/field.json';
import heroTrainingRaw from '../research/hero-training.json';
import militaryStrategiesRaw from '../research/military-strategies.json';
import peaceShieldRaw from '../research/peace-shield.json';
import siegeToSeizeRaw from '../research/siege-to-seize.json';

// Validate all research trees at import time
export const allianceRecognition = ResearchTreeSchema.parse(allianceRecognitionRaw);
export const unitSpecialTraining = ResearchTreeSchema.parse(unitSpecialTrainingRaw);
export const fullyArmedAlliance = ResearchTreeSchema.parse(fullyArmedAllianceRaw);
export const field = ResearchTreeSchema.parse(fieldRaw);
export const heroTraining = ResearchTreeSchema.parse(heroTrainingRaw);
export const militaryStrategies = ResearchTreeSchema.parse(militaryStrategiesRaw);
export const peaceShield = ResearchTreeSchema.parse(peaceShieldRaw);
export const siegeToSeize = ResearchTreeSchema.parse(siegeToSeizeRaw);
