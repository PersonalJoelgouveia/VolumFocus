import type { CardioWeekSummary, EngajamentoBadge } from '../types/history';
import type { Exercise } from '../types/exercise';
import type { WeekLog } from '../types/workout';
import { DAYS_SHORT, isCardioLogEntry } from '../types/workout';

/** Migrado de countWeekWorkouts() (index.html ~5395). */
export function countWeekWorkouts(weekLog: WeekLog): number {
  let n = 0;
  for (let d = 0; d < 7; d++) {
    if ((weekLog[d] ?? []).length > 0) n++;
  }
  return n;
}

/** Migrado de getEngajamentoBadge(n) (index.html ~5400). */
export function getEngajamentoBadge(n: number): EngajamentoBadge {
  if (n >= 5) return { icon: '🏆', label: 'OURO', cls: 'ns-badge-ouro' };
  if (n >= 3) return { icon: '🥈', label: 'PRATA', cls: 'ns-badge-prata' };
  if (n >= 1) return { icon: '🥉', label: 'BRONZE', cls: 'ns-badge-bronze' };
  return { icon: '⚪', label: 'SEM TREINOS', cls: 'ns-badge-bronze' };
}

/** Migrado de getCardioWeekSummary() (index.html ~5408). */
export function getCardioWeekSummary(weekLog: WeekLog, exercises: Exercise[]): CardioWeekSummary {
  let totalMin = 0;
  let maior: CardioWeekSummary['maior'] = null;
  for (let d = 0; d < 7; d++) {
    for (const e of weekLog[d] ?? []) {
      if (!isCardioLogEntry(e)) continue;
      const ex = exercises.find((x) => x.id === e.exId);
      const dur = e.duration || 0;
      totalMin += dur;
      if (!maior || dur > maior.duration) {
        maior = { name: ex ? ex.name : 'Cardio', duration: dur, day: DAYS_SHORT[d] };
      }
    }
  }
  return { totalMin, maior };
}

/** Migrado da frase motivacional dinâmica de renderNovaSemana() (index.html
 *  ~5452-5457). Simplificação deliberada: a 2ª condição original também
 *  checava `metaForcaOk` (recorde de 1RM na semana), que depende do
 *  módulo Força — ainda não portado. Some quando Força existir. */
export function getMotivationalPhrase(treinos: number, metaCardioOk: boolean): string {
  if (treinos >= 5 && metaCardioOk) return '🔥 Semana impecável! Disciplina de elite em força e cardio. Continue nesse ritmo!';
  if (treinos >= 3) return '💪 Boa consistência! Seus números mostram evolução real.';
  if (treinos >= 1) return '👊 Toda semana conta. Avance um degrau por vez — o próximo ciclo começa agora.';
  return '⚠️ Semana sem registros. Que a próxima seja o ponto de virada!';
}
