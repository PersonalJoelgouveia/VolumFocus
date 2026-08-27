import { useMemo, useState } from 'react';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useUIStore } from '../../store/useUIStore';
import { MUSCLE_GROUPS } from '../../types/exercise';
import type { MuscleGroup } from '../../types/exercise';
import { norm } from '../../utils/importParser';
import type { StrengthLogEntry, CardioLogEntry } from '../../types/workout';
import './AddExerciseModal.css';

const MODAL_ID = 'add-exercise';

/**
 * Sucessor de openAddDayModal()/handleComboInput()/confirmAddEx()
 * (index.html ~6106-6259): busca com autocomplete no banco de exercícios,
 * opção de criar um exercício customizado inline, e formulário adaptado
 * ao tipo (força: séries/reps/carga · cardio: duração/intensidade/zona).
 */
export function AddExerciseModal() {
  const openModalId = useUIStore((s) => s.openModalId);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const isOpen = openModalId === MODAL_ID;

  const exercises = useExerciseStore((s) => s.exercises);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const selectedDay = useWorkoutStore((s) => s.selectedDay);
  const addLogEntry = useWorkoutStore((s) => s.addLogEntry);

  const [query, setQuery] = useState('');
  const [selectedExId, setSelectedExId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('Peito');
  const [newIsCardio, setNewIsCardio] = useState(false);

  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [load, setLoad] = useState(0);
  const [duration, setDuration] = useState(20);
  const [intensity, setIntensity] = useState(5);
  const [notes, setNotes] = useState('');

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const n = norm(query);
    return exercises.filter((e) => norm(e.name).includes(n)).slice(0, 8);
  }, [query, exercises]);

  const selectedExercise = exercises.find((e) => e.id === selectedExId) ?? null;
  const isCardio = isCreatingNew ? newIsCardio : selectedExercise?.agonist === 'Cardio';

  if (!isOpen) return null;

  function resetAndClose() {
    setQuery('');
    setSelectedExId(null);
    setIsCreatingNew(false);
    setNewName('');
    setNewMuscle('Peito');
    setNewIsCardio(false);
    setSets(3);
    setReps(10);
    setLoad(0);
    setDuration(20);
    setIntensity(5);
    setNotes('');
    closeModal();
  }

  function handleSelectMatch(id: string) {
    const ex = exercises.find((e) => e.id === id);
    setSelectedExId(id);
    setQuery(ex?.name ?? '');
    setIsCreatingNew(false);
  }

  function handleStartCreate() {
    setIsCreatingNew(true);
    setSelectedExId(null);
    setNewName(query);
  }

  function handleConfirm() {
    let exId = selectedExId;

    if (isCreatingNew) {
      if (!newName.trim()) {
        showToast('Informe o nome do exercício.', 'warning');
        return;
      }
      const id = `custom${Date.now()}`;
      addExercise({
        id,
        name: newName.trim(),
        agonist: newIsCardio ? 'Cardio' : newMuscle,
        ...(newIsCardio ? { type: 'cardio' as const } : {}),
        synergist: [],
        stabilizer: [],
      });
      exId = id;
    }

    if (!exId) {
      showToast('Selecione um exercício ou crie um novo.', 'warning');
      return;
    }

    const entry: StrengthLogEntry | CardioLogEntry = isCardio
      ? {
          exId,
          type: 'cardio',
          duration,
          intensity,
          hrZone: 3,
          ...(notes.trim() && { notes: notes.trim() }),
        }
      : {
          exId,
          sets,
          reps,
          load,
          serieLoads: Array(sets).fill(load),
          serieReps: Array(sets).fill(reps),
          ...(notes.trim() && { notes: notes.trim() }),
        };

    addLogEntry(selectedDay, entry);
    showToast('Exercício adicionado.', 'success');
    resetAndClose();
  }

  return (
    <div className="modal-backdrop" onClick={resetAndClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>+ Exercício</h2>
          <button className="modal-close" onClick={resetAndClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {!isCreatingNew && (
          <div className="addex-combo">
            <input
              className="addex-search"
              placeholder="Buscar exercício..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedExId(null);
              }}
            />
            {query.trim() && !selectedExId && (
              <div className="addex-dropdown">
                {matches.map((ex) => (
                  <button key={ex.id} className="addex-dropdown-item" onClick={() => handleSelectMatch(ex.id)}>
                    <span>{ex.name}</span>
                    <span className="addex-dropdown-tag">{ex.agonist}</span>
                  </button>
                ))}
                <button className="addex-dropdown-item addex-dropdown-create" onClick={handleStartCreate}>
                  ➕ Criar "{query}" como novo exercício
                </button>
              </div>
            )}
          </div>
        )}

        {isCreatingNew && (
          <div className="addex-new-block">
            <label className="addex-label">Nome do exercício</label>
            <input className="addex-input" value={newName} onChange={(e) => setNewName(e.target.value)} />

            <label className="addex-checkbox-row">
              <input type="checkbox" checked={newIsCardio} onChange={(e) => setNewIsCardio(e.target.checked)} />
              É exercício cardio
            </label>

            {!newIsCardio && (
              <>
                <label className="addex-label">Grupo muscular (agonista)</label>
                <select className="addex-input" value={newMuscle} onChange={(e) => setNewMuscle(e.target.value as MuscleGroup)}>
                  {MUSCLE_GROUPS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button className="addex-back-btn" onClick={() => setIsCreatingNew(false)}>
              ← Voltar para busca
            </button>
          </div>
        )}

        {(selectedExId || isCreatingNew) && (
          <div className="addex-form">
            {isCardio ? (
              <>
                <div className="addex-field-row">
                  <label className="addex-label">Duração (min)</label>
                  <input
                    type="number"
                    className="addex-input"
                    min={1}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </div>
                <div className="addex-field-row">
                  <label className="addex-label">Intensidade (PSE 1-10)</label>
                  <input
                    type="number"
                    className="addex-input"
                    min={1}
                    max={10}
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="addex-field-row">
                  <label className="addex-label">Séries</label>
                  <input
                    type="number"
                    className="addex-input"
                    min={1}
                    value={sets}
                    onChange={(e) => setSets(Number(e.target.value))}
                  />
                </div>
                <div className="addex-field-row">
                  <label className="addex-label">Reps</label>
                  <input
                    type="number"
                    className="addex-input"
                    min={1}
                    value={reps}
                    onChange={(e) => setReps(Number(e.target.value))}
                  />
                </div>
                <div className="addex-field-row">
                  <label className="addex-label">Carga (kg)</label>
                  <input
                    type="number"
                    className="addex-input"
                    min={0}
                    step={0.5}
                    value={load}
                    onChange={(e) => setLoad(Number(e.target.value))}
                  />
                </div>
              </>
            )}

            <label className="addex-label">Observações (opcional)</label>
            <input className="addex-input" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <button className="btn-block-primary" onClick={handleConfirm}>
              Adicionar ao dia
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
