/**
 * Dono (uid) dos dados locais deste navegador. Módulo mínimo e SEM
 * dependências para poder ser usado por qualquer store local (ex.: fotos)
 * sem puxar Firebase/Zustand. Quem grava é `enforceLocalOwner`
 * (localDataLifecycle.ts), no login autorizado.
 */

export const OWNER_KEY = 'jg3_owner';

/** Espelho em memória: vale na sessão mesmo se o localStorage falhar. */
let memoryOwner: string | null = null;

export function setLocalOwner(uid: string): void {
  memoryOwner = uid;
  try {
    localStorage.setItem(OWNER_KEY, uid);
  } catch {
    /* sem localStorage: segue só em memória */
  }
}

/** uid da conta dona dos dados locais, ou `null` se ninguém autenticou ainda. */
export function getLocalOwner(): string | null {
  if (memoryOwner) return memoryOwner;
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/** Esquece o dono em memória (chamado quando a sessão local é limpa). */
export function clearLocalOwnerMemory(): void {
  memoryOwner = null;
}
