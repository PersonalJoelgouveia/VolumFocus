import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backupRepository', () => ({
  LOCAL_STORAGE_KEYS: ['jg3_log', 'jg3_alunos', 'jg3_dirty'],
}));

const deletePhotosByAssessment = vi.fn().mockResolvedValue(undefined);
vi.mock('../assessmentPhotoStore', () => ({
  deletePhotosByAssessment: (alunoId: string, id: string) => deletePhotosByAssessment(alunoId, id),
}));

import { enforceLocalOwner, garantirDonoLocal, hasLocalMedia, wipeLocalData } from '../localDataLifecycle';
import { clearLocalOwnerMemory, setLocalAuthUid, setLocalOwner, setLocalOwnerUUID } from '../localOwner';
import {
  carregarRascunhoOnline,
  limparRascunhosExpirados,
  salvarRascunhoOnline,
} from '../onlineAssessmentDraftStore';

function installLocalStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
  });
  return data;
}

const DIA = 24 * 60 * 60 * 1000;
const iso = (diasAtras: number) => new Date(Date.now() - diasAtras * DIA).toISOString();

describe('enforceLocalOwner', () => {
  beforeEach(() => void installLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('adota a conta atual quando não há dono registrado (sem apagar nada)', () => {
    expect(enforceLocalOwner('uid-A')).toBe('adopted');
    expect(localStorage.getItem('jg3_owner')).toBe('uid-A');
  });

  it('reconhece o mesmo dono', () => {
    enforceLocalOwner('uid-A');
    expect(enforceLocalOwner('uid-A')).toBe('same');
  });

  it('detecta outra conta sem sobrescrever o dono registrado', () => {
    enforceLocalOwner('uid-A');
    expect(enforceLocalOwner('uid-B')).toBe('mismatch');
    expect(localStorage.getItem('jg3_owner')).toBe('uid-A');
  });
});

describe('wipeLocalData', () => {
  beforeEach(() => void installLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('apaga dado de usuário/cliente e rascunhos, preservando preferências e ferramentas', async () => {
    for (const k of [
      'jg3_log', 'jg3_alunos', 'jg3_dirty', 'jg3_owner',
      'jg3_sessoes_treino', 'jg3_rotina_sync', 'jg3_health_status', 'jg3_wearable_status', 'jg3_owner_uuid',
      'jg3_online_draft_aluno-1', 'jg3_online_draft_aluno-2',
      'jg3_theme', 'jg3_locale', 'jg3_timer_library', 'jg3_training_models_v9',
    ]) {
      localStorage.setItem(k, '{}');
    }

    expect(await wipeLocalData({ includeMedia: true })).toBe(true);

    const restantes = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).sort();
    expect(restantes).toEqual(['jg3_locale', 'jg3_theme', 'jg3_timer_library', 'jg3_training_models_v9']);
  });

  it('sem IndexedDB no ambiente, não há mídia local e a limpeza não falha', async () => {
    expect(await hasLocalMedia()).toBe(false);
    expect(await wipeLocalData({ includeMedia: false })).toBe(true);
  });
});

describe('rascunho online: expiração', () => {
  beforeEach(() => {
    installLocalStorage();
    // o rascunho só é gravado para uma conta autenticada com ownerUUID resolvido
    setLocalOwner('uidA');
    setLocalAuthUid('uidA', 'a@x.com');
    setLocalOwnerUUID('uidA', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
  afterEach(() => {
    clearLocalOwnerMemory();
    setLocalAuthUid(null);
    vi.unstubAllGlobals();
  });

  const draft = (updatedAt: string) => ({ assessmentId: 'af-1', step: 'review', updatedAt, data: {} });

  it('mantém rascunho recente e descarta (apagando) o vencido', () => {
    salvarRascunhoOnline('aluno-1', draft(iso(2)));
    salvarRascunhoOnline('aluno-2', draft(iso(15)));
    expect(carregarRascunhoOnline('aluno-1')).not.toBeNull();
    expect(carregarRascunhoOnline('aluno-2')).toBeNull();
    expect(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k) => k?.includes('aluno-2'))).toEqual([]);
  });

  it('rascunho vencido descarta também as fotos da avaliação dele (e o recente não)', () => {
    deletePhotosByAssessment.mockClear();
    salvarRascunhoOnline('aluno-1', { assessmentId: 'af-novo', step: 'review', updatedAt: iso(1), data: {} });
    salvarRascunhoOnline('aluno-2', { assessmentId: 'af-velho', step: 'review', updatedAt: iso(20), data: {} });

    limparRascunhosExpirados();

    expect(deletePhotosByAssessment).toHaveBeenCalledTimes(1);
    expect(deletePhotosByAssessment).toHaveBeenCalledWith('aluno-2', 'af-velho');
  });

  it('trata updatedAt ausente/ilegível como expirado (falha segura)', () => {
    salvarRascunhoOnline('aluno-3', draft('lixo'));
    expect(carregarRascunhoOnline('aluno-3')).toBeNull();
  });

  it('a varredura remove só os vencidos, de qualquer cliente', () => {
    salvarRascunhoOnline('aluno-1', draft(iso(1)));
    salvarRascunhoOnline('aluno-2', draft(iso(30)));
    localStorage.setItem('jg3_online_draft_aluno-4', '{json quebrado'); // legado ilegível
    localStorage.setItem('outra_chave', 'x');

    limparRascunhosExpirados();

    const K = (a: string) => `jg3_online_draft_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:${a}`;
    expect(localStorage.getItem(K('aluno-1'))).not.toBeNull();
    expect(localStorage.getItem(K('aluno-2'))).toBeNull();
    expect(localStorage.getItem('jg3_online_draft_aluno-4')).toBeNull();
    expect(localStorage.getItem('outra_chave')).toBe('x');
  });
});

describe('garantirDonoLocal — troca de conta sem logout do app', () => {
  let mem: Map<string, string>;
  beforeEach(() => {
    mem = installLocalStorage();
    const ss = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => (ss.has(k) ? ss.get(k)! : null),
      setItem: (k: string, v: string) => void ss.set(k, String(v)),
      removeItem: (k: string) => void ss.delete(k),
    });
  });
  afterEach(() => {
    clearLocalOwnerMemory();
    vi.unstubAllGlobals();
  });

  const dadosDeA = () => {
    mem.set('jg3_owner', 'uidA');
    mem.set('jg3_alunos', '[{"nome":"Cliente A"}]');
    mem.set('jg3_dirty', '{"state":{"dirty":true}}');
    mem.set('jg3_sessoes_treino', '{"state":{"sessions":[{"alunoNome":"Cliente A"}]}}');
    mem.set('jg3_owner_uuid', '{"uid":"uidA","ownerUUID":"x"}');
    mem.set('jg3_theme', 'dark');
  };

  it('mesmo dono: nada é apagado', async () => {
    dadosDeA();
    expect(await garantirDonoLocal('uidA')).toBe('ok');
    expect(mem.has('jg3_alunos')).toBe(true);
  });

  it('primeiro uso (sem dono registrado): adota sem apagar', async () => {
    mem.set('jg3_alunos', '[]');
    expect(await garantirDonoLocal('uidB')).toBe('ok');
    expect(mem.get('jg3_owner')).toBe('uidB');
    expect(mem.has('jg3_alunos')).toBe(true);
  });

  it('B entra com os dados de A no aparelho: apaga tudo de A (inclusive jg3_dirty) e pede recarga; preferências ficam', async () => {
    dadosDeA();
    expect(await garantirDonoLocal('uidB')).toBe('recarregar');
    expect(Array.from(mem.keys()).sort()).toEqual(['jg3_theme']);
  });

  it('depois da recarga B é adotado sem apagar nada; A voltando também é tratado como troca', async () => {
    dadosDeA();
    await garantirDonoLocal('uidB'); // limpa
    mem.set('jg3_alunos', '[{"nome":"Cliente B"}]'); // B já trabalhando
    expect(await garantirDonoLocal('uidB')).toBe('ok');
    expect(mem.get('jg3_owner')).toBe('uidB');
    expect(mem.has('jg3_alunos')).toBe(true);
    expect(await garantirDonoLocal('uidA')).toBe('recarregar');
    expect(mem.has('jg3_alunos')).toBe(false);
  });

  it('não entra em laço se a limpeza não conseguir trocar o dono (2ª tentativa na mesma aba adota)', async () => {
    dadosDeA();
    expect(await garantirDonoLocal('uidB')).toBe('recarregar');
    mem.set('jg3_owner', 'uidA'); // a limpeza "não pegou" (ex.: outra aba regravou)
    expect(await garantirDonoLocal('uidB')).toBe('ok');
    expect(mem.get('jg3_owner')).toBe('uidB');
  });
});
