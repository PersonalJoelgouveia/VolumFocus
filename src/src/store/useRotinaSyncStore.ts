import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RotinaSyncState {
  /** `atualizadoEm` (ISO) da última rotina publicada que já foi
   *  importada (ou dispensada) pra Semana Atual neste dispositivo. Evita
   *  reimportar/reperguntar a mesma versão a cada carregamento. */
  lastSeenAt: string | null;
  setLastSeenAt: (iso: string) => void;
}

export const useRotinaSyncStore = create<RotinaSyncState>()(
  persist(
    (set) => ({
      lastSeenAt: null,
      setLastSeenAt: (iso) => set({ lastSeenAt: iso }),
    }),
    { name: 'jg3_rotina_sync' }
  )
);
