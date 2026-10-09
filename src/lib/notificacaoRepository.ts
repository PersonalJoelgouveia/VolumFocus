import { collection, db, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where } from './firebase';
import { getMyOwnerUUID } from './ownerRepository';
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
 * SEGURANÇA — regras em `firestore.rules`: o aluno só CRIA (aluno cadastrado, campos
 * fixos, `id == id do documento`, `alunoEmail` == e-mail do token, `lida == false`,
 * `ownerUUID` == o do alunos/{seu e-mail}, conferido no servidor); ler, marcar lida e
 * apagar é só do Personal DONO (`ownerUUID` da notificação == o dele). A idempotência
 * não lê a notificação: reenviar o mesmo id vira um `update`, que a regra nega
 * (`permission-denied` = a notificação do dia já existe).
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

  // Dono = o Personal do cliente: vem do PRÓPRIO doc do aluno (o aluno pode ler o seu). Sem ele a regra
  // negaria; não grava nada em vez de mandar um valor inventado (cliente ainda não migrado).
  const alunoSnap = await getDoc(doc(db, 'alunos', emailLc));
  const ownerUUID = alunoSnap.exists() ? (alunoSnap.data() as { ownerUUID?: unknown }).ownerUUID : undefined;
  if (typeof ownerUUID !== 'string') {
    console.warn('notificacaoRepository: cliente sem ownerUUID — notificação não registrada');
    return;
  }

  const notificacao: TreinoNotificacao = {
    id,
    alunoEmail: emailLc,
    alunoNome,
    dia,
    dataTreino,
    lida: false,
    criadaEm: new Date().toISOString(),
    ownerUUID,
  };
  try {
    await setDoc(notifDocRef(id), notificacao);
  } catch (e) {
    // Já registrada hoje (o 2º setDoc é um update, negado pelas regras): não é erro.
    if ((e as { code?: string } | null)?.code === 'permission-denied') return;
    throw e;
  }
}

/**
 * Lista as notificações mais recentes DO PERSONAL LOGADO. O filtro por ownerUUID é exigido pelas
 * regras (que só liberam a consulta se ela provar que só traz documentos dele). Precisa do índice
 * composto de `firestore.indexes.json` (ownerUUID + criadaEm desc).
 */
export async function fetchTreinoNotificacoes(max = 50): Promise<TreinoNotificacao[]> {
  const ownerUUID = await getMyOwnerUUID();
  const q = query(
    collection(db, 'notificacoesTreinos'),
    where('ownerUUID', '==', ownerUUID),
    orderBy('criadaEm', 'desc'),
    limit(max)
  );
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
