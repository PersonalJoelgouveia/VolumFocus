import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DayIndex, ExDoneMap, WeekLog } from '../types/workout';
import { exDoneKey } from '../types/workout';
import type { SessaoStatus, SessaoTreino } from '../types/session';
import { useWorkoutStore } from './useWorkoutStore';
import { useExecStore } from './useExecStore';
import { useUIStore } from './useUIStore';
import { useSyncStore } from './useSyncStore';
import { getTodayDayIndex } from '../utils/dayIndex';

/** Limite de abas simultâneas — arquitetura escalável: só mudar este número. */
export const MAX_SESSOES = 3;

interface WorkoutSnapshot {
  weekLog: WeekLog;
  weekPSE: Record<number, number>;
  exDone: ExDoneMap;
  selectedDay: DayIndex;
}

function emptySnapshot(): WorkoutSnapshot {
  return { weekLog: {}, weekPSE: {}, exDone: {}, selectedDay: getTodayDayIndex() as DayIndex };
}

function liveSnapshot(): WorkoutSnapshot {
  const s = useWorkoutStore.getState();
  return { weekLog: s.weekLog, weekPSE: s.weekPSE, exDone: s.exDone, selectedDay: s.selectedDay };
}

interface SessionStoreState {
  /** Abas abertas — sucessora direta do pedido "Barra de Sessões" (não
   *  existe equivalente no index (3).html; feature nova). */
  sessions: SessaoTreino[];
  /** `null` = a aba focada é o "Meu Treino" do próprio Personal. */
  activeSessionId: string | null;
  /** Snapshot do weekLog do próprio Personal, capturado na 1ª troca pra
   *  uma aba — sem isso, "Meu Treino" não teria pra onde voltar. */
  ownSnapshot: WorkoutSnapshot | null;

  /** Abre uma sessão nova pro aluno e já foca nela. `false` se o limite
   *  de MAX_SESSOES já foi atingido. */
  abrirNovaSessao: (alunoId: string, alunoNome: string) => boolean;
  /** Fecha a aba (se estiver focada, volta pro "Meu Treino" antes). */
  fecharSessao: (id: string) => void;
  /** Troca a aba em foco — salva o estado de onde estava, carrega o da
   *  aba de destino dentro de useWorkoutStore (mesma store, sem
   *  duplicar CRUD de treino), e fecha o modal de execução se estiver
   *  aberto (não deixa referenciar dados da aba anterior). */
  alternarSessao: (targetId: string | null) => void;
  /** 🟢 ativo (é a aba focada) / 🟡 pausado (tem progresso hoje) /
   *  ⚪ não iniciado / ✓ concluído (todos os exercícios de hoje feitos). */
  getStatus: (id: string) => SessaoStatus;
}

export const useSessionStore = create<SessionStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      ownSnapshot: null,

      abrirNovaSessao: (alunoId, alunoNome) => {
        if (get().sessions.length >= MAX_SESSOES) return false;
        const nova: SessaoTreino = {
          id: `sess-${Date.now()}`,
          alunoId,
          alunoNome,
          criada: new Date().toISOString(),
          ...emptySnapshot(),
        };
        set((s) => ({ sessions: [...s.sessions, nova] }));
        get().alternarSessao(nova.id);
        return true;
      },

      fecharSessao: (id) => {
        if (get().activeSessionId === id) get().alternarSessao(null);
        set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) }));
      },

      alternarSessao: (targetId) => {
        const state = get();
        if (targetId === state.activeSessionId) return;

        // Pausa os watchers de auto-sync durante o swap — troca de aba não
        // pode marcar dirty nem subir dado de sessão pro backup pessoal.
        useSyncStore.getState().pauseWatchers();
        useExecStore.getState().close();

        const outgoing = liveSnapshot();
        if (state.activeSessionId === null) {
          set({ ownSnapshot: outgoing });
        } else {
          set((s) => ({
            sessions: s.sessions.map((sess) => (sess.id === state.activeSessionId ? { ...sess, ...outgoing } : sess)),
          }));
        }

        const incoming = targetId === null ? (get().ownSnapshot ?? emptySnapshot()) : get().sessions.find((s) => s.id === targetId);
        if (incoming) useWorkoutStore.setState(incoming);

        set({ activeSessionId: targetId });
        useUIStore.getState().setActiveView('registro');
        useSyncStore.getState().resumeWatchers();
      },

      getStatus: (id) => {
        const state = get();
        if (state.activeSessionId === id) return 'ativo';
        const sess = state.sessions.find((s) => s.id === id);
        if (!sess) return 'nao-iniciado';
        const todayLog = sess.weekLog[sess.selectedDay] ?? [];
        if (!todayLog.length) return 'nao-iniciado';
        const allDone = todayLog.every((_, idx) => !!sess.exDone[exDoneKey(sess.selectedDay, idx)]);
        return allDone ? 'concluido' : 'pausado';
      },
    }),
    {
      // Escopo deliberado: não entra no payload de backup na nuvem
      // (useSyncStore) — sessão em aba é dado presencial/transitório
      // deste dispositivo, não o treino pessoal do Personal.
      name: 'jg3_sessoes_treino',
    }
  )
);
