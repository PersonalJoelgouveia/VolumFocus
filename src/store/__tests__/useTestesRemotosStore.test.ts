import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ listTestes: vi.fn(), createTeste: vi.fn(), deleteTeste: vi.fn() }));
vi.mock('../../lib/testesDesempenhoRepository', () => repo);

import { useTestesRemotosStore } from '../useTestesRemotosStore';
import type { TesteForcaDoc } from '../../utils/testesDesempenho';

const doc = (id: string): TesteForcaDoc => ({ id, tipo: 'forca', data: '2026-01-01T00:00:00Z', exercise: 'Supino', weight: 80, reps: 5, rir: 0, oneRM: 93, formula: 'hibrida', autorEmail: 'pt@x.com' });
const E = 'Aluno@X.com';

beforeEach(() => {
  useTestesRemotosStore.getState().limpar();
  vi.clearAllMocks();
});

describe('useTestesRemotosStore', () => {
  it('carrega por e-mail (minúsculo) e deduplica carregamentos simultâneos', async () => {
    repo.listTestes.mockResolvedValue([doc('a')]);
    await Promise.all([useTestesRemotosStore.getState().carregar(E), useTestesRemotosStore.getState().carregar(E)]);
    expect(repo.listTestes).toHaveBeenCalledTimes(1);
    expect(repo.listTestes).toHaveBeenCalledWith('aluno@x.com');
    expect(useTestesRemotosStore.getState().byEmail['aluno@x.com'].status).toBe('ready');
  });
  it('erro de carga marca status error e permite nova tentativa', async () => {
    repo.listTestes.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([]);
    await useTestesRemotosStore.getState().carregar(E);
    expect(useTestesRemotosStore.getState().byEmail['aluno@x.com'].status).toBe('error');
    await useTestesRemotosStore.getState().carregar(E);
    expect(useTestesRemotosStore.getState().byEmail['aluno@x.com'].status).toBe('ready');
  });
  it('adicionar: otimista; falha na nuvem desfaz', async () => {
    repo.createTeste.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('negado'));
    expect(await useTestesRemotosStore.getState().adicionar(E, doc('a'))).toBe(true);
    expect(await useTestesRemotosStore.getState().adicionar(E, doc('b'))).toBe(false);
    expect(useTestesRemotosStore.getState().byEmail['aluno@x.com'].docs.map((d) => d.id)).toEqual(['a']);
  });
  it('remover: falha restaura; sucesso apaga', async () => {
    repo.createTeste.mockResolvedValue(undefined);
    await useTestesRemotosStore.getState().adicionar(E, doc('a'));
    repo.deleteTeste.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
    expect(await useTestesRemotosStore.getState().remover(E, 'a')).toBe(false);
    expect(useTestesRemotosStore.getState().byEmail['aluno@x.com'].docs).toHaveLength(1);
    expect(await useTestesRemotosStore.getState().remover(E, 'a')).toBe(true);
    expect(useTestesRemotosStore.getState().byEmail['aluno@x.com'].docs).toHaveLength(0);
  });
  it('é só memória: nada vai ao localStorage', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 });
    repo.createTeste.mockResolvedValue(undefined);
    await useTestesRemotosStore.getState().adicionar(E, doc('a'));
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
