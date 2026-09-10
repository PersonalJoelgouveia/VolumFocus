import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoricoSemana } from '../types/history';
import type { FireState, RecordBadgeId, RecordEntry, StreakId, StreakState } from '../types/achievement';
import { FIRE_MILESTONES, RECORD_BADGES, STREAKS, TITA_TARGET_NAMES, getRank } from '../data/achievements';
import { useUIStore } from './useUIStore';

interface AchievementState {
  /** Sucessor consolidado de jg3_progressao_streak/jg3_streak_consistencia/
   *  jg3_streak_volume/jg3_streak_cardio (4 chaves separadas no original) —
   *  mesmo caso já feito em useWorkoutStore (weekLog/pse/nivel/exDone
   *  também eram 4 chaves, viraram 1 store). Mesma semântica, storage
   *  mais simples. */
  streaks: Record<StreakId, StreakState>;
  /** Sucessor direto de jg3_ach_records (já era um objeto único no original). */
  records: Partial<Record<RecordBadgeId, RecordEntry>>;
  /** Sucessor direto de jg3_dias_on_fire. */
  fire: FireState;

  /** Chamado ao arquivar a semana (NovaSemanaView) — avalia as 4 insígnias
   *  contra a semana anterior do histórico. Equivale a ach.checkStreaks(). */
  checkStreaks: (currentSnap: HistoricoSemana, prevSnap: HistoricoSemana | null) => void;

  tryRecord: (id: RecordBadgeId, value: number, label: string) => boolean;
  /** Equivale a ach.checkTita(entry) — carga máxima em Supino/Terra/Agachamento. */
  checkTita: (exerciseName: string, maxLoad: number) => boolean;
  /** Equivale a ach.checkFornalha(elapsedSec) — maior gasto calórico numa sessão. */
  checkFornalha: (kcal: number, elapsedSec: number) => boolean;

  /** Equivale a fire.checkIn() — registra atividade de hoje na ofensiva diária. */
  fireCheckIn: () => void;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

const initialStreaks: Record<StreakId, StreakState> = {
  tonnage: { current: 0, best: 0 },
  consistencia: { current: 0, best: 0 },
  volume: { current: 0, best: 0 },
  cardio: { current: 0, best: 0 },
};

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      streaks: initialStreaks,
      records: {},
      fire: { current: 0, best: 0, lastDate: null },

      checkStreaks: (currentSnap, prevSnap) => {
        const streaks = { ...get().streaks };
        STREAKS.forEach((s) => {
          const val = s.metric(currentSnap);
          const prevVal = prevSnap ? s.metric(prevSnap) : null;
          const ok = s.continues(val, prevVal);
          const st = { ...streaks[s.id] };
          st.current = ok ? st.current + 1 : 0;
          const subiu = st.current > st.best;
          if (subiu) st.best = st.current;
          streaks[s.id] = st;
          if (subiu) {
            const r = getRank(st.best);
            if (r) useUIStore.getState().showToast(`🎖️ Nova Patente: ${r.icon} ${r.name} — ${s.name}!`, 'success');
          }
        });
        set({ streaks });
      },

      tryRecord: (id, value, label) => {
        const badge = RECORD_BADGES.find((b) => b.id === id);
        if (!badge) return false;
        const existing = get().records[id];
        const isBetter = !existing || (badge.better === 'higher' ? value > existing.value : value < existing.value);
        if (!isBetter) return false;
        set((state) => ({
          records: { ...state.records, [id]: { value, date: new Date().toLocaleDateString('pt-BR'), label } },
        }));
        useUIStore.getState().showToast(`🏆 Novo recorde — ${badge.name}: ${badge.format(value)}!`, 'success');
        return true;
      },

      checkTita: (exerciseName, maxLoad) => {
        if (!maxLoad) return false;
        const isBase = TITA_TARGET_NAMES.some((n) => exerciseName.toLowerCase().includes(n.toLowerCase()));
        if (!isBase) return false;
        return get().tryRecord('tita_power', maxLoad, `${exerciseName} — ${maxLoad}kg`);
      },

      checkFornalha: (kcal, elapsedSec) => {
        if (!kcal || kcal <= 0) return false;
        const label = `${kcal.toFixed(0)} kcal em ${Math.round(elapsedSec / 60)}min`;
        return get().tryRecord('fornalha', kcal, label);
      },

      fireCheckIn: () => {
        const state = get().fire;
        const today = dateKey(new Date());
        if (state.lastDate === today) return;
        const yesterday = dateKey(addDays(new Date(), -1));
        const current = state.lastDate === yesterday ? state.current + 1 : 1;
        const best = Math.max(state.best, current);
        set({ fire: { current, best, lastDate: today } });
        if (FIRE_MILESTONES.includes(current)) {
          useUIStore.getState().showToast(`🔥 ${current} Dias On Fire! Ofensiva de treinos consecutivos.`, 'success');
        }
      },
    }),
    { name: 'jg3_conquistas' }
  )
);

/** Estado de exibição da ofensiva — a ofensiva "morre" visualmente sem precisar de job em segundo plano. Equivale a fire.getDisplayState(). */
export function getFireDisplayState(fire: FireState): { current: number; best: number; checkedToday: boolean } {
  const today = dateKey(new Date());
  const yesterday = dateKey(addDays(new Date(), -1));
  const alive = fire.lastDate === today || fire.lastDate === yesterday;
  return { current: alive ? fire.current : 0, best: fire.best, checkedToday: fire.lastDate === today };
}
