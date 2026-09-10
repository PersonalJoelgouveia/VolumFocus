export type {
  PlatformId,
  WearableScope,
  DateRange,
  HeartRateSample,
  StepSample,
  DistanceSample,
  CalorieSample,
  WearableWorkoutSession,
} from './models';
export type { WearableProvider } from './WearableProvider';
export { WebFallbackProvider } from './WebFallbackProvider';
export { detectPlatform } from './platform';
export { WearableService, getWearableService, resetWearableService } from './WearableService';
