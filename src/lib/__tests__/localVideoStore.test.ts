import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const video = (txt: string) => new Blob([txt], { type: 'video/webm' });
const texto = (b: Blob) => new Response(b).text();

function chavesDoBanco(): Promise<string[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB);
    req.onsuccess = () => {
      const q = req.result.transaction('personal-videos').objectStore('personal-videos').getAllKeys();
      q.onsuccess = () => { req.result.close(); resolve(q.result.map(String).sort()); };
    };
  });
}

describe.skipIf(!disponivel)('localVideoStore — isolamento, limites e limpeza', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('B não recupera o vídeo de A (mesmo exercício) e não afeta o de A ao salvar/remover o dele', async () => {
    await savePersonalVideo('a@x.com', 'e1', video('de-A'));
    expect(await getPersonalVideo('b@x.com', 'e1')).toBeNull();

    await savePersonalVideo('b@x.com', 'e1', video('de-B'));
    await deletePersonalVideo('b@x.com', 'e1');
    await deletePersonalVideosByExercise('b@x.com', 'e1');
    await deletePersonalVideosByCliente('b@x.com', 'al-1');

    expect(await texto((await getPersonalVideo('a@x.com', 'e1'))!.blob)).toBe('de-A');
  });

  it('e-mail em maiúsculas/minúsculas aponta para o mesmo vídeo', async () => {
    await savePersonalVideo('A@X.com', 'e1', video('v'));
    expect(await getPersonalVideo('a@x.COM', 'e1')).not.toBeNull();
  });

  it('formato original da chave é preservado (sem migração) e o escopo por cliente não colide', async () => {
    await savePersonalVideo('a@x.com', 'e1', video('meu'));
    await savePersonalVideo('a@x.com', 'e1', video('cliente-1'), 'al-1');
    expect(await chavesDoBanco()).toEqual(['a@x.com:al-1:e1', 'a@x.com_e1']);
  });

  it('Cliente A, Cliente B e "Meu Treino" não se enxergam', async () => {
    await savePersonalVideo('a@x.com', 'e1', video('c-A'), 'al-A');
    expect(await getPersonalVideo('a@x.com', 'e1', 'al-B')).toBeNull();
    expect(await getPersonalVideo('a@x.com', 'e1', null)).toBeNull();
    expect(await texto((await getPersonalVideo('a@x.com', 'e1', 'al-A'))!.blob)).toBe('c-A');

    await deletePersonalVideo('a@x.com', 'e1', 'al-B'); // não apaga o do A
    expect(await getPersonalVideo('a@x.com', 'e1', 'al-A')).not.toBeNull();
  });

  it('B → Cliente A: outra conta com o mesmo clienteId não alcança o vídeo', async () => {
    await savePersonalVideo('a@x.com', 'e1', video('c-A'), 'al-A');
    expect(await getPersonalVideo('b@x.com', 'e1', 'al-A')).toBeNull();
  });

  it('substituir mantém um único registro por chave', async () => {
    await savePersonalVideo('a@x.com', 'e1', video('v1'));
    await savePersonalVideo('a@x.com', 'e1', video('v2'));
    expect(await chavesDoBanco()).toEqual(['a@x.com_e1']);
    expect(await texto((await getPersonalVideo('a@x.com', 'e1'))!.blob)).toBe('v2');
  });

  it('exercício removido: apaga todos os escopos DO USUÁRIO, sem tocar em outro e-mail nem em exercício parecido', async () => {
    await savePersonalVideo('a@x.com', 'e1', video('1'));
    await savePersonalVideo('a@x.com', 'e1', video('2'), 'al-1');
    await savePersonalVideo('a@x.com', 'e11', video('3'));
    await savePersonalVideo('b@x.com', 'e1', video('4'));
    expect(await countPersonalVideosByExercise('a@x.com', 'e1')).toBe(2);

    await deletePersonalVideosByExercise('a@x.com', 'e1');

    expect(await chavesDoBanco()).toEqual(['a@x.com_e11', 'b@x.com_e1']);
    expect(await countPersonalVideosByExercise('a@x.com', 'e1')).toBe(0);
  });

  it('aluno removido: apaga só os vídeos daquele cliente DO USUÁRIO', async () => {
    await savePersonalVideo('a@x.com', 'e1', video('1'), 'al-1');
    await savePersonalVideo('a@x.com', 'e2', video('2'), 'al-1');
    await savePersonalVideo('a@x.com', 'e1', video('3'), 'al-2');
    await savePersonalVideo('a@x.com', 'e1', video('4'));
    await savePersonalVideo('b@x.com', 'e1', video('5'), 'al-1');

    await deletePersonalVideosByCliente('a@x.com', 'al-1');

    expect(await chavesDoBanco()).toEqual(['a@x.com:al-2:e1', 'a@x.com_e1', 'b@x.com:al-1:e1']);
  });

  it('sem espaço livre: recusa com VideoStorageFullError e preserva o vídeo existente', async () => {
    await savePersonalVideo('a@x.com', 'e1', video('antigo!!')); // 8 bytes
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 100, usage: 95 }) } });

    await expect(savePersonalVideo('a@x.com', 'e2', video('0123456789'))).rejects.toBeInstanceOf(VideoStorageFullError);
    expect(await getPersonalVideo('a@x.com', 'e2')).toBeNull();

    // substituição: o espaço do vídeo antigo (8) conta como livre → 5 + 8 >= 10
    await savePersonalVideo('a@x.com', 'e1', video('0123456789'));
    expect(await texto((await getPersonalVideo('a@x.com', 'e1'))!.blob)).toBe('0123456789');

    // não cabe nem somando o antigo (10): 5 + 10 < 20 → recusa e mantém o antigo
    await expect(savePersonalVideo('a@x.com', 'e1', video('0123456789ABCDEFGHIJ'))).rejects.toBeInstanceOf(VideoStorageFullError);
    expect(await texto((await getPersonalVideo('a@x.com', 'e1'))!.blob)).toBe('0123456789');
  });

  it('navegador sem estimate(): não bloqueia o salvamento', async () => {
    vi.stubGlobal('navigator', {});
    await savePersonalVideo('a@x.com', 'e1', video('ok'));
    expect(await getPersonalVideo('a@x.com', 'e1')).not.toBeNull();
  });

  it('pede armazenamento persistente após salvar', async () => {
    // módulo mantém um "já pedi" por carregamento; o 1º save do arquivo já o consumiu — valida só que não quebra
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });
    await expect(savePersonalVideo('a@x.com', 'e1', video('x'))).resolves.toBeUndefined();
  });

  it('não deixa conexões abertas (deleteDatabase não fica bloqueado)', async () => {
    await savePersonalVideo('a@x.com', 'e1', video('x'));
    await getPersonalVideo('a@x.com', 'e1');
    await deletePersonalVideo('a@x.com', 'e1');
    const bloqueado = await new Promise<boolean>((resolve) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onblocked = () => resolve(true);
      r.onsuccess = () => resolve(false);
    });
    expect(bloqueado).toBe(false);
  });
});
