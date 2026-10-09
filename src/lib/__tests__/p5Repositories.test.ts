import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocs = vi.fn();
const getDoc = vi.fn();
const setDoc = vi.fn();
const updateDoc = vi.fn();
vi.mock('../firebase', () => ({
  db: {},
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  deleteDoc: vi.fn(),
}));

import { createAssessment, getAssessment, listAssessments, updateAssessment } from '../physicalAssessmentRepository';
vi.mock('../ownerRepository', () => ({ getMyOwnerUUID: vi.fn().mockResolvedValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') }));
import { fetchTreinoNotificacoes, registrarTreinoConcluido } from '../notificacaoRepository';

const valido = (id: string) => ({
  id,
  alunoId: 'a',
  date: '2026-10-01T00:00:00.000Z',
  protocol: 'online',
  anthropometry: { peso: 80, altura: 180, imc: 24.7 },
  circumferences: [],
  skinfolds: {},
  results: {},
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

describe('physicalAssessmentRepository — leitura desconfiada', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa o id do DOCUMENTO e ignora (reportando) os malformados', async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: 'doc-ok', data: () => valido('id-forjado-no-conteudo') },
        { id: 'doc-envenenado', data: () => ({ ...valido('x'), anthropometry: null }) },
        { id: 'doc-ok-2', data: () => valido('doc-ok-2') },
      ],
    });
    const invalidos: string[][] = [];
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const lista = await listAssessments('a@x.com', (ids) => invalidos.push(ids));

    expect(lista.map((a) => a.id)).toEqual(['doc-ok', 'doc-ok-2']);
    expect(invalidos).toEqual([['doc-envenenado']]);
  });

  it('sem documentos inválidos não chama onInvalid', async () => {
    getDocs.mockResolvedValue({ docs: [{ id: 'd1', data: () => valido('d1') }] });
    const cb = vi.fn();
    await listAssessments('a@x.com', cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it('getAssessment: id do documento; inválido → null; inexistente → null', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, id: 'doc-1', data: () => valido('forjado') });
    expect((await getAssessment('a@x.com', 'doc-1'))!.id).toBe('doc-1');
    getDoc.mockResolvedValueOnce({ exists: () => true, id: 'doc-2', data: () => ({ protocol: 'online' }) });
    expect(await getAssessment('a@x.com', 'doc-2')).toBeNull();
    getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getAssessment('a@x.com', 'doc-3')).toBeNull();
  });
});

describe('physicalAssessmentRepository — payload gravado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create/update removem undefined e NaN (o Firestore recusa undefined; as regras exigem números)', async () => {
    setDoc.mockResolvedValue(undefined);
    updateDoc.mockResolvedValue(undefined);
    const a = {
      ...valido('af-1'),
      notes: undefined,
      results: { relacaoCinturaQuadril: undefined, relacaoCinturaEstatura: 0.5 },
      anthropometry: { peso: NaN, altura: 180, imc: 24 },
    } as never;
    await createAssessment('a@x.com', a);
    const enviado = setDoc.mock.calls[0][1] as Record<string, unknown>;
    expect('notes' in enviado).toBe(false);
    expect(enviado.results).toEqual({ relacaoCinturaEstatura: 0.5 });
    expect((enviado.anthropometry as Record<string, unknown>).peso).toBeNull();

    await updateAssessment('a@x.com', 'af-1', { notes: undefined, status: 'revisada' } as never);
    expect(updateDoc.mock.calls[0][1]).toEqual({ status: 'revisada' });
  });
});

describe('notificacaoRepository — aluno só cria; dono vem do próprio doc do aluno', () => {
  const UA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  beforeEach(() => {
    vi.clearAllMocks();
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ownerUUID: UA }) });
  });

  it('carimba o ownerUUID do cliente (lido do próprio doc) e não lê a notificação', async () => {
    setDoc.mockResolvedValue(undefined);
    await registrarTreinoConcluido('Aluno@X.com', 'Aluno', 2);
    expect(getDoc).toHaveBeenCalledTimes(1); // só o doc do aluno
    expect(setDoc).toHaveBeenCalledTimes(1);
    const payload = setDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({ alunoEmail: 'aluno@x.com', lida: false, dia: 2, ownerUUID: UA });
    expect(Object.keys(payload).sort()).toEqual(['alunoEmail', 'alunoNome', 'criadaEm', 'dataTreino', 'dia', 'id', 'lida', 'ownerUUID']);
  });

  it('cliente sem ownerUUID (não migrado): não grava nada e não lança', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    await expect(registrarTreinoConcluido('a@x.com', 'A', 1)).resolves.toBeUndefined();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('lado do Personal: consulta filtrada pelo ownerUUID dele', async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await expect(fetchTreinoNotificacoes()).resolves.toEqual([]);
  });

  it('permission-denied (já registrada hoje) não é erro; outros erros sobem', async () => {
    setDoc.mockRejectedValueOnce({ code: 'permission-denied' });
    await expect(registrarTreinoConcluido('a@x.com', 'A', 1)).resolves.toBeUndefined();
    setDoc.mockRejectedValueOnce({ code: 'unavailable' });
    await expect(registrarTreinoConcluido('a@x.com', 'A', 1)).rejects.toMatchObject({ code: 'unavailable' });
  });
});
