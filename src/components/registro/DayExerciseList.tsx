import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { buildDayLogRows } from '../../utils/dayLogGrouping';
import { GROUP_LABELS } from '../../types/workout';
import type { WorkoutDayLog } from '../../types/workout';
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
 * `mode === 'reorder'`, via useReorderDrag.
 */
export function DayExerciseList({ dayLog, mode, selectedIndices, onToggleSelect, onUngroup }: DayExerciseListProps) {
  const selectedDay = useWorkoutStore((s) => s.selectedDay);
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const setDayLog = useWorkoutStore((s) => s.setDayLog);
  const removeLogEntry = useWorkoutStore((s) => s.removeLogEntry);
  const exercises = useExerciseStore((s) => s.exercises);

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
