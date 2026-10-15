import type { StateStorage } from 'zustand/middleware';
import { getLocalAuthUid } from './localOwner';
import { podePersistirSensivel } from './connectivity';

/**
 * Armazenamento "guardado" para dados SENSÍVEIS (localStorage por baixo).
 *  - Online + contexto autorizado: grava normalmente.
 *  - Offline ou sem contexto autorizado: NÃO grava em disco; o valor mais recente fica só em memória
 *    (leituras na mesma sessão enxergam esse valor). Recarregar a página offline o perde — é o desejado.
 *  - Ao reconectar com o MESMO usuário autorizado: grava o valor pendente (flushSensivel). Se a conta
 *    mudou/saiu, o pendente é descartado (nunca é gravado sob outro dono).
 *  - Remover sempre remove de verdade (reduz dado).
 * Limite: não protege contra quem tem acesso ao perfil do navegador / ao sistema operacional do aparelho.
 */
const pendentes = new Map<string, { valor: string; uid: string | null }>();

export function sGet(chave: string): string | null {
  const p = pendentes.get(chave);
  if (p) return p.valor;
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function sSet(chave: string, valor: string): void {
  if (podePersistirSensivel()) {
    pendentes.delete(chave);
    localStorage.setItem(chave, valor); // erros (cota cheia) sobem ao chamador, como antes
    return;
  }
  pendentes.set(chave, { valor, uid: getLocalAuthUid() });
}

export function sRemove(chave: string): void {
  pendentes.delete(chave);
  try {
    localStorage.removeItem(chave);
  } catch {
    /* sem localStorage */
  }
}

/** Grava o que ficou só em memória, SE voltou a poder persistir e o dono é o mesmo. */
export function flushSensivel(): void {
  if (!podePersistirSensivel()) return;
  const uid = getLocalAuthUid();
  for (const [k, p] of Array.from(pendentes)) {
    pendentes.delete(k);
    if (uid && p.uid === uid) {
      try {
        localStorage.setItem(k, p.valor);
      } catch (e) {
        console.error('guardedStorage: falha ao gravar pendente', k, e);
      }
    }
  }
}

/** Esquece tudo o que só estava em memória (logout, troca de conta, perda de contexto autorizado). */
export function descartarMemoriaSensivel(): void {
  pendentes.clear();
}

export function contarPendentesSensiveis(): number {
  return pendentes.size;
}

export const guardedStateStorage: StateStorage = {
  getItem: (n) => sGet(n),
  setItem: (n, v) => sSet(n, v),
  removeItem: (n) => sRemove(n),
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', flushSensivel);
}
