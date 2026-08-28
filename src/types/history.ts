import type { VolumeByMuscle } from '../utils/volumeCalc';
import type { WeekLog } from './workout';

export interface EngajamentoBadge {
  icon: string;
  label: string;
  cls: 'ns-badge-ouro' | 'ns-badge-prata' | 'ns-badge-bronze';
}

export interface CardioWeekSummary {
  totalMin: number;
  maior: { name: string; duration: number; day: string } | null;
}

/**
 * Snapshot de uma semana arquivada — sucessor de `historico_semanas`
 * (snapshotSemanaAtual(), index.html ~5358-5371).
 *
 * Uma diferença deliberada do original: lá `tonnage` guarda o objeto
 * inteiro de calcWeekTonnage() ({kg,reps,sets}), mas buildMinimalWeekSummary()
 * chama `.toFixed()` diretamente nesse objeto — um bug latente no
 * monolito (TypeError em tempo de execução). Aqui `tonnage` já é o
 * número (kg) que a tela realmente precisa exibir.
 */
export interface HistoricoSemana {
  /** Chave estável pra seleção/lista — o próprio ISO de `data`. */
  id: string;
  data: string;
  weekLog: WeekLog;
  weekPSE: Record<number, number>;
  weekVol: VolumeByMuscle;
  tonnage: number;
  /** Total de séries executadas na semana (calcWeekTonnage().sets) — usada
   *  pela insígnia "Máquina de Volume" (STREAKS, data/achievements.ts). */
  sets: number;
  cardio: CardioWeekSummary;
  treinos: number;
  badge: EngajamentoBadge;
}
