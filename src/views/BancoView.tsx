import { useState } from 'react';
import { useExerciseStore } from '../store/useExerciseStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useUIStore } from '../store/useUIStore';
import { MUSCLE_COLOR } from '../data/muscleColors';
import type { Exercise } from '../types/exercise';
import { ExerciseCreatorPanel } from '../components/banco/ExerciseCreatorPanel';
import '../components/registro/DayExerciseList.css';
import '../components/banco/ExerciseCreatorPanel.css';

/**
 * Sucessor de #view-banco + renderBanco() (index.html ~2620-2755,
 * ~4959-4993): biblioteca de exercícios agrupada por músculo agonista,
 * com busca, criação inline (ExerciseCreatorPanel) e editar/remover por
 * item. PT-only (ver types/view.ts).
 */
export function BancoView() {
  const exercises = useExerciseStore((s) => s.exercises);
  const removeExercise = useExerciseStore((s) => s.removeExercise);
  const showToast = useUIStore((s) => s.showToast);

  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = exercises.filter((e) => e.name.toLowerCase().includes(q) || e.agonist.toLowerCase().includes(q));

  const grouped: Record<string, Exercise[]> = {};
  filtered.forEach((e) => {
    (grouped[e.agonist] ??= []).push(e);
  });
  const groups = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));

  const editingExercise = editingId ? exercises.find((e) => e.id === editingId) : undefined;

  async function handleDelete(ex: Exercise) {
    const ok = await useConfirmStore.getState().ask(`Remover "${ex.name}" do banco?`, {
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    removeExercise(ex.id);
    showToast('🗑️ Exercício removido', 'success');
    if (editingId === ex.id) setEditingId(null);
  }

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Banco de Exercícios <span className="tag">BIBLIOTECA</span>
        </div>
      </div>

      {editingExercise ? (
        <ExerciseCreatorPanel editing={editingExercise} onDoneEditing={() => setEditingId(null)} />
      ) : (
        <ExerciseCreatorPanel />
      )}

      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input type="text" placeholder="Buscar exercício…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="info-box mb-4">
        <h4>📐 Pesos de Volume por Papel Muscular</h4>
        <p>
          <strong>Agonista (1.0)</strong> — músculo alvo principal da carga.
          <br />
          <strong>Sinergista (0.5)</strong> — co-recrutado, apoia o movimento.
          <br />
          <strong>Estabilizador (0.25)</strong> — mantém a postura e a articulação estável.
        </p>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Nenhum exercício encontrado.</div>
      ) : (
        groups.map(([muscle, exs]) => {
          const color = MUSCLE_COLOR[muscle as keyof typeof MUSCLE_COLOR] ?? '#888';
          return (
            <div key={muscle} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                {muscle}
              </div>
              {exs.map((e) => {
                const isCardio = e.type === 'cardio';
                return (
                  <div className="ex-item" key={e.id}>
                    <div className="ex-accent" style={{ background: color }} />
                    <div className="ex-info">
                      <div className="ex-name">
                        {e.name}
                        {(e.imgInicio || e.imgFim) && (
                          <span title="Tem imagens de execução" style={{ marginLeft: 6, fontSize: '0.7rem' }}>
                            🖼️
                          </span>
                        )}
                        {e.ytVideoUrl && (
                          <span title="Tem vídeo do YouTube" style={{ marginLeft: 6, fontSize: '0.7rem' }}>
                            ▶️
                          </span>
                        )}
                      </div>
                      <div className="ex-tags">
                        {isCardio ? (
                          <span className="ex-tag ex-tag-cardio">❤️ Cardio</span>
                        ) : (
                          <>
                            <span className="ex-tag ex-tag-ag">{e.agonist}</span>
                            {e.synergist.map((s) => (
                              <span className="ex-tag ex-tag-sin" key={s}>
                                {s}
                              </span>
                            ))}
                            {e.stabilizer.map((s) => (
                              <span className="ex-tag ex-tag-est" key={s}>
                                {s}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="ex-controls">
                      <button className="btn btn-ghost btn-icon btn-sm" title="Editar exercício" onClick={() => setEditingId(e.id)}>
                        ✏️
                      </button>
                      <button className="btn btn-danger btn-icon btn-sm" title="Remover" onClick={() => handleDelete(e)}>
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
