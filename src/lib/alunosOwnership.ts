import { db, doc, getDoc, updateDoc } from './firebase';
import { getMyOwnerUUID } from './ownerRepository';

/**
 * TRANSITÓRIO — migração dos clientes criados antes do modelo de ownership.
 *
 * Para cada cliente local do Personal cujo `alunos/{email}` existe na nuvem SEM
 * `ownerUUID`, grava o ownerUUID do Personal logado (as Rules só aceitam isso uma
 * vez, e só com o PRÓPRIO UUID). Nunca CRIA documento: criar `alunos/{email}`
 * liberaria o login daquele e-mail — por isso `updateDoc` (falha se não existe).
 * Idempotente; erros por cliente (ex.: doc de outro dono → negado) são ignorados.
 *
 * Quando todos estiverem migrados, `aceitarLegadoSemDono()` nas Rules vira `false`
 * e este módulo pode ser removido.
 */
let jaRodouNestaSessao = false;

export async function reivindicarAlunosLegados(emails: string[]): Promise<number> {
  if (jaRodouNestaSessao) return 0;
  jaRodouNestaSessao = true;
  let ownerUUID: string;
  try {
    ownerUUID = await getMyOwnerUUID();
  } catch {
    jaRodouNestaSessao = false; // tenta de novo no próximo login
    return 0;
  }
  let reivindicados = 0;
  for (const email of new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))) {
    try {
      const ref = doc(db, 'alunos', email);
      const snap = await getDoc(ref);
      if (!snap.exists() || snap.data().ownerUUID !== undefined) continue;
      await updateDoc(ref, { ownerUUID });
      reivindicados++;
    } catch {
      /* outro dono, sem permissão ou offline: segue para o próximo */
    }
  }
  return reivindicados;
}
