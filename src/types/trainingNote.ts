/**
 * Tipos do domínio "Anotações" — prontuário de acompanhamento do
 * treinamento por Cliente (Ferramentas > Anotações). NÃO é prontuário
 * médico/diagnóstico: só observações e acompanhamento profissional do
 * Personal Trainer.
 *
 * Cada anotação é um documento independente (ver
 * lib/trainingNotesRepository.ts, subcoleção `alunos/{email}/anotacoes`) —
 * nunca embutida no doc principal do aluno, mesmo padrão já usado em
 * types/assessment.ts + physicalAssessmentRepository.ts.
 */

/** Limite amplo e documentado, com folga real em relação ao teto de 1MiB
 *  por documento do Firestore mesmo no pior caso de UTF-8 (4 bytes/char):
 *  200.000 chars × 4 bytes = ~800KB, deixando espaço de sobra pros demais
 *  campos do documento (ids, nomes, timestamps). Validado via `maxLength`
 *  do textarea (nunca deixa digitar além) e checado de novo antes de
 *  salvar. */
export const TRAINING_NOTE_MAX_LENGTH = 200_000;

export interface TrainingNote {
  id: string;
  alunoId: string;
  alunoNome: string;
  /** Dia da semana (0=Segunda...6=Domingo, mesma convenção de DAYS em
   *  types/workout.ts) em que a anotação foi criada, como string — o
   *  vínculo real com "não misturar duas sessões diferentes" vem de
   *  createdAt (uma anotação por dia calendário), não deste campo sozinho. */
  treinoId?: string;
  /** dia.tipo da rotina do aluno (ex.: "Treino A") quando existir, ou o
   *  nome do dia da semana (DAYS[day]) como fallback — nunca inventado. */
  treinoNome?: string;
  conteudo: string;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
  /** E-mail do Personal autor (só Personal cria/edita/exclui — ver privacidade no pedido). */
  authorId: string;
  authorName?: string;
  /** Sessão presencial (useSessionStore) em que a anotação foi criada,
   *  quando existir essa informação — não usado para resolver duplicidade,
   *  só contexto histórico. */
  sessionId?: string;
}

/** Nova anotação vazia, pronta pra `createNote` — id gerado no cliente
 *  (mesmo padrão de PhysicalAssessment) pra local e nuvem nunca divergirem.
 *  Sufixo aleatório além do timestamp: duas chamadas no mesmo milissegundo
 *  (ex.: dois cliques rápidos) não podem colidir no mesmo id. */
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

/** Resumo de uma linha pro histórico — colapsa quebras de linha/espaços,
 *  nunca reformata o conteúdo real salvo. */
export function resumoConteudo(conteudo: string, max = 80): string {
  const limpo = conteudo.trim().replace(/\s+/g, ' ');
  if (!limpo) return '(sem conteúdo)';
  return limpo.length > max ? `${limpo.slice(0, max)}…` : limpo;
}

/** Data + horário no padrão pt-BR pro cabeçalho/histórico. */
export function formatarDataHorario(iso: string): { data: string; horario: string } {
  const d = new Date(iso);
  return {
    data: d.toLocaleDateString('pt-BR'),
    horario: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** true se os dois ISO caem no mesmo dia calendário local — usado pra
 *  decidir se o painel rápido continua a anotação de hoje (reabrir) em vez
 *  de criar uma nova. */
export function isMesmoDiaCalendario(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
