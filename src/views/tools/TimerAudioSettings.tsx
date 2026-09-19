import { useTimerAudioStore } from '../../store/useTimerAudioStore';
import { END_SOUND_OPTIONS, START_SOUND_OPTIONS, playSound } from '../../utils/timerSounds';

const vibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

/**
 * Tela "Áudio e vibração" do hub Ferramentas > Timer — configura os dois
 * tipos de estímulo sonoro (Início / Final-Descanso), volume, vibração
 * (só disponível quando `navigator.vibrate` existe) e a contagem
 * regressiva final opcional. Persistido via useTimerAudioStore
 * (independente de qual protocolo/sequência está configurado). Os
 * disparos automáticos durante a execução ficam em TimerToolView — aqui é
 * só a tela de configuração + botão "Testar" de cada som.
 */
export function TimerAudioSettings({ onVoltar }: { onVoltar: () => void }) {
  const startEnabled = useTimerAudioStore((s) => s.startEnabled);
  const startSound = useTimerAudioStore((s) => s.startSound);
  const endEnabled = useTimerAudioStore((s) => s.endEnabled);
  const endSound = useTimerAudioStore((s) => s.endSound);
  const volume = useTimerAudioStore((s) => s.volume);
  const vibrationEnabled = useTimerAudioStore((s) => s.vibrationEnabled);
  const finalCountdownEnabled = useTimerAudioStore((s) => s.finalCountdownEnabled);
  const setStartEnabled = useTimerAudioStore((s) => s.setStartEnabled);
  const setStartSound = useTimerAudioStore((s) => s.setStartSound);
  const setEndEnabled = useTimerAudioStore((s) => s.setEndEnabled);
  const setEndSound = useTimerAudioStore((s) => s.setEndSound);
  const setVolume = useTimerAudioStore((s) => s.setVolume);
  const setVibrationEnabled = useTimerAudioStore((s) => s.setVibrationEnabled);
  const setFinalCountdownEnabled = useTimerAudioStore((s) => s.setFinalCountdownEnabled);

  return (
    <div className="itv-config-card">
      <div className="itv-config-title">Áudio e vibração</div>

      <div className="itv-audio-group">
        <div className="itv-toggle-row">
          <span className="itv-toggle-label">Início</span>
          <label className="itv-switch">
            <input type="checkbox" checked={startEnabled} onChange={(e) => setStartEnabled(e.target.checked)} />
            <span className="itv-switch-track" aria-hidden="true" />
          </label>
        </div>
        {START_SOUND_OPTIONS.map((opt) => (
          <div className="itv-sound-option" key={opt.id}>
            <label className="itv-sound-radio">
              <input
                type="radio"
                name="itv-start-sound"
                checked={startSound === opt.id}
                onChange={() => setStartSound(opt.id)}
              />
              <span>{opt.label}</span>
            </label>
            <button type="button" className="itv-test-btn" onClick={() => playSound(opt.id, volume)}>
              ▶ Testar
            </button>
          </div>
        ))}
      </div>

      <div className="itv-audio-group">
        <div className="itv-toggle-row">
          <span className="itv-toggle-label">Final / Descanso</span>
          <label className="itv-switch">
            <input type="checkbox" checked={endEnabled} onChange={(e) => setEndEnabled(e.target.checked)} />
            <span className="itv-switch-track" aria-hidden="true" />
          </label>
        </div>
        {END_SOUND_OPTIONS.map((opt) => (
          <div className="itv-sound-option" key={opt.id}>
            <label className="itv-sound-radio">
              <input
                type="radio"
                name="itv-end-sound"
                checked={endSound === opt.id}
                onChange={() => setEndSound(opt.id)}
              />
              <span>{opt.label}</span>
            </label>
            <button type="button" className="itv-test-btn" onClick={() => playSound(opt.id, volume)}>
              ▶ Testar
            </button>
          </div>
        ))}
      </div>

      <label className="itv-field">
        <span className="itv-field-label">Volume</span>
        <input
          type="range"
          className="itv-range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </label>

      <div className="itv-toggle-row">
        <span className="itv-toggle-label">
          Vibração
          {!vibrationSupported && <span className="itv-toggle-hint"> — não suportada neste aparelho</span>}
        </span>
        <label className="itv-switch">
          <input
            type="checkbox"
            checked={vibrationEnabled && vibrationSupported}
            disabled={!vibrationSupported}
            onChange={(e) => setVibrationEnabled(e.target.checked)}
          />
          <span className="itv-switch-track" aria-hidden="true" />
        </label>
      </div>

      <div className="itv-toggle-row">
        <span className="itv-toggle-label">Contagem regressiva final (3-2-1)</span>
        <label className="itv-switch">
          <input
            type="checkbox"
            checked={finalCountdownEnabled}
            onChange={(e) => setFinalCountdownEnabled(e.target.checked)}
          />
          <span className="itv-switch-track" aria-hidden="true" />
        </label>
      </div>

      <button type="button" className="btn btn-ghost itv-ctrl-btn" onClick={onVoltar}>
        ← Voltar
      </button>
    </div>
  );
}
