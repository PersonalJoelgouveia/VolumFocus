import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deletePhotosByAssessment = vi.fn().mockResolvedValue(undefined);
vi.mock('../assessmentPhotoStore', () => ({
  deletePhotosByAssessment: (alunoId: string, id: string) => deletePhotosByAssessment(alunoId, id),
}));

import { setLocalAuthUid, setLocalOwnerUUID } from '../localOwner';
import {
  carregarRascunhoOnline,
  limparRascunhoOnline,
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

const UA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DIA = 24 * 60 * 60 * 1000;
const iso = (diasAtras: number) => new Date(Date.now() - diasAtras * DIA).toISOString();
const draft = (assessmentId = 'af-online-1-abc', updatedAt = iso(1)) => ({
  assessmentId,
  step: 'antropometria',
  updatedAt,
  data: { peso: '80' },
});
const KN = (owner: string, alunoId: string) => `jg3_online_draft_${owner}:${encodeURIComponent(alunoId)}`;
const KL = (alunoId: string) => `jg3_online_draft_${alunoId}`;
const chaves = (mem: Map<string, string>) => Array.from(mem.keys()).filter((k) => k.startsWith('jg3_online_draft_')).sort();

const entrarA = () => { setLocalAuthUid('uidA', 'a@x.com'); setLocalOwnerUUID('uidA', UA); };
const entrarB = () => { setLocalAuthUid('uidB', 'b@x.com'); setLocalOwnerUUID('uidB', UB); };
const sair = () => setLocalAuthUid(null);

/** Registro v2 (anterior ao ownerUUID). */
const legado = (alunoId: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ ...draft(), v: 2, ownerUid: 'uidA', alunoId, ...extra });

describe('rascunho online — ownerUUID + cliente + avaliação', () => {
  let mem: Map<string, string>;
  beforeEach(() => {
    mem = installLocalStorage();
    deletePhotosByAssessment.mockClear();
    entrarA();
  });
  afterEach(() => {
    sair();
    vi.unstubAllGlobals();
  });

  it('criação: sem sessão/ownerUUID não grava (false); com sessão grava envelope v3 com dono, cliente e avaliação', () => {
    sair();
    expect(salvarRascunhoOnline('al-1', draft())).toBe(false);
    setLocalAuthUid('uidA', 'a@x.com'); // autenticado, vínculo ainda não resolvido
    expect(salvarRascunhoOnline('al-1', draft())).toBe(false);
    expect(chaves(mem)).toEqual([]);

    entrarA();
    const d = draft();
    expect(salvarRascunhoOnline('al-1', d)).toBe(true);
    expect(chaves(mem)).toEqual([KN(UA, 'al-1')]);
    expect(JSON.parse(mem.get(KN(UA, 'al-1'))!)).toMatchObject({ v: 3, ownerUUID: UA, alunoId: 'al-1', assessmentId: 'af-online-1-abc' });
    expect(carregarRascunhoOnline('al-1')).toEqual(d);
  });

  it('atualização (autosave) substitui o rascunho do mesmo (dono, cliente) — sem duplicar', () => {
    salvarRascunhoOnline('al-1', { ...draft(), step: 'dados' });
    salvarRascunhoOnline('al-1', { ...draft(), step: 'revisao', data: { peso: '81' } });
    expect(chaves(mem)).toEqual([KN(UA, 'al-1')]);
    expect(carregarRascunhoOnline('al-1')).toMatchObject({ step: 'revisao', data: { peso: '81' } });
  });

  it('A/Cliente A → Draft A; B/Cliente A e A/Cliente B NÃO o recuperam', () => {
    salvarRascunhoOnline('al-A', draft('af-online-1-aaa'));

    expect(carregarRascunhoOnline('al-B')).toBeNull(); // A → Cliente B
    expect(carregarRascunhoOnline('al-A')?.assessmentId).toBe('af-online-1-aaa');

    sair(); // logout
    expect(carregarRascunhoOnline('al-A')).toBeNull();
    entrarB(); // troca de conta, MESMO cliente
    expect(carregarRascunhoOnline('al-A')).toBeNull(); // B → Cliente A negado
    expect(carregarRascunhoOnline('al-B')).toBeNull();

    // o de A segue intacto (B nem o enxerga nem o apaga) e volta para A
    expect(mem.has(KN(UA, 'al-A'))).toBe(true);
    sair();
    entrarA();
    expect(carregarRascunhoOnline('al-A')?.assessmentId).toBe('af-online-1-aaa');
  });

  it('B/Cliente B tem o próprio rascunho, independente do de A/Cliente A (mesmo cliente também)', () => {
    salvarRascunhoOnline('al-A', draft('af-online-1-aaa'));
    sair(); entrarB();
    salvarRascunhoOnline('al-B', draft('af-online-2-bbb'));
    salvarRascunhoOnline('al-A', draft('af-online-3-ccc')); // B grava o seu para o mesmo clienteId
    expect(carregarRascunhoOnline('al-B')?.assessmentId).toBe('af-online-2-bbb');
    expect(carregarRascunhoOnline('al-A')?.assessmentId).toBe('af-online-3-ccc');
    sair(); entrarA();
    expect(carregarRascunhoOnline('al-A')?.assessmentId).toBe('af-online-1-aaa'); // não foi sobrescrito
  });

  it('troca de conta sem logout: o ownerUUID de A não é herdado por B (nada restaurado)', () => {
    salvarRascunhoOnline('al-A', draft());
    setLocalAuthUid('uidB', 'b@x.com'); // B autenticou; ownerUUID ainda não resolvido
    expect(carregarRascunhoOnline('al-A')).toBeNull();
    expect(salvarRascunhoOnline('al-A', draft('af-online-9-zzz'))).toBe(false);
    setLocalOwnerUUID('uidB', UB);
    expect(carregarRascunhoOnline('al-A')).toBeNull();
    expect(mem.has(KN(UA, 'al-A'))).toBe(true);
  });

  it('rascunho copiado para a chave de outro cliente ou outro dono é rejeitado (envelope não confere)', () => {
    salvarRascunhoOnline('al-A', draft());
    mem.set(KN(UA, 'al-B'), mem.get(KN(UA, 'al-A'))!); // outro cliente, mesmo dono
    expect(carregarRascunhoOnline('al-B')).toBeNull();
    expect(mem.has(KN(UA, 'al-B'))).toBe(false);

    sair(); entrarB();
    mem.set(KN(UB, 'al-A'), mem.get(KN(UA, 'al-A'))!); // copiado para o namespace de B
    expect(carregarRascunhoOnline('al-A')).toBeNull();
    expect(mem.has(KN(UB, 'al-A'))).toBe(false);
  });

  it('ids forjados: alunoId com ":" não alcança outro escopo; alunoId vazio/enorme é recusado', () => {
    salvarRascunhoOnline('al-A', draft());
    expect(carregarRascunhoOnline(`${UA}:al-A`)).toBeNull();
    expect(carregarRascunhoOnline('al-A:x')).toBeNull();
    expect(salvarRascunhoOnline('', draft())).toBe(false);
    expect(salvarRascunhoOnline('x'.repeat(201), draft())).toBe(false);
    expect(carregarRascunhoOnline('')).toBeNull();
  });

  it.each([
    ['com ":" (forja chave de foto)', 'uidB:af-1'],
    ['com "/" (vira caminho no Firestore)', 'a/b'],
    ['com ".."', '../x'],
    ['vazio', ''],
    ['grande demais', 'a'.repeat(129)],
  ])('assessmentId %s não é gravado nem restaurado', (_nome, id) => {
    expect(salvarRascunhoOnline('al-1', draft(id))).toBe(false);
    mem.set(KN(UA, 'al-1'), JSON.stringify({ ...draft(id), v: 3, ownerUUID: UA, alunoId: 'al-1' }));
    expect(carregarRascunhoOnline('al-1')).toBeNull();
    expect(mem.has(KN(UA, 'al-1'))).toBe(false);
  });

  it('versão desconhecida, JSON quebrado e formato inesperado do próprio escopo são descartados', () => {
    mem.set(KN(UA, 'v'), JSON.stringify({ ...draft(), v: 9, ownerUUID: UA, alunoId: 'v' }));
    mem.set(KN(UA, 'j'), '{quebrado');
    mem.set(KN(UA, 'a'), '[]');
    mem.set(KN(UA, 's'), JSON.stringify({ ...draft(), step: 7, v: 3, ownerUUID: UA, alunoId: 's' }));
    for (const id of ['v', 'j', 'a', 's']) expect(carregarRascunhoOnline(id)).toBeNull();
    expect(chaves(mem)).toEqual([]);
  });

  it('envio concluído: limparRascunhoOnline apaga só o do (dono, cliente) atuais', () => {
    salvarRascunhoOnline('al-1', draft());
    salvarRascunhoOnline('al-2', draft('af-online-2-x'));
    sair(); entrarB();
    salvarRascunhoOnline('al-1', draft('af-online-3-y'));
    limparRascunhoOnline('al-1'); // B limpa o dele
    expect(chaves(mem)).toEqual([KN(UA, 'al-1'), KN(UA, 'al-2')].sort());
    sair(); entrarA();
    limparRascunhoOnline('al-1');
    expect(chaves(mem)).toEqual([KN(UA, 'al-2')]);
    expect(carregarRascunhoOnline('al-1')).toBeNull();
    sair();
    limparRascunhoOnline('al-2'); // sem sessão: nada acontece
    expect(chaves(mem)).toEqual([KN(UA, 'al-2')]);
  });

  it('vencido: apaga e descarta as fotos do (dono, cliente); recente não', () => {
    salvarRascunhoOnline('al-1', draft('af-online-1-old', iso(15)));
    salvarRascunhoOnline('al-2', draft('af-online-2-new', iso(2)));
    expect(carregarRascunhoOnline('al-1')).toBeNull();
    expect(carregarRascunhoOnline('al-2')).not.toBeNull();
    expect(deletePhotosByAssessment).toHaveBeenCalledTimes(1);
    expect(deletePhotosByAssessment).toHaveBeenCalledWith('al-1', 'af-online-1-old');
  });

  it('varredura: remove vencidos/inválidos do dono atual; NÃO toca em rascunho de outro dono', () => {
    salvarRascunhoOnline('al-ok', draft('af-online-1-ok'));
    salvarRascunhoOnline('al-velho', draft('af-online-2-velho', iso(30)));
    mem.set(KN(UA, 'al-quebrado'), '{x');
    sair(); entrarB();
    salvarRascunhoOnline('al-de-B', draft('af-online-3-b'));
    salvarRascunhoOnline('al-velho-B', draft('af-online-4-bold', iso(30)));
    sair(); entrarA();
    mem.set('outra_chave', 'x');

    limparRascunhosExpirados();

    expect(chaves(mem)).toEqual([KN(UA, 'al-ok'), KN(UB, 'al-de-B'), KN(UB, 'al-velho-B')].sort());
    expect(mem.get('outra_chave')).toBe('x');
    expect(deletePhotosByAssessment).toHaveBeenCalledTimes(1);
    expect(deletePhotosByAssessment).toHaveBeenCalledWith('al-velho', 'af-online-2-velho');
    sair();
    limparRascunhosExpirados(); // sem sessão: não mexe em nada
    expect(chaves(mem)).toHaveLength(3);
  });

  it('limpeza total (logout/wipe) remove todos os rascunhos e só eles', () => {
    salvarRascunhoOnline('al-1', draft());
    mem.set(KL('al-2'), legado('al-2'));
    mem.set('jg3_theme', 'dark');
    limparTodosRascunhosOnline();
    expect(chaves(mem)).toEqual([]);
    expect(mem.get('jg3_theme')).toBe('dark');
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

  describe('legado v2 (chave só com o cliente) — cache existente preservado', () => {
    it('é adotado (movido) quando o uid gravado é o da sessão e o cliente confere', () => {
      mem.set(KL('al-1'), legado('al-1'));
      expect(carregarRascunhoOnline('al-1')).toEqual(draft());
      expect(chaves(mem)).toEqual([KN(UA, 'al-1')]);
      expect(JSON.parse(mem.get(KN(UA, 'al-1'))!)).toMatchObject({ v: 3, ownerUUID: UA, alunoId: 'al-1' });
    });

    it('de outra conta, sem dono ou de outro cliente NÃO é adotado nem apagado', () => {
      mem.set(KL('al-1'), legado('al-1', { ownerUid: 'uidB' }));
      mem.set(KL('al-2'), JSON.stringify({ ...draft(), v: 2, alunoId: 'al-2' })); // sem dono
      mem.set(KL('al-3'), legado('al-OUTRO'));
      for (const id of ['al-1', 'al-2', 'al-3']) expect(carregarRascunhoOnline(id)).toBeNull();
      expect(chaves(mem)).toEqual([KL('al-1'), KL('al-2'), KL('al-3')]);
    });

    it('B nunca adota o legado de A', () => {
      mem.set(KL('al-1'), legado('al-1'));
      sair(); entrarB();
      expect(carregarRascunhoOnline('al-1')).toBeNull();
      expect(chaves(mem)).toEqual([KL('al-1')]);
      sair(); entrarA();
      expect(carregarRascunhoOnline('al-1')).not.toBeNull();
    });

    it('legado vencido do próprio uid é apagado com as fotos; salvar/limpar não deixam v2 próprio ressuscitar', () => {
      mem.set(KL('al-1'), legado('al-1', { updatedAt: iso(20) }));
      expect(carregarRascunhoOnline('al-1')).toBeNull();
      expect(mem.has(KL('al-1'))).toBe(false);
      expect(deletePhotosByAssessment).toHaveBeenCalledWith('al-1', 'af-online-1-abc');

      mem.set(KL('al-2'), legado('al-2'));
      salvarRascunhoOnline('al-2', draft('af-online-5-new'));
      expect(mem.has(KL('al-2'))).toBe(false);
      mem.set(KL('al-3'), legado('al-3'));
      limparRascunhoOnline('al-3');
      expect(mem.has(KL('al-3'))).toBe(false);
      mem.set(KL('al-4'), legado('al-4', { ownerUid: 'uidB' }));
      limparRascunhoOnline('al-4'); // v2 de outra conta: não é nosso
      expect(mem.has(KL('al-4'))).toBe(true);
    });

    it('varredura: legado próprio vencido e lixo ilegível saem; de outra conta fica', () => {
      mem.set(KL('al-v'), legado('al-v', { updatedAt: iso(20) }));
      mem.set(KL('al-lixo'), '{x');
      mem.set(KL('al-B'), legado('al-B', { ownerUid: 'uidB' }));
      mem.set(KL('al-ok'), legado('al-ok'));
      limparRascunhosExpirados();
      expect(chaves(mem)).toEqual([KL('al-B'), KL('al-ok')]);
    });
  });
});
