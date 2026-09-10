/**
 * Adapter usado enquanto o app roda como PWA puro (sem Capacitor instalado
 * ainda, ou rodando no navegador mesmo depois de instalado). Nunca lança —
 * qualquer chamada aqui é tratada como "recurso indisponível neste
 * dispositivo", no mesmo espírito do UNAVAILABLE_MSG do PersonalVideoRecorder.
 */

import type { DateRange, HealthAdapter, HealthScope, HrSample, StepSample, WorkoutSession } from './HealthAdapter';

export class WebNoopAdapter implements HealthAdapter {
  readonly platform = 'web-noop';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async requestPermissions(_scopes: HealthScope[]): Promise<boolean> {
    return false;
  }

  async readSteps(_range: DateRange): Promise<StepSample[]> {
    return [];
  }

  async readHeartRate(_range: DateRange): Promise<HrSample[]> {
    return [];
  }

  async writeWorkout(_session: WorkoutSession): Promise<void> {
    // Sem plataforma nativa disponível — no-op silencioso, o chamador decide
    // se avisa o usuário (ver useHealthStore).
  }
}
