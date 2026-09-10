/**
 * Contrato de domínio para integração com Apple HealthKit / Android Health
 * Connect. Nenhuma implementação aqui — só a interface e os tipos que o
 * resto do app (useHealthStore, futuras views) enxerga, independente de
 * qual plataforma está por trás (nativo via Capacitor ou nenhuma, na web).
 *
 * Import de tipos existentes: writeWorkout reaproveita WorkoutLogEntry
 * (types/workout.ts) em vez de inventar um formato de treino paralelo —
 * o mapeamento pra HKWorkout/ExerciseSessionRecord fica dentro de cada
 * adapter concreto, não aqui.
 */

import type { WorkoutLogEntry } from '../../types/workout';

export type HealthScope = 'steps' | 'heartRate' | 'workouts';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface StepSample {
  date: string;
  steps: number;
}

export interface HrSample {
  timestamp: string;
  bpm: number;
}

/** Um treino já registrado no app (força ou cardio), pronto pra ser escrito
 *  na plataforma de saúde nativa — não persiste nada aqui, só descreve o
 *  payload de escrita. */
export interface WorkoutSession {
  start: Date;
  end: Date;
  /** Entradas do dia (StrengthLogEntry | CardioLogEntry) que compõem a sessão. */
  entries: WorkoutLogEntry[];
  /** kcal já calculado pelo app (useCalorieStore/MET), reaproveitado em vez
   *  de recalcular dentro do adapter. */
  calories?: number;
}

export interface HealthAdapter {
  /** Nome do adapter ativo, útil só pra debug/telemetria (ex: 'capacitor-ios'). */
  readonly platform: string;
  /** Se a integração nativa existe neste ambiente (false em qualquer navegador comum). */
  isAvailable(): Promise<boolean>;
  requestPermissions(scopes: HealthScope[]): Promise<boolean>;
  readSteps(range: DateRange): Promise<StepSample[]>;
  readHeartRate(range: DateRange): Promise<HrSample[]>;
  writeWorkout(session: WorkoutSession): Promise<void>;
}
