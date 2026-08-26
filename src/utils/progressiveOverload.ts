import type { StrengthLogEntry, WeekLog } from '../types/workout';
import { getLastLoad } from './lastLoad';

const MARGIN_MAX = 10;
const MS_DIA = 24 * 60 * 60 * 1000;

export interface OverloadRecord {
  load: number;
  /** ISO string, ou null quando não há data de referência (import de histórico sem timestamp). */
  date: string | null;
}

export interface OverloadMessage {
  icon: string;
  text: string;
}

/** Migrado de prgCheck._maxLoad(entry) (index.html ~8312). */
export function maxLoadOf(entry: StrengthLogEntry): number {
  if (entry.serieLoads.length) {
    const positive = entry.serieLoads.filter((x) => x > 0);
    return positive.length ? Math.max(...positive) : 0;
  }
  return entry.load || 0;
}

/**
 * Migrado de prgCheck.check(entry) (index.html ~8332), separado em função
 * pura: recebe o registro anterior e devolve { record, messages } em vez
 * de escrever direto em localStorage/DOM — quem persiste é o
 * useProgressStore.
 *
 * Regra A: incremento de carga > 10% desde o registro anterior.
 * Regra B: menos de 7 dias desde o último incremento registrado.
 */
export function evaluateOverload(
  entry: StrengthLogEntry,
  prev: OverloadRecord | null
): { record: OverloadRecord; messages: OverloadMessage[] } {
  const newLoad = maxLoadOf(entry);

  if (!prev || !prev.load) {
    return { record: { load: newLoad, date: new Date().toISOString() }, messages: [] };
  }

  if (newLoad <= prev.load) {
    return { record: { load: newLoad, date: prev.date ?? null }, messages: [] };
  }

  const pctIncrease = ((newLoad - prev.load) / prev.load) * 100;
  const daysSince = prev.date ? (Date.now() - new Date(prev.date).getTime()) / MS_DIA : Infinity;

  const messages: OverloadMessage[] = [];
  if (pctIncrease > MARGIN_MAX) {
    messages.push({ icon: '⚠️', text: 'Carga alta detectada! Priorize sempre a execução perfeita do movimento.' });
  }
  if (daysSince < 7) {
    messages.push({
      icon: '⏱️',
      text: 'Progressão rápida! A sobrecarga deve ser semanal. Avance só se a execução estiver confortável e o desempenho acima da média.',
    });
  }

  return { record: { load: newLoad, date: new Date().toISOString() }, messages };
}

/** Migrado de prgCheck._prev(exId) (index.html ~8321) — fallback ao histórico da semana atual via getLastLoad. */
export function resolvePrevRecord(
  exId: string,
  loadHistory: Record<string, OverloadRecord>,
  weekLog: WeekLog
): OverloadRecord | null {
  if (loadHistory[exId]) return loadHistory[exId];
  const histLoad = getLastLoad(exId, weekLog);
  return histLoad != null && histLoad > 0 ? { load: histLoad, date: null } : null;
}
