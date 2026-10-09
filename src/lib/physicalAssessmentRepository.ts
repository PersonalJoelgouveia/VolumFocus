import { collection, db, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from './firebase';
import type { PhysicalAssessment } from '../types/assessment';
import { validarAvaliacaoRemota } from '../utils/assessmentValidation';

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
 * SEGURANÇA — o cliente NÃO é fronteira de confiança. As regras reais estão
 * versionadas em `firestore.rules` (raiz do projeto) e testadas com o Emulator
 * (`rules-tests/`). Em resumo: Personal (PT_EMAILS) lê/escreve tudo; o Aluno
 * só lê o próprio histórico e só CRIA uma avaliação online sua, com campos
 * fixos (sem `review`, `status == 'enviada'`, `id == id do documento`).
 *
 * Por isso a LEITURA também desconfia: o documento pode ter sido gravado pelo
 * aluno (ou por um cliente adulterado). `listAssessments`/`getAssessment`
 * usam o id do DOCUMENTO (nunca o campo `id` do conteúdo) e passam tudo por
 * `validarAvaliacaoRemota`; documento malformado é ignorado (e reportado),
 * em vez de derrubar a tela do Personal.
 */

function assessmentsCol(email: string) {
  return collection(db, 'alunos', email.toLowerCase(), 'avaliacoesFisicas');
}

function assessmentDocRef(email: string, assessmentId: string) {
  return doc(db, 'alunos', email.toLowerCase(), 'avaliacoesFisicas', assessmentId);
}

/** Grava uma nova avaliação. Usa o `assessment.id` já gerado no cliente como id do documento. */
/**
 * O Firestore recusa `undefined` (o SDK lança "Unsupported field value"); os montadores
 * de avaliação deixam campos opcionais `undefined` (ex.: `notes`, `results.relacaoCinturaQuadril`).
 * Remove-os antes de gravar — assim o documento só tem os campos que as regras esperam.
 * (O round-trip JSON também troca `NaN`/`Infinity` por `null`, que as regras recusam.)
 */
function semUndefined<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

export async function createAssessment(studentEmail: string, assessment: PhysicalAssessment): Promise<string> {
  await setDoc(assessmentDocRef(studentEmail, assessment.id), semUndefined(assessment));
  return assessment.id;
}

/** Busca uma avaliação específica. `null` se não existir (não lança). */
export async function getAssessment(studentEmail: string, assessmentId: string): Promise<PhysicalAssessment | null> {
  const snap = await getDoc(assessmentDocRef(studentEmail, assessmentId));
  return snap.exists() ? validarAvaliacaoRemota(snap.data(), snap.id) : null;
}

/**
 * Lista o histórico completo do aluno, mais recente primeiro. Documentos malformados
 * são ignorados; `onInvalid` recebe os ids ignorados (para avisar o usuário).
 */
export async function listAssessments(
  studentEmail: string,
  onInvalid?: (ids: string[]) => void
): Promise<PhysicalAssessment[]> {
  const q = query(assessmentsCol(studentEmail), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  const validas: PhysicalAssessment[] = [];
  const invalidas: string[] = [];
  for (const d of snap.docs) {
    const avaliacao = validarAvaliacaoRemota(d.data(), d.id);
    if (avaliacao) validas.push(avaliacao);
    else invalidas.push(d.id);
  }
  if (invalidas.length > 0) {
    console.warn('physicalAssessmentRepository: avaliações inválidas ignoradas', invalidas);
    onInvalid?.(invalidas);
  }
  return validas;
}

/** Atualiza campos específicos de uma avaliação existente (merge parcial). */
export async function updateAssessment(
  studentEmail: string,
  assessmentId: string,
  data: Partial<PhysicalAssessment>
): Promise<void> {
  // `alunoId` é imutável no servidor (a identidade do cliente é o caminho do documento, e o
  // `alunoId` gravado pelo aluno é um id local do aparelho dele): a edição nunca o reenvia.
  const { alunoId, ...resto } = data;
  void alunoId;
  await updateDoc(assessmentDocRef(studentEmail, assessmentId), semUndefined(resto));
}

/** Remove uma avaliação do histórico. */
export async function deleteAssessment(studentEmail: string, assessmentId: string): Promise<void> {
  await deleteDoc(assessmentDocRef(studentEmail, assessmentId));
}
