import { db, doc, getDoc, runTransaction, serverTimestamp } from './firebase';

/**
 * Vínculo Firebase Auth UID → `ownerUUID` (etapa 1 da arquitetura de
 * segurança por ownership).
 *
 * Duas coleções, escritas JUNTAS e atomicamente (runTransaction):
 *
 *  - `userOwners/{authUid}`  → { ownerUUID, createdAt }   (vínculo, leitura pelo dono)
 *  - `ownerUUIDs/{ownerUUID}` → { uid, createdAt }         (índice reverso = garantia de unicidade)
 *
 * O ownerUUID NÃO é segredo e NÃO é credencial: é só um identificador opaco
 * e estável para organizar dados. Quem decide autorização é o Firestore
 * (request.auth.uid + Security Rules) — nunca o valor que o frontend lê aqui.
 * Imutabilidade e unicidade são impostas pelas regras (create-only; ver
 * firestore-owner-uuid.rules), não por este código.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isValidOwnerUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}

/**
 * UUID v4 a partir do CSPRNG do navegador. Nunca usa Math.random nem deriva
 * de e-mail/nome/uid: sem Web Crypto, falha em vez de gerar algo previsível.
 */
export function generateOwnerUUID(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('ownerRepository: Web Crypto indisponível — não é seguro gerar o ownerUUID');
  }
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // versão 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function linkRef(uid: string) {
  return doc(db, 'userOwners', uid);
}

function indexRef(ownerUUID: string) {
  return doc(db, 'ownerUUIDs', ownerUUID);
}

/** Desconfia do conteúdo remoto: só devolve um UUID bem formado. */
function ownerUUIDDoDoc(data: unknown): string {
  const v = (data as { ownerUUID?: unknown } | undefined)?.ownerUUID;
  if (!isValidOwnerUUID(v)) throw new Error('ownerRepository: vínculo userOwners malformado');
  return v;
}

/** Lê o ownerUUID já vinculado ao uid, ou `null` se ainda não existe. */
export async function getOwnerUUID(uid: string): Promise<string | null> {
  const snap = await getDoc(linkRef(uid));
  return snap.exists() ? ownerUUIDDoDoc(snap.data()) : null;
}

const MAX_ATTEMPTS = 3;

/**
 * Devolve o ownerUUID do uid, criando-o UMA única vez se não existir.
 *
 * - Já existe → só lê (nenhuma escrita; o UUID nunca é regerado no login).
 * - Não existe → transação: relê o vínculo (se outra aba/dispositivo criou
 *   no meio, adota o dele) e grava vínculo + índice reverso juntos.
 * - Corrida/colisão: as regras aceitam só `create`, então a escrita perdedora
 *   é recusada; relê e adota o vencedor. Só gera outro candidato se, mesmo
 *   assim, o vínculo continuar inexistente (colisão do índice, ~2^-122).
 */
export async function ensureOwnerUUID(uid: string): Promise<string> {
  if (!uid) throw new Error('ownerRepository: uid ausente');

  const existing = await getOwnerUUID(uid);
  if (existing) return existing;

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateOwnerUUID();
    try {
      return await runTransaction(db, async (tx) => {
        const current = await tx.get(linkRef(uid));
        if (current.exists()) return ownerUUIDDoDoc(current.data());
        tx.set(linkRef(uid), { ownerUUID: candidate, createdAt: serverTimestamp() });
        tx.set(indexRef(candidate), { uid, createdAt: serverTimestamp() });
        return candidate;
      });
    } catch (e) {
      lastError = e;
      // Perdeu a corrida? Então o vínculo agora existe — adota em vez de repetir.
      try {
        const winner = await getOwnerUUID(uid);
        if (winner) return winner;
      } catch {
        /* sem leitura possível: cai no próximo candidato / erro final */
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('ownerRepository: falha ao criar o ownerUUID');
}
