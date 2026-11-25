// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const repo = vi.hoisted(() => ({ salvarResumoCardio: vi.fn() }));
vi.mock('../../lib/cardioSemanalRepository', () => repo);
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {}, storage: {}, firebaseApp: {} }));

import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useCardioSemanalSync } from '../useCardioSemanalSync';

function Probe() {
  useCardioSemanalSync();
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  repo.salvarResumoCardio.mockResolvedValue(undefined);
  useWorkoutStore.setState({ weekLog: { 0: [{ exId: 'e1', type: 'cardio', duration: 30, intensity: 5, hrZone: 'z2' }] } as never, exDone: { '0:0': true } as never });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useCardioSemanalSync', () => {
  it('Aluno: cardio prescrito e NAO concluido nao entra no resumo', async () => {
    useWorkoutStore.setState({ exDone: {} as never });
    useUIStore.setState({ isPersonalMode: false, isAlunoMode: true });
    useAuthStore.setState({ user: { email: 'ana@x.com' } as never });
    render(<Probe />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(repo.salvarResumoCardio.mock.calls[0][1].totalMin).toBe(0);
  });
  it('Personal: nunca envia o próprio cardio', async () => {
    useUIStore.setState({ isPersonalMode: true, isAlunoMode: false });
    useAuthStore.setState({ user: { email: 'pt@x.com' } as never });
    render(<Probe />);
    await vi.advanceTimersByTimeAsync(10000);
    expect(repo.salvarResumoCardio).not.toHaveBeenCalled();
  });
  it('Aluno: envia o resumo para o próprio e-mail e não repete sem mudança', async () => {
    useUIStore.setState({ isPersonalMode: false, isAlunoMode: true });
    useAuthStore.setState({ user: { email: 'Ana@x.com' } as never });
    render(<Probe />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(repo.salvarResumoCardio).toHaveBeenCalledTimes(1);
    const [email, r] = repo.salvarResumoCardio.mock.calls[0];
    expect(email).toBe('Ana@x.com');
    expect(r.totalMin).toBe(30);
    useWorkoutStore.setState({ weekLog: { ...useWorkoutStore.getState().weekLog } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(repo.salvarResumoCardio).toHaveBeenCalledTimes(1);
  });
});
