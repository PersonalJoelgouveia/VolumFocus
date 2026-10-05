import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocs = vi.fn();
const getDoc = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn();
vi.mock('../firebase', () => ({
  db: {},
  collection: vi.fn(() => ({})),
  doc: vi.fn((_a: unknown, ...p: string[]) => ({ id: p[p.length - 1] ?? 'novo-id', path: p.join('/') })),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  writeBatch: () => ({ set: batchSet, update: batchUpdate, commit: batchCommit }),
}));

import {
  criarRotinaAluno,
  definirRotinaAtiva,
  listarRotinasAluno,
  obterRotinaAtiva,
} from '../alunoRotinasRepository';

const docRot = (id: string, ativa: unknown, extra: Record<string, unknown> = {}) => ({
  id,
  ref: { id },
  data: () => ({ nome: id, rotina: [], ativa, criadaEm: '2026-10-01', atualizadaEm: '2026-10-01', personalEmail: 'p@x.com', ...extra }),
});

describe('alunoRotinasRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchCommit.mockResolvedValue(undefined);
  });

  it('cria inativa por padrão, com 7 dias vazios e sem tocar nas outras', async () => {
    const r = await criarRotinaAluno('A@X.com', { nome: ' Hipertrofia ', personalEmail: 'P@X.com' });
    expect(r.ativa).toBe(false);
    expect(r.nome).toBe('Hipertrofia');
    expect(r.personalEmail).toBe('p@x.com');
    expect(r.rotina).toHaveLength(7);
    expect(r.criadaEm).toBe(r.atualizadaEm);
    expect(getDocs).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(batchSet).toHaveBeenCalledTimes(1);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('criar com ativa=true desativa a anterior no mesmo batch', async () => {
    getDocs.mockResolvedValue({ docs: [docRot('velha', true), docRot('outra', false)] });
    const r = await criarRotinaAluno('a@x.com', { nome: 'Nova', personalEmail: 'p@x.com', ativa: true });
    expect(r.ativa).toBe(true);
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(batchUpdate.mock.calls[0][0]).toEqual({ id: 'velha' });
    expect(batchUpdate.mock.calls[0][1]).toMatchObject({ ativa: false });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('rejeita nome vazio e e-mail de Personal inválido', async () => {
    await expect(criarRotinaAluno('a@x.com', { nome: '  ', personalEmail: 'p@x.com' })).rejects.toThrow();
    await expect(criarRotinaAluno('a@x.com', { nome: 'X', personalEmail: 'sem-arroba' })).rejects.toThrow();
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('definirRotinaAtiva desativa as outras e ativa o alvo, atomicamente', async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    getDocs.mockResolvedValue({ docs: [docRot('a', true), docRot('b', false), docRot('c', false)] });
    await definirRotinaAtiva('a@x.com', 'c');
    const updates = batchUpdate.mock.calls.map(([ref, data]) => [ref.id ?? ref.path, data.ativa]);
    expect(updates).toContainEqual(['a', false]);
    expect(updates.filter(([, ativa]) => ativa === true)).toHaveLength(1);
    expect(batchUpdate.mock.calls.some(([ref]) => ref.id === 'b')).toBe(false);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('definirRotinaAtiva em id inexistente lança e não grava nada', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await expect(definirRotinaAtiva('a@x.com', 'nao-existe')).rejects.toThrow();
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('lista ignora malformadas (reportando) e obterRotinaAtiva devolve a ativa ou null', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getDocs.mockResolvedValue({
      docs: [docRot('ok', true), docRot('ruim', 'sim'), docRot('ok2', false)],
    });
    const invalidos: string[][] = [];
    const lista = await listarRotinasAluno('a@x.com', (ids) => invalidos.push(ids));
    expect(lista.map((r) => r.id)).toEqual(['ok', 'ok2']);
    expect(invalidos).toEqual([['ruim']]);
    expect((await obterRotinaAtiva('a@x.com'))?.id).toBe('ok');

    getDocs.mockResolvedValue({ docs: [docRot('x', false)] });
    expect(await obterRotinaAtiva('a@x.com')).toBeNull();
  });
});
