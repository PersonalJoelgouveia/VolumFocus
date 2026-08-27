import { collection, db, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc } from './firebase';
import type { TreinoNotificacao } from '../types/notification';

/**
 * Camada repository para "Treino Concluído" — sucessora de
 * ntf_registrarTreinoConcluido/ntf_loadTreinos/ntf_persist (index.html
 * ~10399-10430). Coleção nova (`notificacoesTreinos`) porque o Personal
 * precisa ler notificações de TODOS os alunos de uma vez — uma
 * subcoleção por aluno (`alunos/{email}/notificacoes`) exigiria uma
 * collection-group query; um documento por dia-concluído numa coleção
 * plana, com o id determinístico abaixo, é mais simples de consultar e
 * naturalmente idempotente (mesmo papel do `dedupeKey` original).
 *
 * IMPORTANTE — requer regra nova no Firestore (ainda não publicada):
 *   match /notificacoesTreinos/{id} {
 *     allow create: if request.auth != null
 *       && request.resource.data.alunoEmail == request.auth.token.email.lower();
 *     allow read, update: if request.auth != null
 *       && request.auth.token.email.lower() in PT_EMAILS;
 *   }
 * (mesmo espírito das regras já publicadas para `alunos`/`backups` — ver
 * auditoria de cibersegurança de agosto/2026.)
 */

function slug(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function notifDocRef(id: string) {
  return doc(db, 'notificacoesTreinos', id);
}

/**
 * Registra a conclusão do dia de treino do aluno. Chamada pelo hook
 * equivalente a `_ntfCheckDiaConcluido()` ao fechar o modal de execução.
 * Id determinístico + `setDoc` sem merge de `lida` faz o papel do
 * `dedupeKey`: fechar o modal de novo no mesmo dia já concluído não
 * duplica nem reabre como não-lida.
 */
export async function registrarTreinoConcluido(
  alunoEmail: string,
  alunoNome: string,
  dia: number
): Promise<void> {
  const emailLc = alunoEmail.toLowerCase();
  const dataTreino = new Date().toISOString().slice(0, 10);
  const id = `${slug(emailLc)}_${dataTreino}_${dia}`;

  const existing = await getDoc(notifDocRef(id));
  if (existing.exists()) return;

  const notificacao: TreinoNotificacao = {
    id,
    alunoEmail: emailLc,
    alunoNome,
    dia,
    dataTreino,
    lida: false,
    criadaEm: new Date().toISOString(),
  };
  await setDoc(notifDocRef(id), notificacao);
}

/** Lista as notificações mais recentes (lado do Personal). Equivale a ntf_loadTreinos() + ntf_render(). */
export async function fetchTreinoNotificacoes(max = 50): Promise<TreinoNotificacao[]> {
  const q = query(collection(db, 'notificacoesTreinos'), orderBy('criadaEm', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as TreinoNotificacao);
}

/** Marca uma notificação como lida. Equivale a marcar `lida:true` em ntf_onViewOpen(). */
export async function marcarNotificacaoLida(id: string): Promise<void> {
  await updateDoc(notifDocRef(id), { lida: true });
}

/** Remove a notificação — equivale a ntf_dismissTreino(). */
export async function dispensarNotificacao(id: string): Promise<void> {
  await deleteDoc(notifDocRef(id));
}
