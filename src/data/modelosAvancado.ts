/**
 * Conteúdo dos 7 Modelos da categoria Avançado (Ferramentas > Modelos).
 *
 * Mantém a organização Push/Pull/Legs herdada do fim do Intermediário
 * (data/modelosIntermediario.ts) — no Avançado o eixo de progressão não é
 * mais "como a sessão é organizada", e sim volume/intensidade/densidade/
 * complexidade/especialização dentro da mesma organização, exatamente
 * como a matriz (data/trainingProgression.ts EIXOS.avancado) descreve.
 *
 * Métodos avançados (data/trainingMethods.ts) introduzidos progressivamente,
 * cada um SEMPRE no tipo de exercício pra que foi desenhado — nunca "só
 * pra aumentar dificuldade":
 * - N1 Rest-Pause: só em isolamento pequeno, no fim da sessão.
 * - N2 Drop Set: só em máquina/cabo (Peck Deck, Puxada, Leg Press) — nunca
 *   em barra livre, onde trocar carga em segundos não é viável/seguro.
 * - N3 Cluster Set: só no exercício multiarticular pesado do dia (Supino,
 *   Terra, Agachamento) — é o método desenhado pra força-potência.
 * - N4 FST-7: só em isolamento do grupamento priorizado do ciclo desta
 *   série de modelos (Costas, no dia Pull) — "especialização" quer dizer
 *   que só esse grupamento leva o método, os outros dias continuam com
 *   Cluster Set (carryover) em vez de ganhar uma novidade cada.
 * - N5 GVT: bloco de 10x10 num composto do grupamento priorizado (Remada
 *   Curvada, Pull); FST-7 aparece nos outros dias como método já
 *   consolidado, agora variando de grupamento pra mostrar que ele
 *   continua válido fora do ciclo de especialização.
 * - N6 combina 2 métodos por sessão, sempre em exercícios DIFERENTES:
 *   Cluster Set no composto pesado + 1 finisher isolado (Drop Set ou
 *   FST-7) — nunca dois métodos empilhados no mesmo movimento.
 * - N7 combina até 3 (Cluster no composto + Drop Set/FST-7 isolado +
 *   Rest-Pause bem pequeno pra fechar) — mesma disciplina do N6, só com
 *   mais um finisher curto no fim; não empilha tudo no mesmo exercício,
 *   que seria exatamente "método avançado só pra aumentar dificuldade".
 *
 * Coerência agonista/sinergista/estabilizador ↔ objetivo/volume/
 * intensidade/método: cada aplicação de método está no exercício certo
 * pro objetivo do bloco (ver comentários inline) — Cluster Set nunca cai
 * num isolamento, FST-7/Rest-Pause nunca caem num composto pesado.
 *
 * Só referencia exercícios reais de data/defaultExercises.ts pelo `exId`.
 * Não modifica Rotinas Salvas nem a rotina do Cliente — TrainingModel
 * continua uma entidade própria.
 */

import type {
  TrainingModel,
  TrainingModelBloco,
  TrainingModelEntradaCardio,
  TrainingModelEntradaForca,
  TrainingModelFase,
  TrainingModelMetodo,
  TrainingModelNivel,
  TrainingModelSessao,
} from '../types/trainingModel';
import type { GroupType } from '../types/workout';

interface ForcaExtra {
  metodo?: TrainingModelMetodo;
  groupId?: string;
  groupType?: GroupType;
  notas?: string;
}

function forca(
  id: string,
  exId: string,
  series: number,
  repsMin: number,
  repsMax: number,
  descansoSegundos: number,
  rir: number,
  extra: ForcaExtra = {}
): TrainingModelEntradaForca {
  return {
    id,
    exId,
    series,
    repsMin,
    repsMax,
    descansoSegundos,
    rir,
    metodo: extra.metodo ?? 'series_tradicionais',
    groupId: extra.groupId,
    groupType: extra.groupType,
    notas: extra.notas,
  };
}

function cardioPrep(id: string, exId: string, intensidade = 'Moderada'): TrainingModelEntradaCardio {
  return { id, exId, tipo: 'cardio', duracaoMinutos: 5, intensidade };
}

function bloco(fase: TrainingModelFase, exercicios: TrainingModelBloco['exercicios'], duracaoEstimadaMinutos?: number): TrainingModelBloco {
  return { fase, duracaoEstimadaMinutos, exercicios };
}

function sessao(id: string, nome: string, blocos: TrainingModelBloco[]): TrainingModelSessao {
  return { id, nome, tipo: 'Push/Pull/Legs', blocos };
}

const SESSOES_AVANCADO: Record<TrainingModelNivel, TrainingModelSessao[]> = {
  // N1 — Introduz Rest-Pause (isolamento pequeno, fim da sessão). Superset
  // carrega do Intermediário como base ainda apropriada neste nível.
  1: [
    sessao('avancado-1-sessao-push', 'Push', [
      bloco('preparacao', [cardioPrep('a1pu-p1', 'c1')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a1pu-f1', 'e1', 4, 8, 10, 60, 1),
        forca('a1pu-f2', 'e67', 5, 6, 8, 0, 1, { metodo: 'superset', groupId: 'a1pug1', groupType: 'supersets' }),
        forca('a1pu-f3', 'e26', 5, 12, 15, 45, 1, { metodo: 'superset', groupId: 'a1pug1', groupType: 'supersets' }),
        forca('a1pu-f4', 'e33', 1, 6, 8, 20, 0, { metodo: 'rest_pause', notas: 'Isolamento pequeno — seguro pra 2-3 mini-pausas de 15-20s perto da falha' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-1-sessao-pull', 'Pull', [
      bloco('preparacao', [cardioPrep('a1pl-p1', 'c6')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a1pl-f1', 'e11', 4, 6, 8, 75, 1),
        forca('a1pl-f2', 'e8', 5, 8, 10, 0, 1, { metodo: 'superset', groupId: 'a1plg1', groupType: 'supersets' }),
        forca('a1pl-f3', 'e28', 5, 12, 15, 45, 1, { metodo: 'superset', groupId: 'a1plg1', groupType: 'supersets' }),
        forca('a1pl-f4', 'e29', 1, 6, 8, 20, 0, { metodo: 'rest_pause', notas: 'Isolamento pequeno — mesma lógica do tríceps no Push' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-1-sessao-legs', 'Legs', [
      bloco('preparacao', [cardioPrep('a1le-p1', 'c3')], 5),
      bloco('mobilidade', [forca('a1le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('a1le-f1', 'e14', 4, 8, 10, 75, 1),
        forca('a1le-f2', 'e20', 5, 8, 10, 0, 1, { metodo: 'superset', groupId: 'a1leg1', groupType: 'supersets' }),
        forca('a1le-f3', 'e23', 5, 12, 15, 45, 1, { metodo: 'superset', groupId: 'a1leg1', groupType: 'supersets' }),
        forca('a1le-f4', 'e37', 1, 10, 12, 20, 0, { metodo: 'rest_pause', notas: 'Panturrilha — isolamento seguro pra falha com mini-pausas' }),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N2 — Introduz Drop Set, só em máquina/cabo (nunca em barra livre).
  2: [
    sessao('avancado-2-sessao-push', 'Push', [
      bloco('preparacao', [cardioPrep('a2pu-p1', 'c1')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a2pu-f1', 'e1', 5, 6, 8, 60, 1),
        forca('a2pu-f2', 'e49', 3, 10, 12, 15, 0, { metodo: 'drop_set', notas: 'Peck Deck: máquina, carga ajustável na hora — Drop Set seguro aqui, não na barra' }),
        forca('a2pu-f3', 'e34', 4, 10, 12, 45, 1),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-2-sessao-pull', 'Pull', [
      bloco('preparacao', [cardioPrep('a2pl-p1', 'c6')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a2pl-f1', 'e11', 5, 6, 8, 75, 1),
        forca('a2pl-f2', 'e8', 3, 8, 12, 15, 0, { metodo: 'drop_set', notas: 'Puxada Frontal: polia/cabo, ajuste de carga imediato' }),
        forca('a2pl-f3', 'e31', 4, 10, 12, 45, 1),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-2-sessao-legs', 'Legs', [
      bloco('preparacao', [cardioPrep('a2le-p1', 'c3')], 5),
      bloco('mobilidade', [forca('a2le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('a2le-f1', 'e14', 5, 6, 8, 75, 1),
        forca('a2le-f2', 'e15', 3, 10, 12, 15, 0, { metodo: 'drop_set', notas: 'Leg Press: máquina, sem precisar trocar anilhas de barra livre' }),
        forca('a2le-f3', 'e79', 4, 15, 20, 45, 1),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N3 — Introduz Cluster Set, só no multiarticular pesado do dia.
  3: [
    sessao('avancado-3-sessao-push', 'Push', [
      bloco('preparacao', [cardioPrep('a3pu-p1', 'c1')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a3pu-f1', 'e1', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Multiarticular de força — micro-pausas intra-série viabilizam carga mais alta com boa técnica' }),
        forca('a3pu-f2', 'e49', 4, 10, 12, 45, 1),
        forca('a3pu-f3', 'e33', 3, 10, 12, 45, 1),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-3-sessao-pull', 'Pull', [
      bloco('preparacao', [cardioPrep('a3pl-p1', 'c6')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a3pl-f1', 'e11', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Multiarticular de força' }),
        forca('a3pl-f2', 'e8', 4, 8, 12, 45, 1),
        forca('a3pl-f3', 'e29', 3, 10, 12, 45, 1),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-3-sessao-legs', 'Legs', [
      bloco('preparacao', [cardioPrep('a3le-p1', 'c3')], 5),
      bloco('mobilidade', [forca('a3le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('a3le-f1', 'e14', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Multiarticular de força' }),
        forca('a3le-f2', 'e16', 4, 12, 15, 45, 1),
        forca('a3le-f3', 'e37', 3, 15, 20, 42, 1),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N4 — Introduz FST-7, só no grupamento priorizado do ciclo (Costas, no
  // Pull). Push/Legs seguem com Cluster Set (carryover), sem ganhar um
  // método novo cada — é isso que "especialização" quer dizer aqui.
  4: [
    sessao('avancado-4-sessao-push', 'Push', [
      bloco('preparacao', [cardioPrep('a4pu-p1', 'c1')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a4pu-f1', 'e1', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Carryover do N3 — dia sem especialização' }),
        forca('a4pu-f2', 'e49', 4, 10, 12, 42, 1),
        forca('a4pu-f3', 'e34', 3, 10, 12, 42, 1),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-4-sessao-pull', 'Pull', [
      bloco('preparacao', [cardioPrep('a4pl-p1', 'c6')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a4pl-f1', 'e11', 4, 6, 8, 75, 1),
        forca('a4pl-f2', 'e8', 4, 8, 12, 45, 1),
        forca('a4pl-f3', 'e57', 7, 12, 15, 30, 1, { metodo: 'fst7', notas: 'Isolamento do grupamento priorizado do ciclo (Costas) — bombeamento final' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-4-sessao-legs', 'Legs', [
      bloco('preparacao', [cardioPrep('a4le-p1', 'c3')], 5),
      bloco('mobilidade', [forca('a4le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('a4le-f1', 'e14', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Carryover do N3 — dia sem especialização' }),
        forca('a4le-f2', 'e16', 4, 12, 15, 42, 1),
        forca('a4le-f3', 'e37', 3, 15, 20, 42, 1),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N5 — Introduz GVT (10x10) no composto do grupamento priorizado
  // (Remada Curvada, Pull). FST-7 aparece nos outros dias, mostrando que
  // continua válido fora do ciclo de especialização, agora noutro grupamento.
  5: [
    sessao('avancado-5-sessao-push', 'Push', [
      bloco('preparacao', [cardioPrep('a5pu-p1', 'c1')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a5pu-f1', 'e1', 4, 8, 10, 60, 2),
        forca('a5pu-f2', 'e6', 7, 12, 15, 30, 1, { metodo: 'fst7', notas: 'FST-7 fora do grupamento priorizado — método consolidado, não exclusivo de um só grupo' }),
        forca('a5pu-f3', 'e33', 3, 10, 12, 42, 1),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-5-sessao-pull', 'Pull', [
      bloco('preparacao', [cardioPrep('a5pl-p1', 'c6')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a5pl-f1', 'e9', 10, 10, 10, 75, 2, { metodo: 'gvt', notas: 'GVT: carga submáxima fixa (~60% 1RM); RIR planejado a subir ao longo das 10 séries — grupamento priorizado do ciclo' }),
        forca('a5pl-f2', 'e8', 4, 8, 12, 45, 1),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-5-sessao-legs', 'Legs', [
      bloco('preparacao', [cardioPrep('a5le-p1', 'c3')], 5),
      bloco('mobilidade', [forca('a5le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('a5le-f1', 'e14', 4, 8, 10, 60, 2),
        forca('a5le-f2', 'e16', 7, 15, 20, 30, 1, { metodo: 'fst7', notas: 'FST-7 fora do grupamento priorizado' }),
        forca('a5le-f3', 'e37', 3, 15, 20, 42, 1),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N6 — Combina 2 métodos avançados por sessão, sempre em exercícios
  // diferentes: Cluster Set no composto pesado + 1 finisher isolado.
  6: [
    sessao('avancado-6-sessao-push', 'Push', [
      bloco('preparacao', [cardioPrep('a6pu-p1', 'c1')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a6pu-f1', 'e1', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Composto pesado' }),
        forca('a6pu-f2', 'e49', 3, 10, 12, 15, 0, { metodo: 'drop_set', notas: 'Isolamento, exercício diferente do Cluster Set' }),
        forca('a6pu-f3', 'e34', 3, 10, 12, 40, 1),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-6-sessao-pull', 'Pull', [
      bloco('preparacao', [cardioPrep('a6pl-p1', 'c6')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a6pl-f1', 'e11', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Composto pesado' }),
        forca('a6pl-f2', 'e57', 7, 12, 15, 30, 1, { metodo: 'fst7', notas: 'Isolamento do grupamento priorizado, exercício diferente do Cluster Set' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-6-sessao-legs', 'Legs', [
      bloco('preparacao', [cardioPrep('a6le-p1', 'c3')], 5),
      bloco('mobilidade', [forca('a6le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('a6le-f1', 'e14', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Composto pesado' }),
        forca('a6le-f2', 'e16', 3, 12, 15, 15, 0, { metodo: 'drop_set', notas: 'Isolamento, exercício diferente do Cluster Set' }),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N7 — Especialização plena com fadiga controlada: até 3 métodos por
  // sessão, mas cada um no exercício certo — Cluster Set sempre isolado no
  // único composto pesado do dia, os outros dois confinados a isolamentos
  // pequenos no fim. Nunca dois métodos no mesmo movimento.
  7: [
    sessao('avancado-7-sessao-push', 'Push', [
      bloco('preparacao', [cardioPrep('a7pu-p1', 'c1')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a7pu-f1', 'e1', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Único composto pesado da sessão' }),
        forca('a7pu-f2', 'e49', 3, 10, 12, 15, 0, { metodo: 'drop_set', notas: 'Isolamento' }),
        forca('a7pu-f3', 'e33', 1, 6, 8, 20, 0, { metodo: 'rest_pause', notas: 'Isolamento pequeno — fecha a sessão perto da falha absoluta' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-7-sessao-pull', 'Pull', [
      bloco('preparacao', [cardioPrep('a7pl-p1', 'c6')], 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('a7pl-f1', 'e11', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Único composto pesado da sessão' }),
        forca('a7pl-f2', 'e57', 7, 12, 15, 30, 1, { metodo: 'fst7', notas: 'Isolamento do grupamento priorizado do ciclo' }),
        forca('a7pl-f3', 'e29', 1, 6, 8, 20, 0, { metodo: 'rest_pause', notas: 'Isolamento pequeno — fecha a sessão' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('avancado-7-sessao-legs', 'Legs', [
      bloco('preparacao', [cardioPrep('a7le-p1', 'c3')], 5),
      bloco('mobilidade', [forca('a7le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('a7le-f1', 'e14', 4, 3, 5, 20, 1, { metodo: 'cluster_set', notas: 'Único composto pesado da sessão' }),
        forca('a7le-f2', 'e16', 3, 12, 15, 15, 0, { metodo: 'drop_set', notas: 'Isolamento' }),
        forca('a7le-f3', 'e37', 1, 10, 12, 20, 0, { metodo: 'rest_pause', notas: 'Isolamento pequeno — fecha a sessão' }),
      ]),
      bloco('cardio', []),
    ]),
  ],
};

/**
 * Aplica o conteúdo dos 7 níveis Avançado aos `TrainingModel`
 * correspondentes de um catálogo (clona as sessões — nunca compartilha
 * referência entre chamadas). Modelos de outras categorias passam
 * inalterados.
 */
export function aplicarSessoesAvancado(modelos: TrainingModel[]): TrainingModel[] {
  return modelos.map((modelo) => {
    if (modelo.categoria !== 'avancado') return modelo;
    const sessoes = SESSOES_AVANCADO[modelo.nivel];
    return { ...modelo, sessoes: JSON.parse(JSON.stringify(sessoes)) };
  });
}
