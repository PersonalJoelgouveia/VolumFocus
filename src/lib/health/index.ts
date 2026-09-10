import { Capacitor } from '@capacitor/core';
import type { HealthAdapter } from './HealthAdapter';
import { WebNoopAdapter } from './WebNoopAdapter';
import { CapacitorHealthAdapter } from './CapacitorHealthAdapter';

export type { HealthAdapter, HealthScope, DateRange, StepSample, HrSample, WorkoutSession } from './HealthAdapter';

let cached: HealthAdapter | null = null;

/** Escolhido uma vez por sessão do app — Capacitor.isNativePlatform() é
 *  estável durante o runtime (não muda de web pra nativo em hot reload real). */
export function getHealthAdapter(): HealthAdapter {
  if (!cached) {
    cached = Capacitor.isNativePlatform() ? new CapacitorHealthAdapter() : new WebNoopAdapter();
  }
  return cached;
}
