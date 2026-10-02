import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deletePhotosByAssessment = vi.fn().mockResolvedValue(undefined);
vi.mock('../assessmentPhotoStore', () => ({
  deletePhotosByAssessment: (id: string) => deletePhotosByAssessment(id),
}));

import { clearLocalOwnerMemory, setLocalOwner } from '../localOwner';
import {
  carregarRascunhoOnline,
  limparRascunhosExpirados,
  limparTodosRascunhosOnline,
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
const draft = (assessmentId = 'af-online-1-abc', updatedAt = iso(1)) => ({
  assessmentId,
  step: 'antropometria',
  updatedAt,
  data: { peso: '80' },
});
const K = (alunoId: string) => `jg3_online_draft_${alunoId}`;
/** Chaves do storage sem a do dono (jg3_owner), que `setLocalOwner` também grava. */
const chaves = (mem: Map<string, string>) => Array.from(mem.keys()).filter((k) => k !== 'jg3_owner').sort();

describe('rascunho online — dono, contexto e validação', () => {
  let mem: Map<string, string>;
  beforeEach(() => {
    mem = installLocalStorage();
    deletePhotosByAssessment.mockClear();
    setLocalOwner('uidA');
  });
  afterEach(() => {
    clearLocalOwnerMemory();
    vi.unstubAllGlobals();
  });

  it('sem conta autenticada não grava (e avisa com false)', () => {
    clearLocalOwnerMemory();
    mem.delete('jg3_owner'); // como após o logout (wipeLocalData remove o dono)
    expect(salvarRascunhoOnline('al-1', draft())).toBe(false);
    expect(chaves(mem)).toEqual([]);
  });

  it('grava versão, dono e aluno junto com o conteúdo', () => {
    const d = draft();
    expect(salvarRascunhoOnline('al-1', d)).toBe(true);
    const gravado = JSON.parse(mem.get(K('al-1'))!);
    expect(gravado).toMatchObject({ v: 2, ownerUid: 'uidA', alunoId: 'al-1', assessmentId: 'af-online-1-abc' });
    expect(carregarRascunhoOnline('al-1')).toEqual(d);
  });

  it('CENÁRIO: A deixa rascunho parcial e sai sem limpeza; B entra e NÃO o recupera (e o rascunho é descartado)', () => {
    salvarRascunhoOnline('al-1', draft());
    setLocalOwner('uidB'); // B autenticado no mesmo navegador, mesma chave de aluno

    expect(carregarRascunhoOnline('al-1')).toBeNull();
    expect(mem.has(K('al-1'))).toBe(false);

    setLocalOwner('uidA'); // e A também não o recupera depois: foi apagado
    expect(carregarRascunhoOnline('al-1')).toBeNull();
    // não toca nas fotos de outra conta
    expect(deletePhotosByAssessment).not.toHaveBeenCalled();
  });

  it('Cliente A → rascunho A; Cliente B → rascunho B; sem mistura, mesmo dono', () => {
    salvarRascunhoOnline('al-A', draft('af-online-1-aaa'));
    salvarRascunhoOnline('al-B', draft('af-online-2-bbb'));
    expect(carregarRascunhoOnline('al-A')?.assessmentId).toBe('af-online-1-aaa');
    expect(carregarRascunhoOnline('al-B')?.assessmentId).toBe('af-online-2-bbb');
    expect(carregarRascunhoOnline('al-C')).toBeNull();
  });

  it('rascunho copiado para a chave de outro aluno é rejeitado (contexto não confere)', () => {
    salvarRascunhoOnline('al-A', draft());
    mem.set(K('al-B'), mem.get(K('al-A'))!);
    expect(carregarRascunhoOnline('al-B')).toBeNull();
    expect(mem.has(K('al-B'))).toBe(false);
    expect(carregarRascunhoOnline('al-A')).not.toBeNull(); // o original segue válido
  });

  it('rascunho antigo (sem versão/dono) continua restaurável e ganha dono ao ser regravado', () => {
    const d = draft();
    mem.set(K('al-1'), JSON.stringify(d));
    const r = carregarRascunhoOnline('al-1');
    expect(r).toEqual(d);
    salvarRascunhoOnline('al-1', r!);
    expect(JSON.parse(mem.get(K('al-1'))!).ownerUid).toBe('uidA');
  });

  it.each([
    ['com ":" (forja chave de foto de outra conta)', 'uidB:af-1'],
    ['com "/" (vira caminho no Firestore)', 'a/b'],
    ['com ".."', '../x'],
    ['vazio', ''],
    ['grande demais', 'a'.repeat(129)],
  ])('assessmentId %s não é gravado nem restaurado', (_nome, id) => {
    expect(salvarRascunhoOnline('al-1', draft(id))).toBe(false);
    mem.set(K('al-1'), JSON.stringify({ ...draft(id), v: 2, ownerUid: 'uidA', alunoId: 'al-1' }));
    expect(carregarRascunhoOnline('al-1')).toBeNull();
    expect(mem.has(K('al-1'))).toBe(false);
  });

  it('versão desconhecida, JSON quebrado e formato inesperado são descartados', () => {
    mem.set(K('v'), JSON.stringify({ ...draft(), v: 3, ownerUid: 'uidA' }));
    mem.set(K('j'), '{quebrado');
    mem.set(K('a'), '[]');
    mem.set(K('s'), JSON.stringify({ ...draft(), step: 7, ownerUid: 'uidA' }));
    for (const id of ['v', 'j', 'a', 's']) expect(carregarRascunhoOnline(id)).toBeNull();
    expect(chaves(mem)).toEqual([]);
  });

  it('vencido: apaga e descarta as fotos do rascunho; recente não', () => {
    salvarRascunhoOnline('al-1', draft('af-online-1-old', iso(15)));
    salvarRascunhoOnline('al-2', draft('af-online-2-new', iso(2)));
    expect(carregarRascunhoOnline('al-1')).toBeNull();
    expect(carregarRascunhoOnline('al-2')).not.toBeNull();
    expect(deletePhotosByAssessment).toHaveBeenCalledTimes(1);
    expect(deletePhotosByAssessment).toHaveBeenCalledWith('af-online-1-old');
  });

  it('varredura no login remove vencidos, inválidos e de outro dono; mantém só os válidos do dono atual', () => {
    salvarRascunhoOnline('al-ok', draft('af-online-1-ok'));
    salvarRascunhoOnline('al-velho', draft('af-online-2-velho', iso(30)));
    mem.set(K('al-quebrado'), '{x');
    mem.set(K('al-de-B'), JSON.stringify({ ...draft('af-online-3-b'), v: 2, ownerUid: 'uidB', alunoId: 'al-de-B' }));
    mem.set('outra_chave', 'x');

    limparRascunhosExpirados();

    expect(chaves(mem)).toEqual([K('al-ok'), 'outra_chave']);
    expect(deletePhotosByAssessment).toHaveBeenCalledTimes(1);
    expect(deletePhotosByAssessment).toHaveBeenCalledWith('af-online-2-velho');
  });

  it('limpeza total (logout) remove todos os rascunhos e só eles', () => {
    salvarRascunhoOnline('al-1', draft());
    salvarRascunhoOnline('al-2', draft('af-online-2-x'));
    mem.set('jg3_theme', 'dark');
    limparTodosRascunhosOnline();
    expect(chaves(mem)).toEqual(['jg3_theme']);
  });

  it('localStorage cheio: retorna false (o formulário avisa o usuário)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('cheio', 'QuotaExceededError');
      },
      removeItem: () => undefined,
      key: () => null,
      length: 0,
    });
    expect(salvarRascunhoOnline('al-1', draft())).toBe(false);
  });
});
