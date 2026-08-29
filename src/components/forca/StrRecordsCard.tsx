import { useExerciseStore } from '../../store/useExerciseStore';
import { useStrengthStore } from '../../store/useStrengthStore';
import { MUSCLE_COLOR } from '../../data/muscleColors';
import { STR_FORMULAS } from '../../utils/strengthCalc';

/** Sucessor do CARD 3 (Recordes Pessoais) + strRenderRecords() (index.html ~3034-3043, ~9341-9370). */
export function StrRecordsCard() {
  const records = useStrengthStore((s) => s.records);
  const exercises = useExerciseStore((s) => s.exercises);

  const entries = Object.entries(records).sort((a, b) => b[1].oneRM - a[1].oneRM);

  return (
    <div className="card">
      <div className="card-title">Recordes Pessoais Salvos</div>

      {entries.length === 0 ? (
        <div className="str-records-empty">
          Nenhum recorde ainda.
          <br />
          Execute seu primeiro cálculo acima. 💪
        </div>
      ) : (
        entries.map(([name, data]) => {
          const exObj = exercises.find((e) => e.name === name);
          const color = exObj ? MUSCLE_COLOR[exObj.agonist] ?? 'var(--teal)' : 'var(--teal)';
          const fLabel = data.formula ? STR_FORMULAS[data.formula]?.label ?? data.formula : 'Híbrida';
          const rirLabel = data.rir > 0 ? ` · RIR${data.rir}` : '';
          return (
            <div className="str-record-item" key={name}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="str-record-name">{name}</div>
                <div className="str-record-meta">
                  {data.weight}kg × {data.reps}reps{rirLabel} · {fLabel} · {data.date || ''}
                </div>
              </div>
              <div className="str-record-rm" style={{ color }}>
                {data.oneRM.toFixed(1)}
                <span className="str-record-rm-unit"> KG</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
