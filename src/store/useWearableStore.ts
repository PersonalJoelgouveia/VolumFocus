import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getWearableService } from '../lib/wearables';
import type {
  CalorieSample,
  DateRange,
  DistanceSample,
  HeartRateSample,
  PlatformId,
  StepSample,
  WearableScope,
  WearableWorkoutSession,
} from '../lib/wearables';

export type WearableSyncStatus = 'idle' | 'checking' | 'syncing' | 'ok' | 'error';

interface WearableState {
  platform: PlatformId;
  available: boolean;
  permissionsGranted: boolean;
  status: WearableSyncStatus;
  lastSyncAt: string | null;
  errorMessage: string | null;

  checkAvailability: () => Promise<void>;
  requestPermissions: (scopes: WearableScope[]) => Promise<boolean>;

  // Nenhuma amostra fica na store — cada fetch retorna direto pro
  // chamador, igual useHealthStore (decisão de privacidade ainda pendente
  // sobre persistir dado bruto de saúde).
  fetchHeartRate: (range: DateRange) => Promise<HeartRateSample[]>;
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
      errorMessage: null,

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

      fetchHeartRate: (range) => getWearableService().getProvider().getHeartRate(range),
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
      }),
    }
  )
);
