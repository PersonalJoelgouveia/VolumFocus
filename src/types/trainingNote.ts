/**
 * Tipo do domínio "Anotações" — prontuário de acompanhamento do
 * treinamento por Cliente (Ferramentas > Anotações). NÃO é prontuário
 * médico/diagnóstico: só observações e acompanhamento profissional do
 * Personal Trainer.
 *
 * Cada anotação é um documento independente, vinculado ao cliente por
 * `alunoId` — ver lib/trainingNotesRepository.ts (subcoleção
 * `alunos/{email}/anotacoes`), nunca embutida no doc principal do aluno.
 * Mesmo desacoplamento já usado em types/assessment.ts +
 * physicalAssessmentRepository.ts.
 */

/** Limite amplo e documentado para o campo `conteudo`, com folga real em
 *  relação ao teto de 1MiB por documento do Firestore mesmo no pior caso
 *  de UTF-8 (4 bytes/char): 200.000 chars × 4 bytes = ~800KB, deixando
 *  espaço de sobra pros demais campos do documento (ids, nomes,
 *  timestamps). Validado pelo repository antes de gravar/atualizar (ver
 *  trainingNotesRepository.ts) — validação de UI (ex.: `maxLength` do
 *  textarea) é responsabilidade de uma etapa futura, não desta camada. */
export const TRAINING_NOTE_MAX_LENGTH = 200_000;

export interface TrainingNote {
  id: string;
  alunoId: string;
  alunoNome: string;
  /** Dia da semana / treino ao qual a anotação está vinculada, quando
   *  essa informação existir (ex.: criada durante a execução de um
   *  treino específico) — opcional, nunca inventado. */
  treinoId?: string;
  /** Nome do treino (ex.: dia.tipo da rotina do aluno), quando existir. */
  treinoNome?: string;
  /** Sessão presencial (useSessionStore) em que a anotação foi criada,
   *  quando essa informação existir — contexto histórico, não usado como
   *  chave de identidade da anotação. */
  sessionId?: string;
  conteudo: string;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
  /** E-mail do Personal autor — só o Personal cria/edita/exclui anotações. */
  authorId: string;
  authorName?: string;
}

/** Nova anotação vazia, pronta pra `createNote` — id gerado no cliente
 *  (mesma convenção de physicalAssessmentRepository.ts/AvaliacaoFisicaModal)
 *  pra local e nuvem nunca divergirem no identificador. Sufixo aleatório
 *  além do timestamp: duas chamadas no mesmo milissegundo não colidem. */
export function criarTrainingNoteVazia(params: {
  alunoId: string;
  alunoNome: string;
  authorId: string;
  authorName?: string;
  treinoId?: string;
  treinoNome?: string;
  sessionId?: string;
}): TrainingNote {
  const agora = new Date().toISOString();
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conteudo: '',
    createdAt: agora,
    updatedAt: agora,
    ...params,
  };
}
