import type { WeekLog } from '../types/workout';
import { isCardioLogEntry } from '../types/workout';

/**
 * Migrado de getLastLoad(exId) (index.html ~6045) — só a parte de "semana
 * atual". O fallback ao histórico arquivado (getLastLoadFromHistory, que lê
 * `historico_semanas`) fica pendente: o arquivamento de semanas passadas
 * ("Nova Semana") ainda não foi migrado para uma view real (stub da Fase 2),
 * então não há, hoje, dado de semanas anteriores para consultar aqui.
 */
export function getLastLoad(exId: string, weekLog: WeekLog): number | null {
  for (let d = 0; d < 7; d++) {
    const dayLog = weekLog[d] ?? [];
    for (const entry of dayLog) {
      if (isCardioLogEntry(entry) || entry.exId !== exId) continue;
      if (entry.serieLoads?.length) {
        const positive = entry.serieLoads.filter((x) => x > 0);
        if (positive.length) return Math.max(...positive);
      } else if (entry.load > 0) {
        return entry.load;
      }
    }
  }
  return null;
}
