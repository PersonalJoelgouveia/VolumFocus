import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RotinaSyncState {
  /** Versão (`multi:{id}@{atualizadaEm}`, ou `atualizadoEm` ISO no legado) da última rotina que já foi
   *  importada (ou dispensada) pra Semana Atual neste dispositivo. Evita
   *  reimportar/reperguntar a mesma versão a cada carregamento. */
  lastSeenAt: string | null;
  setLastSeenAt: (iso: string) => void;
  /** Impressão digital da prescrição da semana logo após a última importação
   *  (utils/rotinaSync.fingerprintSemana). Se a semana ainda bate com ela e não há
   *  progresso, o aluno não mexeu → a próxima rotina ativa pode substituir sem perguntar. */
  lastImportedFingerprint: string | null;
  setLastImportedFingerprint: (fp: string | null) => void;
}

export const useRotinaSyncStore = create<RotinaSyncState>()(
  persist(
    (set) => ({
      lastSeenAt: null,
      setLastSeenAt: (iso) => set({ lastSeenAt: iso }),
      lastImportedFingerprint: null,
      setLastImportedFingerprint: (fp) => set({ lastImportedFingerprint: fp }),
    }),
    { name: 'jg3_rotina_sync' }
  )
);
