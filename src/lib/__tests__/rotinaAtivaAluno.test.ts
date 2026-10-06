import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlunoRotinaSalva } from '../../types/aluno';

const h = vi.hoisted(() => ({
  state: { status: 'pronto', ativa: null, rotinas: [] } as { status: string; ativa: unknown; rotinas: unknown[] },
  carregar: vi.fn(async () => undefined),
  email: { current: 'a@x.com' as string | null },
  legado: vi.fn(),
}));

vi.mock('../../store/useMinhasRotinasStore', () => ({
  useMinhasRotinasStore: { getState: () => ({ ...h.state, carregar: h.carregar }) },
  resolverEmailDoAlunoAutenticado: () => h.email.current,
}));
vi.mock('../alunoRepository', () => ({ fetchPublishedRotina: (...a: unknown[]) => h.legado(...a) }));

import { resolverRotinaAtivaDoAluno } from '../rotinaAtivaAluno';

const rot = (id: string, ativa: boolean): AlunoRotinaSalva => ({
  id, nome: `Rotina ${id}`, rotina: [], ativa, criadaEm: '2026-10-01', atualizadaEm: '2026-10-05T10:00:00.000Z', personalEmail: 'p@x.com',
});

describe('resolverRotinaAtivaDoAluno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.email.current = 'a@x.com';
    h.legado.mockResolvedValue(null);
  });

  it('1) aluno novo, sem rotina em lugar nenhum → null', async () => {
    h.state = { status: 'pronto', ativa: null, rotinas: [] };
    expect(await resolverRotinaAtivaDoAluno()).toBeNull();
    expect(h.legado).toHaveBeenCalledWith('a@x.com');
  });

  it('2) primeira rotina no modelo novo → ela, com versão id@atualizadaEm', async () => {
    const a = rot('r1', true);
    h.state = { status: 'pronto', ativa: a, rotinas: [a] };
    const r = await resolverRotinaAtivaDoAluno();
    expect(r).toMatchObject({ origem: 'multiplas', nome: 'Rotina r1', version: 'multi:r1@2026-10-05T10:00:00.000Z' });
    expect(h.legado).not.toHaveBeenCalled();
  });

  it('5) várias históricas: só a marcada ativa é a fonte; mudar a ativa muda a versão', async () => {
    const [a, b] = [rot('r1', false), rot('r2', true)];
    h.state = { status: 'pronto', ativa: b, rotinas: [a, b] };
    expect((await resolverRotinaAtivaDoAluno())?.version).toContain('multi:r2@');
  });

  it('há rotinas mas nenhuma ativa → null, SEM cair no campo legado', async () => {
    h.state = { status: 'pronto', ativa: null, rotinas: [rot('r1', false)] };
    h.legado.mockResolvedValue({ rotina: [], atualizadoEm: '2026-01-01' });
    expect(await resolverRotinaAtivaDoAluno()).toBeNull();
    expect(h.legado).not.toHaveBeenCalled();
  });

  it('modelo novo vazio ou com erro (regras não publicadas) → usa o legado como antes', async () => {
    h.legado.mockResolvedValue({ rotina: [], atualizadoEm: '2026-01-01T00:00:00.000Z' });
    h.state = { status: 'erro', ativa: null, rotinas: [] };
    expect(await resolverRotinaAtivaDoAluno()).toMatchObject({ origem: 'legado', version: '2026-01-01T00:00:00.000Z' });
    h.state = { status: 'pronto', ativa: null, rotinas: [] };
    expect((await resolverRotinaAtivaDoAluno())?.origem).toBe('legado');
  });

  it('não autorizado (PT/sem login) → null e não toca no legado', async () => {
    h.state = { status: 'nao-autorizado', ativa: null, rotinas: [] };
    expect(await resolverRotinaAtivaDoAluno()).toBeNull();
    expect(h.legado).not.toHaveBeenCalled();
  });
});
