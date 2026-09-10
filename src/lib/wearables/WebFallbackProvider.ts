/**
 * Único provider concreto desta etapa. Usado tanto na Web (sempre) quanto
 * em Android/iOS enquanto os providers nativos reais não existirem
 * (etapa futura) — garante que o app nunca trava por falta de integração
 * nativa, no mesmo espírito do UNAVAILABLE_MSG do PersonalVideoRecorder.
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
import type { WearableProvider } from './WearableProvider';

export class WebFallbackProvider implements WearableProvider {
  readonly id = 'web-fallback';
  readonly platform: PlatformId;

  constructor(platform: PlatformId = 'web') {
    this.platform = platform;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async requestPermissions(_scopes: WearableScope[]): Promise<boolean> {
    return false;
  }

  async getHeartRate(_range: DateRange): Promise<HeartRateSample[]> {
    return [];
  }

  async getRestingHeartRate(_range: DateRange): Promise<HeartRateSample[]> {
    return [];
  }

  async getSteps(_range: DateRange): Promise<StepSample[]> {
    return [];
  }

  async getDistance(_range: DateRange): Promise<DistanceSample[]> {
    return [];
  }

  async getCalories(_range: DateRange): Promise<CalorieSample[]> {
    return [];
  }

  async getSessions(_range: DateRange): Promise<WearableWorkoutSession[]> {
    return [];
  }

  async writeSession(_session: WearableWorkoutSession): Promise<void> {
    // Sem plataforma nativa disponível — no-op silencioso.
  }
}
