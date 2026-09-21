/**
 * Tipos do domínio "Modelo de Treino" (Ferramentas > Modelos).
 *
 * `TrainingModel` é uma entidade própria — não reaproveita nem substitui
 * Rotinas Salvas (types/workout.ts Rotina/WeekLog/useRotinaStore) nem a
 * rotina do Cliente (types/aluno.ts AlunoRotina/AlunoExercicio). O único
 * ponto compartilhado é o Banco de Exercícios: cada entrada do modelo
 * referencia um exercício existente pelo mesmo `exId` já usado em
 * StrengthLogEntry/CardioLogEntry (types/workout.ts) — nunca duplica nome,
 * agonista ou mídia do exercício aqui.
 *
 * `GroupType` (Bi-Set/Tri-Set/Superset/Circuito) é importado de
 * types/workout.ts por ser vocabulário genérico de agrupamento já usado em
 * WorkoutLogEntry e AlunoExercicio — não é "estado de Rotinas Salvas", só
 * o tipo compartilhado.
 *
 * Etapa: só a camada de dados (tipos + helpers puros, sem side effects).
 * Sessões são organizadas em blocos fixos por fase (Preparação/Mobilidade/
 * Força/Cardio, ver TrainingModelBloco e criarSessaoVazia) — estrutura
 * exclusiva dos Modelos, sem qualquer alteração em Rotinas Salvas ou na
 * rotina do Cliente. Sem UI de edição de conteúdo e sem conversão pra
 * AlunoRotina ("Copiar para Cliente") ainda — isso é uma etapa futura.
 */

import type { GroupType } from './workout';

export type TrainingModelCategoria = 'iniciante' | 'intermediario' | 'avancado';

export const TRAINING_MODEL_CATEGORIAS: TrainingModelCategoria[] = ['iniciante', 'intermediario', 'avancado'];

export const TRAINING_MODEL_CATEGORIA_LABELS: Record<TrainingModelCategoria, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

/** 7 níveis por categoria — 21 no total (REGRA definida pelo Joel). */
export type TrainingModelNivel = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const TRAINING_MODEL_NIVEIS: TrainingModelNivel[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Fase de um bloco dentro da sessão — eixo independente de força/cardio:
 * um exercício cardio pode SER a preparação (bike/elíptico/esteira, ver
 * PREPARACAO_CARDIO_SUGERIDO em data/preparacaoCardio.ts), não só o corpo
 * do treino. A partir da estrutura em blocos (ver TrainingModelBloco), a
 * fase é uma propriedade do bloco, não de cada entrada — uma entrada nunca
 * fica "sem fase" nem contradiz o bloco em que está.
 */
export type TrainingModelFase = 'preparacao' | 'mobilidade' | 'forca' | 'cardio';

/** Ordem fixa dos blocos numa sessão (ver TrainingModelSessao/criarSessaoVazia). */
export const TRAINING_MODEL_FASES: TrainingModelFase[] = ['preparacao', 'mobilidade', 'forca', 'cardio'];

export const TRAINING_MODEL_FASE_LABELS: Record<TrainingModelFase, string> = {
  preparacao: 'Preparação/Vascularização',
  mobilidade: 'Mobilidade',
  forca: 'Força/Musculação',
  cardio: 'Cardiovascular',
};

/**
 * Métodos de intensificação/organização — vocabulário fechado alinhado à
 * progressão pedida (iniciante → intermediário → avançado). Ver
 * METODOS_POR_CATEGORIA pra sugestão por nível; nada aqui é aplicado
 * automaticamente a um exercício, é só o rótulo escolhido na entrada.
 */
export type TrainingModelMetodo =
  | 'series_tradicionais'
  | 'controle_tecnico'
  | 'padroes_fundamentais'
  | 'progressao_basica'
  | 'piramide_crescente'
  | 'piramide_decrescente'
  | 'biset'
  | 'triset'
  | 'superset'
  | 'conjugado'
  | 'circuito'
  | 'progressao_densidade'
  | 'rest_pause'
  | 'drop_set'
  | 'cluster_set'
  | 'fst7'
  | 'gvt';

export const TRAINING_MODEL_METODO_LABELS: Record<TrainingModelMetodo, string> = {
  series_tradicionais: 'Séries tradicionais',
  controle_tecnico: 'Controle técnico',
  padroes_fundamentais: 'Padrões fundamentais',
  progressao_basica: 'Progressão básica',
  piramide_crescente: 'Pirâmide crescente',
  piramide_decrescente: 'Pirâmide decrescente',
  biset: 'Bi-Set',
  triset: 'Tri-Set',
  superset: 'Superset',
  conjugado: 'Conjugado',
  circuito: 'Circuito',
  progressao_densidade: 'Progressão de densidade',
  rest_pause: 'Rest-Pause',
  drop_set: 'Drop Set',
  cluster_set: 'Cluster Set',
  fst7: 'FST-7',
  gvt: 'GVT',
};

/** Métodos sugeridos por categoria — guia de progressão, não uma trava. */
export const METODOS_POR_CATEGORIA: Record<TrainingModelCategoria, TrainingModelMetodo[]> = {
  iniciante: ['series_tradicionais', 'controle_tecnico', 'padroes_fundamentais', 'progressao_basica'],
  intermediario: [
    'piramide_crescente',
    'piramide_decrescente',
    'biset',
    'triset',
    'superset',
    'conjugado',
    'circuito',
    'progressao_densidade',
  ],
  avancado: ['rest_pause', 'drop_set', 'cluster_set', 'fst7', 'gvt'],
};

interface TrainingModelEntradaBase {
  /** Id estável da entrada dentro do modelo — não confundir com `exId`
   *  (referência ao Banco de Exercícios). Permite editar/reordenar/agrupar
   *  sem depender de índice de array, mesmo padrão de StrengthLogEntry.id. */
  id: string;
  /** Referencia Exercise.id existente no Banco de Exercícios
   *  (types/exercise.ts) — nunca duplica nome/agonista/mídia aqui. */
  exId: string;
  metodo?: TrainingModelMetodo;
  descansoSegundos?: number;
  groupId?: string;
  groupType?: GroupType;
  notas?: string;
}

/**
 * Entrada de força. Séries/reps como faixa (não um valor fixo de log,
 * como em StrengthLogEntry) porque o modelo é um template reutilizável
 * pra vários Clientes, não a execução real de um treino.
 */
export interface TrainingModelEntradaForca extends TrainingModelEntradaBase {
  tipo?: undefined;
  series: number;
  repsMin: number;
  repsMax: number;
  /** Carga sugerida (kg), opcional — a carga real é ajustada pelo Personal
   *  ao aplicar o modelo num Cliente específico. */
  cargaSugerida?: number;
  rir?: number;
}

export interface TrainingModelEntradaCardio extends TrainingModelEntradaBase {
  tipo: 'cardio';
  duracaoMinutos: number;
  /** Texto livre (ex: "Moderada", "Zona 2") — mesmo padrão de
   *  AlunoExercicioCardio.intensidade (types/aluno.ts). */
  intensidade: string;
}

export type TrainingModelEntrada = TrainingModelEntradaForca | TrainingModelEntradaCardio;

export function isTrainingModelEntradaCardio(e: TrainingModelEntrada): e is TrainingModelEntradaCardio {
  return e.tipo === 'cardio';
}

/**
 * Um bloco dentro de uma sessão — a unidade que carrega a fase
 * (Preparação/Mobilidade/Força/Cardio) e os exercícios daquela fase.
 * `duracaoEstimadaMinutos` é referência editável, não regra rígida (pedido
 * explícito de ~5min pra Preparação; os demais blocos ficam livres).
 * Cardio "quando aplicável": um bloco de fase `cardio` com `exercicios`
 * vazio significa que a sessão não tem cardio dedicado — o bloco
 * continua presente (ordem fixa), só sem conteúdo.
 */
export interface TrainingModelBloco {
  fase: TrainingModelFase;
  duracaoEstimadaMinutos?: number;
  exercicios: TrainingModelEntrada[];
}

/**
 * Uma sessão do modelo. `tipo` é a divisão (Full Body, Upper/Lower, Push,
 * Pull, etc.) — texto livre e editável, mesmo padrão de AlunoRotinaDia.tipo.
 * `blocos` segue sempre a ordem de TRAINING_MODEL_FASES (preparação →
 * mobilidade → força → cardio) — ver criarSessaoVazia. `sessoes` do modelo
 * não é fixada a 7 dias como AlunoRotina: cabe tanto splits de poucas
 * sessões por semana (ex: Full Body 3x) quanto uma semana cheia — a
 * relação sessão↔dia da semana só é decidida na conversão pra rotina do
 * Cliente (etapa futura), não faz parte do modelo em si.
 */
export interface TrainingModelSessao {
  id: string;
  nome: string;
  tipo: string;
  blocos: TrainingModelBloco[];
}

/**
 * Modelo de treino — entidade própria (`TrainingModel`), independente de
 * Rotinas Salvas e da rotina do Cliente (ver cabeçalho do arquivo).
 * `volume`, `intensidade`, `complexidade` e `densidade` são descritores de
 * planejamento do nível (ex: "10–14 séries por grupamento/semana", "RIR
 * 2–3, submáximo") — texto livre e editável, não um valor calculado a
 * partir de `sessoes` (para contagens reais, ver `contarExercicios`). A
 * matriz de progressão que popula esses 4 campos + `metodos` pros 21
 * níveis fica em data/trainingProgression.ts.
 */
export interface TrainingModel {
  id: string;
  nome: string;
  categoria: TrainingModelCategoria;
  nivel: TrainingModelNivel;
  objetivo: string;
  descricao: string;
  sessoes: TrainingModelSessao[];
  volume: string;
  intensidade: string;
  /** Complexidade motora/organizacional do nível (nº de padrões de
   *  movimento combinados, variações técnicas, exigência coordenativa). */
  complexidade: string;
  /** Densidade da sessão (relação trabalho/descanso: agrupamentos,
   *  circuitos, redução de pausa) — eixo de progressão à parte do volume. */
  densidade: string;
  metodos: TrainingModelMetodo[];
  duracaoEstimadaMinutos: number;
  /** Incrementada pelo Personal a cada revisão relevante do conteúdo do
   *  modelo — independente de `atualizado` (timestamp de última escrita). */
  versao: number;
  criado: string;
  atualizado?: string;
}

function nomePadrao(categoria: TrainingModelCategoria, nivel: TrainingModelNivel): string {
  return `${TRAINING_MODEL_CATEGORIA_LABELS[categoria]} — Nível ${nivel}`;
}

/** Modelo vazio (sem sessões) pra um categoria×nível — ponto de partida
 *  antes do Personal montar o conteúdo. `objetivo`/`volume`/`intensidade`/
 *  `complexidade`/`densidade`/`metodos` nascem em branco aqui; quem os
 *  preenche pelos 21 níveis é `criarCatalogoComProgressao()` em
 *  data/trainingProgression.ts — este helper fica puro/sem opinião de
 *  progressão de propósito, pra outros usos (ex: duplicar um nível) não
 *  herdarem a matriz sem pedir. */
export function criarTrainingModelVazio(categoria: TrainingModelCategoria, nivel: TrainingModelNivel): TrainingModel {
  return {
    id: `${categoria}-${nivel}`,
    categoria,
    nivel,
    nome: nomePadrao(categoria, nivel),
    objetivo: '',
    descricao: '',
    sessoes: [],
    volume: '',
    intensidade: '',
    complexidade: '',
    densidade: '',
    metodos: [],
    duracaoEstimadaMinutos: 0,
    versao: 1,
    criado: new Date().toISOString(),
  };
}

/**
 * Catálogo inicial fixo: 21 modelos vazios, um por categoria×nível. Ids
 * estáveis (`${categoria}-${nivel}`) pra sobreviver a atualizações futuras
 * do app sem duplicar entradas.
 */
export function criarCatalogoInicial(): TrainingModel[] {
  const modelos: TrainingModel[] = [];
  for (const categoria of TRAINING_MODEL_CATEGORIAS) {
    for (const nivel of TRAINING_MODEL_NIVEIS) {
      modelos.push(criarTrainingModelVazio(categoria, nivel));
    }
  }
  return modelos;
}

/** Duração de referência (min) por fase ao criar um bloco vazio — só a
 *  Preparação tem valor por regra explícita; os demais nascem sem duração
 *  fixada (editável livremente). */
const DURACAO_REFERENCIA_POR_FASE: Partial<Record<TrainingModelFase, number>> = {
  preparacao: 5,
};

export function criarBlocoVazio(fase: TrainingModelFase): TrainingModelBloco {
  return {
    fase,
    duracaoEstimadaMinutos: DURACAO_REFERENCIA_POR_FASE[fase],
    exercicios: [],
  };
}

/**
 * Sessão vazia com a estrutura de 4 blocos na ordem fixa (Preparação ~5min
 * de referência → Mobilidade → Força/Musculação → Cardiovascular). O bloco
 * de Cardio nasce presente mas vazio — "quando aplicável" quer dizer que
 * ele pode continuar vazio pra sessões sem cardio dedicado, não que o
 * bloco deixe de existir. Todos os blocos ficam editáveis pelo Personal
 * depois (adicionar/remover exercícios, ajustar duração de referência).
 */
export function criarSessaoVazia(nome: string, tipo: string): TrainingModelSessao {
  return {
    id: `sessao-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nome,
    tipo,
    blocos: TRAINING_MODEL_FASES.map((fase) => criarBlocoVazio(fase)),
  };
}

/** Total de entradas (força+cardio) cadastradas no modelo, somando todos os blocos de todas as sessões. */
export function contarExercicios(modelo: TrainingModel): number {
  return modelo.sessoes.reduce(
    (acc, sessao) => acc + sessao.blocos.reduce((soma, bloco) => soma + bloco.exercicios.length, 0),
    0
  );
}

export function modeloEstaVazio(modelo: TrainingModel): boolean {
  return contarExercicios(modelo) === 0;
}
