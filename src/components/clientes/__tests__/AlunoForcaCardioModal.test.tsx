// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const cardioRepo = vi.hoisted(() => ({ listarResumosCardio: vi.fn() }));
const testesRepo = vi.hoisted(() => ({ listTestes: vi.fn(), createTeste: vi.fn(), deleteTeste: vi.fn() }));
vi.mock('../../../lib/cardioSemanalRepository', () => cardioRepo);
vi.mock('../../../lib/testesDesempenhoRepository', () => testesRepo);
vi.mock('../../../lib/firebase', () => ({ auth: {}, db: {}, storage: {}, firebaseApp: {} }));
vi.mock('../../../lib/connectivity', () => ({ exigirOnline: () => true, isOnline: () => true }));

import { useUIStore } from '../../../store/useUIStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useCardioGoalStore } from '../../../store/useCardioGoalStore';
import { useWorkoutStore } from '../../../store/useWorkoutStore';
import { semanaId } from '../../../utils/cardioSemanalAluno';
import { AlunoForcaCardioModal } from '../AlunoForcaCardioModal';

afterEach(cleanup);

describe('AlunoForcaCardioModal — aba Cardio', () => {
  it('mostra o cardio/meta DO ALUNO e nunca a meta e o volume do Personal', async () => {
    useUIStore.setState({ isPersonalMode: true, isAlunoMode: false });
    useAuthStore.setState({ user: { email: 'pt@x.com' } as never });
    useCardioGoalStore.setState({ metaMin: 777 });
    useWorkoutStore.setState({
      weekLog: { 0: [{ exId: 'e1', type: 'cardio', duration: 321, intensity: 5, hrZone: 'z2' }] } as never,
      exDone: { '0:0': true } as never,
    });
    testesRepo.listTestes.mockResolvedValue([]);
    cardioRepo.listarResumosCardio.mockResolvedValue([
      { semana: semanaId(), totalMin: 54, metaMin: 90, atualizadoEm: new Date().toISOString(), sessoes: [] },
    ]);
    render(<AlunoForcaCardioModal aluno={{ id: 'a', nome: 'André', email: 'andre@x.com' } as never} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Cardiorrespiratório' }));
    await waitFor(() => expect(screen.getByText('54')).toBeTruthy());
    expect(screen.getByText(/90 min \(meta do aluno\)/)).toBeTruthy();
    expect(screen.queryByText(/Meta Semanal/)).toBeNull();
    expect(screen.queryByText(/777/)).toBeNull();
    expect(screen.queryByText(/321/)).toBeNull();
    expect(cardioRepo.listarResumosCardio).toHaveBeenCalledWith('andre@x.com', 6);
  });
});
