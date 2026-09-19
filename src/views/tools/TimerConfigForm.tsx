import { useState } from 'react';
import { genStimulusId, type Stimulus, type StimulusType, type TimerConfig } from '../../store/useIntervalTimerStore';

const TYPE_OPTIONS: { value: StimulusType; label: string }[] = [
  { value: 'preparacao', label: 'Preparação' },
  { value: 'exercicio', label: 'Exercício' },
  { value: 'descanso', label: 'Descanso' },
  { value: 'outro', label: 'Outro' },
];

interface DraftStimulus {
  id: string;
  name: string;
  type: StimulusType;
  /** Duração em segundos, como texto — validada/convertida só no Salvar. */
  duration: string;
}

function toDraft(stim: Stimulus): DraftStimulus {
  return { id: stim.id, name: stim.name, type: stim.type, duration: String(stim.durationSeconds) };
}

function newDraft(): DraftStimulus {
  return { id: genStimulusId(), name: 'Novo estímulo', type: 'exercicio', duration: '30' };
}

interface TimerConfigFormProps {
  config: TimerConfig;
  onCancel: () => void;
  onSave: (config: TimerConfig) => void;
}

/**
 * Área "Configurar Timer" do hub Ferramentas > Timer — edita o nome do
 * timer e a sequência livre de estímulos (`useIntervalTimerStore.config`):
 * cada estímulo tem nome, tipo (Preparação/Exercício/Descanso/Outro) e
 * duração próprios; "Ordem" é a posição na lista, controlada pelos botões
 * ▲/▼ de cada card (sem drag-and-drop, pra manter simples e funcionar
 * igual em touch/mouse). "Novo estímulo" adiciona um item ao final;
 * "Salvar Timer" grava a config e já inicia a sequência do primeiro
 * estímulo (ver `saveAndStart` no store) — sem tela de confirmação extra.
 * Rascunho 100% local em useState; nada é persistido além do que já
 * existia no store.
 */
export function TimerConfigForm({ config, onCancel, onSave }: TimerConfigFormProps) {
  const [name, setName] = useState(config.name);
  const [stimuli, setStimuli] = useState<DraftStimulus[]>(() => config.stimuli.map(toDraft));

  function updateField(id: string, patch: Partial<DraftStimulus>) {
    setStimuli((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStimulus(id: string) {
    setStimuli((prev) => prev.filter((s) => s.id !== id));
  }

  function moveStimulus(index: number, delta: -1 | 1) {
    setStimuli((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addStimulus() {
    setStimuli((prev) => [...prev, newDraft()]);
  }

  function handleSave() {
    if (stimuli.length === 0) return;
    const nextStimuli = stimuli.map(
      (s): Stimulus => ({
        id: s.id,
        name: s.name.trim() || TYPE_OPTIONS.find((o) => o.value === s.type)?.label || 'Estímulo',
        type: s.type,
        durationSeconds: Math.min(3600, Math.max(1, Math.round(Number(s.duration)) || 1)),
      }),
    );
    onSave({ name: name.trim() || 'Meu Timer', stimuli: nextStimuli });
  }

  return (
    <div className="itv-config-card">
      <div className="itv-config-title">Configurar Timer</div>

      <label className="itv-field">
        <span className="itv-field-label">Nome do Timer</span>
        <input
          type="text"
          className="itv-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Treino HIIT"
          maxLength={40}
        />
      </label>

      <div className="itv-stim-list">
        {stimuli.length === 0 && <div className="itv-stim-empty">Nenhum estímulo ainda. Adicione o primeiro abaixo.</div>}

        {stimuli.map((stim, index) => (
          <div className="itv-stim-card" key={stim.id}>
            <div className="itv-stim-head">
              <span className="itv-stim-order">{index + 1}</span>
              <div className="itv-stim-head-actions">
                <button
                  type="button"
                  className="itv-stim-icon-btn"
                  onClick={() => moveStimulus(index, -1)}
                  disabled={index === 0}
                  aria-label="Mover estímulo para cima"
                  title="Mover para cima"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="itv-stim-icon-btn"
                  onClick={() => moveStimulus(index, 1)}
                  disabled={index === stimuli.length - 1}
                  aria-label="Mover estímulo para baixo"
                  title="Mover para baixo"
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="itv-stim-icon-btn itv-stim-remove"
                  onClick={() => removeStimulus(stim.id)}
                  aria-label="Excluir estímulo"
                  title="Excluir estímulo"
                >
                  🗑
                </button>
              </div>
            </div>

            <label className="itv-field">
              <span className="itv-field-label">Nome</span>
              <input
                type="text"
                className="itv-input"
                value={stim.name}
                onChange={(e) => updateField(stim.id, { name: e.target.value })}
                maxLength={30}
              />
            </label>

            <div className="itv-field-grid itv-stim-fields">
              <label className="itv-field">
                <span className="itv-field-label">Tipo</span>
                <select
                  className="itv-input"
                  value={stim.type}
                  onChange={(e) => updateField(stim.id, { type: e.target.value as StimulusType })}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="itv-field">
                <span className="itv-field-label">Duração (s)</span>
                <input
                  type="number"
                  className="itv-input"
                  min={1}
                  max={3600}
                  value={stim.duration}
                  onChange={(e) => updateField(stim.id, { duration: e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}

        <button type="button" className="btn btn-ghost itv-add-stim-btn" onClick={addStimulus}>
          + Novo estímulo
        </button>
      </div>

      <div className="itv-config-actions">
        <button type="button" className="btn btn-ghost itv-ctrl-btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary itv-ctrl-btn" onClick={handleSave} disabled={stimuli.length === 0}>
          💾 Salvar Timer
        </button>
      </div>
    </div>
  );
}
