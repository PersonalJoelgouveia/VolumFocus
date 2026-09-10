import { useState } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useUIStore } from '../store/useUIStore';
import { useTimerStore } from '../store/useTimerStore';
import { useProgressStore } from '../store/useProgressStore';
import { DAYS } from '../types/workout';
import type { GroupType, StrengthLogEntry } from '../types/workout';
import { isCardioLogEntry } from '../types/workout';
import { DayExerciseList } from '../components/registro/DayExerciseList';
import { ConjugarBar } from '../components/registro/ConjugarBar';
import { SessionTabsBar } from '../components/registro/SessionTabsBar';
import { AlunoRotinaSyncBanner } from '../components/registro/AlunoRotinaSyncBanner';
import { RegistroActionsMenu } from '../components/registro/RegistroActionsMenu';
import { useSessionStore } from '../store/useSessionStore';
import type { ListMode } from '../components/registro/ExerciseListItem';

/**
 * View "Treinos" (Registro) — sucessora de renderDayContent() com as 4
 * ações do módulo de treino portadas do monolito: Clonar Dia, Reordenar
 * (drag & drop), Conjugar (agrupar em Bi-Set/Tri-Set/Superset/Circuito) e
 * + Exercício (busca + criação customizada). O modal de execução com anel
 * de gestos (abrir um exercício individual) segue fora de escopo — aqui
 * cada linha oferece apenas "Remover" como controle direto.
 */
export function RegistroView() {
  const selectedDay = useWorkoutStore((s) => s.selectedDay);
  const selectDay = useWorkoutStore((s) => s.selectDay);
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const dayLog = weekLog[selectedDay] ?? [];
  const setDayLog = useWorkoutStore((s) => s.setDayLog);

  const isPersonalMode = useUIStore((s) => s.isPersonalMode);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessao = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : undefined;
  const openModal = useUIStore((s) => s.openModal);
  const showToast = useUIStore((s) => s.showToast);

  const isTimerActive = useTimerStore((s) => s.isRunning || s.isPaused);
  const askToStart = useTimerStore((s) => s.askToStart);

  const checkEntries = useProgressStore((s) => s.checkEntries);

  const [mode, setMode] = useState<ListMode>('normal');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [groupType, setGroupType] = useState<GroupType>('biset');

  const freeCount = dayLog.filter((e) => !e.groupId).length;

  function handleCheckProgress() {
    const strengthEntries = dayLog.filter((e): e is StrengthLogEntry => !isCardioLogEntry(e));
    if (!strengthEntries.length) {
      showToast('Nenhum exercício de força para validar hoje.');
      return;
    }
    const before = useProgressStore.getState().popupMessages.length;
    checkEntries(strengthEntries, weekLog);
    const after = useProgressStore.getState().popupMessages.length;
    if (after === before) {
      showToast('Progressão dentro do esperado — nenhum alerta.', 'success');
    }
  }

  /** Toggle "Reordenar" ↔ "Concluir" — mutuamente exclusivo com Conjugar. */
  function handleToggleReorder() {
    if (mode === 'reorder') {
      setMode('normal');
      showToast('Ordem atualizada.', 'success');
      return;
    }
    setSelectedIndices(new Set());
    setMode('reorder');
  }

  /** Toggle do modo de seleção Conjugar — mutuamente exclusivo com Reordenar. */
  function handleToggleConjugar() {
    if (mode === 'conjugar') {
      setSelectedIndices(new Set());
      setMode('normal');
      return;
    }
    setMode('conjugar');
  }

  function handleToggleSelect(idx: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);

      // Mesma heurística do original: sugere Tri-Set a partir de 3
      // selecionados, volta pra Bi-Set com 2 (índices no plural genérico
      // — Superset/Circuito seguem como escolha manual do usuário).
      if (next.size >= 3 && groupType === 'biset') setGroupType('triset');
      else if (next.size === 2 && groupType === 'triset') setGroupType('biset');

      return next;
    });
  }

  function handleConfirmGroup() {
    if (selectedIndices.size < 2) return;
    const groupId = `g${Date.now()}`;
    const next = dayLog.map((entry, i) =>
      selectedIndices.has(i) ? { ...entry, groupId, groupType } : entry
    );
    setDayLog(selectedDay, next);
    showToast(`${selectedIndices.size} exercícios conjugados.`, 'success');
    setSelectedIndices(new Set());
    setMode('normal');
  }

  function handleCancelConjugar() {
    setSelectedIndices(new Set());
    setMode('normal');
  }

  function handleUngroup(groupId: string) {
    const next = dayLog.map((entry) => {
      if (entry.groupId !== groupId) return entry;
      const { groupId: _g, groupType: _t, ...rest } = entry;
      return rest as typeof entry;
    });
    setDayLog(selectedDay, next);
    showToast('Grupo desfeito.', 'success');
  }

  return (
    <div>
      {isPersonalMode && <SessionTabsBar />}
      <AlunoRotinaSyncBanner />

      <div className="sec-row">
        <div className="page-title">
          Treinos <span className="tag">SEMANA ATUAL</span>
          {isPersonalMode && activeSessao && (
            <span className="tag" style={{ marginLeft: 6, background: 'var(--teal-glow)', color: 'var(--teal)' }}>
              SESSÃO · {activeSessao.alunoNome.split(' ')[0]}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {mode === 'normal' && (
            <>
              <button className="btn btn-primary" onClick={() => openModal('add-exercise')}>
                + Exercício
              </button>
              <button className="btn btn-ghost" onClick={() => openModal('rotinas')}>
                📁 Rotinas
              </button>
              <button className="btn btn-primary" onClick={handleCheckProgress}>
                📈 Verificar Progressão
              </button>
            </>
          )}

          <RegistroActionsMenu
            mode={mode}
            dayLogLength={dayLog.length}
            freeCount={freeCount}
            isTimerActive={isTimerActive}
            onCronometrar={askToStart}
            onImportar={() => openModal('import-workout')}
            onClonarDia={() => openModal('clone-day')}
            onToggleConjugar={handleToggleConjugar}
            onToggleReorder={handleToggleReorder}
          />
        </div>
      </div>

      <div className="level-pill">
        {DAYS.map((day, i) => (
          <button
            key={day}
            className={`lv-btn${selectedDay === i ? ' active' : ''}`}
            onClick={() => selectDay(i as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
            disabled={mode !== 'normal'}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          Log de {DAYS[selectedDay]} · {dayLog.length} exercício{dayLog.length === 1 ? '' : 's'}
          {mode === 'reorder' && <span className="tag" style={{ marginLeft: 8 }}>ARRASTE PARA REORDENAR</span>}
          {mode === 'conjugar' && <span className="tag" style={{ marginLeft: 8 }}>TOQUE PARA SELECIONAR</span>}
        </div>

        <DayExerciseList
          dayLog={dayLog}
          mode={mode}
          selectedIndices={selectedIndices}
          onToggleSelect={handleToggleSelect}
          onUngroup={handleUngroup}
        />
      </div>

      {mode === 'conjugar' && (
        <ConjugarBar
          count={selectedIndices.size}
          groupType={groupType}
          onChangeType={setGroupType}
          onConfirm={handleConfirmGroup}
          onCancel={handleCancelConjugar}
        />
      )}
    </div>
  );
}
