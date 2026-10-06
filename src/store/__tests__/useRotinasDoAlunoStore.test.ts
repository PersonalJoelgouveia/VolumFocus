import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlunoRotinaSalva } from '../../types/aluno';

const h = vi.hoisted(() => ({ listar: vi.fn() }));
vi.mock('../../lib/alunoRotinasRepository', () => ({ listarRotinasAluno: (...a: unknown[]) => h.listar(...a) }));
vi.mock('../useAuthStore', async () => {
  const { create } = await import('zustand');
  return { useAuthStore: create(() => ({ role: 'personal', user: { email: 'joelgouveia16@gmail.com' } })) };
});

import { useAuthStore } from '../useAuthStore';
import { ROTINAS_ALUNO_VAZIO, selectRotinasDoAluno, useRotinasDoAlunoStore } from '../useRotinasDoAlunoStore';

const r = (id: string, ativa: boolean, atualizadaEm: string): AlunoRotinaSalva => ({
  id, nome: id, rotina: [], ativa, criadaEm: '2026-10-01', atualizadaEm, personalEmail: 'p@x.com',
});
const setAuth = (s: object) => (useAuthStore as unknown as { setState: (s: object) => void }).setState(s);

describe('useRotinasDoAlunoStore (mini perfil do Personal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth({ role: 'personal', user: { email: 'joelgouveia16@gmail.com' } });
    useRotinasDoAlunoStore.getState().limpar();
  });

  it('lê alunos/{email}/rotinas do aluno pedido (minúsculo), ativa primeiro', async () => {
    h.listar.mockResolvedValue([r('antiga', false, '2026-10-04'), r('atual', true, '2026-10-01')]);
    await useRotinasDoAlunoStore.getState().carregar('Aluno@X.com');
    expect(h.listar).toHaveBeenCalledWith('aluno@x.com');
    const e = selectRotinasDoAluno('aluno@x.com')(useRotinasDoAlunoStore.getState());
    expect(e.status).toBe('pronto');
    expect(e.ordenadas.map((x) => x.id)).toEqual(['atual', 'antiga']);
    expect(e.ativa?.id).toBe('atual');
  });

  it('refresh depois de salvar mostra a nova ativa; a antiga continua na lista', async () => {
    h.listar.mockResolvedValueOnce([r('A', true, '2026-10-01')]);
    await useRotinasDoAlunoStore.getState().carregar('a@x.com');
    h.listar.mockResolvedValueOnce([r('A', false, '2026-10-01'), r('B', true, '2026-10-05')]);
    await useRotinasDoAlunoStore.getState().carregar('a@x.com');
    const e = selectRotinasDoAluno('a@x.com')(useRotinasDoAlunoStore.getState());
    expect(e.ativa?.id).toBe('B');
    expect(e.ordenadas.map((x) => x.id)).toEqual(['B', 'A']);
  });

  it('isola alunos: carregar um não mexe no outro; sem entrada devolve o vazio estável', async () => {
    h.listar.mockResolvedValue([r('A', true, '2026-10-01')]);
    await useRotinasDoAlunoStore.getState().carregar('a@x.com');
    expect(selectRotinasDoAluno('b@x.com')(useRotinasDoAlunoStore.getState())).toBe(ROTINAS_ALUNO_VAZIO);
  });

  it('aluno (não-Personal) não lê rotinas de ninguém por aqui', async () => {
    setAuth({ role: 'aluno', user: { email: 'a@x.com' } });
    await useRotinasDoAlunoStore.getState().carregar('b@x.com');
    expect(h.listar).not.toHaveBeenCalled();
    expect(selectRotinasDoAluno('b@x.com')(useRotinasDoAlunoStore.getState()).status).toBe('nao-autorizado');
  });

  it('erro → status erro; duas ativas → vale a mais recente; troca de conta limpa o cache', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.listar.mockRejectedValueOnce(new Error('permission-denied'));
    await useRotinasDoAlunoStore.getState().carregar('a@x.com');
    expect(selectRotinasDoAluno('a@x.com')(useRotinasDoAlunoStore.getState()).status).toBe('erro');

    h.listar.mockResolvedValue([r('velha', true, '2026-10-01'), r('nova', true, '2026-10-05')]);
    await useRotinasDoAlunoStore.getState().carregar('a@x.com');
    expect(selectRotinasDoAluno('a@x.com')(useRotinasDoAlunoStore.getState()).ativa?.id).toBe('nova');

    setAuth({ role: 'nao-logado', user: null });
    expect(useRotinasDoAlunoStore.getState().porEmail).toEqual({});
  });
});
