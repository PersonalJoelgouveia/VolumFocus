import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkoutStore, notificarCargaEditada } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useUIStore } from '../../store/useUIStore';
import { isCardioLogEntry } from '../../types/workout';
import type { DayIndex, WorkoutDayLog } from '../../types/workout';
import { applyNotepadText, serializeDayLog } from '../../utils/workoutNotepad';
import type { NotepadError } from '../../utils/workoutNotepad';
import './WorkoutNotepad.css';

const DEBOUNCE_MS = 700;
/** Referência estável: um `?? []` novo a cada render derruba o React (erro #185). */
const EMPTY_LOG: WorkoutDayLog = [];

type Status = 'synced' | 'typing' | 'error';

interface WorkoutNotepadProps {
  day: DayIndex;
}

/**
 * Bloco de Notas do Treino — o treino do dia inteiro como texto editável
 * (função inversa do importador; conversão em utils/workoutNotepad.ts).
 *
 * Sincronização: cada pausa de digitação (700 ms), o `blur`, ao esconder a aba
 * e ao fechar o modo, o texto é lido, validado e gravado no log do dia. É
 * TUDO-OU-NADA: se qualquer linha estiver inválida, nada é gravado (e as
 * linhas com problema são listadas) — assim uma linha pela metade nunca apaga
 * exercícios. Quando o log muda por outro caminho (timer, "+ Exercício",
 * sync do Personal) o texto é reescrito, exceto enquanto a pessoa digita.
 *
 * Deve ser montado com `key={day}`: trocar de dia remonta e grava o rascunho
 * pendente do dia anterior no cleanup.
 */
export function WorkoutNotepad({ day }: WorkoutNotepadProps) {
  const dayLog = useWorkoutStore((s) => s.weekLog[day]) ?? EMPTY_LOG;
  const pse = useWorkoutStore((s) => s.weekPSE[day]);
  const exercises = useExerciseStore((s) => s.exercises);
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);

  const canonical = useMemo(() => serializeDayLog(dayLog, exercises, pse), [dayLog, exercises, pse]);

  const [draft, setDraft] = useState(canonical);
  const [status, setStatus] = useState<Status>('synced');
  const [errors, setErrors] = useState<NotepadError[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const lastCanonicalRef = useRef(canonical);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleRef = useRef(isPersonalMode ? 'personal' : 'aluno');
  roleRef.current = isPersonalMode ? 'personal' : 'aluno';

  /** Valida o texto atual e, se estiver tudo certo, grava no treino. */
  const applyDraft = useCallback((): boolean => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const store = useWorkoutStore.getState();
    const exs = useExerciseStore.getState().exercises;
    const oldLog = store.weekLog[day] ?? EMPTY_LOG;
    const curPse = store.weekPSE[day];

    const r = applyNotepadText(draftRef.current, oldLog, exs, { role: roleRef.current as 'personal' | 'aluno' });
    setErrors(r.errors);
    setWarnings(r.warnings);
    if (!r.ok) {
      setStatus('error');
      return false;
    }

    const nextPse = r.pse ?? curPse;
    const before = serializeDayLog(oldLog, exs, curPse);
    const after = serializeDayLog(r.log, exs, nextPse);

    if (after !== before) {
      // exDone é indexado por posição: remapeia para as novas posições.
      const wasDone = r.oldIndexOf.map((o) => o !== null && !!store.exDone[`${day}:${o}`]);
      store.clearDayDone(day);
      store.setDayLog(day, r.log);
      wasDone.forEach((done, i) => done && store.markExerciseDone(day, i));

      // Edição de peso feita aqui também precisa chegar ao sync Personal ⇄ aluno.
      r.log.forEach((entry, i) => {
        const o = r.oldIndexOf[i];
        if (o === null || isCardioLogEntry(entry)) return;
        const prev = oldLog[o];
        if (prev && !isCardioLogEntry(prev) && entry.load !== prev.load) notificarCargaEditada(entry.exId, entry.load);
      });
    }
    if (r.pse !== null && r.pse !== curPse) store.setDayPSE(day, r.pse);

    lastCanonicalRef.current = after;
    dirtyRef.current = false;
    setStatus('synced');
    return true;
  }, [day]);

  const applyRef = useRef(applyDraft);
  applyRef.current = applyDraft;

  // Mudança vinda de fora (timer, "+ Exercício", sync): reescreve o texto, a menos que esteja digitando.
  useEffect(() => {
    if (canonical === lastCanonicalRef.current) return;
    lastCanonicalRef.current = canonical;
    if (dirtyRef.current) return;
    draftRef.current = canonical;
    setDraft(canonical);
    setErrors([]);
    setWarnings([]);
    setStatus('synced');
  }, [canonical]);

  // Grava o rascunho pendente ao desmontar (trocar de dia / sair do modo) e ao esconder a aba.
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) applyRef.current();
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      if (timerRef.current) clearTimeout(timerRef.current);
      flush();
    };
  }, []);

  function handleChange(value: string) {
    draftRef.current = value;
    dirtyRef.current = true;
    setDraft(value);
    setStatus('typing');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => applyRef.current(), DEBOUNCE_MS);
  }

  function handleBlur() {
    const ok = dirtyRef.current ? applyDraft() : status !== 'error';
    if (ok) {
      // Normaliza o texto (ex.: "12,5 kg" → "12.5kg") só depois de sair do campo.
      const exs = useExerciseStore.getState().exercises;
      const store = useWorkoutStore.getState();
      const norm = serializeDayLog(store.weekLog[day] ?? EMPTY_LOG, exs, store.weekPSE[day]);
      draftRef.current = norm;
      setDraft(norm);
    }
  }

  const lineCount = draft.split('\n').length;

  return (
    <div className="np-wrap">
      <textarea
        className="np-textarea"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        rows={Math.min(28, Math.max(9, lineCount + 2))}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="Treino do dia em texto"
        aria-invalid={status === 'error'}
        placeholder={'Supino Reto 4x10 80kg #focar na descida\nAgachamento 3x8/8/6 100kg\nPSE: 7'}
      />

      <div className={`np-status np-status-${status}`} role="status" aria-live="polite">
        {status === 'synced' && '✓ Sincronizado com o treino'}
        {status === 'typing' && 'Editando…'}
        {status === 'error' && 'Corrija as linhas abaixo — o treino só é atualizado quando todas estiverem válidas.'}
      </div>

      {errors.length > 0 && (
        <ul className="np-issues np-issues-error">
          {errors.map((e, i) => (
            <li key={i}>
              <strong>{e.line > 0 ? `Linha ${e.line}:` : 'Geral:'}</strong> {e.reason}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="np-issues np-issues-warn">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <details className="np-help">
        <summary>Como escrever</summary>
        <pre>{`Nome 3x10 80kg #nota          carga e reps iguais
Nome 3x8/8/6 80kg 82,5kg 85kg  reps e cargas por série
Nome 3x12 12,5kg              decimais: ponto ou vírgula
A 3x10 20kg + B 3x10 15kg     conjugado (Bi-Set / Tri-Set)
[Superset] A 3x10 + B 3x10    Superset ou Circuito
Esteira 30min int 6           cardio
PSE: 7                        PSE do dia`}</pre>
        {!isPersonalMode && (
          <p>Como aluno, você edita carga e repetições (dentro da janela do Personal) e pode adicionar séries e exercícios.</p>
        )}
      </details>
    </div>
  );
}
