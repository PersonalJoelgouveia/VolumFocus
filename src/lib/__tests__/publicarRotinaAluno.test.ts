import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarRotinaVazia } from '../../types/aluno';
import type { AlunoRotinaSalva } from '../../types/aluno';

const h = vi.hoisted(() => ({ legado: vi.fn(), criar: vi.fn(), ativa: vi.fn() }));
vi.mock('../alunoRepository', () => ({ syncRotinaToCloud: (...a: unknown[]) => h.legado(...a) }));
vi.mock('../alunoRotinasRepository', () => ({
  criarRotinaAluno: (...a: unknown[]) => h.criar(...a),
  obterRotinaAtiva: (...a: unknown[]) => h.ativa(...a),
}));

import { publicarRotinaParaAluno } from '../publicarRotinaAluno';

const rotina = () => {
  const r = criarRotinaVazia();
  r[0] = { tipo: 'Treino', exercicios: [{ nome: 'Supino', series: 3, reps: '10', carga: 40 }] };
  return r;
};

describe('publicarRotinaParaAluno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.ativa.mockResolvedValue(null);
    h.criar.mockResolvedValue({});
    h.legado.mockResolvedValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('grava no modelo novo como ATIVA e também no campo legado', async () => {
    const r = await publicarRotinaParaAluno('a@x.com', rotina(), 'p@x.com');
    expect(r).toEqual({ multiplas: true, legado: true });
    expect(h.criar).toHaveBeenCalledWith('a@x.com', expect.objectContaining({ ativa: true, personalEmail: 'p@x.com', rotina: rotina() }));
    expect(h.criar.mock.calls[0][1].nome).toMatch(/^Publicada em /);
    expect(h.legado).toHaveBeenCalledWith('a@x.com', rotina());
  });

  it('ativa idêntica (mesmo com chaves em outra ordem) → não cria rotina duplicada, legado segue', async () => {
    const reordenada = JSON.parse(JSON.stringify(rotina())).map((d: { tipo: string; exercicios: object[] }) => ({
      exercicios: d.exercicios.map((e) => Object.fromEntries(Object.entries(e).reverse())),
      tipo: d.tipo,
    }));
    h.ativa.mockResolvedValue({ id: 'r1', ativa: true, rotina: reordenada } as unknown as AlunoRotinaSalva);
    expect(await publicarRotinaParaAluno('a@x.com', rotina(), 'p@x.com')).toEqual({ multiplas: true, legado: true });
    expect(h.criar).not.toHaveBeenCalled();
  });

  it('ativa diferente → cria nova ativa', async () => {
    h.ativa.mockResolvedValue({ id: 'r1', ativa: true, rotina: criarRotinaVazia() } as unknown as AlunoRotinaSalva);
    await publicarRotinaParaAluno('a@x.com', rotina(), 'p@x.com');
    expect(h.criar).toHaveBeenCalledTimes(1);
  });

  it('modelo novo falha (ex.: regras não publicadas) → ainda grava o legado e reporta o parcial', async () => {
    h.criar.mockRejectedValue(new Error('permission-denied'));
    expect(await publicarRotinaParaAluno('a@x.com', rotina(), 'p@x.com')).toEqual({ multiplas: false, legado: true });
    expect(h.legado).toHaveBeenCalled();
  });

  it('legado falha, novo ok → multiplas true, legado false', async () => {
    h.legado.mockResolvedValue(false);
    expect(await publicarRotinaParaAluno('a@x.com', rotina(), 'p@x.com')).toEqual({ multiplas: true, legado: false });
  });
});
