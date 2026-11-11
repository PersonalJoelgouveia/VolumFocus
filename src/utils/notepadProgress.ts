import { exDoneKey, isCardioLogEntry } from '../types/workout';
import type { ExDoneMap, StrengthLogEntry, WorkoutDayLog, WorkoutLogEntry } from '../types/workout';

/**
 * Progresso da execução do dia a partir do próprio log (`doneSerie` por série +
 * `exDone` por exercício) — sem estado paralelo. Usado pela barra de timer do
 * Bloco de Notas para saber "qual é a série atual" e "o que vem a seguir".
 */

export interface Cursor {
  /** Índice da entrada no log do dia. */
  idx: number;
  /** Série atual (0-based); 0 para cardio. */
  set: number;
}

export function setsOf(e: StrengthLogEntry): number {
  return Math.max(1, e.sets || 1);
}

export function doneSetCount(e: StrengthLogEntry): number {
  return Array.from({ length: setsOf(e) }, (_, i) => !!e.doneSerie?.[i]).filter(Boolean).length;
}

export function isEntryComplete(e: WorkoutLogEntry, idx: number, day: number, exDone: ExDoneMap): boolean {
  if (exDone[exDoneKey(day, idx)]) return true;
  if (isCardioLogEntry(e)) return false;
  return doneSetCount(e) >= setsOf(e);
}

function firstOpenSet(e: StrengthLogEntry): number {
  const n = setsOf(e);
  for (let i = 0; i < n; i++) if (!e.doneSerie?.[i]) return i;
  return 0;
}

/**
 * Próxima série a executar. Em conjugados (Bi-Set, Tri-Set, Superset, Circuito)
 * as séries alternam entre os membros: A1, B1, A2, B2… — pega o membro do grupo
 * com menos séries feitas (empate → o primeiro na ordem do log).
 */
export function findCursor(log: WorkoutDayLog, isComplete: (idx: number) => boolean): Cursor | null {
  for (let i = 0; i < log.length; i++) {
    if (isComplete(i)) continue;
    const e = log[i];
    if (isCardioLogEntry(e)) return { idx: i, set: 0 };

    if (e.groupId) {
      let best = i;
      let bestCount = doneSetCount(e);
      for (let j = i + 1; j < log.length; j++) {
        const m = log[j];
        if (m.groupId !== e.groupId || isComplete(j) || isCardioLogEntry(m)) continue;
        const c = doneSetCount(m);
        if (c < bestCount) {
          best = j;
          bestCount = c;
        }
      }
      return { idx: best, set: firstOpenSet(log[best] as StrengthLogEntry) };
    }
    return { idx: i, set: firstOpenSet(e) };
  }
  return null;
}

/** `doneSerie` com a série `set` marcada como feita. */
export function withSetDone(e: StrengthLogEntry, set: number): boolean[] {
  return Array.from({ length: setsOf(e) }, (_, i) => i === set || !!e.doneSerie?.[i]);
}

/**
 * Depois de concluir `cursor`, a rodada acabou? Fora de conjugados, sempre
 * (descansa após cada série). Em conjugados, só quando todos os membros já
 * fizeram essa mesma série — o descanso vem depois do último da rodada.
 */
export function isRoundComplete(log: WorkoutDayLog, cursor: Cursor, isComplete: (idx: number) => boolean): boolean {
  const e = log[cursor.idx];
  if (!e.groupId) return true;
  return log.every((m, j) => {
    if (m.groupId !== e.groupId) return true;
    if (isComplete(j) || isCardioLogEntry(m)) return true;
    return doneSetCount(m) >= cursor.set + 1;
  });
}
