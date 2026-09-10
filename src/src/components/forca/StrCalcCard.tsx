import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useStrengthStore } from '../../store/useStrengthStore';
import { useUIStore } from '../../store/useUIStore';
import { RIR_MESSAGES, STR_FORMULAS, STR_FORMULA_ORDER, strCalcAll } from '../../utils/strengthCalc';
import type { StrFormulaKey, StrCalcAllResult } from '../../types/strength';
import { isCardioLogEntry } from '../../types/workout';

export interface StrCalcOutcome {
  exerciseName: string;
  weight: number;
  reps: number;
  rir: number;
  formula: StrFormulaKey;
  all: StrCalcAllResult;
  oneRM: number;
  isNewRecord: boolean;
}

interface StrCalcCardProps {
  onCalculated: (outcome: StrCalcOutcome) => void;
}

function rirBadgeClass(rir: number): string {
  if (rir === 0) return 'str-rir-badge-0';
  if (rir <= 2) return 'str-rir-badge-low';
  return 'str-rir-badge-high';
}

/**
 * Sucessor do CARD 1 (Formulário de Cálculo) + strPopulateSelect/
 * strHandleExerciseChange/strOnRirChange/strOnFormulaChange/strCalculate
 * (index.html ~2927-3010, ~9051-9270): exercícios agrupados por músculo
 * (mesmo filtro `type !== 'cardio'`), pré-preenchimento com a última carga
 * registrada no log semanal, slider de RIR com badge/descrição dinâmicos,
 * e o aviso de zona fora de 1–12 reps.
 */
export function StrCalcCard({ onCalculated }: StrCalcCardProps) {
  const exercises = useExerciseStore((s) => s.exercises);
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const upsertRecord = useStrengthStore((s) => s.upsertRecord);
  const showToast = useUIStore((s) => s.showToast);

  const strengthExercises = exercises.filter((e) => e.type !== 'cardio');
  const grouped: Record<string, typeof strengthExercises> = {};
  strengthExercises.forEach((e) => {
    (grouped[e.agonist] ??= []).push(e);
  });
  const groupEntries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));

  const [exerciseName, setExerciseName] = useState(strengthExercises[0]?.name ?? '');
  const [weight, setWeight] = useState('80');
  const [reps, setReps] = useState('5');
  const [rir, setRir] = useState(0);
  const [formula, setFormula] = useState<StrFormulaKey>('hibrida');

  const exObj = exercises.find((e) => e.name === exerciseName);

  // Pré-preenche com a última carga/reps registrada no log semanal desse exercício.
  useEffect(() => {
    if (!exObj) return;
    for (let d = 6; d >= 0; d--) {
      const entry = (weekLog[d] ?? []).find((e) => e.exId === exObj.id);
      if (entry && !isCardioLogEntry(entry)) {
        const lastSet = (entry.sets || 1) - 1;
        const load = entry.serieLoads?.[lastSet] ?? entry.load;
        const r = entry.serieReps?.[lastSet] ?? entry.reps;
        if (load > 0) {
          setWeight(String(load));
          setReps(String(Math.min(r, 10)));
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseName]);

  const repsNum = parseInt(reps, 10) || 0;
  const repsEfetivas = repsNum + rir;
  const repsForaDaZona = repsNum > 0 && (repsNum < 1 || repsNum > 12);

  function handleCalcular() {
    const w = parseFloat(weight) || 0;
    if (!exerciseName || w <= 0 || repsNum <= 0) {
      return showToast('⚠️ Preencha exercício, carga e repetições.', 'warning');
    }
    const all = strCalcAll(w, repsEfetivas);
    const oneRM = all[formula] ?? all.hibrida ?? 0;
    const isNewRecord = upsertRecord(exerciseName, w, repsNum, oneRM, formula, rir);
    onCalculated({ exerciseName, weight: w, reps: repsNum, rir, formula, all, oneRM, isNewRecord });
    if (isNewRecord) showToast(`🏆 Novo recorde em ${exerciseName}: ${oneRM.toFixed(1)}kg!`, 'success');
  }

  return (
    <div className="card str-calc-card">
      <div className="card-title">Calcular Nova Carga Máxima</div>

      <div className="form-group">
        <label htmlFor="str-ex-select">Exercício Alvo</label>
        <select id="str-ex-select" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)}>
          {groupEntries.map(([muscle, exs]) => (
            <optgroup label={muscle} key={muscle}>
              {exs.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {exObj && (
          <span className="str-linked-badge">
            <span>⚡</span> Vinculado ao Banco
          </span>
        )}
      </div>

      <div className="grid-2">
        <div className="form-group">
          <label htmlFor="str-weight">Carga Levantada (kg)</label>
          <input id="str-weight" type="number" inputMode="decimal" min={1} step={0.5} placeholder="Ex: 80" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="str-reps">Repetições Realizadas</label>
          <input id="str-reps" type="number" inputMode="numeric" min={1} max={30} placeholder="1–30" value={reps} onChange={(e) => setReps(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="str-rir" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          RIR
          <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>
            Repetições em Reserva
          </span>
          <span className="str-rir-tooltip" title="Quantas repetições você ainda tinha 'sobrando' antes da falha.">
            ?
          </span>
        </label>
        <div className="str-rir-row">
          <input
            id="str-rir"
            type="range"
            min={0}
            max={5}
            step={1}
            value={rir}
            style={{ '--rir-pct': `${(rir / 5) * 100}%` } as CSSProperties}
            onChange={(e) => setRir(parseInt(e.target.value, 10))}
          />
          <span className={`str-rir-badge ${rirBadgeClass(rir)}`}>RIR {rir}</span>
        </div>
        <div className="str-rir-desc">{RIR_MESSAGES[rir]}</div>
      </div>

      <div className="form-group">
        <label htmlFor="str-formula-select">Fórmula de Estimativa</label>
        <select id="str-formula-select" value={formula} onChange={(e) => setFormula(e.target.value as StrFormulaKey)}>
          {STR_FORMULA_ORDER.map((k) => (
            <option key={k} value={k}>
              {k === 'hibrida' ? `${STR_FORMULAS[k].label} (Recomendada)` : STR_FORMULAS[k].label} — {STR_FORMULAS[k].desc}
            </option>
          ))}
        </select>
      </div>
      <div className="str-formula-desc">{STR_FORMULAS[formula].desc}</div>

      {repsForaDaZona && (
        <div className="str-reps-warn">⚠️ Para máxima precisão, use entre 1 e 12 repetições.</div>
      )}

      <button className="btn btn-primary btn-full" onClick={handleCalcular}>
        Calcular &amp; Salvar Recorde
      </button>
    </div>
  );
}
