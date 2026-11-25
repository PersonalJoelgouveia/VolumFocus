// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../lib/firebase', () => ({ auth: {}, db: {}, storage: {}, firebaseApp: {} }));
vi.mock('../../../lib/notificacaoRepository', () => ({ registrarTreinoConcluido: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../utils/restAlarm', () => ({ cancelAlarm: vi.fn(), ensureAlarmRinging: vi.fn(), scheduleAlarm: vi.fn() }));
vi.mock('../../../utils/timerSounds', () => ({ unlockAudio: vi.fn() }));
vi.mock('../ExecutionMediaSection', () => ({ ExecutionMediaSection: () => null }));

import { useExecStore } from '../../../store/useExecStore';
import { useWorkoutStore } from '../../../store/useWorkoutStore';
import { useExerciseStore } from '../../../store/useExerciseStore';
import { useUIStore } from '../../../store/useUIStore';
import { ExecutionModal } from '../ExecutionModal';

const EX = { id: 'bike', name: 'Bicicleta Ergométrica', type: 'cardio', agonist: 'Cardio', synergist: [] };

beforeEach(() => {
  useUIStore.setState({ isPersonalMode: false, isAlunoMode: true });
  useExerciseStore.setState({ exercises: [EX as never] });
  useWorkoutStore.setState({
    weekLog: { 0: [{ exId: 'bike', type: 'cardio', duration: 30, intensity: 7, hrZone: 'z3' }] } as never,
    exDone: {} as never,
  });
  useExecStore.getState().open(0, 0, { isCardio: true, totalSets: 1, durationSec: 1800 });
});
afterEach(() => {
  cleanup();
  useExecStore.getState().close();
});

describe('ExecutionModal — cardio', () => {
  it('mostra o tempo prescrito, o check do cardio e esconde presets/±30s', () => {
    render(<ExecutionModal />);
    expect(screen.getByText('30:00')).toBeTruthy();
    expect(screen.getByText('Progresso do cardio')).toBeTruthy();
    expect(screen.queryByText('− 30s')).toBeNull();
    expect(screen.queryByText('30s')).toBeNull();
  });
  it('tocar no check conclui e computa; tocar de novo desfaz', () => {
    render(<ExecutionModal />);
    const pill = screen.getByLabelText('Marcar cardio como concluído');
    fireEvent.click(pill);
    expect(useWorkoutStore.getState().exDone['0:0' as never]).toBe(true);
    fireEvent.click(screen.getByLabelText('Cardio concluído — toque para desfazer'));
    expect(useWorkoutStore.getState().exDone['0:0' as never]).toBeUndefined();
  });
  it('ao fim do cronômetro o cardio é concluído sozinho', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    useExecStore.getState().open(0, 0, { isCardio: true, totalSets: 1, durationSec: 60 });
    render(<ExecutionModal />);
    act(() => useExecStore.getState().startTimer());
    act(() => {
      vi.setSystemTime(Date.now() + 61_000);
      vi.advanceTimersByTime(500);
    });
    expect(useWorkoutStore.getState().exDone['0:0' as never]).toBe(true);
    expect(useExecStore.getState().done).toEqual([true]);
    vi.useRealTimers();
  });
});
