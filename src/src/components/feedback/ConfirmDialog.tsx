import { useConfirmStore } from '../../store/useConfirmStore';
import '../timer/TimerModals.css';

/**
 * Sucessor genérico de vfConfirm() (auditoria UX de julho/2026 — os 14 usos
 * de window.confirm() nativo do monolito foram substituídos por este
 * padrão). Renderizado uma vez em AppShell; qualquer lugar do app chama
 * `await useConfirmStore.getState().ask(mensagem, opts)`.
 */
export function ConfirmDialog() {
  const isOpen = useConfirmStore((s) => s.isOpen);
  const message = useConfirmStore((s) => s.message);
  const confirmLabel = useConfirmStore((s) => s.confirmLabel);
  const danger = useConfirmStore((s) => s.danger);
  const handleConfirm = useConfirmStore((s) => s.handleConfirm);
  const handleCancel = useConfirmStore((s) => s.handleCancel);

  if (!isOpen) return null;

  return (
    <div className="timer-modal-backdrop" onClick={handleCancel}>
      <div className="cro-confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="cro-confirm-icon">{danger ? '⚠️' : '❓'}</div>
        <div className="cro-confirm-sub" style={{ marginBottom: 22 }}>
          {message}
        </div>
        <div className="cro-confirm-btns">
          <button className="btn btn-ghost" onClick={handleCancel}>
            Cancelar
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={handleConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
