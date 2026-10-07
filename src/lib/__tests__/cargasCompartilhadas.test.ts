import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ setDoc: vi.fn(async () => undefined), getDoc: vi.fn() }));
vi.mock('../firebase', () => ({
  db: {},
  doc: (...a: unknown[]) => ({ path: a.slice(1).join('/') }),
  setDoc: h.setDoc,
  getDoc: h.getDoc,
}));

import { _resetCargasPendentes, chavesPendentes, descarregarCargasPendentes, lerCargasCompartilhadas, registrarCargaEditada } from '../cargasCompartilhadas';

describe('cargasCompartilhadas (Firestore)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.setDoc.mockClear();
    _resetCargasPendentes();
  });
  afterEach(() => vi.useRealTimers());

  it('junta várias edições do mesmo exercício numa escrita só (último valor vence)', async () => {
    registrarCargaEditada('A@x.com', 'Supino Reto', 40, 'aluno');
    registrarCargaEditada('A@x.com', 'Supino Reto', 42.5, 'aluno');
    expect(chavesPendentes('a@x.com').has('supino_reto')).toBe(true);
    await vi.advanceTimersByTimeAsync(1600);
    expect(h.setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, opts] = h.setDoc.mock.calls[0] as unknown as [{ path: string }, { cargas: Record<string, { carga: number; por: string }> }, { merge: boolean }];
    expect(ref.path).toBe('alunos/a@x.com/cargas/atuais');
    expect(data.cargas.supino_reto).toMatchObject({ carga: 42.5, por: 'aluno' });
    expect(opts).toEqual({ merge: true });
    expect(chavesPendentes('a@x.com').size).toBe(0);
  });

  it('recoloca na fila se a gravação falhar', async () => {
    h.setDoc.mockRejectedValueOnce(new Error('offline'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    registrarCargaEditada('a@x.com', 'Remada', 30, 'personal');
    await descarregarCargasPendentes();
    expect(chavesPendentes('a@x.com').has('remada')).toBe(true);
    spy.mockRestore();
  });

  it('ignora valor inválido e lê só entradas válidas', async () => {
    registrarCargaEditada('a@x.com', 'Remada', -3, 'aluno');
    expect(chavesPendentes('a@x.com').size).toBe(0);
    h.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ cargas: { remada: { carga: 30, em: 'x', por: 'aluno' }, lixo: 1 } }) });
    expect(Object.keys(await lerCargasCompartilhadas('a@x.com'))).toEqual(['remada']);
  });
});
