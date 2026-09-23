/**
 * Matriz de progressão dos Modelos de Treino (Ferramentas > Modelos).
 *
 * Define os metadados de planejamento dos 21 níveis (Iniciante/
 * Intermediário/Avançado × 7) que alimentam `TrainingModel.objetivo`/
 * `volume`/`intensidade`/`complexidade`/`densidade`/`metodos`
 * (types/trainingModel.ts). Esse eixo (nível 1–7 dentro de uma categoria)
 * é ortogonal à Frequência Semanal (data/frequenciaSemanal.ts, que dita a
 * organização das sessões) — por isso a mesma matriz de 21 entradas
 * alimenta cada combinação categoria×frequência×nível do catálogo, sem
 * duplicação. `sessoes` continua vazio em todo o catálogo; conteúdo real
 * de treino é etapa futura.
 *
 * REGRA DE PROGRESSÃO: nunca "mais séries = nível maior". Cada nível avança
 * numa combinação de eixos — complexidade motora, organização da sessão,
 * métodos, densidade (relação trabalho/descanso) e controle do esforço
 * (RIR) — e o volume por si sobe pouco entre níveis vizinhos. É a
 * combinação dos eixos que caracteriza o nível, não um único número.
 *
 * Estrutura: `EIXOS` guarda, por categoria, 5 tabelas de 7 frases (uma por
 * nível) mais os métodos recomendados por nível — é a "lógica" que este
 * arquivo expõe. `MATRIZ_PROGRESSAO` é a lista achatada de 21 entradas
 * derivada dela, e `criarCatalogoComProgressao()` é o que os Modelos vão
 * usar depois pra nascer com esses metadados já preenchidos.
 */

import {
  TRAINING_MODEL_CATEGORIAS,
  TRAINING_MODEL_NIVEIS,
  criarTrainingModelVazio,
} from '../types/trainingModel';
import type { TrainingModel, TrainingModelCategoria, TrainingModelMetodo, TrainingModelNivel } from '../types/trainingModel';
import { listarCombinacoesFrequencia } from './frequenciaSemanal';

export interface NivelProgressao {
  categoria: TrainingModelCategoria;
  nivel: TrainingModelNivel;
  objetivo: string;
  volume: string;
  intensidade: string;
  complexidade: string;
  densidade: string;
  metodosRecomendados: TrainingModelMetodo[];
}

type PorNivel<T> = Record<TrainingModelNivel, T>;

interface EixosCategoria {
  objetivo: PorNivel<string>;
  volume: PorNivel<string>;
  intensidade: PorNivel<string>;
  complexidade: PorNivel<string>;
  densidade: PorNivel<string>;
  metodosRecomendados: PorNivel<TrainingModelMetodo[]>;
}

/**
 * Eixos de progressão por categoria. Dentro de cada categoria o volume
 * quase não se move (a diferença real entre os 7 níveis está nos outros
 * eixos); é entre categorias que o salto de volume/intensidade é maior.
 */
const EIXOS: Record<TrainingModelCategoria, EixosCategoria> = {
  iniciante: {
    objetivo: {
      1: 'Adaptação anatômica e aprendizado dos padrões básicos de movimento',
      2: 'Consolidar a técnica e introduzir cargas livres básicas',
      3: 'Ampliar o repertório motor com controle do tempo de execução',
      4: 'Ganhar autonomia técnica e iniciar progressão de carga estruturada',
      5: 'Consolidar os padrões fundamentais (empurrar/puxar/dobradiça/agachar/carregar)',
      6: 'Introduzir variedade de estímulo sem abrir mão do controle técnico',
      7: 'Fechar o ciclo iniciante com autonomia plena para o intermediário',
    },
    volume: {
      1: '2–3 séries por exercício, Full Body 1x por grupamento na semana',
      2: '3 séries por exercício, Full Body 2x/semana',
      3: '3 séries por exercício, mesma frequência do nível 2',
      4: '3–4 séries por exercício, ainda 1x por grupamento na sessão',
      5: '4 séries por exercício, sessão um pouco mais longa',
      6: '4 séries por exercício, leve aumento no nº de exercícios',
      7: '4 séries por exercício, frequência já podendo ir a 2x/semana por grupo',
    },
    intensidade: {
      1: 'Carga leve, RIR 4–5 (folga confortável, foco na execução)',
      2: 'RIR 4, carga levemente progressiva sobre o nível 1',
      3: 'RIR 3–4, cadência controlada (ex: 3-1-1)',
      4: 'RIR 3, progressão de carga guiada por desempenho, não fixa',
      5: 'RIR 2–3 na maior parte da sessão',
      6: 'RIR 2–3, algumas séries já em RIR 2',
      7: 'RIR 2, esforço próximo do que o intermediário vai pedir',
    },
    complexidade: {
      1: 'Exercícios guiados (máquinas/peso corporal), 1 padrão de movimento por vez',
      2: 'Introduz halteres livres unilaterais simples, ainda 1 padrão por exercício',
      3: 'Introduz variações de pegada/ângulo dentro do mesmo padrão',
      4: 'Combina 2 padrões de movimento por sessão (ex: agachar + empurrar)',
      5: 'Sessão cobre os 5 padrões fundamentais numa única sessão Full Body',
      6: 'Introduz apoio unilateral e superfícies levemente instáveis',
      7: 'Todos os padrões fundamentais dominados com boa qualidade de movimento',
    },
    densidade: {
      1: 'Descanso generoso (60–90s), sem pressão de tempo',
      2: 'Descanso 60–75s, ainda sem combinar exercícios',
      3: 'Descanso 60s, transições mais organizadas entre exercícios',
      4: 'Descanso 45–60s, começa reduzir o tempo ocioso entre séries',
      5: 'Descanso 45s, sequência da sessão mais fluida',
      6: 'Descanso 40–45s, começa alternar pares de exercícios (sem Bi-Set formal)',
      7: 'Descanso 40s, sessão já organizada em blocos claros',
    },
    metodosRecomendados: {
      1: ['series_tradicionais', 'controle_tecnico'],
      2: ['series_tradicionais', 'controle_tecnico', 'padroes_fundamentais'],
      3: ['controle_tecnico', 'padroes_fundamentais', 'progressao_basica'],
      4: ['padroes_fundamentais', 'progressao_basica'],
      5: ['padroes_fundamentais', 'progressao_basica'],
      6: ['progressao_basica', 'padroes_fundamentais'],
      7: ['progressao_basica', 'series_tradicionais'],
    },
  },

  intermediario: {
    objetivo: {
      1: 'Transição para o treino intermediário: primeiro contato com agrupamentos',
      2: 'Explorar variação de tensão dentro da série (pirâmide)',
      3: 'Aprofundar a organização da sessão e ampliar os agrupamentos',
      4: 'Estruturar a sessão por função muscular (push/pull/legs)',
      5: 'Introduzir controle de fadiga localizada em blocos metabólicos',
      6: 'Periodizar a densidade da sessão de forma estruturada',
      7: 'Fechar o ciclo intermediário combinando todos os métodos aprendidos',
    },
    volume: {
      1: '4 séries por exercício, Full Body avançado 2–3x/semana',
      2: '4 séries por exercício, primeira divisão Upper/Lower',
      3: '4–5 séries por exercício',
      4: '4–5 séries por exercício, split push/pull/legs',
      5: '5 séries por exercício nos pontos-chave da sessão',
      6: '5 séries por exercício, sessão com mais variedade de exercícios',
      7: '5 séries por exercício, sessão plenamente estruturada por função',
    },
    intensidade: {
      1: 'RIR 2–3, cargas já numa faixa de trabalho consistente',
      2: 'RIR 2–3, carga crescente entre séries dentro do próprio exercício',
      3: 'RIR 2, maior consistência de esforço entre séries',
      4: 'RIR 2, algumas séries levadas a RIR 1 no exercício final',
      5: 'RIR 2, RIR 1 nos blocos definidos de circuito',
      6: 'RIR 1–2, esforço mais próximo da falha em blocos definidos',
      7: 'RIR 1–2, controle fino do esforço por bloco da sessão',
    },
    complexidade: {
      1: 'Introduz Bi-Set simples entre agonista e antagonista',
      2: 'Introduz pirâmide crescente em exercícios multiarticulares',
      3: 'Introduz Tri-Set em grupamentos complementares',
      4: 'Combina Superset com exercícios compostos de padrões diferentes',
      5: 'Introduz circuitos curtos (3–4 exercícios) e pirâmide decrescente',
      6: 'Introduz variação de tempo de execução (isometria/excêntrica controlada)',
      7: 'Sessão combina Bi-Set/Tri-Set/Superset/circuito conforme o bloco',
    },
    densidade: {
      1: 'Descanso 45s entre séries, 60s entre Bi-Sets',
      2: 'Descanso 45–60s, sessão dividida por padrão de movimento',
      3: 'Descanso 40–45s, blocos de 3 exercícios encadeados',
      4: 'Descanso 40s, densidade já perceptivelmente maior que no iniciante',
      5: 'Descanso reduzido no circuito (20–30s), normal fora dele',
      6: 'Progressão de densidade: descanso reduz ao longo do ciclo',
      7: 'Densidade alta e controlada, pronta para os métodos avançados',
    },
    metodosRecomendados: {
      1: ['biset', 'progressao_basica'],
      2: ['piramide_crescente', 'biset'],
      3: ['triset', 'piramide_crescente', 'biset'],
      4: ['superset', 'triset', 'piramide_crescente'],
      5: ['circuito', 'piramide_decrescente', 'superset'],
      6: ['progressao_densidade', 'circuito', 'conjugado'],
      7: ['conjugado', 'progressao_densidade', 'circuito', 'superset'],
    },
  },

  avancado: {
    objetivo: {
      1: 'Introduzir intensificação pontual sem comprometer a técnica',
      2: 'Explorar sobrecarga metabólica ao final da série',
      3: 'Desenvolver força-potência com controle total da qualidade do movimento',
      4: 'Especializar hipertrofia localizada num grupamento prioritário do ciclo',
      5: 'Trabalhar volume-alvo elevado com carga submáxima controlada',
      6: 'Combinar métodos avançados na mesma sessão com fadiga controlada',
      7: 'Especialização plena com periodização de fadiga entre ciclos',
    },
    volume: {
      1: '4–5 séries por exercício, especialização começa a aparecer no split',
      2: '5 séries por exercício nos grupamentos prioritários',
      3: '4–5 séries por exercício multiarticular',
      4: 'Volume concentrado no grupamento-alvo do ciclo (especialização)',
      5: '10 séries de 10 reps no grupamento prioritário (GVT)',
      6: 'Volume variável por bloco, ajustado à combinação de métodos do dia',
      7: 'Volume e distribuição ajustados por ciclo, com deload implícito',
    },
    intensidade: {
      1: 'RIR 1 na maior parte da sessão, RIR 0 pontual',
      2: 'RIR 0–1 na série final de cada exercício',
      3: 'Carga alta, RIR 1–2 entre clusters (foco em qualidade, não fadiga)',
      4: 'RIR 0–1 no bloco de especialização, RIR 2 no restante',
      5: 'Carga fixa submáxima, RIR planejado a subir ao longo das séries',
      6: 'RIR 0–1 nos blocos de intensificação, monitorado de perto',
      7: 'RIR 0–1 nos blocos-chave, controle rigoroso por sessão',
    },
    complexidade: {
      1: 'Introduz Rest-Pause em exercícios de isolamento',
      2: 'Introduz Drop Set nas últimas séries de exercícios-chave',
      3: 'Introduz Cluster Set em multiarticulares de força',
      4: 'Introduz FST-7 no grupamento priorizado do ciclo',
      5: 'Introduz GVT como bloco estruturado dentro da sessão',
      6: 'Combina 2 métodos avançados na mesma sessão (ex: Rest-Pause + Drop Set)',
      7: 'Combinação plena de métodos avançados conforme o objetivo do ciclo',
    },
    densidade: {
      1: 'Descanso padrão entre séries, pausas curtas dentro do Rest-Pause',
      2: 'Densidade alta na série de Drop Set, normal nas demais',
      3: 'Micro-pausas dentro da série (Cluster), descanso pleno entre séries',
      4: 'Descanso curto (30–45s) no bloco FST-7',
      5: 'Descanso curto e fixo (60–90s), conforme o protocolo do método',
      6: 'Densidade alta, com pausas calculadas por método combinado',
      7: 'Densidade máxima controlada, sessão inteiramente periodizada',
    },
    metodosRecomendados: {
      1: ['rest_pause', 'superset'],
      2: ['drop_set', 'rest_pause'],
      3: ['cluster_set', 'drop_set'],
      4: ['fst7', 'cluster_set'],
      5: ['gvt', 'fst7'],
      6: ['rest_pause', 'drop_set', 'cluster_set'],
      7: ['fst7', 'gvt', 'rest_pause', 'drop_set', 'cluster_set'],
    },
  },
};

/** Matriz achatada: 21 entradas, uma por categoria×nível. */
export const MATRIZ_PROGRESSAO: NivelProgressao[] = TRAINING_MODEL_CATEGORIAS.flatMap((categoria) =>
  TRAINING_MODEL_NIVEIS.map((nivel) => {
    const eixos = EIXOS[categoria];
    return {
      categoria,
      nivel,
      objetivo: eixos.objetivo[nivel],
      volume: eixos.volume[nivel],
      intensidade: eixos.intensidade[nivel],
      complexidade: eixos.complexidade[nivel],
      densidade: eixos.densidade[nivel],
      metodosRecomendados: eixos.metodosRecomendados[nivel],
    };
  })
);

export function getProgressao(categoria: TrainingModelCategoria, nivel: TrainingModelNivel): NivelProgressao {
  // Sempre existe: os 21 pares categoria×nível são fixos (ver types/trainingModel.ts).
  return MATRIZ_PROGRESSAO.find((p) => p.categoria === categoria && p.nivel === nivel)!;
}

/**
 * Catálogo de modelos vazios (sem sessões/exercícios) já com os metadados
 * da matriz de progressão preenchidos (objetivo/volume/intensidade/
 * complexidade/densidade/metodos) — um modelo por combinação categoria ×
 * (frequência, variante quando 4x) × nível (ver data/frequenciaSemanal.ts
 * pras combinações de frequência). `sessoes` fica vazio em todos: o
 * conteúdo real de treino pra essa estrutura por frequência é uma etapa
 * futura, explicitamente adiada.
 *
 * NOTA: os geradores de conteúdo anteriores (data/modelosIniciante.ts,
 * modelosIntermediario.ts, modelosAvancado.ts) foram construídos sob a
 * premissa antiga — o nível 1–7 ditava a organização da sessão (Full
 * Body → Upper/Lower → Push/Pull/Legs). Agora é a Frequência Semanal
 * quem dita a organização (ver data/frequenciaSemanal.ts) e o nível só
 * progride intensidade/volume/complexidade/densidade dentro dela — os
 * dois modelos de organização são incompatíveis, então esses três
 * arquivos não são mais chamados aqui. Ficam intactos no projeto (nada
 * foi apagado), mas o conteúdo que geravam não migra automaticamente
 * pra cá; é decisão explícita futura se algo deles será reaproveitado.
 */
export function criarCatalogoComProgressao(): TrainingModel[] {
  return TRAINING_MODEL_CATEGORIAS.flatMap((categoria) =>
    listarCombinacoesFrequencia().flatMap(({ frequencia, variante }) =>
      TRAINING_MODEL_NIVEIS.map((nivel) => {
        const modelo = criarTrainingModelVazio(categoria, frequencia, nivel, variante);
        const p = getProgressao(categoria, nivel);
        return {
          ...modelo,
          objetivo: p.objetivo,
          volume: p.volume,
          intensidade: p.intensidade,
          complexidade: p.complexidade,
          densidade: p.densidade,
          metodos: p.metodosRecomendados,
        };
      })
    )
  );
}
