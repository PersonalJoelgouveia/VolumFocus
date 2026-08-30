import { useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { WorkoutLogEntry } from '../../types/workout';
import { isCardioLogEntry } from '../../types/workout';
import type { Exercise } from '../../types/exercise';
import { MUSCLE_COLOR } from '../../data/muscleColors';
import { CARDIO_ZONES } from '../../types/cardio';
import { getLastLoad } from '../../utils/lastLoad';
import type { WeekLog } from '../../types/workout';
import { ExerciseMediaModal } from './ExerciseMediaModal';

export type ListMode = 'normal' | 'reorder' | 'conjugar';

interface ExerciseListItemProps {
  entry: WorkoutLogEntry;
  exercise: Exercise | undefined;
  mode: ListMode;
  isSelected: boolean;
  isGrouped: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  isDone: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onPlay: () => void;
  onResetDone: () => void;
  weekLog: WeekLog;
  itemProps: Record<string, unknown>;
}

/**
 * Migrado de `_exItemHtml(entry, i, inGroup)` (index.html ~4569-4608),
 * incluindo o badge de progressão vs. semana anterior (`histLoad`), os
 * chips de série/cardio, o botão "▶ Iniciar execução" (abre o
 * <ExecutionModal>) e o badge "✓ Concluído" com reset por duplo toque
 * (módulo `exDone`, index.html ~9830-9910).
 */
export function ExerciseListItem({
  entry,
  exercise,
  mode,
  isSelected,
  isGrouped,
  isDragging,
  isDragOver,
  isDone,
  onToggleSelect,
  onRemove,
  onPlay,
  onResetDone,
  weekLog,
  itemProps,
}: ExerciseListItemProps) {
  const lastTapRef = useRef(0);
  const [showMedia, setShowMedia] = useState(false);

  if (!exercise) return null;

  const isCardio = isCardioLogEntry(entry);
  const color = MUSCLE_COLOR[exercise.agonist] ?? '#888';
  const hasMedia = !!(exercise.imgInicio || exercise.imgFim || exercise.ytVideoUrl);

  const classes = ['ex-item'];
  if (mode === 'reorder') classes.push('ro-mode-item');
  if (mode === 'conjugar') classes.push('cj-mode-item');
  if (isSelected) classes.push('cj-sel');
  if (isDragging) classes.push('ro-dragging');
  if (isDragOver) classes.push('ro-drag-over');
  if (isDone && mode === 'normal') classes.push('ex-done');

  const clickable = mode === 'conjugar' && !isGrouped;

  /** Duplo toque (<380ms) no item concluído reseta o status — mesmo timing do original. */
  function handleDoneClick(e: MouseEvent) {
    if (!isDone || mode !== 'normal') return;
    if ((e.target as HTMLElement).closest('button')) return;
    const now = Date.now();
    if (now - lastTapRef.current < 380) {
      onResetDone();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  return (
    <div
      className={classes.join(' ')}
      style={{ paddingLeft: isGrouped ? 32 : undefined } as CSSProperties}
      onClick={clickable ? onToggleSelect : isDone && mode === 'normal' ? handleDoneClick : undefined}
      {...itemProps}
    >
      {mode === 'conjugar' && !isGrouped && (
        <div className={`cj-check${isSelected ? ' cj-sel-check' : ''}`}>
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--purple)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1.5,5 4,7.5 8.5,2" />
            </svg>
          )}
        </div>
      )}

      {mode === 'reorder' && (
        <div className="ro-handle" title="Arrastar para reordenar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </div>
      )}

      <div className="ex-accent" style={{ background: color }} />

      <div className="ex-info">
        <div className="ex-name">{exercise.name}</div>

        <div className="ex-tags">
          {isCardio ? (
            <span className="ex-tag ex-tag-cardio">❤️ Cardio</span>
          ) : (
            <>
              <span className="ex-tag ex-tag-ag">{exercise.agonist}</span>
              {exercise.synergist.map((m) => (
                <span className="ex-tag ex-tag-sin" key={m}>
                  {m}
                </span>
              ))}
            </>
          )}
        </div>

        <div className="serie-chips">
          {isCardio ? (
            <>
              <span className="cd-chip cd-chip-dur">⏱️ {entry.duration || 0} min</span>
              <span className="cd-chip cd-chip-int">🔥 PSE {entry.intensity ?? '-'}/10</span>
              {(() => {
                const zone = CARDIO_ZONES.find((z) => z.id === entry.hrZone) ?? CARDIO_ZONES[2];
                return (
                  <span
                    className="cd-chip cd-chip-zone"
                    style={{ background: `${zone.color}1a`, borderColor: `${zone.color}55`, color: zone.color }}
                  >
                    {zone.label} · {zone.name}
                  </span>
                );
              })()}
            </>
          ) : (
            <>
              {entry.serieLoads.length
                ? entry.serieLoads.map((l, k) => (
                    <span className="serie-chip" key={k}>
                      {entry.serieReps[k] ?? entry.reps}× {l}kg
                    </span>
                  ))
                : (
                    <span className="serie-chip">
                      {entry.sets}×{entry.reps} @ {entry.load}kg
                    </span>
                  )}
              {(() => {
                const histLoad = getLastLoad(entry.exId, weekLog);
                const currMax = entry.serieLoads.length
                  ? Math.max(0, ...entry.serieLoads.filter((x) => x > 0))
                  : entry.load || 0;
                if (!histLoad || currMax <= 0) return null;
                if (currMax > histLoad) {
                  const pct = (((currMax - histLoad) / histLoad) * 100).toFixed(0);
                  return (
                    <span className="serie-chip" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.07)' }}>
                      ▲ +{pct}%
                    </span>
                  );
                }
                if (currMax < histLoad * 0.98) {
                  const pct = (((histLoad - currMax) / histLoad) * 100).toFixed(0);
                  return (
                    <span className="serie-chip" style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.07)' }}>
                      ▼ -{pct}%
                    </span>
                  );
                }
                return null;
              })()}
            </>
          )}
        </div>

        {entry.notes && (
          <div style={{ fontSize: '0.67rem', color: 'var(--teal)', marginTop: 5, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontStyle: 'normal' }}>#</span>
            {entry.notes}
          </div>
        )}
      </div>

      {mode === 'normal' && !isDone && (
        <div className="ex-controls">
          <button
            className={`btn btn-icon btn-sm${hasMedia ? ' btn-play' : ' btn-ghost'}`}
            title={hasMedia ? 'Ver mídia do exercício' : 'Sem mídia cadastrada'}
            onClick={(e) => {
              e.stopPropagation();
              setShowMedia(true);
            }}
          >
            {hasMedia ? '🎬' : '📷'}
          </button>
          <button
            className="btn btn-play btn-icon btn-sm"
            title="Iniciar execução"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            title="Remover"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            🗑️
          </button>
        </div>
      )}

      {mode === 'normal' && isDone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className={`btn btn-icon btn-sm${hasMedia ? ' btn-play' : ' btn-ghost'}`}
            title={hasMedia ? 'Ver mídia do exercício' : 'Sem mídia cadastrada'}
            onClick={(e) => {
              e.stopPropagation();
              setShowMedia(true);
            }}
          >
            {hasMedia ? '🎬' : '📷'}
          </button>
          <div className="ex-done-badge">
            ✓ Concluído<span className="ex-done-hint">· 2× p/ resetar</span>
          </div>
        </div>
      )}

      {showMedia && <ExerciseMediaModal exercise={exercise} onClose={() => setShowMedia(false)} />}
    </div>
  );
}
