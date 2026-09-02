import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useExecStore } from '../../store/useExecStore';
import { buildDayLogRows } from '../../utils/dayLogGrouping';
import { GROUP_LABELS } from '../../types/workout';
import type { WorkoutDayLog } from '../../types/workout';
import { isCardioLogEntry } from '../../types/workout';
import { useReorderDrag } from '../../hooks/useReorderDrag';
import { ExerciseListItem } from './ExerciseListItem';
import type { ListMode } from './ExerciseListItem';
import './DayExerciseList.css';

interface DayExerciseListProps {
  dayLog: WorkoutDayLog;
  mode: ListMode;
  selectedIndices: Set<number>;
  onToggleSelect: (idx: number) => void;
  onUngroup: (groupId: string) => void;
}

/**
 * Migrado do laço de renderização de `#day-content` (index.html
 * ~4544-4644): agrupa via buildDayLogRows() e delega cada linha/grupo a
 * ExerciseListItem. O drag & drop (desktop + touch) só fica ativo quando
 * `mode === 'reorder'`. O botão ▶ de cada item abre o <ExecutionModal>
 * via useExecStore.open(); o estado "concluído" (exDone) vem de
 * useWorkoutStore.
 */
export function DayExerciseList({ dayLog, mode, selectedIndices, onToggleSelect, onUngroup }: DayExerciseListProps) {
  const selectedDay = useWorkoutStore((s) => s.selectedDay);
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const setDayLog = useWorkoutStore((s) => s.setDayLog);
  const removeLogEntry = useWorkoutStore((s) => s.removeLogEntry);
  const exDone = useWorkoutStore((s) => s.exDone);
  const unmarkExerciseDone = useWorkoutStore((s) => s.unmarkExerciseDone);
  const markExerciseDone = useWorkoutStore((s) => s.markExerciseDone);
  const updateLogEntry = useWorkoutStore((s) => s.updateLogEntry);
  const exercises = useExerciseStore((s) => s.exercises);
  const openExec = useExecStore((s) => s.open);

  function handlePlay(idx: number) {
    const entry = dayLog[idx];
    if (!entry) return;
    if (isCardioLogEntry(entry)) {
      openExec(selectedDay, idx, { isCardio: true, totalSets: 0 });
    } else {
      openExec(selectedDay, idx, { isCardio: false, totalSets: entry.sets || 1 });
    }
  }

  function handleReorder(fromIdx: number, toIdx: number) {
    const next = [...dayLog];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDayLog(selectedDay, next);
  }

  const { getItemProps, isDragging, isDragOver } = useReorderDrag(mode === 'reorder', handleReorder);

  const rows = buildDayLogRows(dayLog);

  if (rows.length === 0) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
        Nenhum exercício registrado. Use "+ Exercício" ou "Importar Treino".
      </p>
    );
  }

  return (
    <div className="day-log-list">
      {rows.map((row) => {
        if (row.kind === 'free') {
          const ex = exercises.find((e) => e.id === row.entry.exId);
          return (
            <ExerciseListItem
              key={row.index}
              entry={row.entry}
              exercise={ex}
              mode={mode}
              isSelected={selectedIndices.has(row.index)}
              isGrouped={false}
              isDragging={isDragging(row.index)}
              isDragOver={isDragOver(row.index)}
              onToggleSelect={() => onToggleSelect(row.index)}
              onRemove={() => removeLogEntry(selectedDay, row.index)}
              onPlay={() => handlePlay(row.index)}
              isDone={!!exDone[`${selectedDay}:${row.index}`]}
              onResetDone={() => unmarkExerciseDone(selectedDay, row.index)}
              onUpdateEntry={(patch) => updateLogEntry(selectedDay, row.index, patch)}
              onMarkDone={() => markExerciseDone(selectedDay, row.index)}
              onUnmarkDone={() => unmarkExerciseDone(selectedDay, row.index)}
              weekLog={weekLog}
              itemProps={getItemProps(row.index)}
            />
          );
        }

        const groupType = row.members[0].entry.groupType ?? 'biset';
        return (
          <div className="cj-group" key={row.groupId}>
            <div className="cj-group-header">
              <span className="cj-group-badge">{GROUP_LABELS[groupType]}</span>
              <span className="cj-group-desc">{row.members.length} exercícios conjugados</span>
              {mode === 'normal' && (
                <button className="cj-ungroup-btn" onClick={() => onUngroup(row.groupId)}>
                  Desagrupar
                </button>
              )}
            </div>
            {row.members.map((m, k) => (
              <div key={`wrap-${m.index}`}>
                {k > 0 && <div className="cj-connector" key={`conn-${m.index}`} />}
                <ExerciseListItem
                  key={`item-${m.index}`}
                  entry={m.entry}
                  exercise={exercises.find((e) => e.id === m.entry.exId)}
                  mode={mode}
                  isSelected={false}
                  isGrouped
                  isDragging={isDragging(m.index)}
                  isDragOver={isDragOver(m.index)}
                  onToggleSelect={() => {}}
                  onRemove={() => removeLogEntry(selectedDay, m.index)}
                  onPlay={() => handlePlay(m.index)}
                  isDone={!!exDone[`${selectedDay}:${m.index}`]}
                  onResetDone={() => unmarkExerciseDone(selectedDay, m.index)}
                  onUpdateEntry={(patch) => updateLogEntry(selectedDay, m.index, patch)}
                  onMarkDone={() => markExerciseDone(selectedDay, m.index)}
                  onUnmarkDone={() => unmarkExerciseDone(selectedDay, m.index)}
                  weekLog={weekLog}
                  itemProps={getItemProps(m.index)}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
