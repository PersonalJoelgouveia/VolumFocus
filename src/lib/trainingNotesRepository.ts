import { collection, db, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, startAfter, updateDoc } from './firebase';
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
 * ============================================================
 * SEGURANÇA — LEIA ANTES DE PUBLICAR/ALTERAR QUALQUER COISA AQUI
 * ============================================================
 *
 * Este arquivo (e o app em geral) NÃO TEM BACKEND PRÓPRIO. A única barreira
 * de autorização real é a regra do Firestore abaixo — tudo que existe em
 * TypeScript (este repository, useTrainingNotes.ts, os componentes de UI,
 * o filtro `ptOnly` do card em FerramentasView.tsx) é caminho feliz e
 * conveniência de interface, nunca proteção. Um usuário autenticado
 * (Personal OU Aluno) pode abrir o console do navegador e chamar o SDK do
 * Firestore diretamente, ignorando hooks/telas por completo. Se a regra
 * abaixo não estiver publicada exatamente assim, qualquer Aluno logado
 * pode ler (e possivelmente escrever) anotações privadas de QUALQUER
 * cliente, não só as próprias.
 *
 * REQUER REGRA NOVA NO FIRESTORE — AINDA NÃO PUBLICADA (não vem no zip
 * enviado, que só contém `src/`; regras vivem no Firebase Console, fora
 * deste repositório — preciso que você confirme/publique manualmente).
 * Mesmo espírito da regra já publicada para `avaliacoesFisicas`, mas SEM a
 * exceção de leitura/escrita do Aluno — a anotação é dado privado do
 * acompanhamento, o Aluno NUNCA lê, cria, edita ou exclui, só o Personal:
 *
 *   match /alunos/{email}/anotacoes/{noteId} {
 *     allow read, delete: if request.auth != null
 *       && request.auth.token.email.lower() in PT_EMAILS;
 *     allow create, update: if request.auth != null
 *       && request.auth.token.email.lower() in PT_EMAILS
 *       && request.resource.data.alunoId is string
 *       && request.resource.data.conteudo is string
 *       && request.resource.data.conteudo.size() <= 200000;
 *   }
 *
 * PT_EMAILS aqui deve ser a mesma lista hardcoded nas regras publicadas
 * para `alunos` (não dá pra referenciar useAuthStore.PT_EMAILS do client
 * dentro das regras — são mundos separados; se a lista mudar num lado,
 * precisa mudar no outro manualmente). O `size() <= 200000` espelha
 * TRAINING_NOTE_MAX_LENGTH (types/trainingNote.ts) na própria regra — a
 * validação client-side (`validarConteudo` abaixo) é só UX (erro antes de
 * gastar uma escrita), nunca a garantia real de que o limite é respeitado.
 *
 * RISCO ESPECÍFICO A CONFERIR — wildcard recursivo: se as regras já
 * publicadas tiverem algo como `match /alunos/{email}/{document=**}`
 * concedendo leitura ampla (ex.: pro próprio Aluno em qualquer subcoleção
 * dele), essa regra mais genérica NÃO é sobrescrita pela regra específica
 * de `anotacoes` acima — no Firestore, se QUALQUER bloco `match` que
 * casa com o caminho permite o acesso, o acesso é permitido (não é "a
 * regra mais específica vence"). Ou seja: um wildcard desses tornaria a
 * regra restritiva de `anotacoes` inútil na prática. Confira isso no
 * Firebase Console antes de considerar este documento "seguro" — o padrão
 * observado nas regras já publicadas para `avaliacoesFisicas`/`alunos`
 * (blocos `match` nomeados por subcoleção, não um `{document=**}`) sugere
 * que isso NÃO deve estar acontecendo hoje, mas não dá pra confirmar sem
 * ver o arquivo de regras de verdade.
 *
 * IDs não são a proteção: `note.id` (ver criarTrainingNoteVazia) não
 * precisa ser imprevisível/impossível de adivinhar — mesmo que um Aluno
 * de alguma forma soubesse o `noteId` exato de outro cliente, a regra
 * acima nega o acesso pelo token de autenticação de quem pede, não por
 * quão difícil é adivinhar o caminho do documento. Segurança por obscuridade
 * de ID nunca é a barreira aqui.
 *
 * Queries sempre escopadas por aluno: `notesCol`/`listNotesByAlunoPage`
 * usam `collection(db, 'alunos', email, 'anotacoes')` — uma subcoleção de
 * UM email específico — nunca `collectionGroup('anotacoes')`, que
 * atravessaria a subcoleção de TODOS os alunos numa única consulta. Não
 * introduza um `collectionGroup` aqui sem repensar a regra acima (ela
 * autoriza por `{email}` do caminho; uma collectionGroup precisaria de uma
 * regra própria, mais fácil de errar).
 */

function notesCol(email: string) {
  return collection(db, 'alunos', email.toLowerCase(), 'anotacoes');
}

function noteDocRef(email: string, noteId: string) {
  return doc(db, 'alunos', email.toLowerCase(), 'anotacoes', noteId);
}

/** Lança se `conteudo` passar do limite documentado — protege o Firestore
 *  contra gravação de um campo grande demais mesmo que a validação de UI
 *  (NoteEditor.tsx: `maxLength` do textarea + aviso "Limite atingido")
 *  seja contornada por algum caminho que não passe por ela. */
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

/**
 * Lista UMA PÁGINA do histórico do aluno, mais recente primeiro — nunca o
 * histórico inteiro de uma vez. Um cliente pode acumular centenas de
 * anotações ao longo do tempo, cada uma com até `TRAINING_NOTE_MAX_LENGTH`
 * caracteres; buscar tudo de uma vez sem paginação escalaria mal tanto em
 * tráfego de rede quanto em memória no dispositivo do Personal.
 *
 * `cursorCreatedAt` é o `createdAt` (ISO) da ÚLTIMA anotação já carregada
 * — passe `undefined` pra primeira página. Como a query já ordena por
 * `createdAt desc`, isso é suficiente pro `startAfter` (a versão do
 * Firestore que recebe valores de campo, não precisa do DocumentSnapshot
 * inteiro) sem a UI/hook precisarem conhecer tipos internos do Firestore.
 *
 * `hasMore` é inferido por quem chama pela heurística padrão: se a página
 * veio cheia (`length === pageSize`), pode haver mais; a próxima busca
 * confirma (uma página vazia/parcial encerra a paginação). Não faz uma
 * consulta de contagem à parte só pra saber se "tem mais".
 */
export async function listNotesByAlunoPage(
  studentEmail: string,
  pageSize: number,
  cursorCreatedAt?: string
): Promise<TrainingNote[]> {
  const restricoes = cursorCreatedAt
    ? [orderBy('createdAt', 'desc'), startAfter(cursorCreatedAt), limit(pageSize)]
    : [orderBy('createdAt', 'desc'), limit(pageSize)];
  const q = query(notesCol(studentEmail), ...restricoes);
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
