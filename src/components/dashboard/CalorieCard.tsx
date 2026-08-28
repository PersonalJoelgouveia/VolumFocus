import { useTimerStore } from '../../store/useTimerStore';
import { useCalorieStore } from '../../store/useCalorieStore';

/**
 * Card de calorias — sucessor completo de `metCardHtml` em renderDashboard()
 * (index.html ~4702-4727) e de _metUpdateDashCard(). Como o Dashboard e o
 * <TimerEngine> compartilham o mesmo useTimerStore, o valor aqui já chega
 * "ao vivo" sem precisar de um segundo listener manual de DOM (o
 * equivalente ao document.getElementById('met-dash-val') do monolito).
 */
export function CalorieCard() {
  const isRunning = useTimerStore((s) => s.isRunning);
  const isPaused = useTimerStore((s) => s.isPaused);
  const displaySeconds = useTimerStore((s) => s.displaySeconds);

  const isCalorieActive = useCalorieStore((s) => s.isActive);
  const bodyWeightKg = useCalorieStore((s) => s.bodyWeightKg);
  const met = useCalorieStore((s) => s.met);
  const calcKcal = useCalorieStore((s) => s.calcKcal);
  const openWeightModal = useCalorieStore((s) => s.openWeightModal);

  const isTimerActive = isRunning || isPaused;
  const kcal = isTimerActive ? calcKcal(displaySeconds) : null;

  if (isCalorieActive && kcal !== null) {
    const minStr = (displaySeconds / 60).toFixed(0);
    return (
      <div className="met-conquest-card">
        <span className="cq-icon">🔥</span>
        <div className="cq-label">Calorias Gastas</div>
        <div className="met-live-val">{kcal.toFixed(1)}</div>
        <div className="met-live-unit">kcal estimadas</div>
        <div className="met-live-detail">
          MET {met} · {bodyWeightKg}kg · {minStr}min
        </div>
      </div>
    );
  }

  return (
    <div className="met-conquest-card">
      <span className="cq-icon">🔥</span>
      <div className="cq-label">Calorias Gastas</div>
      <div className="met-neutral">
        <div className="met-neutral-ico">📊</div>
        <div className="met-neutral-txt">
          {isCalorieActive ? 'Inicie o cronômetro para calcular.' : 'Gasto calórico em tempo real via cronômetro.'}
        </div>
        {!isCalorieActive && (
          <button className="met-activate-btn" onClick={openWeightModal}>
            ⚡ Ativar Cálculo
          </button>
        )}
      </div>
    </div>
  );
}
