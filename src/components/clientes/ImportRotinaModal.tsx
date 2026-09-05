import { useState } from 'react';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useUIStore } from '../../store/useUIStore';
import { parseImportText, groupParsedItems } from '../../utils/importParser';
import type { ParsedImportItem } from '../../utils/importParser';
import { GROUP_LABELS } from '../../types/workout';
import type { AlunoExercicioForca } from '../../types/aluno';
import '../modals/ImportWorkoutModal.css';

interface ImportRotinaModalProps {
  alunoId: string;
  day: number;
  onClose: () => void;
}

function toAlunoExercicio(p: ParsedImportItem): AlunoExercicioForca {
  const repsVaried = p.serieReps.some((r) => r !== p.serieReps[0]);
  return {
    nome: p.rawName,
    series: p.sets,
    reps: repsVaried ? p.serieReps.join('/') : String(p.reps),
    carga: p.load,
    ...(p.notes && { notes: p.notes }),
    ...(p.groupId && { groupId: p.groupId, groupType: p.groupType }),
  };
}

function renderPreviewLine(p: ParsedImportItem, i: number) {
  return (
    <div className="parse-item" key={i}>
      <div className="parse-dot" style={{ background: 'var(--teal)' }} />
      <div style={{ flex: 1 }}>
        <div className="parse-name">{p.rawName}</div>
        <div className="parse-detail">
          {p.sets}×{p.serieReps.join('/')} ·{' '}
          {p.serieLoads.some((l) => l > 0) ? p.serieLoads.map((l) => `${l}kg`).join(' · ') : 'sem carga'}
        </div>
        {p.notes && (
          <div className="parse-note">
            <span className="parse-hash">#</span> {p.notes}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Treino Por Extenso" pro fluxo Clientes > Ver Rotina > Editar Rotina.
 * Reaproveita a mesma linguagem de utils/importParser.ts (Bi-Set `+` e
 * Tri-Set `+..+`), convertendo cada ParsedImportItem pro schema mais
 * simples de AlunoExercicio (texto livre, sem exId — ver types/aluno.ts).
 */
export function ImportRotinaModal({ alunoId, day, onClose }: ImportRotinaModalProps) {
  const exercises = useExerciseStore((s) => s.exercises);
  const addExerciciosBulk = useAlunoStore((s) => s.addExerciciosBulk);
  const showToast = useUIStore((s) => s.showToast);

  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState<ParsedImportItem[]>([]);
  const [hasParsed, setHasParsed] = useState(false);

  function handleParse() {
    const result = parseImportText(rawText, exercises);
    setItems(result.items);
    setHasParsed(true);
  }

  function handleConfirm() {
    addExerciciosBulk(alunoId, day, items.map(toAlunoExercicio));
    showToast(`${items.length} exercícios importados para a rotina.`, 'success');
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importar Treino por Extenso</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <textarea
          className="import-textarea"
          placeholder={
            'Ex: Supino Reto 4x10 80kg\nElevação lateral 3X15 4kg + Crucifixo inverso 3kg 3X15\nFrancês na polia 15kg 3X12+ Rosca direta 3X15 4kg+ Testa 3X12 5kg'
          }
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={6}
        />

        <button className="btn-block-primary" onClick={handleParse}>
          Pré-visualizar
        </button>

        {hasParsed && (
          <div className="import-preview">
            {items.length === 0 ? (
              <div className="import-empty">
                Formato não reconhecido. Use: Nome Sériesx Reps Cargakg (use + pra Bi-Set/Tri-Set)
              </div>
            ) : (
              <>
                {(() => {
                  let cursor = 0;
                  return groupParsedItems(items).map((group, gi) => {
                    const startIdx = cursor;
                    cursor += group.length;
                    if (group.length === 1) return renderPreviewLine(group[0], startIdx);
                    return (
                      <div className="cj-group" key={`grp-${gi}`} style={{ marginBottom: 10 }}>
                        <div className="cj-group-header">
                          <span className="cj-group-badge">{GROUP_LABELS[group[0].groupType ?? 'biset']}</span>
                          <span className="cj-group-desc">{group.length} exercícios conjugados</span>
                        </div>
                        {group.map((p, k) => (
                          <div key={startIdx + k}>
                            {k > 0 && <div className="cj-connector" />}
                            {renderPreviewLine(p, startIdx + k)}
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
                <button className="btn-block-primary" onClick={handleConfirm}>
                  Confirmar Importação
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
