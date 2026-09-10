import { useEffect, useState } from 'react';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useUIStore } from '../../store/useUIStore';
import { MUSCLE_GROUPS } from '../../types/exercise';
import type { Exercise, MuscleGroup } from '../../types/exercise';
import { ExerciseMediaPicker } from './ExerciseMediaPicker';
import type { ExerciseMediaValue } from './ExerciseMediaPicker';
import './ExerciseCreatorPanel.css';

type Mode = 'manual' | 'rapido';

interface ExerciseCreatorPanelProps {
  /** Exercício sendo editado, ou undefined para o painel de criação. */
  editing?: Exercise;
  /** No modo edição, fecha o formulário ao salvar/cancelar. */
  onDoneEditing?: () => void;
}

function parseQuick(raw: string) {
  const parts = raw.split(';').map((s) => s.trim());
  return {
    name: parts[0] || '',
    agonist: parts[1] || '',
    synergist: parts[2] ? parts[2].split(',').map((s) => s.trim()).filter(Boolean) : [],
    stabilizer: parts[3] ? parts[3].split(',').map((s) => s.trim()).filter(Boolean) : [],
  };
}

/**
 * Sucessor do painel inline `#bk-panel-wrap` (index.html ~2625-2739) +
 * suas funções `bk*` (~4807-4956): criação de exercício com abas
 * Manual/Modo Rápido, chips de sinergista/estabilizador com exclusão
 * mútua, e toggle Musculação/Cardio. Reaproveitado também para edição
 * (`editing` presente) — o modal separado `#modal-create-ex` do
 * original, que fazia praticamente a mesma coisa com <select multiple>
 * em vez de chips, foi consolidado aqui para não duplicar schema/lógica.
 */
export function ExerciseCreatorPanel({ editing, onDoneEditing }: ExerciseCreatorPanelProps) {
  const addExercise = useExerciseStore((s) => s.addExercise);
  const updateExercise = useExerciseStore((s) => s.updateExercise);
  const showToast = useUIStore((s) => s.showToast);

  const isEdit = !!editing;
  const [open, setOpen] = useState(isEdit);
  const [type, setType] = useState<'forca' | 'cardio'>(editing?.type === 'cardio' ? 'cardio' : 'forca');
  const [mode, setMode] = useState<Mode>('manual');
  const [name, setName] = useState(editing?.name ?? '');
  const [agonist, setAgonist] = useState<MuscleGroup>(
    editing && editing.agonist !== 'Cardio' ? editing.agonist : MUSCLE_GROUPS[0]
  );
  const [syn, setSyn] = useState<string[]>(editing?.synergist ?? []);
  const [stab, setStab] = useState<string[]>(editing?.stabilizer ?? []);
  const [quick, setQuick] = useState('');

  // Id estável pro exercício sendo criado — gerado uma vez, reutilizado
  // tanto pelo caminho de upload de mídia (Storage) quanto pelo
  // addExercise() final, pra não desalinhar onde a imagem foi enviada.
  const [newExerciseId] = useState(() => Date.now().toString());
  const targetId = editing?.id ?? newExerciseId;
  const [media, setMedia] = useState<ExerciseMediaValue>({
    imgInicio: editing?.imgInicio ?? null,
    imgFim: editing?.imgFim ?? null,
    ytVideoUrl: editing?.ytVideoUrl ?? null,
  });

  // Reabre já preenchido sempre que o alvo de edição mudar.
  useEffect(() => {
    if (!editing) return;
    setOpen(true);
    setType(editing.type === 'cardio' ? 'cardio' : 'forca');
    setMode('manual');
    setName(editing.name);
    setAgonist(editing.agonist !== 'Cardio' ? editing.agonist : MUSCLE_GROUPS[0]);
    setSyn(editing.synergist);
    setStab(editing.stabilizer);
    setMedia({ imgInicio: editing.imgInicio ?? null, imgFim: editing.imgFim ?? null, ytVideoUrl: editing.ytVideoUrl ?? null });
  }, [editing]);

  const others = MUSCLE_GROUPS.filter((m) => m !== agonist);
  const quickParsed = quick.trim() ? parseQuick(quick) : null;

  function toggleChip(kind: 'syn' | 'stab', muscle: string) {
    if (kind === 'syn') {
      setStab((s) => s.filter((m) => m !== muscle));
      setSyn((s) => (s.includes(muscle) ? s.filter((m) => m !== muscle) : [...s, muscle]));
    } else {
      setSyn((s) => s.filter((m) => m !== muscle));
      setStab((s) => (s.includes(muscle) ? s.filter((m) => m !== muscle) : [...s, muscle]));
    }
  }

  function reset() {
    setName('');
    setAgonist(MUSCLE_GROUPS[0]);
    setSyn([]);
    setStab([]);
    setQuick('');
    setType('forca');
    setMode('manual');
    setMedia({ imgInicio: null, imgFim: null, ytVideoUrl: null });
  }

  function handleSalvar() {
    let finalName: string;
    let finalAgonist: string;
    let finalSyn: string[];
    let finalStab: string[];

    if (type === 'cardio') {
      finalName = name.trim();
      finalAgonist = 'Cardio';
      finalSyn = [];
      finalStab = [];
    } else if (mode === 'manual' || isEdit) {
      finalName = name.trim();
      finalAgonist = agonist;
      finalSyn = syn;
      finalStab = stab;
    } else {
      const p = parseQuick(quick);
      finalName = p.name;
      finalAgonist = p.agonist;
      finalSyn = p.synergist;
      finalStab = p.stabilizer;
    }

    if (!finalName) return showToast('⚠️ Informe o nome do exercício.', 'warning');
    if (!finalAgonist) return showToast('⚠️ Selecione o músculo agonista.', 'warning');

    if (isEdit && editing) {
      updateExercise(editing.id, {
        name: finalName,
        agonist: finalAgonist as Exercise['agonist'],
        synergist: finalSyn as MuscleGroup[],
        stabilizer: finalStab as MuscleGroup[],
        ...(type === 'cardio' ? { type: 'cardio' as const } : { type: undefined }),
        imgInicio: media.imgInicio,
        imgFim: media.imgFim,
        ytVideoUrl: media.ytVideoUrl,
      });
      showToast(`✅ "${finalName}" atualizado`, 'success');
      onDoneEditing?.();
      return;
    }

    addExercise({
      id: newExerciseId,
      name: finalName,
      agonist: finalAgonist as Exercise['agonist'],
      synergist: finalSyn as MuscleGroup[],
      stabilizer: finalStab as MuscleGroup[],
      ...(type === 'cardio' ? { type: 'cardio' as const } : {}),
      imgInicio: media.imgInicio,
      imgFim: media.imgFim,
      ytVideoUrl: media.ytVideoUrl,
    });
    showToast(`✅ "${finalName}" adicionado ao Banco`, 'success');
    reset();
    setOpen(false);
  }

  function handleCancelEdit() {
    onDoneEditing?.();
  }

  return (
    <div className={`bk-panel-wrap${open ? ' bk-open' : ''}`}>
      <div className="bk-header" onClick={() => !isEdit && setOpen((v) => !v)}>
        <div className="bk-header-left">
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>{isEdit ? '✏️' : '➕'}</span>
          <span className="bk-header-title">{isEdit ? `Editar: ${editing!.name}` : 'Novo Exercício'}</span>
          {!isEdit && (
            <span className="tag" style={{ fontSize: '0.5rem', padding: '2px 7px' }}>
              INLINE
            </span>
          )}
        </div>
        {!isEdit && <span className="bk-chevron">▼</span>}
      </div>

      {open && (
        <div className="bk-body">
          <div className="cd-type-toggle">
            <button
              className={`cd-type-btn${type === 'forca' ? ' cd-type-active' : ''}`}
              onClick={() => setType('forca')}
            >
              🏋️ Musculação
            </button>
            <button
              className={`cd-type-btn cd-type-cardio${type === 'cardio' ? ' cd-type-active' : ''}`}
              onClick={() => setType('cardio')}
            >
              ❤️ Cardio
            </button>
          </div>

          {type === 'forca' && !isEdit && (
            <div className="bk-tabs">
              <button className={`bk-tab${mode === 'manual' ? ' bk-tab-active' : ''}`} onClick={() => setMode('manual')}>
                📋 Manual
              </button>
              <button className={`bk-tab${mode === 'rapido' ? ' bk-tab-active' : ''}`} onClick={() => setMode('rapido')}>
                ⚡ Modo Rápido
              </button>
            </div>
          )}

          <div className="form-group">
            <label>Nome do Exercício</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Supino Inclinado com Halteres"
              autoComplete="off"
            />
          </div>

          {type === 'forca' && (mode === 'manual' || isEdit) && (
            <>
              <div className="form-group">
                <label>🎯 Agonista (Músculo Alvo) — 1.0</label>
                <select value={agonist} onChange={(e) => setAgonist(e.target.value as MuscleGroup)}>
                  {MUSCLE_GROUPS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>
                  ⚡ Sinergistas — 0.5{' '}
                  <span style={{ fontSize: '0.61rem', fontWeight: 400, color: 'var(--text-3)' }}>clique para marcar</span>
                </label>
                <div className="bk-chips">
                  {others.map((m) => (
                    <span
                      key={m}
                      className={`bk-chip${syn.includes(m) ? ' bk-chip-syn' : ''}`}
                      onClick={() => toggleChip('syn', m)}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>
                  🔒 Estabilizadores — 0.25{' '}
                  <span style={{ fontSize: '0.61rem', fontWeight: 400, color: 'var(--text-3)' }}>clique para marcar</span>
                </label>
                <div className="bk-chips">
                  {others.map((m) => (
                    <span
                      key={m}
                      className={`bk-chip${stab.includes(m) ? ' bk-chip-stab' : ''}`}
                      onClick={() => toggleChip('stab', m)}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {type === 'forca' && mode === 'rapido' && !isEdit && (
            <>
              <div className="bk-hint">
                <strong style={{ color: 'var(--text-2)' }}>Formato:</strong>{' '}
                <code>Nome; Agonista; Sin1, Sin2; Estab1, Estab2</code>
                <br />
                Campos 3 e 4 são opcionais. Use vírgula para separar músculos.
                <br />
                Ex: <code>Supino Reto; Peito; Tríceps, Ombros; Extensores da Coluna</code>
              </div>
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label>Entrada de Texto</label>
                <input
                  type="text"
                  value={quick}
                  onChange={(e) => setQuick(e.target.value)}
                  placeholder="Nome; Agonista; Sinergistas; Estabilizadores"
                  autoComplete="off"
                />
              </div>
              {quick.trim() && (
                <div className="bk-preview bk-preview-show">
                  <div className="bk-preview-lbl">Pré-visualização</div>
                  {!quickParsed?.name ? (
                    <div className="bk-preview-err">⚠️ Nome ausente (1º campo).</div>
                  ) : !quickParsed.agonist ? (
                    <div className="bk-preview-err">⚠️ Agonista ausente (2º campo obrigatório).</div>
                  ) : (
                    <div className="bk-preview-row">
                      <span className="bk-preview-name">{quickParsed.name}</span>
                      <span className="ex-tag ex-tag-ag">{quickParsed.agonist}</span>
                      {quickParsed.synergist.map((m) => (
                        <span className="ex-tag ex-tag-sin" key={m}>
                          {m}
                        </span>
                      ))}
                      {quickParsed.stabilizer.map((m) => (
                        <span className="ex-tag ex-tag-est" key={m}>
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {type === 'cardio' && (
            <div className="bk-hint">
              ❤️ Exercícios cardio não usam séries/repetições. No registro do dia, você informará{' '}
              <strong style={{ color: 'var(--text-2)' }}>duração</strong> e{' '}
              <strong style={{ color: 'var(--text-2)' }}>intensidade percebida (0–10)</strong>.
            </div>
          )}

          <ExerciseMediaPicker exerciseId={targetId} value={media} onChange={setMedia} />

          <div className="bk-footer">
            {isEdit ? (
              <button className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>
                Cancelar
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                Limpar
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleSalvar}>
              💾 {isEdit ? 'Salvar Alterações' : 'Salvar Exercício'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
