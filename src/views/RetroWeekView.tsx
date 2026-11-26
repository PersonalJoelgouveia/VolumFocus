import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRetroWeeksStore } from '../store/useRetroWeeksStore';
import { useUIStore } from '../store/useUIStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { isCurrentWeek, formatWeekRange, shiftWeek, weekAllowed } from '../utils/retroWeek';
import type { DayIndex } from '../types/workout';
import { RegistroView } from './RegistroView';

/**
 * Lançamento de treino RETROATIVO: abre a semana escolhida no grid de Performance com a mesma tela de
 * "Meus Treinos" (mesmas ferramentas, sem timers/rotinas). Os dados vão para `useRetroWeeksStore`; a semana
 * atual, as conquistas e as sincronizações em andamento não são tocadas.
 */
export function RetroWeekView() {
  const key = useRetroWeeksStore((s) => s.activeKey);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const selectedDay = useRetroWeeksStore((s) => s.selectedDay);

  // Se a semana aberta passou a ser a atual (ou nada está aberto), volta ao fluxo normal de Meus Treinos.
  useEffect(() => {
    if (key && isCurrentWeek(key)) {
      // Navega sem fechar a semana aberta: fora desta tela ela deixa de valer (ver retroAtivo()).
      useWorkoutStore.getState().selectDay(selectedDay as DayIndex);
      setActiveView('registro');
    } else if (!key) {
      setActiveView('performance');
    }
  }, [key, selectedDay, setActiveView]);

  if (!key) return null;

  const abrir = (k: string) => {
    if (weekAllowed(k)) useRetroWeeksStore.getState().open(k, selectedDay);
  };

  return (
    <div>
      <div className="sec-row" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost" onClick={() => setActiveView('performance')}>
          ← Performance
        </button>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-icon" aria-label="Semana anterior" onClick={() => abrir(shiftWeek(key, -1))}>
            <ChevronLeft size={18} />
          </button>
          <span className="tag" style={{ whiteSpace: 'nowrap' }}>
            {formatWeekRange(key)}
          </span>
          <button
            className="btn btn-ghost btn-icon"
            aria-label="Próxima semana"
            disabled={!weekAllowed(shiftWeek(key, 1))}
            onClick={() => abrir(shiftWeek(key, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="cli-ex-detail" style={{ marginBottom: 8 }}>
        Você está lançando treinos de uma semana que já passou. Eles entram no calendário e no histórico na data certa e não
        mudam a sua semana atual.
      </div>
      <RegistroView />
    </div>
  );
}
