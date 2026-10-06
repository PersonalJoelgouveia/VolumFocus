import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlunoRotinaSalva } from '../../types/aluno';

const h = vi.hoisted(() => ({
  fbUser: { current: null as null | { email: string; emailVerified: boolean } },
  listar: vi.fn(),
}));

vi.mock('../../lib/firebase', () => ({
  auth: {
    get currentUser() {
      return h.fbUser.current;
    },
  },
}));
vi.mock('../../lib/alunoRotinasRepository', () => ({
  listarRotinasAluno: (...a: unknown[]) => h.listar(...a),
}));
vi.mock('../useAuthStore', async () => {
  const { create } = await import('zustand');
  const useAuthStore = create(() => ({ role: 'nao-logado', user: null as null | { email: string } }));
  return { useAuthStore };
});

import { useAuthStore } from '../useAuthStore';
import {
  resolverEmailDoAlunoAutenticado,
  selectRotinaAtiva,
  selectRotinasOrdenadas,
  selectTodasRotinas,
  useMinhasRotinasStore,
} from '../useMinhasRotinasStore';

const r = (id: string, ativa: boolean, atualizadaEm: string): AlunoRotinaSalva => ({
  id, nome: id, rotina: [], ativa, criadaEm: '2026-10-01T00:00:00.000Z', atualizadaEm, personalEmail: 'p@x.com',
});

function logarComo(email: string, role: 'aluno' | 'personal' = 'aluno', verified = true) {
  h.fbUser.current = { email, emailVerified: verified };
  (useAuthStore as unknown as { setState: (s: object) => void }).setState({ role, user: { email } });
}

describe('useMinhasRotinasStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.fbUser.current = null;
    (useAuthStore as unknown as { setState: (s: object) => void }).setState({ role: 'nao-logado', user: null });
    useMinhasRotinasStore.getState().limpar();
  });

  it('lê SEMPRE o e-mail do Firebase Auth (minúsculo), sem aceitar e-mail de fora', async () => {
    logarComo('Aluno@X.com');
    h.listar.mockResolvedValue([]);
    await useMinhasRotinasStore.getState().carregar();
    expect(h.listar).toHaveBeenCalledWith('aluno@x.com');
    expect(useMinhasRotinasStore.getState().carregar.length).toBe(0);
  });

  it('ordena: ativa primeiro, depois atualizadaEm mais recente; expõe todas e a ativa', async () => {
    logarComo('a@x.com');
    h.listar.mockResolvedValue([
      r('antiga', false, '2026-10-01T00:00:00.000Z'),
      r('ativa', true, '2026-09-01T00:00:00.000Z'),
      r('recente', false, '2026-10-04T00:00:00.000Z'),
    ]);
    await useMinhasRotinasStore.getState().carregar();
    const s = useMinhasRotinasStore.getState();
    expect(selectRotinasOrdenadas(s).map((x) => x.id)).toEqual(['ativa', 'recente', 'antiga']);
    expect(selectTodasRotinas(s)).toHaveLength(3);
    expect(selectRotinaAtiva(s)?.id).toBe('ativa');
    expect(selectRotinasOrdenadas(s)).toBe(selectRotinasOrdenadas(useMinhasRotinasStore.getState()));
  });

  it('duas ativas (corrida entre Personals): `ativa` é a de atualizadaEm mais recente, igual à 1ª da lista', async () => {
    logarComo('a@x.com');
    h.listar.mockResolvedValue([
      r('criada-por-ultimo-mas-velha', true, '2026-10-01T00:00:00.000Z'),
      r('atualizada-por-ultimo', true, '2026-10-05T00:00:00.000Z'),
    ]);
    await useMinhasRotinasStore.getState().carregar();
    const s = useMinhasRotinasStore.getState();
    expect(s.ativa?.id).toBe('atualizada-por-ultimo');
    expect(s.ordenadas[0].id).toBe(s.ativa?.id);
  });

  it('sem rotinas: pronto, lista vazia estável e ativa null', async () => {
    logarComo('a@x.com');
    h.listar.mockResolvedValue([]);
    await useMinhasRotinasStore.getState().carregar();
    const s = useMinhasRotinasStore.getState();
    expect(s.status).toBe('pronto');
    expect(s.ordenadas).toEqual([]);
    expect(s.ativa).toBeNull();
  });

  it.each([
    ['sem login', () => undefined],
    ['Personal', () => logarComo('joelgouveia16@gmail.com', 'personal')],
    ['e-mail não verificado', () => logarComo('a@x.com', 'aluno', false)],
  ])('%s: não lê o Firestore e fica nao-autorizado', async (_n, setup) => {
    setup();
    await useMinhasRotinasStore.getState().carregar();
    expect(h.listar).not.toHaveBeenCalled();
    expect(useMinhasRotinasStore.getState().status).toBe('nao-autorizado');
  });

  it('papel de aluno com e-mail diferente do Firebase Auth é recusado', () => {
    logarComo('a@x.com');
    (useAuthStore as unknown as { setState: (s: object) => void }).setState({ user: { email: 'outro@x.com' } });
    expect(resolverEmailDoAlunoAutenticado()).toBeNull();
  });

  it('erro do Firestore → status erro com mensagem pt-BR, sem dados', async () => {
    logarComo('a@x.com');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.listar.mockRejectedValue(new Error('permission-denied'));
    await useMinhasRotinasStore.getState().carregar();
    const s = useMinhasRotinasStore.getState();
    expect(s.status).toBe('erro');
    expect(s.erro).toMatch(/Não foi possível/);
    expect(s.ordenadas).toEqual([]);
  });

  it('troca de conta durante a leitura descarta o resultado; logout limpa a memória', async () => {
    logarComo('a@x.com');
    let resolver!: (v: AlunoRotinaSalva[]) => void;
    h.listar.mockReturnValue(new Promise((res) => (resolver = res)));
    const p = useMinhasRotinasStore.getState().carregar();
    logarComo('b@x.com');
    resolver([r('da-conta-a', true, '2026-10-01T00:00:00.000Z')]);
    await p;
    expect(useMinhasRotinasStore.getState().rotinas).toEqual([]);

    h.listar.mockResolvedValue([r('x', true, '2026-10-01T00:00:00.000Z')]);
    await useMinhasRotinasStore.getState().carregar();
    expect(useMinhasRotinasStore.getState().ativa?.id).toBe('x');
    (useAuthStore as unknown as { setState: (s: object) => void }).setState({ role: 'nao-logado', user: null });
    expect(useMinhasRotinasStore.getState().ativa).toBeNull();
    expect(useMinhasRotinasStore.getState().status).toBe('idle');
  });
});
