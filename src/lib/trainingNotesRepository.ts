import { collection, db, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from './firebase';
import type { TrainingNote } from '../types/trainingNote';

/**
 * Repository para "Anotações" (prontuário de acompanhamento do
 * treinamento) — mesmo espírito de physicalAssessmentRepository.ts:
 * subcoleção por aluno (`alunos/{email}/anotacoes/{id}`) em vez de array
 * embutido no doc principal, pra ler/atualizar/remover uma anotação sem
 * reescrever o histórico inteiro e sem o doc `alunos/{email}` crescer sem
 * limite (importante aqui em especial — texto longo, ao contrário de
 * avaliação física).
 *
 * `id` já vem gerado no cliente (ver criarTrainingNoteVazia) — createNote
 * usa `setDoc` com esse id em vez de deixar o Firestore gerar um novo, pra
 * local e nuvem nunca divergirem no identificador.
 *
 * IMPORTANTE — requer regra nova no Firestore (ainda não publicada; não
 * vem no zip enviado, que só contém `src/`). Mesmo espírito da regra já
 * publicada para `avaliacoesFisicas`, mas SEM a exceção de escrita do
 * Aluno (anotação é dado privado do Personal — aluno nunca cria/edita/
 * exclui, só o Personal, ver types/trainingNote.ts):
 *
 *   match /alunos/{email}/anotacoes/{noteId} {
 *     allow read, create, update, delete: if request.auth != null
 *       && request.auth.token.email.lower() in PT_EMAILS;
 *   }
 *
 * Aluno NÃO tem `allow read` aqui de propósito — anotações são privadas do
 * acompanhamento, não expostas automaticamente pro aluno (ver pedido).
 * PT_EMAILS deve ser a mesma lista hardcoded já publicada para `alunos`.
 */

function notesCol(email: string) {
  return collection(db, 'alunos', email.toLowerCase(), 'anotacoes');
}

function noteDocRef(email: string, noteId: string) {
  return doc(db, 'alunos', email.toLowerCase(), 'anotacoes', noteId);
}

/** Grava uma nova anotação. Usa o `note.id` já gerado no cliente como id do documento. */
export async function createNote(studentEmail: string, note: TrainingNote): Promise<string> {
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

/** Atualiza campos específicos de uma anotação existente (merge parcial) — usado pelo autosave. */
export async function updateNote(studentEmail: string, noteId: string, data: Partial<TrainingNote>): Promise<void> {
  await updateDoc(noteDocRef(studentEmail, noteId), data);
}

/** Remove uma anotação do histórico. */
export async function deleteNote(studentEmail: string, noteId: string): Promise<void> {
  await deleteDoc(noteDocRef(studentEmail, noteId));
}
