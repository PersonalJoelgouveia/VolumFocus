import { useTimerLibraryStore, getSeriesCount, getTotalSeconds, type SavedTimer } from '../../store/useTimerLibraryStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { TimerConfig } from '../../store/useIntervalTimerStore';

function fmt(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TimerLibraryProps {
  onVoltar: () => void;
  onStart: (timer: SavedTimer) => void;
  onEdit: (timer: SavedTimer) => void;
  onNew: () => void;
}

/**
 * Tela "Biblioteca de Timers" (Ferramentas > Timer > 📚 Biblioteca) — lista
 * os timers salvos (presets iniciais + os que o usuário salvar em
 * TimerConfigForm) com Nome, quantidade de estímulos, duração total e nº
 * de séries (quando houver algum estímulo do tipo Exercício). Iniciar/
 * Editar delegam pro chamador (TimerToolView, que já tem o motor
 * ativo/TimerConfigForm); Duplicar/Excluir mexem só na biblioteca
 * (`useTimerLibraryStore`). Excluir usa o ConfirmDialog global do app em
 * vez de window.confirm.
 */
export function TimerLibrary({ onVoltar, onStart, onEdit, onNew }: TimerLibraryProps) {
  const timers = useTimerLibraryStore((s) => s.timers);
  const duplicate = useTimerLibraryStore((s) => s.duplicate);
  const remove = useTimerLibraryStore((s) => s.remove);

  async function handleRemove(timer: SavedTimer) {
    const ok = await useConfirmStore.getState().ask(`Excluir o timer "${timer.config.name}"?`, {
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (ok) remove(timer.id);
  }

  function meta(config: TimerConfig) {
    const total = getTotalSeconds(config);
    const series = getSeriesCount(config);
    return (
      <div className="itv-lib-meta">
        <span>{config.stimuli.length} estímulo{config.stimuli.length === 1 ? '' : 's'}</span>
        <span>{fmt(total)}</span>
        {series > 0 && <span>{series} série{series === 1 ? '' : 's'}</span>}
      </div>
    );
  }

  return (
    <div className="itv-config-card">
      <div className="itv-config-title">Biblioteca de Timers</div>

      <button type="button" className="btn btn-ghost itv-add-stim-btn" onClick={onNew}>
        + Novo timer
      </button>

      <div className="itv-lib-list">
        {timers.length === 0 && <div className="itv-stim-empty">Nenhum timer salvo ainda.</div>}

        {timers.map((timer) => (
          <div className="itv-lib-card" key={timer.id}>
            <div className="itv-lib-head">
              <div className="itv-lib-name">{timer.config.name}</div>
              <div className="itv-lib-actions">
                <button type="button" className="itv-stim-icon-btn" onClick={() => onStart(timer)} aria-label="Iniciar" title="Iniciar">
                  ▶
                </button>
                <button type="button" className="itv-stim-icon-btn" onClick={() => onEdit(timer)} aria-label="Editar" title="Editar">
                  ✏️
                </button>
                <button
                  type="button"
                  className="itv-stim-icon-btn"
                  onClick={() => duplicate(timer.id)}
                  aria-label="Duplicar"
                  title="Duplicar"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="itv-stim-icon-btn itv-stim-remove"
                  onClick={() => handleRemove(timer)}
                  aria-label="Excluir"
                  title="Excluir"
                >
                  🗑
                </button>
              </div>
            </div>
            {meta(timer.config)}
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-ghost itv-ctrl-btn" onClick={onVoltar}>
        ← Voltar
      </button>
    </div>
  );
}
