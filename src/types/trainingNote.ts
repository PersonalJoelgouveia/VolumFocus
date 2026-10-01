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

/** Data + horário no padrão pt-BR pro histórico/cabeçalho. */
export function formatarDataHorario(iso: string): { data: string; horario: string } {
  const d = new Date(iso);
  return {
    data: d.toLocaleDateString('pt-BR'),
    horario: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Prefixo generoso o bastante pra sempre sobrar `max` caracteres úteis
 *  mesmo depois de colapsar espaços/quebras de linha — bem acima de
 *  qualquer `max` usado na prática (histórico usa 90). Existe só pra
 *  `resumoConteudo` nunca precisar processar uma anotação inteira (até
 *  `TRAINING_NOTE_MAX_LENGTH` = 200.000 caracteres) só pra descartar quase
 *  tudo em seguida — importante pra performance da lista do histórico,
 *  que pode mostrar várias dezenas de anotações longas ao mesmo tempo. */
const PREFIXO_PARA_RESUMO = 1000;

/** Resumo de uma linha pro histórico — colapsa quebras de linha/espaços,
 *  nunca reformata o conteúdo real salvo (só processa um prefixo do
 *  conteúdo, nunca a anotação inteira — ver PREFIXO_PARA_RESUMO). */
export function resumoConteudo(conteudo: string, max = 90): string {
  let prefixo = conteudo.length > PREFIXO_PARA_RESUMO ? conteudo.slice(0, PREFIXO_PARA_RESUMO) : conteudo;
  // O corte acima conta unidades UTF-16 — se caiu bem no meio de um emoji
  // (par substituto), descarta a metade solta em vez de exibir um
  // caractere quebrado no resumo.
  if (terminaEmSurrogateSolto(prefixo)) prefixo = prefixo.slice(0, -1);

  const limpo = prefixo.trim().replace(/\s+/g, ' ');
  if (!limpo) return '(sem conteúdo)';
  return limpo.length > max ? `${limpo.slice(0, max)}…` : limpo;
}

/** true se o último caractere (em unidades UTF-16) for um "high surrogate"
 *  sem o "low surrogate" seguinte — metade de um emoji cortado ao meio por
 *  um `.slice()` em vez de um caractere completo removido de propósito.
 *  Exportada pra ser reaproveitada por NoteEditor.tsx (mesma checagem,
 *  usada lá pra colagem de texto que bateu no limite de tamanho). */
export function terminaEmSurrogateSolto(valor: string): boolean {
  if (valor.length === 0) return false;
  const codigo = valor.charCodeAt(valor.length - 1);
  return codigo >= 0xd800 && codigo <= 0xdbff;
}

/** true se os dois ISO caem no mesmo dia calendário local — usado pelo
 *  painel de anotação da execução do treino pra decidir se reabre a
 *  anotação de hoje (continuar) em vez de criar uma nova a cada clique no
 *  ícone. Compara ano/mês/dia locais, ignora a hora. */
export function isMesmoDiaCalendario(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
