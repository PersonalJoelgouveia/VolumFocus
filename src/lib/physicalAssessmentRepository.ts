import { collection, db, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from './firebase';
import type { PhysicalAssessment } from '../types/assessment';

/**
 * Repository para o histórico de "Avaliação Física" — sucessor natural de
 * alunoRepository.ts, mesmo projeto/app Firebase. Subcoleção por aluno
 * (`alunos/{email}/avaliacoesFisicas/{id}`) em vez de array embutido no
 * doc principal: cada avaliação é lida/atualizada/removida sem reescrever
 * o histórico inteiro, e o doc `alunos/{email}` não cresce sem limite.
 *
 * `id` já vem gerado no cliente (ver AvaliacaoFisicaModal) — createAssessment
 * usa `setDoc` com esse id em vez de deixar o Firestore gerar um novo,
 * pra local e nuvem nunca divergirem no identificador.
 *
 * Erros NÃO são silenciados aqui (ao contrário de alunoRepository.ts) —
 * quem chama (usePhysicalAssessments) precisa do catch pra popular estado
 * de erro/retry e desfazer a atualização otimista.
 *
 * IMPORTANTE — requer regra nova no Firestore (ainda não publicada; não
 * veio no zip enviado, que só contém `src/`). Mesmo espírito das regras já
 * publicadas para `alunos`/`backups`/`notificacoesTreinos`:
 *
 *   match /alunos/{email}/avaliacoesFisicas/{assessmentId} {
 *     allow read: if request.auth != null
 *       && (request.auth.token.email.lower() in PT_EMAILS
 *           || request.auth.token.email.lower() == email);
 *     allow create, update, delete: if request.auth != null
 *       && request.auth.token.email.lower() in PT_EMAILS;
 *   }
 *
 * PT_EMAILS aqui deve ser a mesma lista hardcoded nas regras publicadas
 * para `alunos` (não dá pra referenciar useAuthStore.PT_EMAILS do client
 * dentro das regras — são mundos separados).
 */

function assessmentsCol(email: string) {
  return collection(db, 'alunos', email.toLowerCase(), 'avaliacoesFisicas');
}

function assessmentDocRef(email: string, assessmentId: string) {
  return doc(db, 'alunos', email.toLowerCase(), 'avaliacoesFisicas', assessmentId);
}

/** Grava uma nova avaliação. Usa o `assessment.id` já gerado no cliente como id do documento. */
export async function createAssessment(studentEmail: string, assessment: PhysicalAssessment): Promise<string> {
  await setDoc(assessmentDocRef(studentEmail, assessment.id), assessment);
  return assessment.id;
}

/** Busca uma avaliação específica. `null` se não existir (não lança). */
export async function getAssessment(studentEmail: string, assessmentId: string): Promise<PhysicalAssessment | null> {
  const snap = await getDoc(assessmentDocRef(studentEmail, assessmentId));
  return snap.exists() ? (snap.data() as PhysicalAssessment) : null;
}

/** Lista o histórico completo do aluno, mais recente primeiro. */
export async function listAssessments(studentEmail: string): Promise<PhysicalAssessment[]> {
  const q = query(assessmentsCol(studentEmail), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as PhysicalAssessment);
}

/** Atualiza campos específicos de uma avaliação existente (merge parcial). */
export async function updateAssessment(
  studentEmail: string,
  assessmentId: string,
  data: Partial<PhysicalAssessment>
): Promise<void> {
  await updateDoc(assessmentDocRef(studentEmail, assessmentId), data);
}

/** Remove uma avaliação do histórico. */
export async function deleteAssessment(studentEmail: string, assessmentId: string): Promise<void> {
  await deleteDoc(assessmentDocRef(studentEmail, assessmentId));
}
