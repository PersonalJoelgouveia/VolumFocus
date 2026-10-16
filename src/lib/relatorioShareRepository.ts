import { auth, collection, db, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from './firebase';
import { getMyOwnerUUID } from './ownerRepository';
import { listAssessments } from './physicalAssessmentRepository';
import type { PhysicalAssessment } from '../types/assessment';
import { expiraEmDias, gerarShareId, shareIdValido, type ShareDoc } from './relatorioShare';

/**
 * Persistência dos links protegidos. QUEM PODE O QUÊ é decidido pelas Security Rules
 * (firestore.etapaC.rules, bloco /compartilhamentos): aqui só se montam os pedidos.
 * O frontend não escolhe ownerUUID nem aluno "por conta própria": o ownerUUID vem do doc do cliente
 * e as Rules conferem contra o dono real; o id da avaliação é conferido com `exists()` nas Rules.
 */

function toDate(v: unknown): Date | null {
  const t = v as { toDate?: () => Date } | null | undefined;
  return t && typeof t.toDate === 'function' ? t.toDate() : null;
}

function shareDe(id: string, d: Record<string, unknown>): ShareDoc {
  return {
    shareId: id,
    alunoEmail: String(d.alunoEmail ?? ''),
    avaliacaoId: String(d.avaliacaoId ?? ''),
    ownerUUID: String(d.ownerUUID ?? ''),
    criadoPorUid: String(d.criadoPorUid ?? ''),
    criadoEm: toDate(d.criadoEm),
    expiraEm: toDate(d.expiraEm),
    revogadoEm: toDate(d.revogadoEm),
    paraAluno: d.paraAluno === true,
  };
}

/** Cria o compartilhamento (Personal dono). Devolve o shareId aleatório. */
export async function criarCompartilhamento(
  alunoEmail: string,
  avaliacaoId: string,
  opts: { dias: number; paraAluno: boolean }
): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Sem usuário autenticado');
  const a = alunoEmail.toLowerCase();
  const alunoSnap = await getDoc(doc(db, 'alunos', a));
  const ownerUUID = alunoSnap.data()?.ownerUUID;
  if (typeof ownerUUID !== 'string') throw new Error('Cliente sem ownerUUID');
  const shareId = gerarShareId();
  await setDoc(doc(db, 'compartilhamentos', shareId), {
    alunoEmail: a,
    avaliacaoId,
    ownerUUID,
    criadoPorUid: u.uid,
    criadoEm: serverTimestamp(),
    expiraEm: expiraEmDias(opts.dias),
    revogadoEm: null,
    paraAluno: opts.paraAluno,
  });
  return shareId;
}

/** Revoga (Personal dono). Não apaga: o registro fica como prova do ciclo de vida. */
export async function revogarCompartilhamento(shareId: string): Promise<void> {
  if (!shareIdValido(shareId)) throw new Error('id inválido');
  await updateDoc(doc(db, 'compartilhamentos', shareId), { revogadoEm: serverTimestamp() });
}

/** Links desta avaliação (só os do Personal dono; as Rules exigem o filtro por ownerUUID). */
export async function listarCompartilhamentos(alunoEmail: string, avaliacaoId: string): Promise<ShareDoc[]> {
  const q = query(
    collection(db, 'compartilhamentos'),
    where('ownerUUID', '==', await getMyOwnerUUID()),
    where('alunoEmail', '==', alunoEmail.toLowerCase()),
    where('avaliacaoId', '==', avaliacaoId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => shareDe(d.id, d.data())).sort((x, y) => (y.criadoEm?.getTime() ?? 0) - (x.criadoEm?.getTime() ?? 0));
}

/** Resolve o ponteiro. Lança se as Rules negarem (inexistente e "sem permissão" são indistinguíveis de propósito). */
export async function carregarCompartilhamento(shareId: string): Promise<ShareDoc> {
  if (!shareIdValido(shareId)) throw new Error('link inválido');
  const snap = await getDoc(doc(db, 'compartilhamentos', shareId));
  if (!snap.exists()) throw new Error('link indisponível');
  return shareDe(snap.id, snap.data());
}

export interface DadosDoLink {
  nome: string;
  assessments: PhysicalAssessment[];
}

/** Lê o aluno e o histórico COM as credenciais de quem abriu: as Rules das avaliações decidem de novo. */
export async function carregarDadosDoLink(s: ShareDoc): Promise<DadosDoLink> {
  const [alunoSnap, assessments] = await Promise.all([getDoc(doc(db, 'alunos', s.alunoEmail)), listAssessments(s.alunoEmail)]);
  const perfil = alunoSnap.data()?.perfilAluno as { nome?: unknown } | undefined;
  return { nome: typeof perfil?.nome === 'string' ? perfil.nome : '', assessments };
}

/** Trilha de acessos (best-effort; create-only; hora do servidor; autor conferido com o token pelas Rules). */
export async function registrarAcesso(shareId: string, papel: 'personal' | 'aluno', acao: 'abriu' | 'gerou_pdf'): Promise<void> {
  const u = auth.currentUser;
  if (!u || !shareIdValido(shareId)) return;
  try {
    await setDoc(doc(collection(db, 'compartilhamentos', shareId, 'acessos')), {
      autorUid: u.uid,
      autorPapel: papel,
      acao,
      criadoEm: serverTimestamp(),
    });
  } catch (e) {
    console.warn('relatorioShare: não foi possível registrar o acesso', e);
  }
}
