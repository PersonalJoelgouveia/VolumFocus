// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const repo = vi.hoisted(() => ({ listarResumosCardio: vi.fn() }));
vi.mock('../../../lib/cardioSemanalRepository', () => repo);
vi.mock('../../../lib/firebase', () => ({ auth: {}, db: {}, storage: {}, firebaseApp: {} }));

import { semanaId } from '../../../utils/cardioSemanalAluno';
import { AlunoCardioSemanaCard } from '../AlunoCardioSemanaCard';

afterEach(cleanup);

describe('AlunoCardioSemanaCard', () => {
  it('mostra os minutos reais do aluno com a meta dele', async () => {
    repo.listarResumosCardio.mockResolvedValue([
      { semana: semanaId(), totalMin: 55, metaMin: 120, atualizadoEm: new Date().toISOString(), sessoes: [{ dia: 'SEG', nome: 'Bike', duracao: 55, intensidade: 6 }] },
      { semana: '2026-01-05', totalMin: 80, metaMin: 90, atualizadoEm: 'x', sessoes: [] },
    ]);
    render(<AlunoCardioSemanaCard alunoEmail="ana@x.com" />);
    await waitFor(() => expect(screen.getByText('55')).toBeTruthy());
    expect(screen.getByText(/120 min \(meta do aluno\)/)).toBeTruthy();
    expect(screen.getByText('Bike')).toBeTruthy();
    expect(screen.getByText('80 / 90 min')).toBeTruthy();
    expect(repo.listarResumosCardio).toHaveBeenCalledWith('ana@x.com', 6);
  });
  it('sem dados da semana avisa; erro mostra aviso', async () => {
    repo.listarResumosCardio.mockResolvedValueOnce([]);
    render(<AlunoCardioSemanaCard alunoEmail="ana@x.com" />);
    await waitFor(() => expect(screen.getByText(/Sem cardio recebido desta semana/)).toBeTruthy());
    cleanup();
    repo.listarResumosCardio.mockRejectedValueOnce(new Error('denied'));
    render(<AlunoCardioSemanaCard alunoEmail="ana@x.com" />);
    await waitFor(() => expect(screen.getByText(/Não foi possível carregar o cardio/)).toBeTruthy());
  });
});
