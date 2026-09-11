/**
 * Modelos normalizados do domínio "Wearable" — formato único que o app
 * consome, seja qual for a fonte real do dado (Health Connect, HealthKit,
 * ou nenhuma, na Web). Nenhum tipo aqui referencia SDK nativo nenhum.
 */

export type PlatformId = 'android' | 'ios' | 'web';

export type WearableScope = 'heartRate' | 'restingHeartRate' | 'steps' | 'distance' | 'calories' | 'sessions';

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

/* ---------------------------------------------------------------------
 * Etapa 6 — Sincronização incremental, dedup e fila offline.
 * Nada aqui referencia SDK nativo nem Firebase — só o vocabulário do
 * domínio de sincronização em si.
 * ------------------------------------------------------------------- */

/** Cursor de sincronização por escopo. `lastSyncAt` marca a última
 *  TENTATIVA (sucesso ou falha); `lastSuccessfulSyncAt` só avança quando o
 *  escopo inteiro sincroniza sem erro — é a base do range incremental do
 *  próximo sync (nunca reprocessa o que já foi confirmado). */
export interface SyncCursor {
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
}

/** Registro normalizado persistido localmente — uma amostra/sessão já
 *  deduplicada. `id` é determinístico (Hash(provider + type + timestamp)),
 *  então reprocessar a mesma amostra em syncs diferentes produz o mesmo
 *  `id` e o mesmo `payload`: put() idempotente, nunca duplica. */
export interface WearableSyncRecord<T = unknown> {
  id: string;
  provider: string;
  type: WearableScope;
  /** Timestamp natural do dado (instante exato pra FC/sessão, dia pra
   *  agregados diários de passos/distância/calorias). */
  timestamp: string;
  /** Quando este registro foi gravado localmente (auditoria/depuração). */
  syncedAt: string;
  payload: T;
}

/** Item da fila de retry — um escopo que falhou num sync e precisa ser
 *  retentado (offline, erro de permissão revogada, erro de rede etc.). */
export interface SyncRetryEntry {
  id: string;
  scope: WearableScope;
  range: { start: string; end: string };
  attempts: number;
  lastError: string;
  enqueuedAt: string;
}

export type ScopeSyncStatus = 'ok' | 'error' | 'skipped-offline' | 'skipped-unsupported';

export interface ScopeSyncOutcome {
  scope: WearableScope;
  status: ScopeSyncStatus;
  recordsWritten: number;
  error?: string;
}

export interface SyncResult {
  status: 'ok' | 'partial' | 'error' | 'offline';
  outcomes: ScopeSyncOutcome[];
  startedAt: string;
  finishedAt: string;
  pendingRetryCount: number;
}
