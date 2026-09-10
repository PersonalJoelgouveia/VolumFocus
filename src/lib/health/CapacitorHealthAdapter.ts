/**
 * Adapter nativo via @capgo/capacitor-health (API unificada HealthKit/Health
 * Connect — dedup de fontes feito pela própria plataforma, sem plugins
 * separados por SO). Requer @capacitor/core + @capgo/capacitor-health
 * instalados e `npx cap sync` rodado no projeto real (fora do escopo do
 * que este chat consegue executar — só o código TS entra aqui).
 *
 * ATENÇÃO: a API pública documentada do plugin (isAvailable,
 * requestAuthorization, checkAuthorization, readSamples, saveSample,
 * queryWorkouts, queryAggregated) não expõe um "saveWorkout" dedicado —
 * writeWorkout aqui grava a sessão como amostra de calorias
 * (dataType 'calories') como aproximação. Antes de shippar,
 * confirmar na versão instalada se existe write de sessão de treino
 * completa (com tipo de exercício) ou se esse é de fato o caminho.
 */

import { Health } from '@capgo/capacitor-health';
import type { HealthDataType } from '@capgo/capacitor-health';
import type { DateRange, HealthAdapter, HealthScope, HrSample, StepSample, WorkoutSession } from './HealthAdapter';

const SCOPE_TO_DATATYPE: Record<HealthScope, HealthDataType> = {
  steps: 'steps',
  heartRate: 'heartRate',
  // 'workouts' não é um dataType de leitura — é tratado via queryWorkouts/saveSample à parte.
  workouts: 'calories',
};

export class CapacitorHealthAdapter implements HealthAdapter {
  readonly platform = 'capacitor';

  async isAvailable(): Promise<boolean> {
    try {
      const { available } = await Health.isAvailable();
      return available;
    } catch (e) {
      console.warn('CapacitorHealthAdapter: isAvailable falhou', e);
      return false;
    }
  }

  async requestPermissions(scopes: HealthScope[]): Promise<boolean> {
    try {
      const read = scopes.map((s) => SCOPE_TO_DATATYPE[s]);
      const result = await Health.requestAuthorization({ read, write: scopes.includes('workouts') ? ['calories'] : [] });
      // O plugin documenta que, no iOS, leitura nunca é reportada como
      // concedida por design (HealthKit esconde isso) — result aqui é
      // best-effort, não uma garantia binária confiável no iOS.
      return Boolean(result);
    } catch (e) {
      console.warn('CapacitorHealthAdapter: requestPermissions falhou', e);
      return false;
    }
  }

  async readSteps(range: DateRange): Promise<StepSample[]> {
    try {
      const { samples } = await Health.readSamples({
        dataType: 'steps',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      });
      return samples.map((s: { startDate: string; value: number }) => ({ date: s.startDate, steps: s.value }));
    } catch (e) {
      console.warn('CapacitorHealthAdapter: readSteps falhou', e);
      return [];
    }
  }

  async readHeartRate(range: DateRange): Promise<HrSample[]> {
    try {
      const { samples } = await Health.readSamples({
        dataType: 'heartRate',
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      });
      return samples.map((s: { startDate: string; value: number }) => ({ timestamp: s.startDate, bpm: s.value }));
    } catch (e) {
      console.warn('CapacitorHealthAdapter: readHeartRate falhou', e);
      return [];
    }
  }

  async writeWorkout(session: WorkoutSession): Promise<void> {
    if (!session.calories) return; // nada de útil pra escrever sem kcal calculado
    try {
      await Health.saveSample({
        dataType: 'calories',
        value: session.calories,
        startDate: session.start.toISOString(),
        endDate: session.end.toISOString(),
      });
    } catch (e) {
      console.warn('CapacitorHealthAdapter: writeWorkout falhou', e);
    }
  }
}
