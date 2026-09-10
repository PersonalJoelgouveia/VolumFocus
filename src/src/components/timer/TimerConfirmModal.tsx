import { useTimerStore } from '../../store/useTimerStore';
import { useCalorieStore } from '../../store/useCalorieStore';
import './TimerModals.css';

/**
 * Sucessor de `#cro-confirm-modal` (index.html ~3577-3587) e de
 * croStart()/croDecline(). Ao confirmar, se o cálculo MET ainda não
 * estiver ativo, o modal de peso abre em seguida — mesmo encadeamento de
 * croStart() (setTimeout de 350ms para o modal MET, index.html ~10057).
 */
export function TimerConfirmModal() {
  const isOpen = useTimerStore((s) => s.isConfirmModalOpen);
  const declineStart = useTimerStore((s) => s.declineStart);
  const start = useTimerStore((s) => s.start);
  const isCalorieActive = useCalorieStore((s) => s.isActive);
  const openWeightModal = useCalorieStore((s) => s.openWeightModal);

  if (!isOpen) return null;

  function handleStart() {
    start();
    if (!isCalorieActive) {
      setTimeout(openWeightModal, 350);
    }
  }

  return (
    <div className="timer-modal-backdrop">
      <div className="cro-confirm-card">
        <div className="cro-confirm-icon">⏱️</div>
        <div className="cro-confirm-title">Cronometrar o treino?</div>
        <div className="cro-confirm-sub">Deseja cronometrar o tempo total do seu treino de hoje?</div>
        <div className="cro-confirm-btns">
          <button className="btn btn-ghost" onClick={declineStart}>
            Agora não
          </button>
          <button className="btn btn-primary" onClick={handleStart}>
            Sim, iniciar
          </button>
        </div>
      </div>
    </div>
  );
}
