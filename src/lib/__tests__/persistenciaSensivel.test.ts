import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../trainingNotesRepository', () => ({ getNote: vi.fn(), createNote: vi.fn(), updateNote: vi.fn() }));
vi.mock('../physicalAssessmentRepository', () => ({ getAssessment: vi.fn() }));
vi.mock('../firebase', () => ({ db: {}, auth: { currentUser: null } }));

import { setLocalAuthUid } from '../localOwner';
import { descartarMemoriaSensivel, flushSensivel, sGet, sRemove, sSet, contarPendentesSensiveis } from '../guardedStorage';
import { QUARENTENA_KEY, guardarLegadoSensivel, reconciliarLegadoSensivel } from '../migracaoSensivel';
import { limparMemoriaSensivel } from '../localDataLifecycle';
import { useAlunoStore } from '../../store/useAlunoStore';
import { createNote, getNote, updateNote } from '../trainingNotesRepository';
import { getAssessment } from '../physicalAssessmentRepository';

function installLocalStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
  });
  return data;
}

function setOnline(v: boolean) {
  vi.stubGlobal('navigator', { onLine: v });
}

let disco: Map<string, string>;

beforeEach(() => {
  disco = installLocalStorage();
  descartarMemoriaSensivel();
  setOnline(true);
  setLocalAuthUid(null);
  vi.clearAllMocks();
});
afterEach(() => {
  setOnline(true);
  vi.unstubAllGlobals();
});

describe('armazenamento guardado (offline / contexto autorizado)', () => {
  it('online + autorizado: grava em disco', () => {
    setLocalAuthUid('u1', 'a@x.com');
    sSet('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
  });
  it('OFFLINE: NÃO grava em disco; leitura na sessão vê o valor em memória', () => {
    setLocalAuthUid('u1', 'a@x.com');
    setOnline(false);
    sSet('k', 'segredo');
    expect(localStorage.getItem('k')).toBeNull();
    expect(sGet('k')).toBe('segredo');
    expect(contarPendentesSensiveis()).toBe(1);
  });
  it('sem contexto autorizado: não grava em disco', () => {
    sSet('k', 'v');
    expect(localStorage.getItem('k')).toBeNull();
  });
  it('reconectou com o MESMO usuário: grava o pendente', () => {
    setLocalAuthUid('u1', 'a@x.com');
    setOnline(false);
    sSet('k', 'v');
    setOnline(true);
    flushSensivel();
    expect(localStorage.getItem('k')).toBe('v');
    expect(contarPendentesSensiveis()).toBe(0);
  });
  it('trocou de conta: o pendente é DESCARTADO, nunca gravado sob outro dono', () => {
    setLocalAuthUid('u1', 'a@x.com');
    setOnline(false);
    sSet('k', 'v');
    setLocalAuthUid('u2', 'b@x.com');
    setOnline(true);
    flushSensivel();
    expect(localStorage.getItem('k')).toBeNull();
  });
  it('remover remove de verdade (disco e memória)', () => {
    setLocalAuthUid('u1', 'a@x.com');
    sSet('k', 'v');
    sRemove('k');
    expect(localStorage.getItem('k')).toBeNull();
    expect(sGet('k')).toBeNull();
  });
});

describe('useAlunoStore: só o cadastro vai para o disco', () => {
  it('avaliações e anotações ficam só em memória', () => {
    setLocalAuthUid('u1', 'a@x.com');
    useAlunoStore.setState({
      alunos: [{ id: 'al1', nome: 'A', email: 'a@x.com', status: 'ativo', foco: 'x', rotina: [] }],
      avaliacoes: { al1: [{ id: 'av1' } as never] },
      notas: { al1: [{ id: 'n1', conteudo: 'PRONTUARIO-SECRETO' } as never] },
    });
    const bruto = localStorage.getItem('jg3_alunos') ?? '';
    expect(bruto).toContain('"alunos"');
    expect(bruto).not.toContain('PRONTUARIO-SECRETO');
    expect(bruto).not.toContain('av1');
  });
  it('offline: nada novo é gravado em disco', () => {
    setLocalAuthUid('u1', 'a@x.com');
    useAlunoStore.setState({ alunos: [] });
    const antes = localStorage.getItem('jg3_alunos');
    setOnline(false);
    useAlunoStore.setState({ alunos: [{ id: 'al2', nome: 'NOVO-OFFLINE', email: 'n@x.com', status: 'ativo', foco: 'x', rotina: [] }] });
    expect(localStorage.getItem('jg3_alunos')).toBe(antes);
    expect(JSON.stringify(Array.from(disco.entries()))).not.toContain('NOVO-OFFLINE');
  });
  it('limparMemoriaSensivel zera avaliações/anotações em memória (troca de conta, perda de contexto)', () => {
    useAlunoStore.setState({ avaliacoes: { x: [{ id: 'a' } as never] }, notas: { x: [{ id: 'n' } as never] } });
    limparMemoriaSensivel();
    expect(useAlunoStore.getState().avaliacoes).toEqual({});
    expect(useAlunoStore.getState().notas).toEqual({});
  });
});

describe('migração sem perda do legado sensível', () => {
  const nota = { id: 'n1', alunoId: 'al1', conteudo: 'texto novo', updatedAt: '2026-10-10T10:00:00Z' };
  const aval = { id: 'av1' };
  beforeEach(() => {
    useAlunoStore.setState({ alunos: [{ id: 'al1', nome: 'A', email: 'a@x.com', status: 'ativo', foco: 'x', rotina: [] }] });
  });

  it('guarda o legado em quarentena (copia, não apaga) com o dono atual', () => {
    localStorage.setItem('jg3_owner', 'u1');
    guardarLegadoSensivel({ notas: { al1: [nota] }, avaliacoes: { al1: [aval] } });
    const q = JSON.parse(localStorage.getItem(QUARENTENA_KEY) ?? '{}');
    expect(q.ownerUid).toBe('u1');
    expect(q.notas.al1).toHaveLength(1);
  });
  it('sem itens sensíveis: nada é guardado', () => {
    guardarLegadoSensivel({ alunos: [] });
    expect(localStorage.getItem(QUARENTENA_KEY)).toBeNull();
  });
  it('origem NÃO comprovada (dono diferente/ausente): não envia nada à nuvem e mantém a quarentena', async () => {
    localStorage.setItem('jg3_owner', 'outro');
    guardarLegadoSensivel({ notas: { al1: [nota] } });
    setLocalAuthUid('u1', 'a@x.com');
    const r = await reconciliarLegadoSensivel();
    expect(r.status).toBe('origem-nao-comprovada');
    expect(createNote).not.toHaveBeenCalled();
    expect(localStorage.getItem(QUARENTENA_KEY)).not.toBeNull();
  });
  it('tudo confirmado/enviado: apaga a quarentena', async () => {
    localStorage.setItem('jg3_owner', 'u1');
    guardarLegadoSensivel({ notas: { al1: [nota] }, avaliacoes: { al1: [aval] } });
    setLocalAuthUid('u1', 'a@x.com');
    vi.mocked(getNote).mockResolvedValue(null); // nota ausente na nuvem -> envia
    vi.mocked(getAssessment).mockResolvedValue({ id: 'av1' } as never);
    const r = await reconciliarLegadoSensivel();
    expect(createNote).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ status: 'concluida', enviados: 1, confirmados: 1, pendentes: 0 });
    expect(localStorage.getItem(QUARENTENA_KEY)).toBeNull();
  });
  it('nota local mais nova que a da nuvem é enviada; mais antiga só é confirmada', async () => {
    localStorage.setItem('jg3_owner', 'u1');
    guardarLegadoSensivel({ notas: { al1: [nota] } });
    setLocalAuthUid('u1', 'a@x.com');
    vi.mocked(getNote).mockResolvedValue({ ...nota, updatedAt: '2026-10-01T00:00:00Z' } as never);
    await reconciliarLegadoSensivel();
    expect(updateNote).toHaveBeenCalledTimes(1);
  });
  it('avaliação ausente na nuvem: NÃO é apagada (fica pendente na quarentena)', async () => {
    localStorage.setItem('jg3_owner', 'u1');
    guardarLegadoSensivel({ avaliacoes: { al1: [aval] } });
    setLocalAuthUid('u1', 'a@x.com');
    vi.mocked(getAssessment).mockResolvedValue(null);
    const r = await reconciliarLegadoSensivel();
    expect(r).toMatchObject({ status: 'pendencias', pendentes: 1 });
    expect(JSON.parse(localStorage.getItem(QUARENTENA_KEY) ?? '{}').avaliacoes.al1).toHaveLength(1);
  });
  it('falha de rede ao enviar: item permanece na quarentena', async () => {
    localStorage.setItem('jg3_owner', 'u1');
    guardarLegadoSensivel({ notas: { al1: [nota] } });
    setLocalAuthUid('u1', 'a@x.com');
    vi.mocked(getNote).mockRejectedValue(new Error('offline'));
    const r = await reconciliarLegadoSensivel();
    expect(r.pendentes).toBe(1);
    expect(localStorage.getItem(QUARENTENA_KEY)).not.toBeNull();
  });
});
