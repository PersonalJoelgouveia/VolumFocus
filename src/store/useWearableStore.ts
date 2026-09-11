import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getWearableService } from '../lib/wearables';
import type {
  CalorieSample,
  DateRange,
  DistanceSample,
  HeartRateSample,
  PlatformId,
  ScopeSyncOutcome,
  StepSample,
  SyncResult,
  WearableScope,
  WearableSyncRecord,
  WearableWorkoutSession,
} from '../lib/wearables';

export type WearableSyncStatus = 'idle' | 'checking' | 'syncing' | 'ok' | 'partial' | 'error' | 'offline';

interface WearableState {
  platform: PlatformId;
  available: boolean;
  permissionsGranted: boolean;
  status: WearableSyncStatus;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  pendingRetryCount: number;
  errorMessage: string | null;
  lastOutcomes: ScopeSyncOutcome[];

  checkAvailability: () => Promise<void>;
  requestPermissions: (scopes: WearableScope[]) => Promise<boolean>;

  /** Sincronização incremental completa (Etapa 6) — baixa só o que
   *  mudou desde o último sucesso, dedup por id determinístico,
   *  idempotente e offline-first. Nunca lança. */
  syncNow: (scopes?: WearableScope[]) => Promise<SyncResult>;
  /** Retenta escopos que ficaram pendentes de uma sincronização anterior
   *  (offline, erro transitório). Chamado automaticamente ao reconectar. */
  retryPending: () => Promise<void>;
  /** Histórico já sincronizado, lido do armazenamento local — nunca do
   *  Firebase, nunca da rede. */
  getLocalHistory: (scope: WearableScope, range: DateRange) => Promise<WearableSyncRecord[]>;

  // Leitura pontual direto do provider (comportamento pré-Etapa 6,
  // preservado): cada fetch retorna direto pro chamador, sem persistir.
  fetchHeartRate: (range: DateRange) => Promise<HeartRateSample[]>;
  fetchRestingHeartRate: (range: DateRange) => Promise<HeartRateSample[]>;
  fetchSteps: (range: DateRange) => Promise<StepSample[]>;
  fetchDistance: (range: DateRange) => Promise<DistanceSample[]>;
  fetchCalories: (range: DateRange) => Promise<CalorieSample[]>;
  fetchSessions: (range: DateRange) => Promise<WearableWorkoutSession[]>;
}

export const useWearableStore = create<WearableState>()(
  persist(
    (set, get) => ({
      platform: getWearableService().getPlatform(),
      available: false,
      permissionsGranted: false,
      status: 'idle',
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      pendingRetryCount: 0,
      errorMessage: null,
      lastOutcomes: [],

      checkAvailability: async () => {
        set({ status: 'checking', errorMessage: null });
        try {
          const available = await getWearableService().getProvider().isAvailable();
          set({ available, status: 'ok' });
        } catch (e) {
          set({ status: 'error', errorMessage: e instanceof Error ? e.message : String(e) });
        }
      },

      requestPermissions: async (scopes) => {
        set({ status: 'syncing', errorMessage: null });
        try {
          const granted = await getWearableService().getProvider().requestPermissions(scopes);
          set({
            permissionsGranted: granted,
            status: 'ok',
            lastSyncAt: granted ? new Date().toISOString() : get().lastSyncAt,
          });
          return granted;
        } catch (e) {
          set({ status: 'error', errorMessage: e instanceof Error ? e.message : String(e) });
          return false;
        }
      },

      syncNow: async (scopes) => {
        set({ status: 'syncing', errorMessage: null });
        const result = await getWearableService().sync(scopes);
        const firstError = result.outcomes.find((o) => o.status === 'error')?.error ?? null;
        set({
          status: result.status,
          lastSyncAt: result.finishedAt,
          lastSuccessfulSyncAt: result.status === 'error' ? get().lastSuccessfulSyncAt : result.finishedAt,
          pendingRetryCount: result.pendingRetryCount,
          errorMessage: firstError,
          lastOutcomes: result.outcomes,
        });
        return result;
      },

      retryPending: async () => {
        await getWearableService().processRetryQueue();
        const pendingRetryCount = await getWearableService().getPendingRetryCount();
        set({ pendingRetryCount });
      },

      getLocalHistory: (scope, range) => getWearableService().getLocalHistory(scope, range),

      fetchHeartRate: (range) => getWearableService().getProvider().getHeartRate(range),
      fetchRestingHeartRate: (range) => getWearableService().getProvider().getRestingHeartRate(range),
      fetchSteps: (range) => getWearableService().getProvider().getSteps(range),
      fetchDistance: (range) => getWearableService().getProvider().getDistance(range),
      fetchCalories: (range) => getWearableService().getProvider().getCalories(range),
      fetchSessions: (range) => getWearableService().getProvider().getSessions(range),
    }),
    {
      name: 'jg3_wearable_status',
      partialize: (state) => ({
        available: state.available,
        permissionsGranted: state.permissionsGranted,
        lastSyncAt: state.lastSyncAt,
        lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
      }),
    }
  )
);

// Reconectou → drena a fila de retry sozinho, sem o usuário precisar
// reabrir a tela de Saúde. Registrado uma única vez por sessão do app;
// em ambiente sem `window` (SSR/teste) isso é um no-op seguro.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useWearableStore.getState().retryPending();
  });
}
