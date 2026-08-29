import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth } from '../lib/firebase';
import { collectBackupPayload, fetchBackup, hydrateFromBackup, uploadBackup } from '../lib/backupRepository';
import { useUIStore } from './useUIStore';
import { useWorkoutStore } from './useWorkoutStore';
import { useExerciseStore } from './useExerciseStore';
import { useCalorieStore } from './useCalorieStore';
import { useProgressStore } from './useProgressStore';
import { useAlunoStore } from './useAlunoStore';
import { useHistoricoStore } from './useHistoricoStore';
import { useRotinaStore } from './useRotinaStore';
import { useStrengthStore } from './useStrengthStore';
import { useAchievementStore } from './useAchievementStore';
import { useCardioTestStore } from './useCardioTestStore';
import { useCardioGoalStore } from './useCardioGoalStore';

export type SyncDotStatus = 'idle' | 'waiting' | 'syncing' | 'ok' | 'error';

interface SyncState {
  status: SyncDotStatus;
  /** Sinalizador persistente (sobrevive a F5) de "existe edição local que
   *  ainda não foi confirmada na nuvem" — sucessor direto de LS_DIRTY /
   *  jg3_dirty (index.html ~7281-7293). Existe pra impedir que um pull
   *  sobrescreva dados locais que nunca chegaram a subir. */
  dirty: boolean;
  lastSyncAt: string | null;
  errorMessage: string | null;

  /** Liga os "watchers" nas stores locais uma única vez — qualquer
   *  mudança depois disso marca dirty + agenda auto-sync. Chamado uma
   *  vez no topo do app (AppShell), depois do primeiro render — assim a
   *  hidratação inicial de cada store (que dispara o subscribe também)
   *  nunca é confundida com uma edição real do usuário. */
  init: () => void;

  markDirty: () => void;
  /** Sucessor de scheduleAutoSync() (index.html ~7707-7719): debounce de
   *  alguns segundos, depois envia se houver sessão ativa. */
  scheduleAutoSync: () => void;

  pushNow: () => Promise<boolean>;
  pullNow: () => Promise<boolean>;
  /** Botão explícito "Salvar na Nuvem" — sempre envia, mesmo sem estar dirty. */
  saveNow: () => Promise<void>;
  /** Chamado logo após um login bem-sucedido — sucessor da decisão
   *  push-ou-pull de _requestSignIn() (index.html ~7336-7349): dirty
   *  sobe, senão baixa o que já estiver salvo na nuvem. */
  syncAfterLogin: () => Promise<void>;
  /** Clique no dot de sync quando em erro/aguardando — sucessor de reconnect(). */
  reconnect: () => Promise<void>;
}

const AUTO_SYNC_DEBOUNCE_MS = 4000;
let debounceHandle: ReturnType<typeof setTimeout> | null = null;
let watchersAttached = false;

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      dirty: false,
      lastSyncAt: null,
      errorMessage: null,

      init: () => {
        if (watchersAttached) return;
        watchersAttached = true;
        const stores = [
          useWorkoutStore,
          useExerciseStore,
          useCalorieStore,
          useProgressStore,
          useAlunoStore,
          useHistoricoStore,
          useRotinaStore,
          useStrengthStore,
          useAchievementStore,
          useCardioTestStore,
          useCardioGoalStore,
        ];
        stores.forEach((store) => {
          store.subscribe(() => get().scheduleAutoSync());
        });
        if (auth.currentUser) set({ status: 'waiting' });
      },

      markDirty: () => set({ dirty: true }),

      scheduleAutoSync: () => {
        get().markDirty();
        if (!auth.currentUser) return;
        if (debounceHandle) clearTimeout(debounceHandle);
        debounceHandle = setTimeout(() => {
          debounceHandle = null;
          get().pushNow();
        }, AUTO_SYNC_DEBOUNCE_MS);
      },

      pushNow: async () => {
        const email = auth.currentUser?.email;
        if (!email) return false;
        set({ status: 'syncing', errorMessage: null });
        const payload = collectBackupPayload();
        const ok = await uploadBackup(email, payload);
        if (ok) {
          set({ status: 'ok', dirty: false, lastSyncAt: new Date().toISOString() });
        } else {
          set({ status: 'error', errorMessage: 'Falha ao salvar na nuvem.' });
        }
        return ok;
      },

      pullNow: async () => {
        const email = auth.currentUser?.email;
        if (!email) return false;
        set({ status: 'syncing', errorMessage: null });
        try {
          const payload = await fetchBackup(email);
          if (payload) hydrateFromBackup(payload);
          set({ status: 'ok', dirty: false, lastSyncAt: new Date().toISOString() });
          return true;
        } catch (e) {
          console.error('useSyncStore: falha ao restaurar backup', e);
          set({ status: 'error', errorMessage: 'Falha ao restaurar da nuvem.' });
          return false;
        }
      },

      saveNow: async () => {
        const ok = await get().pushNow();
        useUIStore.getState().showToast(ok ? '☁️ Salvo na nuvem!' : '⚠️ Não foi possível salvar na nuvem.', ok ? 'success' : 'error');
      },

      syncAfterLogin: async () => {
        if (get().dirty) {
          const ok = await get().pushNow();
          if (ok) useUIStore.getState().showToast('☁️ Suas alterações locais foram enviadas ao conectar.', 'success');
        } else {
          await get().pullNow();
        }
      },

      reconnect: async () => {
        if (!auth.currentUser) return;
        await get().syncAfterLogin();
      },
    }),
    {
      name: 'jg3_dirty',
      partialize: (state) => ({ dirty: state.dirty }),
    }
  )
);
