import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocalAuthUid, setLocalOwnerUUID } from '../localOwner';
import {
  VideoStorageFullError,
  countPersonalVideosByExercise,
  deletePersonalVideo,
  deletePersonalVideosByCliente,
  deletePersonalVideosByExercise,
  getPersonalVideo,
  savePersonalVideo,
} from '../localVideoStore';

/**
 * Precisam de um IndexedDB em Node. Sem `fake-indexeddb` (npm i -D fake-indexeddb)
 * a suíte é PULADA — não falha. No navegador real, rode os cenários manuais.
 */
const FAKE_IDB = 'fake-indexeddb/auto';
let disponivel = true;
try {
  await import(/* @vite-ignore */ FAKE_IDB);
} catch {
  disponivel = false;
}

const DB = 'volumfocus-media';
const STORE = 'personal-videos';
const UA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const video = (txt: string) => new Blob([txt], { type: 'video/webm' });
const texto = (b: Blob) => new Response(b).text();

/** Login autorizado simulado: uid + e-mail do Firebase Auth + ownerUUID resolvido. */
function entrar(uid: string, email: string, ownerUUID: string): void {
  setLocalAuthUid(uid, email);
  setLocalOwnerUUID(uid, ownerUUID);
}
const sair = () => setLocalAuthUid(null);
const entrarA = () => entrar('uid-A', 'a@x.com', UA);
const entrarB = () => entrar('uid-B', 'b@x.com', UB);

function chavesDoBanco(): Promise<string[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB);
    req.onsuccess = () => {
      const q = req.result.transaction(STORE).objectStore(STORE).getAllKeys();
      q.onsuccess = () => { req.result.close(); resolve(q.result.map(String).sort()); };
    };
  });
}

/** Insere um registro no formato ANTERIOR (namespace por e-mail). */
function semearLegado(id: string, rec: Record<string, unknown>, txt: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => {
      const tx = req.result.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        id, blob: video(txt), mimeType: 'video/webm', createdAt: '2025-01-01T00:00:00.000Z', sizeBytes: txt.length, ...rec,
      });
      tx.oncomplete = () => { req.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}

describe.skipIf(!disponivel)('localVideoStore — ownership, isolamento, limites e limpeza', () => {
  beforeEach(async () => {
    sair();
    await new Promise<void>((resolve) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sair();
  });

  it('CENÁRIO OBRIGATÓRIO: A grava p/ Cliente A, logout, B entra → B não recupera o vídeo de A', async () => {
    entrarA();
    await savePersonalVideo('e1', video('de-A'), 'al-A');
    sair();
    // sem sessão: nada acessível
    await expect(getPersonalVideo('e1', 'al-A')).rejects.toThrow();

    entrarB();
    expect(await getPersonalVideo('e1', 'al-A')).toBeNull(); // mesmo exercício e mesmo clienteId
    expect(await getPersonalVideo('e1', null)).toBeNull();
    expect(await getPersonalVideo('e1', 'al-B')).toBeNull();

    // B grava/remove/limpa o dele: nada disso encosta no de A
    await savePersonalVideo('e1', video('de-B'), 'al-A');
    await deletePersonalVideo('e1', 'al-A');
    await deletePersonalVideosByExercise('e1');
    await deletePersonalVideosByCliente('al-A');

    sair();
    entrarA(); // o vídeo de A continua lá para A
    expect(await texto((await getPersonalVideo('e1', 'al-A'))!.blob)).toBe('de-A');
  });

  it('A → Cliente A = vídeo A; A → Cliente B = vídeo B (não se enxergam, nem o "Meu Treino")', async () => {
    entrarA();
    await savePersonalVideo('e1', video('c-A'), 'al-A');
    expect(await getPersonalVideo('e1', 'al-B')).toBeNull();
    expect(await getPersonalVideo('e1', null)).toBeNull();

    await savePersonalVideo('e1', video('c-B'), 'al-B');
    expect(await texto((await getPersonalVideo('e1', 'al-A'))!.blob)).toBe('c-A');
    expect(await texto((await getPersonalVideo('e1', 'al-B'))!.blob)).toBe('c-B');

    await deletePersonalVideo('e1', 'al-B'); // não apaga o do cliente A
    expect(await getPersonalVideo('e1', 'al-B')).toBeNull();
    expect(await getPersonalVideo('e1', 'al-A')).not.toBeNull();
  });

  it('B → Cliente A é negado; B → Cliente B grava o próprio', async () => {
    entrarA();
    await savePersonalVideo('e1', video('c-A'), 'al-A');
    sair();
    entrarB();
    expect(await getPersonalVideo('e1', 'al-A')).toBeNull();
    await savePersonalVideo('e1', video('c-B'), 'al-B');
    expect(await texto((await getPersonalVideo('e1', 'al-B'))!.blob)).toBe('c-B');
  });

  it('chave = ownerUUID + cliente + exercício + videoId; "Meu Treino" usa escopo próprio', async () => {
    entrarA();
    await savePersonalVideo('e1', video('meu'));
    await savePersonalVideo('e1', video('cli'), 'al-1');
    expect(await chavesDoBanco()).toEqual([`${UA}:a=al-1:e1:principal`, `${UA}:self:e1:principal`]);
    const rec = (await getPersonalVideo('e1', 'al-1'))!;
    expect(rec).toMatchObject({ ownerUUID: UA, exerciseId: 'e1', clienteId: 'al-1', videoId: 'principal' });
    expect(rec.userEmail).toBeUndefined(); // e-mail não é mais gravado
  });

  it('ids forjados com ":" / "=" não alcançam o escopo de outro cliente nem de outro dono', async () => {
    entrarA();
    await savePersonalVideo('e1', video('c-A'), 'al-A');
    await savePersonalVideo('e1', video('self'));
    expect(await getPersonalVideo('e1:principal', 'al-A')).toBeNull();
    expect(await getPersonalVideo('e1', 'al-A:x')).toBeNull();
    expect(await getPersonalVideo('e1', 'self')).toBeNull(); // cliente literalmente chamado "self" ≠ "Meu Treino"
    expect(await getPersonalVideo(`${UB}:self:e1`, null)).toBeNull();
    await expect(getPersonalVideo('', null)).rejects.toThrow();
    await expect(getPersonalVideo('e1', '')).rejects.toThrow();
  });

  it('sem ownerUUID resolvido (ou conta que mudou sem resolver) nada é acessível', async () => {
    setLocalAuthUid('uid-A', 'a@x.com'); // autenticado, vínculo ainda não resolvido
    await expect(savePersonalVideo('e1', video('x'))).rejects.toThrow();
    await expect(getPersonalVideo('e1')).rejects.toThrow();
    await expect(deletePersonalVideo('e1')).rejects.toThrow();
    await expect(countPersonalVideosByExercise('e1')).rejects.toThrow();
    await expect(deletePersonalVideosByExercise('e1')).rejects.toThrow();
    await expect(deletePersonalVideosByCliente('al-1')).rejects.toThrow();
  });

  it('troca de conta sem logout: ownerUUID de A não é herdado por B', async () => {
    entrarA();
    await savePersonalVideo('e1', video('de-A'));
    setLocalAuthUid('uid-B', 'b@x.com'); // B autenticou, ownerUUID ainda não resolvido
    await expect(getPersonalVideo('e1')).rejects.toThrow();
    setLocalOwnerUUID('uid-B', UB);
    expect(await getPersonalVideo('e1')).toBeNull();
  });

  it('substituir mantém um único registro por chave', async () => {
    entrarA();
    await savePersonalVideo('e1', video('v1'));
    await savePersonalVideo('e1', video('v2'));
    expect(await chavesDoBanco()).toEqual([`${UA}:self:e1:principal`]);
    expect(await texto((await getPersonalVideo('e1'))!.blob)).toBe('v2');
  });

  it('exercício removido: apaga todos os clientes DO DONO, sem tocar em outro dono nem em exercício parecido', async () => {
    entrarA();
    await savePersonalVideo('e1', video('1'));
    await savePersonalVideo('e1', video('2'), 'al-1');
    await savePersonalVideo('e11', video('3'));
    sair();
    entrarB();
    await savePersonalVideo('e1', video('4'));
    sair();
    entrarA();
    expect(await countPersonalVideosByExercise('e1')).toBe(2);

    await deletePersonalVideosByExercise('e1');

    expect(await chavesDoBanco()).toEqual([`${UA}:self:e11:principal`, `${UB}:self:e1:principal`]);
    expect(await countPersonalVideosByExercise('e1')).toBe(0);
  });

  it('aluno removido: apaga só os vídeos daquele cliente DO DONO', async () => {
    entrarA();
    await savePersonalVideo('e1', video('1'), 'al-1');
    await savePersonalVideo('e2', video('2'), 'al-1');
    await savePersonalVideo('e1', video('3'), 'al-2');
    await savePersonalVideo('e1', video('4'));
    sair();
    entrarB();
    await savePersonalVideo('e1', video('5'), 'al-1');
    sair();
    entrarA();

    await deletePersonalVideosByCliente('al-1');

    expect(await chavesDoBanco()).toEqual([`${UA}:a=al-2:e1:principal`, `${UA}:self:e1:principal`, `${UB}:a=al-1:e1:principal`]);
  });

  describe('legado (namespace por e-mail) — cache existente preservado', () => {
    it('adota o vídeo antigo do próprio e-mail na 1ª leitura (move, não duplica)', async () => {
      await semearLegado('a@x.com_e1', { exerciseId: 'e1', userEmail: 'a@x.com' }, 'antigo-self');
      await semearLegado('a@x.com:al-1:e1', { exerciseId: 'e1', userEmail: 'a@x.com', clienteId: 'al-1' }, 'antigo-cli');
      entrarA();

      expect(await texto((await getPersonalVideo('e1'))!.blob)).toBe('antigo-self');
      expect(await texto((await getPersonalVideo('e1', 'al-1'))!.blob)).toBe('antigo-cli');
      expect(await chavesDoBanco()).toEqual([`${UA}:a=al-1:e1:principal`, `${UA}:self:e1:principal`]);
      const rec = (await getPersonalVideo('e1'))!;
      expect(rec.createdAt).toBe('2025-01-01T00:00:00.000Z'); // metadados preservados
      expect(rec.ownerUUID).toBe(UA);
    });

    it('B (outro e-mail) não adota nem enxerga o legado de A; o legado fica intacto', async () => {
      await semearLegado('a@x.com_e1', { exerciseId: 'e1', userEmail: 'a@x.com' }, 'antigo-A');
      entrarB();
      expect(await getPersonalVideo('e1')).toBeNull();
      expect(await chavesDoBanco()).toEqual(['a@x.com_e1']);
      sair();
      entrarA();
      expect(await texto((await getPersonalVideo('e1'))!.blob)).toBe('antigo-A');
    });

    it('legado cujo registro não confere (e-mail/cliente/exercício diferentes) não é adotado', async () => {
      await semearLegado('a@x.com_e1', { exerciseId: 'e1', userEmail: 'outro@x.com' }, 'forjado');
      await semearLegado('a@x.com:al-1:e2', { exerciseId: 'e2', userEmail: 'a@x.com', clienteId: 'al-9' }, 'cliente-errado');
      entrarA();
      expect(await getPersonalVideo('e1')).toBeNull();
      expect(await getPersonalVideo('e2', 'al-1')).toBeNull();
    });

    it('sem cache do ownerUUID Cliente A ≠ Cliente B no legado: só o cliente certo adota', async () => {
      await semearLegado('a@x.com:al-A:e1', { exerciseId: 'e1', userEmail: 'a@x.com', clienteId: 'al-A' }, 'c-A');
      entrarA();
      expect(await getPersonalVideo('e1', 'al-B')).toBeNull();
      expect(await getPersonalVideo('e1', null)).toBeNull();
      expect(await texto((await getPersonalVideo('e1', 'al-A'))!.blob)).toBe('c-A');
    });

    it('substituir e excluir também tratam a cópia legada (não ressuscita depois)', async () => {
      await semearLegado('a@x.com_e1', { exerciseId: 'e1', userEmail: 'a@x.com' }, 'antigo');
      await semearLegado('a@x.com_e2', { exerciseId: 'e2', userEmail: 'a@x.com' }, 'antigo2');
      entrarA();
      await savePersonalVideo('e1', video('novo'));
      expect(await chavesDoBanco()).toEqual(['a@x.com_e2', `${UA}:self:e1:principal`]);
      await deletePersonalVideo('e2');
      expect(await chavesDoBanco()).toEqual([`${UA}:self:e1:principal`]);
      expect(await getPersonalVideo('e2')).toBeNull();
    });

    it('exercício/aluno removidos limpam legado do próprio e-mail e nunca o de outro', async () => {
      await semearLegado('a@x.com_e1', { exerciseId: 'e1', userEmail: 'a@x.com' }, '1');
      await semearLegado('a@x.com:al-1:e1', { exerciseId: 'e1', userEmail: 'a@x.com', clienteId: 'al-1' }, '2');
      await semearLegado('b@x.com_e1', { exerciseId: 'e1', userEmail: 'b@x.com' }, '3');
      entrarA();
      expect(await countPersonalVideosByExercise('e1')).toBe(2);
      await deletePersonalVideosByExercise('e1');
      expect(await chavesDoBanco()).toEqual(['b@x.com_e1']);
    });
  });

  it('sem espaço livre: recusa com VideoStorageFullError e preserva o vídeo existente', async () => {
    entrarA();
    await savePersonalVideo('e1', video('antigo!!')); // 8 bytes
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 100, usage: 95 }) } });

    await expect(savePersonalVideo('e2', video('0123456789'))).rejects.toBeInstanceOf(VideoStorageFullError);
    expect(await getPersonalVideo('e2')).toBeNull();

    // substituição: o espaço do vídeo antigo (8) conta como livre → 5 + 8 >= 10
    await savePersonalVideo('e1', video('0123456789'));
    expect(await texto((await getPersonalVideo('e1'))!.blob)).toBe('0123456789');

    // não cabe nem somando o antigo (10): 5 + 10 < 20 → recusa e mantém o antigo
    await expect(savePersonalVideo('e1', video('0123456789ABCDEFGHIJ'))).rejects.toBeInstanceOf(VideoStorageFullError);
    expect(await texto((await getPersonalVideo('e1'))!.blob)).toBe('0123456789');
  });

  it('navegador sem estimate(): não bloqueia o salvamento', async () => {
    entrarA();
    vi.stubGlobal('navigator', {});
    await savePersonalVideo('e1', video('ok'));
    expect(await getPersonalVideo('e1')).not.toBeNull();
  });

  it('pede armazenamento persistente após salvar', async () => {
    entrarA();
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });
    await expect(savePersonalVideo('e1', video('x'))).resolves.toBeUndefined();
  });

  it('não deixa conexões abertas (deleteDatabase não fica bloqueado)', async () => {
    await semearLegado('a@x.com_e9', { exerciseId: 'e9', userEmail: 'a@x.com' }, 'l');
    entrarA();
    await savePersonalVideo('e1', video('x'));
    await getPersonalVideo('e1');
    await getPersonalVideo('e9'); // adoção
    await deletePersonalVideo('e1');
    const bloqueado = await new Promise<boolean>((resolve) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onblocked = () => resolve(true);
      r.onsuccess = () => resolve(false);
    });
    expect(bloqueado).toBe(false);
  });
});
