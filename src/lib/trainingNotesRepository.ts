import { collection, db, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from './firebase';
import { TRAINING_NOTE_MAX_LENGTH } from '../types/trainingNote';
import type { TrainingNote } from '../types/trainingNote';

/**
 * Repository para "Anotações" (prontuário de acompanhamento do
 * treinamento) — mesmo espírito de physicalAssessmentRepository.ts:
 * subcoleção por aluno (`alunos/{email}/anotacoes/{id}`) em vez de array
 * embutido no doc principal, pra ler/atualizar/remover uma anotação sem
 * reescrever o histórico inteiro e sem o doc `alunos/{email}` crescer sem
 * limite (importante aqui em especial — texto potencialmente longo, ao
 * contrário de avaliação física).
 *
 * `id` já vem gerado no cliente (ver criarTrainingNoteVazia) — createNote
 * usa `setDoc` com esse id em vez de deixar o Firestore gerar um novo, pra
 * local e nuvem nunca divergirem no identificador.
 *
 * Erros NÃO são silenciados aqui (mesma convenção de
 * physicalAssessmentRepository.ts) — quem chama precisa do catch pra
 * popular estado de erro/retry e desfazer atualização otimista.
 *
 * IMPORTANTE — requer regra nova no Firestore (ainda não publicada; não
 * vem no zip enviado, que só contém `src/`). Mesmo espírito da regra já
 * publicada para `avaliacoesFisicas`, mas SEM a exceção de leitura/escrita
 * do Aluno (anotação é dado privado do acompanhamento — Aluno nunca lê,
 * cria, edita ou exclui, só o Personal):
 *
 *   match /alunos/{email}/anotacoes/{noteId} {
 *     allow read, create, update, delete: if request.auth != null
 *       && request.auth.token.email.lower() in PT_EMAILS;
 *   }
 *
 * PT_EMAILS aqui deve ser a mesma lista hardcoded nas regras publicadas
 * para `alunos` (não dá pra referenciar useAuthStore.PT_EMAILS do client
 * dentro das regras — são mundos separados).
 */

function notesCol(email: string) {
  return collection(db, 'alunos', email.toLowerCase(), 'anotacoes');
}

function noteDocRef(email: string, noteId: string) {
  return doc(db, 'alunos', email.toLowerCase(), 'anotacoes', noteId);
}

/** Lança se `conteudo` passar do limite documentado — protege o Firestore
 *  contra gravação de um campo grande demais, independente de qualquer
 *  validação (ou falta dela) na camada de UI, que ainda não existe. */
function validarConteudo(conteudo: string | undefined): void {
  if (conteudo !== undefined && conteudo.length > TRAINING_NOTE_MAX_LENGTH) {
    throw new Error(
      `Conteúdo da anotação excede o limite de ${TRAINING_NOTE_MAX_LENGTH} caracteres (${conteudo.length}).`
    );
  }
}

/** Grava uma nova anotação. Usa o `note.id` já gerado no cliente como id do documento. */
export async function createNote(studentEmail: string, note: TrainingNote): Promise<string> {
  validarConteudo(note.conteudo);
  await setDoc(noteDocRef(studentEmail, note.id), note);
  return note.id;
}

/** Busca uma anotação específica. `null` se não existir (não lança). */
export async function getNote(studentEmail: string, noteId: string): Promise<TrainingNote | null> {
  const snap = await getDoc(noteDocRef(studentEmail, noteId));
  return snap.exists() ? (snap.data() as TrainingNote) : null;
}

/** Lista o histórico completo do aluno, mais recente primeiro. */
export async function listNotesByAluno(studentEmail: string): Promise<TrainingNote[]> {
  const q = query(notesCol(studentEmail), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as TrainingNote);
}

/** Atualiza campos específicos de uma anotação existente (merge parcial). */
export async function updateNote(studentEmail: string, noteId: string, data: Partial<TrainingNote>): Promise<void> {
  validarConteudo(data.conteudo);
  await updateDoc(noteDocRef(studentEmail, noteId), data);
}

/** Remove uma anotação do histórico. */
export async function deleteNote(studentEmail: string, noteId: string): Promise<void> {
  await deleteDoc(noteDocRef(studentEmail, noteId));
}
