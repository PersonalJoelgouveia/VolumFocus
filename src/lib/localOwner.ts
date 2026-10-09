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

/* ============================================================================
 * ownerUUID local — namespace/isolamento de dados locais (ex.: fotos corporais).
 *
 * O ownerUUID NÃO é segredo nem credencial: aqui serve só para separar espaços
 * de armazenamento no aparelho. Quem protege os dados na nuvem são as Security
 * Rules (request.auth.uid). Um ownerUUID errado/forjado só faria as fotos
 * "sumirem" para quem o usou — nunca dá acesso a nada no Firebase.
 *
 * Fluxo: o login autorizado chama `setLocalAuthUid(uid)`; quando o vínculo
 * Auth UID → ownerUUID é lido/criado, `setLocalOwnerUUID(uid, ownerUUID)`.
 * O par é guardado em localStorage (`jg3_owner_uuid`) só para o app abrir OFFLINE
 * sem reler o Firestore; só vale se o `uid` guardado for o da sessão atual.
 * ========================================================================== */

export const OWNER_UUID_CACHE_KEY = 'jg3_owner_uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let memoryAuthUid: string | null = null;
let memoryOwnerUUID: string | null = null;
let memoryAuthEmail: string | null = null;

/** uid da sessão autorizada atual (ou `null` = sem sessão → nenhum dado local acessível).
 *  `email` (opcional, confirmado pelo Firebase Auth) só serve para ADOTAR dados locais
 *  legados que eram namespaceados por e-mail (ex.: vídeos pessoais). */
export function setLocalAuthUid(uid: string | null, email?: string | null): void {
  if (uid !== memoryAuthUid) memoryOwnerUUID = null; // outra conta: nada herdado em memória
  memoryAuthUid = uid;
  memoryAuthEmail = uid && email ? email.toLowerCase() : null;
  if (uid === null) {
    try {
      localStorage.removeItem(OWNER_UUID_CACHE_KEY);
    } catch {
      /* sem localStorage */
    }
  }
}

/** Registra o ownerUUID resolvido no servidor para o `uid` (ignora se não for a sessão atual). */
export function setLocalOwnerUUID(uid: string, ownerUUID: string): void {
  if (uid !== memoryAuthUid || !UUID_V4.test(ownerUUID)) return;
  memoryOwnerUUID = ownerUUID;
  try {
    localStorage.setItem(OWNER_UUID_CACHE_KEY, JSON.stringify({ uid, ownerUUID }));
  } catch {
    /* segue só em memória */
  }
}

/** ownerUUID da sessão atual, ou `null` (sem sessão / ainda não resolvido e sem cache desta conta). */
export function getLocalOwnerUUID(): string | null {
  if (!memoryAuthUid) return null;
  if (memoryOwnerUUID) return memoryOwnerUUID;
  try {
    const raw = localStorage.getItem(OWNER_UUID_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { uid?: unknown; ownerUUID?: unknown };
    if (c.uid === memoryAuthUid && typeof c.ownerUUID === 'string' && UUID_V4.test(c.ownerUUID)) {
      memoryOwnerUUID = c.ownerUUID;
      return c.ownerUUID;
    }
  } catch {
    /* cache ilegível: ignora */
  }
  return null;
}

/** e-mail (minúsculo) da sessão autorizada atual, ou `null`. Só para adoção de legado. */
export function getLocalAuthEmail(): string | null {
  return memoryAuthUid ? memoryAuthEmail : null;
}

/** uid do Firebase da sessão autorizada atual, ou `null`. Só para adoção de dados legados por uid. */
export function getLocalAuthUid(): string | null {
  return memoryAuthUid;
}
