/**
 * Contrato que qualquer fonte de dado de wearable deve implementar.
 * Nesta etapa só existe UM implementador real: WebFallbackProvider.
 * Providers nativos (Health Connect / HealthKit) entram numa etapa
 * futura, implementando exatamente esta mesma interface — o resto do
 * app (WearableService, useWearableStore, telas) não muda nada.
 */

import type {
  CalorieSample,
  DateRange,
  DistanceSample,
  HeartRateSample,
  PlatformId,
  StepSample,
  WearableScope,
  WearableWorkoutSession,
} from './models';

export interface WearableProvider {
  /** Identifica o provider só pra debug/telemetria (ex: 'web-fallback'). */
  readonly id: string;
  readonly platform: PlatformId;

  isAvailable(): Promise<boolean>;
  requestPermissions(scopes: WearableScope[]): Promise<boolean>;

  getHeartRate(range: DateRange): Promise<HeartRateSample[]>;
  /** FC em repouso — mesmo formato de HeartRateSample, escopo de permissão separado. */
  getRestingHeartRate(range: DateRange): Promise<HeartRateSample[]>;
  getSteps(range: DateRange): Promise<StepSample[]>;
  getDistance(range: DateRange): Promise<DistanceSample[]>;
  getCalories(range: DateRange): Promise<CalorieSample[]>;
  getSessions(range: DateRange): Promise<WearableWorkoutSession[]>;

  /** Escreve uma sessão já registrada no app na plataforma nativa.
   *  No WebFallbackProvider é sempre um no-op. */
  writeSession(session: WearableWorkoutSession): Promise<void>;
}
