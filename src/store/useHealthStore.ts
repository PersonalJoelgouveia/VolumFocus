import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getHealthAdapter } from '../lib/health';
import type { HealthScope, HrSample, StepSample } from '../lib/health';

interface HealthState {
  /** Só cacheia status/flags — nunca a amostra de saúde em si. Decisão
   *  pendente de você (ver Riscos & Considerações do diagnóstico): dado
   *  de saúde bruto (passos/FC) deve ficar só em memória por sessão,
   *  igual ao vídeo pessoal (nunca sobe pro backup do Firestore), até
   *  definirmos política de privacidade/retenção explícita. */
  available: boolean;
  permissionsGranted: boolean;
  lastSyncAt: string | null;

  checkAvailability: () => Promise<void>;
  requestPermissions: (scopes: HealthScope[]) => Promise<boolean>;
  /** Não persistido — só em memória durante a sessão atual. */
  fetchSteps: (start: Date, end: Date) => Promise<StepSample[]>;
  fetchHeartRate: (start: Date, end: Date) => Promise<HrSample[]>;
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set) => ({
      available: false,
      permissionsGranted: false,
      lastSyncAt: null,

      checkAvailability: async () => {
        const adapter = getHealthAdapter();
        const available = await adapter.isAvailable();
        set({ available });
      },

      requestPermissions: async (scopes) => {
        const adapter = getHealthAdapter();
        const granted = await adapter.requestPermissions(scopes);
        set({ permissionsGranted: granted, lastSyncAt: granted ? new Date().toISOString() : null });
        return granted;
      },

      fetchSteps: async (start, end) => {
        const adapter = getHealthAdapter();
        return adapter.readSteps({ start, end });
      },

      fetchHeartRate: async (start, end) => {
        const adapter = getHealthAdapter();
        return adapter.readHeartRate({ start, end });
      },
    }),
    {
      // Só os 3 flags leves acima — nunca incluir esta store em
      // backupRepository.ts sem decisão explícita sobre dado de saúde na nuvem.
      name: 'jg3_health_status',
      partialize: (state) => ({
        available: state.available,
        permissionsGranted: state.permissionsGranted,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);
