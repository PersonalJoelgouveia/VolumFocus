import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Sem jsdom: stub mínimo de localStorage para o middleware persist.
beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

async function carregar() {
  const { useModeloStore } = await import('../useModeloStore');
  const { useUIStore } = await import('../useUIStore');
  return { useModeloStore, useUIStore };
}

describe('Modelos — acesso exclusivo do Personal (camada do store)', () => {
  let m: Awaited<ReturnType<typeof carregar>>;
  beforeEach(async () => {
    m = await carregar();
    m.useUIStore.setState({ isPersonalMode: false, isAlunoMode: false });
  });

  it('Aluno/deslogado: leituras vazias e escritas ignoradas', () => {
    m.useUIStore.setState({ isPersonalMode: false, isAlunoMode: true });
    const s = m.useModeloStore.getState();
    const id = s.modelos[0].id;
    expect(s.getModelo(id)).toBeUndefined();
    expect(s.listarFrequenciasPorCategoria(s.modelos[0].categoria)).toEqual([]);
    expect(s.listarPorFrequencia(s.modelos[0].categoria, s.modelos[0].frequencia, s.modelos[0].variante)).toEqual([]);
    const antes = JSON.stringify(m.useModeloStore.getState().modelos);
    s.garantirSessoesIniciais(id);
    s.setDuracaoEstimada(id, 999);
    expect(JSON.stringify(m.useModeloStore.getState().modelos)).toBe(antes);
    expect(s.copiarParaCliente(id, 'qualquer')).toEqual({ ok: false, exerciciosNaoEncontrados: [] });
  });

  it('Personal: leituras e edições funcionam e preservam o catálogo', () => {
    m.useUIStore.setState({ isPersonalMode: true, isAlunoMode: false });
    const s = m.useModeloStore.getState();
    const base = s.modelos[0];
    expect(s.getModelo(base.id)?.id).toBe(base.id);
    expect(s.listarFrequenciasPorCategoria(base.categoria).length).toBeGreaterThan(0);
    s.setDuracaoEstimada(base.id, 77);
    expect(m.useModeloStore.getState().getModelo(base.id)?.duracaoEstimadaMinutos).toBe(77);
  });
});
