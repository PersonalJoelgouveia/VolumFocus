/**
 * Modelos normalizados do domínio "Wearable" — formato único que o app
 * consome, seja qual for a fonte real do dado (Health Connect, HealthKit,
 * ou nenhuma, na Web). Nenhum tipo aqui referencia SDK nativo nenhum.
 */

export type PlatformId = 'android' | 'ios' | 'web';

export type WearableScope = 'heartRate' | 'steps' | 'distance' | 'calories' | 'sessions';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface HeartRateSample {
  timestamp: string;
  bpm: number;
}

export interface StepSample {
  date: string;
  steps: number;
}

export interface DistanceSample {
  date: string;
  meters: number;
}

export interface CalorieSample {
  date: string;
  kcal: number;
}

/** Sessão de treino normalizada — de/para o app, nunca o formato nativo
 *  (HKWorkout / ExerciseSessionRecord ficam só dentro do provider real,
 *  numa etapa futura). */
export interface WearableWorkoutSession {
  id: string;
  start: Date;
  end: Date;
  /** Tipo livre por enquanto (ex: 'strength', 'cardio') — mapeamento pro
   *  enum de atividade de cada plataforma nativa é responsabilidade do
   *  provider concreto, não deste modelo. */
  activityType: string;
  calories?: number;
  avgHeartRate?: number;
}
