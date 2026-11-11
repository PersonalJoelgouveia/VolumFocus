import { useEffect, useMemo } from 'react';
import { Check, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAchievementStore } from '../../store/useAchievementStore';
import { useTimerAudioStore } from '../../store/useTimerAudioStore';
import { registrarTreinoConcluido } from '../../lib/notificacaoRepository';
import { playSound } from '../../utils/timerSounds';
import { useRestCountdown } from '../../hooks/useRestCountdown';
import { GROUP_LABELS, isCardioLogEntry } from '../../types/workout';
import type { DayIndex, WorkoutDayLog } from '../../types/workout';
import { findCursor, isEntryComplete, isRoundComplete, setsOf, withSetDone } from '../../utils/notepadProgress';
import './NotepadTimerBar.css';

const DEFAULT_REST = 90;
const EMPTY_LOG: WorkoutDayLog = [];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface NotepadTimerBarProps {
  day: DayIndex;
}

/**
 * Barra fixa na parte de baixo durante o Bloco de Notas: mostra o exercício e a
 * série atuais (derivados do próprio log — `doneSerie`/`exDone`), controla o
 * timer de descanso e avança sozinha para a próxima série/exercício.
 *
 * Fluxo: "✓ Série feita" marca a série, e se há próxima começa o descanso. Ao
 * fim do descanso o alarme toca e a barra passa a chamar a série seguinte. Em
 * conjugados as séries alternam entre os membros (A1, B1, A2, B2…) e o descanso
 * só vem ao fim da rodada. Concluir o último exercício encerra o treino do dia.
 *
 * Estado do timer é local: vive enquanto o modo Bloco de Notas está aberto.
 */
export function NotepadTimerBar({ day }: NotepadTimerBarProps) {
  const dayLog = useWorkoutStore((s) => s.weekLog[day]) ?? EMPTY_LOG;
  const exDone = useWorkoutStore((s) => s.exDone);
  const exercises = useExerciseStore((s) => s.exercises);
  const showToast = useUIStore((s) => s.showToast);

  const timer = useRestCountdown(DEFAULT_REST, () => showToast('⏰ Descanso finalizado — bora pra próxima série!'));

  // Sobe o widget do cronômetro global para não ficar escondido atrás da barra.
  useEffect(() => {
    document.body.classList.add('np-bar-open');
    return () => document.body.classList.remove('np-bar-open');
  }, []);

  // Alarme: toca ao terminar o descanso e repete algumas vezes até a pessoa agir.
  useEffect(() => {
    if (!timer.ringing) return;
    const { endSound, volume, vibrationEnabled } = useTimerAudioStore.getState();
    playSound(endSound, volume);
    if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch {
        /* vibração indisponível */
      }
    }
    let n = 0;
    const id = setInterval(() => {
      if (++n >= 4) {
        clearInterval(id);
        return;
      }
      playSound(endSound, volume);
    }, 2000);
    return () => clearInterval(id);
  }, [timer.ringing]);

  const cursor = useMemo(
    () => findCursor(dayLog, (i) => isEntryComplete(dayLog[i], i, day, exDone)),
    [dayLog, exDone, day]
  );

  const nameOf = (exId: string) => exercises.find((e) => e.id === exId)?.name ?? exId;

  /** Pré-visualiza o que vem depois de concluir o cursor atual (sem gravar nada). */
  const upNext = useMemo(() => {
    if (!cursor) return null;
    const e = dayLog[cursor.idx];
    let after: WorkoutDayLog = dayLog;
    if (!isCardioLogEntry(e)) {
      after = dayLog.map((x, i) => (i === cursor.idx ? { ...e, doneSerie: withSetDone(e, cursor.set) } : x));
    }
    const isComplete = (i: number) =>
      (i === cursor.idx && isCardioLogEntry(e)) || isEntryComplete(after[i], i, day, exDone);
    const next = findCursor(after, isComplete);
    if (!next) return 'Último — fim do treino';
    const ne = after[next.idx];
    if (isCardioLogEntry(ne)) return `${nameOf(ne.exId)} · ${ne.duration}min`;
    const sameExercise = next.idx === cursor.idx;
    return `${sameExercise ? '' : nameOf(ne.exId) + ' · '}Série ${next.set + 1}/${setsOf(ne)}`;
  }, [cursor, dayLog, exDone, day, exercises]);

  if (dayLog.length === 0) return null;

  const current = cursor ? dayLog[cursor.idx] : null;
  const allDone = cursor === null;

  /** Gesto do usuário: libera o áudio (política de autoplay) tocando um som mudo. */
  function unlockAudio() {
    const { endSound } = useTimerAudioStore.getState();
    playSound(endSound, 0);
  }

  function finishExercise(idx: number) {
    const store = useWorkoutStore.getState();
    const e = store.weekLog[day]?.[idx];
    if (!e) return;
    store.markExerciseDone(day, idx);
    const name = nameOf(e.exId);
    showToast(`🏆 ${name} — todas as séries concluídas!`);
    if (!isCardioLogEntry(e)) {
      const loads = e.serieLoads?.length ? e.serieLoads : [e.load || 0];
      useAchievementStore.getState().checkTita(name, Math.max(...loads));
    }
    useAchievementStore.getState().fireCheckIn();
  }

  function notifyDayDone() {
    const { isPersonalMode } = useUIStore.getState();
    const authUser = useAuthStore.getState().user;
    if (isPersonalMode || !authUser?.email) return;
    registrarTreinoConcluido(authUser.email, authUser.name, day).catch((err) =>
      console.error('NotepadTimerBar: falha ao registrar treino concluído', err)
    );
  }

  function completeCurrent() {
    unlockAudio();
    timer.stopRing();
    const store = useWorkoutStore.getState();
    const log = store.weekLog[day] ?? EMPTY_LOG;
    const cur = findCursor(log, (i) => isEntryComplete(log[i], i, day, store.exDone));
    if (!cur) return;
    const e = log[cur.idx];

    if (isCardioLogEntry(e)) {
      finishExercise(cur.idx);
    } else {
      const doneSerie = withSetDone(e, cur.set);
      store.updateLogEntry(day, cur.idx, { doneSerie });
      if (doneSerie.every(Boolean)) finishExercise(cur.idx);
      else showToast(`💪 Série ${cur.set + 1} concluída`);
    }

    const fresh = useWorkoutStore.getState();
    const log2 = fresh.weekLog[day] ?? EMPTY_LOG;
    const isComplete = (i: number) => isEntryComplete(log2[i], i, day, fresh.exDone);
    const next = findCursor(log2, isComplete);
    if (!next) {
      timer.reset();
      showToast('🏆 Treino do dia concluído!');
      notifyDayDone();
      return;
    }
    if (isRoundComplete(log2, cur, isComplete)) timer.start();
    else timer.reset();
  }

  function skipRest() {
    unlockAudio();
    timer.reset();
  }

  const resting = timer.running;
  const label = allDone
    ? '🏆 Treino do dia concluído'
    : timer.ringing
      ? '⏰ Descanso acabou — hora da próxima série!'
      : resting
        ? 'Descansando…'
        : 'Em execução';

  return (
    <div className={`npbar${timer.ringing ? ' npbar-ringing' : ''}${resting ? ' npbar-resting' : ''}`} role="region" aria-label="Timer de descanso e exercício atual">
      <div className="npbar-main">
        <div className="npbar-info">
          <div className="npbar-label">{label}</div>
          {current && cursor && (
            <>
              <div className="npbar-name">
                {nameOf(current.exId)}
                {current.groupId && current.groupType && (
                  <span className="npbar-badge">{GROUP_LABELS[current.groupType]}</span>
                )}
              </div>
              <div className="npbar-detail">
                {isCardioLogEntry(current)
                  ? `${current.duration}min · int ${current.intensity}`
                  : `Série ${cursor.set + 1}/${setsOf(current)} · ${current.serieReps?.[cursor.set] ?? current.reps} reps${
                      (current.serieLoads?.[cursor.set] ?? current.load) > 0 ? ` × ${current.serieLoads?.[cursor.set] ?? current.load}kg` : ''
                    }`}
              </div>
              {upNext && <div className="npbar-next">A seguir: {upNext}</div>}
            </>
          )}
        </div>
        <button
          type="button"
          className="npbar-time"
          onClick={() => {
            unlockAudio();
            timer.toggle();
          }}
          aria-label={timer.running ? 'Pausar descanso' : 'Iniciar descanso'}
        >
          {fmt(timer.remaining)}
        </button>
      </div>

      <div className="npbar-controls">
        <button type="button" className="npbar-btn" onClick={() => timer.adjust(-30)} aria-label="Menos 30 segundos">
          −30
        </button>
        <button
          type="button"
          className="npbar-btn npbar-icon"
          onClick={() => {
            unlockAudio();
            timer.toggle();
          }}
          aria-label={timer.running ? 'Pausar' : 'Iniciar'}
        >
          {timer.running ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" className="npbar-btn npbar-icon" onClick={timer.reset} aria-label="Zerar timer">
          <RotateCcw size={16} />
        </button>
        <button type="button" className="npbar-btn" onClick={() => timer.adjust(30)} aria-label="Mais 30 segundos">
          +30
        </button>
        {(resting || timer.ringing) && (
          <button type="button" className="npbar-btn npbar-icon" onClick={skipRest} aria-label="Pular descanso" title="Pular descanso">
            <SkipForward size={16} />
          </button>
        )}
        <button type="button" className="npbar-done" onClick={completeCurrent} disabled={allDone}>
          <Check size={18} /> {current && isCardioLogEntry(current) ? 'Cardio feito' : 'Série feita'}
        </button>
      </div>
    </div>
  );
}
