/**
 * Único arquivo desta etapa que fala com Health Connect de verdade — via
 * @capgo/capacitor-health (mesmo plugin já instalado na Etapa 1). Implementa
 * exatamente o contrato WearableProvider da Etapa 2; nada fora daqui (service,
 * store, telas) sabe que Health Connect existe.
 *
 * Escopo desta etapa: leitura (passos, distância, calorias ativas, FC, FC em
 * repouso, sessões) + disponibilidade + permissões granulares. writeSession
 * existe só por exigência da interface (não fazia parte do pedido) — grava
 * como amostra de calorias, mesma aproximação já documentada desde a Etapa 1.
 */

import { Health } from '@capgo/capacitor-health';
import type { HealthDataType, Workout } from '@capgo/capacitor-health';
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
import { warnDev } from './devLog';

const SCOPE_TO_DATATYPE: Record<WearableScope, HealthDataType> = {
  heartRate: 'heartRate',
  restingHeartRate: 'restingHeartRate',
  steps: 'steps',
  distance: 'distance',
  calories: 'calories',
  sessions: 'workouts',
};

export class HealthConnectProvider implements WearableProvider {
  readonly id = 'health-connect';
  readonly platform: PlatformId = 'android';

  /** Nunca lança — qualquer falha de disponibilidade vira "false", nunca
   *  exceção não tratada subindo pro chamador. */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await Health.isAvailable();
      return result.available;
    } catch (e) {
      warnDev('HealthConnectProvider: isAvailable falhou', e);
      return false;
    }
  }

  /** Permissão é pedida por tipo (granular) — o app nunca pede um bloco
   *  único "acesso a tudo". Retorna true se PELO MENOS UM escopo pedido foi
   *  concedido; a granularidade real (quais foram negados) é aplicada
   *  depois, individualmente, em cada leitura via isScopeAuthorized(). */
  async requestPermissions(scopes: WearableScope[]): Promise<boolean> {
    if (!(await this.isAvailable())) return false;
    try {
      const read = scopes.map((s) => SCOPE_TO_DATATYPE[s]);
      const status = await Health.requestAuthorization({ read, write: [] });
      return status.readAuthorized.length > 0;
    } catch (e) {
      warnDev('HealthConnectProvider: requestPermissions falhou', e);
      return false;
    }
  }

  async getHeartRate(range: DateRange): Promise<HeartRateSample[]> {
    const samples = await this.readIfAuthorized('heartRate', range);
    return samples.map((s) => ({ timestamp: s.startDate, bpm: s.value }));
  }

  async getRestingHeartRate(range: DateRange): Promise<HeartRateSample[]> {
    const samples = await this.readIfAuthorized('restingHeartRate', range);
    return samples.map((s) => ({ timestamp: s.startDate, bpm: s.value }));
  }

  async getSteps(range: DateRange): Promise<StepSample[]> {
    if (!(await this.isScopeAuthorized('steps'))) return [];
    try {
      const { samples } = await Health.queryAggregated({
        dataType: 'steps',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        bucket: 'day',
        aggregation: 'sum',
      });
      return samples.map((s) => ({ date: s.startDate.slice(0, 10), steps: s.value }));
    } catch (e) {
      warnDev('HealthConnectProvider: getSteps falhou', e);
      return [];
    }
  }

  async getDistance(range: DateRange): Promise<DistanceSample[]> {
    if (!(await this.isScopeAuthorized('distance'))) return [];
    try {
      const { samples } = await Health.queryAggregated({
        dataType: 'distance',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        bucket: 'day',
        aggregation: 'sum',
      });
      return samples.map((s) => ({ date: s.startDate.slice(0, 10), meters: s.value }));
    } catch (e) {
      warnDev('HealthConnectProvider: getDistance falhou', e);
      return [];
    }
  }

  /** "Calorias ativas" — dataType 'calories' do plugin (energia ativa, não
   *  basal/total). Agregado por dia, igual passos/distância. */
  async getCalories(range: DateRange): Promise<CalorieSample[]> {
    if (!(await this.isScopeAuthorized('calories'))) return [];
    try {
      const { samples } = await Health.queryAggregated({
        dataType: 'calories',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        bucket: 'day',
        aggregation: 'sum',
      });
      return samples.map((s) => ({ date: s.startDate.slice(0, 10), kcal: s.value }));
    } catch (e) {
      warnDev('HealthConnectProvider: getCalories falhou', e);
      return [];
    }
  }

  /** Sessões de exercício via queryWorkouts — não usa readSamples (workouts
   *  não é uma amostra pontual). FC média por sessão não é exposta pelo tipo
   *  Workout do plugin — fica de fora aqui, sinalizado como limitação. */
  async getSessions(range: DateRange): Promise<WearableWorkoutSession[]> {
    if (!(await this.isScopeAuthorized('sessions'))) return [];
    try {
      const { workouts } = await Health.queryWorkouts({
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      });
      return workouts.map((w: Workout) => ({
        id: w.platformId ?? `${w.startDate}-${w.endDate}`,
        start: new Date(w.startDate),
        end: new Date(w.endDate),
        activityType: w.workoutType,
        calories: w.totalEnergyBurned,
      }));
    } catch (e) {
      warnDev('HealthConnectProvider: getSessions falhou', e);
      return [];
    }
  }

  async writeSession(session: WearableWorkoutSession): Promise<void> {
    if (!session.calories) return;
    if (!(await this.isScopeAuthorized('sessions'))) return;
    try {
      await Health.saveSample({
        dataType: 'calories',
        value: session.calories,
        startDate: session.start.toISOString(),
        endDate: session.end.toISOString(),
      });
    } catch (e) {
      warnDev('HealthConnectProvider: writeSession falhou', e);
    }
  }

  /** Guarda comum a heartRate/restingHeartRate: verifica permissão antes de
   *  ler, nunca lança em ausência de permissão ou ausência de dado. */
  private async readIfAuthorized(scope: WearableScope, range: DateRange) {
    if (!(await this.isScopeAuthorized(scope))) return [];
    try {
      const { samples } = await Health.readSamples({
        dataType: SCOPE_TO_DATATYPE[scope],
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      });
      return samples;
    } catch (e) {
      warnDev(`HealthConnectProvider: readSamples(${scope}) falhou`, e);
      return [];
    }
  }

  /** Checa autorização SEM disparar o prompt do sistema (checkAuthorization),
   *  pra cada tipo individualmente — é aqui que a granularidade real da
   *  permissão (aceita pra passos, negada pra FC, por exemplo) é respeitada:
   *  um escopo negado retorna lista vazia em vez de estourar erro nativo. */
  private async isScopeAuthorized(scope: WearableScope): Promise<boolean> {
    try {
      const dataType = SCOPE_TO_DATATYPE[scope];
      const status = await Health.checkAuthorization({ read: [dataType] });
      return status.readAuthorized.includes(dataType);
    } catch (e) {
      warnDev(`HealthConnectProvider: checkAuthorization(${scope}) falhou`, e);
      return false;
    }
  }
}
