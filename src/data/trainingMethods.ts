/**
 * Biblioteca de Métodos de Treino (Ferramentas > Modelos).
 *
 * Define os 13 métodos como estruturas de dados reutilizáveis — cada um
 * com descrição, complexidade, níveis recomendados e parâmetros
 * configuráveis. Nada aqui aplica um método a um exercício automaticamente:
 * isso é decisão explícita do Personal numa etapa futura, ao montar o
 * conteúdo de um `TrainingModelEntrada` (types/trainingModel.ts) — este
 * arquivo só descreve o método, não o executa nem o injeta em nada.
 *
 * `id` reaproveita exatamente os valores de `TrainingModelMetodo`
 * (types/trainingModel.ts) — não cria uma segunda lista de ids paralela.
 * Esta biblioteca cobre só os 13 métodos "técnicas nomeadas" pedidos, um
 * subconjunto de `TrainingModelMetodo` (que também inclui os 4 descritores
 * de estágio do Iniciante — controle_tecnico/padroes_fundamentais/
 * progressao_basica/progressao_densidade — que não são técnicas com
 * parâmetros configuráveis, por isso ficam fora desta biblioteca).
 *
 * `niveisRecomendados` é derivado de `METODOS_POR_CATEGORIA`
 * (types/trainingModel.ts), não duplicado à mão: a categoria em que o
 * método é introduzido, mais todas as categorias seguintes (uma vez
 * introduzido, o método continua disponível nos níveis mais avançados).
 * Isso evita a matriz de progressão e esta biblioteca discordarem uma da
 * outra com o tempo.
 *
 * Não modifica Rotinas Salvas (types/workout.ts/useRotinaStore) — nada
 * neste arquivo é lido ou escrito por elas.
 */

import { METODOS_POR_CATEGORIA, TRAINING_MODEL_CATEGORIAS, TRAINING_MODEL_METODO_LABELS } from '../types/trainingModel';
import type { TrainingModelCategoria, TrainingModelMetodo } from '../types/trainingModel';

/** Os 13 métodos cobertos por esta biblioteca (técnicas nomeadas e configuráveis). */
export const TRAINING_METHOD_IDS = [
  'series_tradicionais',
  'piramide_crescente',
  'piramide_decrescente',
  'biset',
  'triset',
  'superset',
  'conjugado',
  'circuito',
  'rest_pause',
  'drop_set',
  'cluster_set',
  'fst7',
  'gvt',
] as const satisfies readonly TrainingModelMetodo[];

export type TrainingMethodId = (typeof TRAINING_METHOD_IDS)[number];

export type TrainingMethodComplexidade = 'baixa' | 'media' | 'alta';

export type TrainingMethodParametroTipo = 'numero' | 'texto' | 'selecao';

export interface TrainingMethodParametro {
  /** Chave estável do parâmetro (para uso programático futuro, ex: formulário gerado a partir da lista). */
  chave: string;
  nome: string;
  tipo: TrainingMethodParametroTipo;
  /** Unidade de exibição, quando fizer sentido (ex: 'seg', '%', 'séries'). */
  unidade?: string;
  /** Valor sugerido — só uma sugestão de preenchimento; nunca aplicado automaticamente (ver regra do cabeçalho). */
  padrao?: number | string;
  min?: number;
  max?: number;
  /** Alternativas válidas quando `tipo === 'selecao'`. */
  opcoes?: string[];
  descricao: string;
}

export interface TrainingMethodDefinition {
  id: TrainingMethodId;
  nome: string;
  descricao: string;
  complexidade: TrainingMethodComplexidade;
  niveisRecomendados: TrainingModelCategoria[];
  parametros: TrainingMethodParametro[];
}

/** Categoria de introdução do método, mais todas as categorias seguintes (ver cabeçalho do arquivo). */
function categoriasRecomendadas(id: TrainingModelMetodo): TrainingModelCategoria[] {
  const indice = TRAINING_MODEL_CATEGORIAS.findIndex((categoria) => METODOS_POR_CATEGORIA[categoria].includes(id));
  return indice === -1 ? [] : TRAINING_MODEL_CATEGORIAS.slice(indice);
}

interface MetodoConteudo {
  descricao: string;
  complexidade: TrainingMethodComplexidade;
  parametros: TrainingMethodParametro[];
}

const CONTEUDO: Record<TrainingMethodId, MetodoConteudo> = {
  series_tradicionais: {
    descricao:
      'Séries e repetições fixas, com descanso completo entre elas. A base de qualquer programa — usada em todos os níveis, sozinha ou combinada com outros métodos.',
    complexidade: 'baixa',
    parametros: [
      { chave: 'series', nome: 'Séries', tipo: 'numero', unidade: 'séries', padrao: 3, min: 1, max: 6, descricao: 'Número de séries do exercício.' },
      { chave: 'repeticoes', nome: 'Repetições', tipo: 'texto', padrao: '8-12', descricao: 'Faixa de repetições por série (ex: "8-12").' },
      { chave: 'descansoSegundos', nome: 'Descanso entre séries', tipo: 'numero', unidade: 'seg', padrao: 60, min: 30, max: 180, descricao: 'Descanso completo entre as séries.' },
    ],
  },

  piramide_crescente: {
    descricao: 'A carga aumenta e as repetições diminuem a cada série subsequente, dentro do mesmo exercício.',
    complexidade: 'media',
    parametros: [
      { chave: 'degraus', nome: 'Nº de degraus', tipo: 'numero', unidade: 'séries', padrao: 4, min: 2, max: 6, descricao: 'Quantas séries compõem a pirâmide.' },
      { chave: 'variacaoCargaPercent', nome: 'Aumento de carga por degrau', tipo: 'numero', unidade: '%', padrao: 10, min: 5, max: 20, descricao: 'Quanto a carga sobe a cada degrau, em relação ao anterior.' },
      { chave: 'descansoSegundos', nome: 'Descanso entre degraus', tipo: 'numero', unidade: 'seg', padrao: 75, min: 45, max: 120, descricao: 'Descanso entre cada degrau da pirâmide.' },
    ],
  },

  piramide_decrescente: {
    descricao: 'A carga diminui e as repetições aumentam a cada série subsequente — o inverso da pirâmide crescente.',
    complexidade: 'media',
    parametros: [
      { chave: 'degraus', nome: 'Nº de degraus', tipo: 'numero', unidade: 'séries', padrao: 4, min: 2, max: 6, descricao: 'Quantas séries compõem a pirâmide.' },
      { chave: 'reducaoCargaPercent', nome: 'Redução de carga por degrau', tipo: 'numero', unidade: '%', padrao: 10, min: 5, max: 20, descricao: 'Quanto a carga cai a cada degrau, em relação ao anterior.' },
      { chave: 'descansoSegundos', nome: 'Descanso entre degraus', tipo: 'numero', unidade: 'seg', padrao: 60, min: 30, max: 90, descricao: 'Descanso entre cada degrau da pirâmide.' },
    ],
  },

  biset: {
    descricao: 'Dois exercícios encadeados sem descanso entre eles — geralmente agonista/antagonista ou o mesmo grupamento.',
    complexidade: 'media',
    parametros: [
      { chave: 'relacaoGrupos', nome: 'Relação entre os grupamentos', tipo: 'selecao', opcoes: ['Agonista/Antagonista', 'Mesmo grupamento', 'Grupamentos distintos'], padrao: 'Agonista/Antagonista', descricao: 'Como os 2 exercícios do Bi-Set se relacionam.' },
      { chave: 'descansoEntreExerciciosSegundos', nome: 'Descanso entre os 2 exercícios', tipo: 'numero', unidade: 'seg', padrao: 0, min: 0, max: 20, descricao: 'Pausa entre o 1º e o 2º exercício do par (geralmente zero).' },
      { chave: 'descansoAposParSegundos', nome: 'Descanso após o par completo', tipo: 'numero', unidade: 'seg', padrao: 60, min: 30, max: 120, descricao: 'Descanso depois de completar os 2 exercícios.' },
    ],
  },

  triset: {
    descricao: 'Três exercícios encadeados sem descanso entre eles, geralmente do mesmo grupamento ou complementares.',
    complexidade: 'media',
    parametros: [
      { chave: 'relacaoGrupos', nome: 'Relação entre os grupamentos', tipo: 'selecao', opcoes: ['Mesmo grupamento', 'Grupamentos complementares', 'Grupamentos distintos'], padrao: 'Mesmo grupamento', descricao: 'Como os 3 exercícios do Tri-Set se relacionam.' },
      { chave: 'descansoEntreExerciciosSegundos', nome: 'Descanso entre exercícios', tipo: 'numero', unidade: 'seg', padrao: 0, min: 0, max: 15, descricao: 'Pausa entre cada exercício do trio (geralmente zero).' },
      { chave: 'descansoAposBlocoSegundos', nome: 'Descanso após o bloco completo', tipo: 'numero', unidade: 'seg', padrao: 75, min: 45, max: 150, descricao: 'Descanso depois de completar os 3 exercícios.' },
    ],
  },

  superset: {
    descricao: 'Dois ou mais exercícios encadeados sem descanso, tipicamente de grupamentos diferentes, elevando a densidade da sessão.',
    complexidade: 'media',
    parametros: [
      { chave: 'numeroExercicios', nome: 'Nº de exercícios no bloco', tipo: 'numero', unidade: 'exercícios', padrao: 2, min: 2, max: 4, descricao: 'Quantos exercícios compõem o superset.' },
      { chave: 'descansoEntreExerciciosSegundos', nome: 'Descanso entre exercícios', tipo: 'numero', unidade: 'seg', padrao: 0, min: 0, max: 15, descricao: 'Pausa entre cada exercício do bloco.' },
      { chave: 'descansoAposBlocoSegundos', nome: 'Descanso após o bloco completo', tipo: 'numero', unidade: 'seg', padrao: 60, min: 30, max: 120, descricao: 'Descanso depois de completar todo o bloco.' },
    ],
  },

  conjugado: {
    descricao: 'Combina um exercício de força/potência com um exercício complementar (pliometria, velocidade ou técnico) no mesmo bloco, buscando transferência entre as duas qualidades.',
    complexidade: 'alta',
    parametros: [
      { chave: 'tipoComplementar', nome: 'Tipo do exercício complementar', tipo: 'selecao', opcoes: ['Pliometria', 'Velocidade', 'Técnico'], padrao: 'Pliometria', descricao: 'Natureza do exercício que acompanha o principal.' },
      { chave: 'cargaPrincipalPercent1RM', nome: 'Carga do exercício principal', tipo: 'numero', unidade: '% 1RM', padrao: 80, min: 60, max: 95, descricao: 'Intensidade do exercício de força/potência do bloco.' },
      { chave: 'descansoEntreBlocoSegundos', nome: 'Descanso entre os 2 exercícios', tipo: 'numero', unidade: 'seg', padrao: 90, min: 60, max: 180, descricao: 'Pausa entre o exercício principal e o complementar.' },
    ],
  },

  circuito: {
    descricao: 'Sequência de exercícios executados em estações, com descanso reduzido entre elas, priorizando densidade e condicionamento.',
    complexidade: 'media',
    parametros: [
      { chave: 'numeroEstacoes', nome: 'Nº de estações', tipo: 'numero', unidade: 'exercícios', padrao: 4, min: 3, max: 8, descricao: 'Quantos exercícios compõem uma volta do circuito.' },
      { chave: 'voltas', nome: 'Nº de voltas', tipo: 'numero', unidade: 'voltas', padrao: 3, min: 1, max: 6, descricao: 'Quantas vezes o circuito é repetido.' },
      { chave: 'duracaoOuRepsPorEstacao', nome: 'Duração ou reps por estação', tipo: 'texto', padrao: '30s', descricao: 'Ex: "30s" (tempo) ou "12 reps".' },
      { chave: 'descansoEntreEstacoesSegundos', nome: 'Descanso entre estações', tipo: 'numero', unidade: 'seg', padrao: 15, min: 0, max: 30, descricao: 'Pausa entre uma estação e a próxima.' },
      { chave: 'descansoEntreVoltasSegundos', nome: 'Descanso entre voltas', tipo: 'numero', unidade: 'seg', padrao: 90, min: 45, max: 180, descricao: 'Pausa entre uma volta completa e a próxima.' },
    ],
  },

  rest_pause: {
    descricao: 'Uma série levada perto da falha, seguida de mini-pausas curtas para somar repetições extras com a mesma carga.',
    complexidade: 'alta',
    parametros: [
      { chave: 'cargaPercent1RM', nome: 'Carga', tipo: 'numero', unidade: '% 1RM', padrao: 80, min: 70, max: 90, descricao: 'Intensidade da série inicial.' },
      { chave: 'repeticoesIniciais', nome: 'Repetições até a mini-pausa', tipo: 'texto', padrao: 'até quase falha', descricao: 'Ponto em que a primeira mini-série é interrompida.' },
      { chave: 'numeroMiniPausas', nome: 'Nº de mini-pausas', tipo: 'numero', unidade: 'pausas', padrao: 2, min: 1, max: 4, descricao: 'Quantas mini-pausas somam repetições à série.' },
      { chave: 'duracaoPausaSegundos', nome: 'Duração de cada mini-pausa', tipo: 'numero', unidade: 'seg', padrao: 15, min: 10, max: 20, descricao: 'Tempo de cada pausa curta entre as mini-séries.' },
    ],
  },

  drop_set: {
    descricao: 'Ao chegar perto da falha, reduz a carga imediatamente e continua a série sem descanso — pode repetir por múltiplos drops.',
    complexidade: 'media',
    parametros: [
      { chave: 'numeroDrops', nome: 'Nº de drops', tipo: 'numero', unidade: 'drops', padrao: 2, min: 1, max: 4, descricao: 'Quantas reduções de carga são feitas na série.' },
      { chave: 'reducaoCargaPercentPorDrop', nome: 'Redução de carga por drop', tipo: 'numero', unidade: '%', padrao: 20, min: 10, max: 30, descricao: 'Quanto a carga cai a cada drop.' },
      { chave: 'tempoTrocaSegundos', nome: 'Tempo de troca de carga', tipo: 'numero', unidade: 'seg', padrao: 10, min: 5, max: 20, descricao: 'Tempo gasto ajustando a carga entre um drop e outro (sem descanso pleno).' },
    ],
  },

  cluster_set: {
    descricao: 'A série é fracionada em mini-blocos com pausas curtas intra-série, permitindo manter mais repetições com cargas mais altas.',
    complexidade: 'alta',
    parametros: [
      { chave: 'cargaPercent1RM', nome: 'Carga', tipo: 'numero', unidade: '% 1RM', padrao: 85, min: 75, max: 95, descricao: 'Intensidade do cluster — mais alta que uma série tradicional, viabilizada pelas pausas curtas.' },
      { chave: 'repeticoesPorCluster', nome: 'Repetições por cluster', tipo: 'numero', unidade: 'reps', padrao: 3, min: 1, max: 5, descricao: 'Repetições feitas antes de cada micro-pausa.' },
      { chave: 'numeroClusters', nome: 'Nº de clusters', tipo: 'numero', unidade: 'clusters', padrao: 4, min: 2, max: 6, descricao: 'Quantos mini-blocos compõem a série inteira.' },
      { chave: 'pausaIntraClusterSegundos', nome: 'Pausa entre clusters', tipo: 'numero', unidade: 'seg', padrao: 20, min: 10, max: 30, descricao: 'Duração da micro-pausa entre um cluster e o próximo.' },
    ],
  },

  fst7: {
    descricao: 'Sete séries do último exercício de um grupamento, com descanso bem curto, buscando bombeamento e distensão da fáscia.',
    complexidade: 'alta',
    parametros: [
      { chave: 'series', nome: 'Séries', tipo: 'numero', unidade: 'séries', padrao: 7, min: 7, max: 7, descricao: 'Número de séries — característica que dá nome ao método.' },
      { chave: 'repeticoes', nome: 'Repetições', tipo: 'texto', padrao: '12-15', descricao: 'Faixa de repetições por série.' },
      { chave: 'descansoSegundos', nome: 'Descanso entre séries', tipo: 'numero', unidade: 'seg', padrao: 30, min: 15, max: 45, descricao: 'Descanso curto entre as 7 séries.' },
      { chave: 'exercicioAlvo', nome: 'Exercício-alvo', tipo: 'texto', padrao: 'isolamento do grupamento priorizado', descricao: 'Exercício em que o bloco de 7 séries é aplicado (geralmente de isolamento).' },
    ],
  },

  gvt: {
    descricao: 'Dez séries de dez repetições no mesmo exercício, com carga submáxima fixa e descanso curto, priorizando volume total.',
    complexidade: 'alta',
    parametros: [
      { chave: 'series', nome: 'Séries', tipo: 'numero', unidade: 'séries', padrao: 10, min: 10, max: 10, descricao: 'Número de séries — característica que dá nome ao método.' },
      { chave: 'repeticoes', nome: 'Repetições', tipo: 'numero', unidade: 'reps', padrao: 10, min: 10, max: 10, descricao: 'Repetições por série, fixas nas 10 séries.' },
      { chave: 'cargaPercent1RM', nome: 'Carga', tipo: 'numero', unidade: '% 1RM', padrao: 60, min: 50, max: 65, descricao: 'Carga submáxima fixa, mantida nas 10 séries.' },
      { chave: 'descansoSegundos', nome: 'Descanso entre séries', tipo: 'numero', unidade: 'seg', padrao: 75, min: 60, max: 90, descricao: 'Descanso curto e fixo entre as 10 séries.' },
    ],
  },
};

/** Biblioteca dos 13 métodos, pronta pra ser referenciada pelos Modelos (ainda sem aplicação automática). */
export const TRAINING_METHODS: TrainingMethodDefinition[] = TRAINING_METHOD_IDS.map((id) => ({
  id,
  nome: TRAINING_MODEL_METODO_LABELS[id],
  descricao: CONTEUDO[id].descricao,
  complexidade: CONTEUDO[id].complexidade,
  niveisRecomendados: categoriasRecomendadas(id),
  parametros: CONTEUDO[id].parametros,
}));

export function getTrainingMethod(id: TrainingMethodId): TrainingMethodDefinition {
  // Sempre existe: TRAINING_METHOD_IDS é a única fonte de ids possíveis.
  return TRAINING_METHODS.find((m) => m.id === id)!;
}

export function listarMetodosPorNivel(categoria: TrainingModelCategoria): TrainingMethodDefinition[] {
  return TRAINING_METHODS.filter((m) => m.niveisRecomendados.includes(categoria));
}
