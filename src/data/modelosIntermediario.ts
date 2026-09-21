/**
 * Conteúdo dos 7 Modelos da categoria Intermediário (Ferramentas > Modelos).
 *
 * Evolui a organização da sessão em relação ao Iniciante (data/
 * modelosIniciante.ts): Full Body avançado (N1) → Upper/Lower (N2–N3) →
 * Push/Pull/Legs (N4–N7). Cada sessão mantém os 4 blocos fixos
 * (types/trainingModel.ts TrainingModelBloco) — Preparação continua
 * ~5min de referência em todas; Mobilidade aparece "quando aplicável"
 * (fica vazia nas sessões mais avançadas/especializadas de N6–N7, quando
 * a sessão já não pede mobilidade genérica). Só referencia exercícios
 * reais de data/defaultExercises.ts pelo `exId`.
 *
 * Métodos introduzidos progressivamente (nunca todos de uma vez, ver
 * data/trainingMethods.ts pras definições): N1 Bi-Set → N2 Pirâmide
 * crescente → N3 Tri-Set → N4 Superset → N5 Pirâmide decrescente +
 * Circuito → N6 Conjugado → N7 fecha combinando Bi-Set/Tri-Set/Superset/
 * Circuito na mesma sessão (conforme o bloco), sem introduzir método novo.
 * Agrupamentos usam `groupId`/`groupType` (GroupType de types/workout.ts:
 * 'biset'|'triset'|'supersets'|'circuito') — Pirâmide e Conjugado não têm
 * um GroupType próprio (não é uma sequência de exercícios diferentes sem
 * descanso); ficam representados via `metodo` + `notas` explicando a
 * estrutura (degraus da pirâmide; par força+complementar do conjugado).
 * O banco não tem exercício pliométrico dedicado, então o "complementar"
 * do Conjugado usa a opção "Técnico" do método (ver trainingMethods.ts),
 * não "Pliometria".
 *
 * Densidade cai em relação ao Iniciante e segue caindo dentro da própria
 * categoria (45s→60s no N1 caindo a 40s no N7, com descansos ainda mais
 * curtos dentro de agrupamentos/circuitos). Volume sobe pouco (4→5
 * séries); o grande salto de complexidade/variedade está na organização
 * da sessão e nos métodos, não no número de séries.
 *
 * `aplicarSessoesIntermediario` liga este conteúdo aos `TrainingModel` da
 * categoria intermediário (chamado por `criarCatalogoComProgressao`,
 * data/trainingProgression.ts). Não modifica Rotinas Salvas nem a rotina
 * do Cliente — TrainingModel continua uma entidade própria.
 */

import type { GroupType } from '../types/workout';
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

function cardioPrep(id: string, exId: string, duracaoMinutos: number, intensidade: string): TrainingModelEntradaCardio {
  return { id, exId, tipo: 'cardio', duracaoMinutos, intensidade };
}

function bloco(fase: TrainingModelFase, exercicios: TrainingModelBloco['exercicios'], duracaoEstimadaMinutos?: number): TrainingModelBloco {
  return { fase, duracaoEstimadaMinutos, exercicios };
}

function sessao(id: string, nome: string, tipo: string, blocos: TrainingModelBloco[]): TrainingModelSessao {
  return { id, nome, tipo, blocos };
}

const prep5 = (id: string, exId: string, intensidade = 'Moderada') => [cardioPrep(id, exId, 5, intensidade)];

const SESSOES_INTERMEDIARIO: Record<TrainingModelNivel, TrainingModelSessao[]> = {
  // N1 — Full Body avançado. Introduz Bi-Set (agonista/antagonista).
  1: [
    sessao('intermediario-1-sessao-1', 'Full Body Avançado', 'Full Body', [
      bloco('preparacao', prep5('m1-p1', 'c1'), 5),
      bloco('mobilidade', [forca('m1-m1', 'e88', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m1-f1', 'e1', 4, 8, 10, 0, 3, { metodo: 'biset', groupId: 'm1g1', groupType: 'biset', notas: 'Bi-Set agonista/antagonista com puxada frontal' }),
        forca('m1-f2', 'e8', 4, 8, 10, 60, 3, { metodo: 'biset', groupId: 'm1g1', groupType: 'biset' }),
        forca('m1-f3', 'e25', 3, 10, 12, 0, 2, { metodo: 'biset', groupId: 'm1g2', groupType: 'biset', notas: 'Bi-Set ombro/costas' }),
        forca('m1-f4', 'e56', 3, 10, 12, 60, 2, { metodo: 'biset', groupId: 'm1g2', groupType: 'biset' }),
        forca('m1-f5', 'e14', 4, 8, 12, 45, 3),
        forca('m1-f6', 'e63', 4, 8, 12, 45, 3),
        forca('m1-f7', 'e83', 3, 30, 40, 45, 2),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N2 — Primeira divisão Upper/Lower. Introduz Pirâmide crescente.
  2: [
    sessao('intermediario-2-sessao-upper', 'Upper', 'Upper/Lower', [
      bloco('preparacao', prep5('m2u-p1', 'c4'), 5),
      bloco('mobilidade', [forca('m2u-m1', 'e86', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m2u-f1', 'e1', 4, 6, 12, 60, 3, {
          metodo: 'piramide_crescente',
          notas: 'Pirâmide crescente: carga sobe e reps caem a cada série (ex.: 12→10→8→6)',
        }),
        forca('m2u-f2', 'e8', 4, 8, 12, 50, 3),
        forca('m2u-f3', 'e24', 3, 10, 12, 50, 2),
        forca('m2u-f4', 'e10', 3, 10, 12, 50, 2),
        forca('m2u-f5', 'e29', 3, 10, 12, 45, 2),
        forca('m2u-f6', 'e33', 3, 10, 12, 45, 2),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-2-sessao-lower', 'Lower', 'Upper/Lower', [
      bloco('preparacao', prep5('m2l-p1', 'c3'), 5),
      bloco('mobilidade', [forca('m2l-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m2l-f1', 'e14', 4, 6, 12, 75, 3, {
          metodo: 'piramide_crescente',
          notas: 'Pirâmide crescente: carga sobe e reps caem a cada série (ex.: 12→10→8→6)',
        }),
        forca('m2l-f2', 'e63', 4, 8, 12, 60, 3),
        forca('m2l-f3', 'e23', 3, 12, 15, 45, 2),
        forca('m2l-f4', 'e37', 3, 15, 20, 45, 2),
        forca('m2l-f5', 'e40', 3, 30, 40, 45, 2),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N3 — Aprofunda Upper/Lower. Introduz Tri-Set.
  3: [
    sessao('intermediario-3-sessao-upper', 'Upper', 'Upper/Lower', [
      bloco('preparacao', prep5('m3u-p1', 'c4'), 5),
      bloco('mobilidade', [forca('m3u-m1', 'e87', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m3u-f1', 'e2', 4, 8, 12, 0, 2, { metodo: 'triset', groupId: 'm3ug1', groupType: 'triset', notas: 'Tri-Set de peito (pré-exaustão)' }),
        forca('m3u-f2', 'e49', 4, 10, 12, 0, 2, { metodo: 'triset', groupId: 'm3ug1', groupType: 'triset' }),
        forca('m3u-f3', 'e7', 4, 12, 20, 60, 1, { metodo: 'triset', groupId: 'm3ug1', groupType: 'triset', notas: 'Até quase falha' }),
        forca('m3u-f4', 'e53', 4, 8, 12, 50, 2),
        forca('m3u-f5', 'e26', 3, 12, 15, 45, 2),
        forca('m3u-f6', 'e31', 3, 10, 12, 45, 2),
        forca('m3u-f7', 'e34', 3, 10, 12, 45, 2),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-3-sessao-lower', 'Lower', 'Upper/Lower', [
      bloco('preparacao', prep5('m3l-p1', 'c3'), 5),
      bloco('mobilidade', [forca('m3l-m1', 'e92', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m3l-f1', 'e15', 4, 10, 12, 0, 2, { metodo: 'triset', groupId: 'm3lg1', groupType: 'triset', notas: 'Tri-Set de quadríceps' }),
        forca('m3l-f2', 'e16', 4, 12, 15, 0, 2, { metodo: 'triset', groupId: 'm3lg1', groupType: 'triset' }),
        forca('m3l-f3', 'e18', 4, 10, 12, 60, 1, { metodo: 'triset', groupId: 'm3lg1', groupType: 'triset' }),
        forca('m3l-f4', 'e20', 4, 8, 12, 50, 2),
        forca('m3l-f5', 'e64', 3, 8, 10, 50, 2),
        forca('m3l-f6', 'e38', 3, 15, 20, 45, 2),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N4 — Split Push/Pull/Legs. Introduz Superset.
  4: [
    sessao('intermediario-4-sessao-push', 'Push', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m4pu-p1', 'c1'), 5),
      bloco('mobilidade', [forca('m4pu-m1', 'e86', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m4pu-f1', 'e1', 4, 8, 10, 0, 2, { metodo: 'superset', groupId: 'm4pug1', groupType: 'supersets' }),
        forca('m4pu-f2', 'e67', 4, 8, 10, 40, 1, { metodo: 'superset', groupId: 'm4pug1', groupType: 'supersets' }),
        forca('m4pu-f3', 'e48', 3, 10, 12, 40, 2),
        forca('m4pu-f4', 'e26', 3, 12, 15, 40, 2),
        forca('m4pu-f5', 'e33', 3, 10, 12, 40, 2),
        forca('m4pu-f6', 'e78', 3, 8, 12, 40, 2),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-4-sessao-pull', 'Pull', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m4pl-p1', 'c6'), 5),
      bloco('mobilidade', [forca('m4pl-m1', 'e87', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m4pl-f1', 'e8', 4, 8, 10, 0, 2, { metodo: 'superset', groupId: 'm4plg1', groupType: 'supersets' }),
        forca('m4pl-f2', 'e9', 4, 8, 10, 40, 1, { metodo: 'superset', groupId: 'm4plg1', groupType: 'supersets' }),
        forca('m4pl-f3', 'e54', 3, 10, 12, 40, 2),
        forca('m4pl-f4', 'e28', 3, 12, 15, 40, 2),
        forca('m4pl-f5', 'e29', 3, 10, 12, 40, 2),
        forca('m4pl-f6', 'e31', 3, 10, 12, 40, 2),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-4-sessao-legs', 'Legs', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m4le-p1', 'c3'), 5),
      bloco('mobilidade', [forca('m4le-m1', 'e90', 1, 6, 8, 25, 5)]),
      bloco('forca', [
        forca('m4le-f1', 'e14', 4, 8, 10, 0, 2, { metodo: 'superset', groupId: 'm4leg1', groupType: 'supersets' }),
        forca('m4le-f2', 'e23', 4, 12, 15, 40, 1, { metodo: 'superset', groupId: 'm4leg1', groupType: 'supersets' }),
        forca('m4le-f3', 'e63', 4, 8, 12, 45, 2),
        forca('m4le-f4', 'e18', 3, 10, 12, 40, 2),
        forca('m4le-f5', 'e79', 3, 15, 20, 40, 2),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N5 — Push/Pull/Legs. Introduz Pirâmide decrescente + Circuito.
  5: [
    sessao('intermediario-5-sessao-push', 'Push', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m5pu-p1', 'c1'), 5),
      bloco('mobilidade', [forca('m5pu-m1', 'e86', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m5pu-f1', 'e1', 4, 6, 12, 60, 2, {
          metodo: 'piramide_decrescente',
          notas: 'Pirâmide decrescente: carga cai e reps sobem a cada série (ex.: 6→8→10→12)',
        }),
        forca('m5pu-f2', 'e25', 4, 8, 12, 45, 2),
        forca('m5pu-f3', 'e5', 3, 12, 15, 15, 1, { metodo: 'circuito', groupId: 'm5pug2', groupType: 'circuito', notas: '3 voltas' }),
        forca('m5pu-f4', 'e26', 3, 12, 15, 15, 1, { metodo: 'circuito', groupId: 'm5pug2', groupType: 'circuito' }),
        forca('m5pu-f5', 'e33', 3, 10, 12, 90, 1, { metodo: 'circuito', groupId: 'm5pug2', groupType: 'circuito', notas: 'Descanso pleno entre voltas' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-5-sessao-pull', 'Pull', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m5pl-p1', 'c6'), 5),
      bloco('mobilidade', [forca('m5pl-m1', 'e87', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m5pl-f1', 'e8', 4, 6, 12, 60, 2, {
          metodo: 'piramide_decrescente',
          notas: 'Pirâmide decrescente: carga cai e reps sobem a cada série (ex.: 6→8→10→12)',
        }),
        forca('m5pl-f2', 'e10', 4, 8, 12, 45, 2),
        forca('m5pl-f3', 'e28', 3, 12, 15, 15, 1, { metodo: 'circuito', groupId: 'm5plg2', groupType: 'circuito', notas: '3 voltas' }),
        forca('m5pl-f4', 'e31', 3, 10, 12, 15, 1, { metodo: 'circuito', groupId: 'm5plg2', groupType: 'circuito' }),
        forca('m5pl-f5', 'e32', 3, 10, 12, 90, 1, { metodo: 'circuito', groupId: 'm5plg2', groupType: 'circuito' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-5-sessao-legs', 'Legs', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m5le-p1', 'c3'), 5),
      bloco('mobilidade', [forca('m5le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m5le-f1', 'e14', 4, 6, 12, 75, 2, {
          metodo: 'piramide_decrescente',
          notas: 'Pirâmide decrescente: carga cai e reps sobem a cada série (ex.: 6→8→10→12)',
        }),
        forca('m5le-f2', 'e20', 4, 8, 12, 50, 2),
        forca('m5le-f3', 'e23', 3, 12, 15, 15, 1, { metodo: 'circuito', groupId: 'm5leg2', groupType: 'circuito', notas: '3 voltas' }),
        forca('m5le-f4', 'e37', 3, 15, 20, 15, 1, { metodo: 'circuito', groupId: 'm5leg2', groupType: 'circuito' }),
        forca('m5le-f5', 'e39', 3, 15, 20, 90, 1, { metodo: 'circuito', groupId: 'm5leg2', groupType: 'circuito' }),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N6 — Push/Pull/Legs. Introduz Conjugado (força + complementar técnico —
  // o banco não tem exercício pliométrico dedicado, ver cabeçalho do arquivo).
  // Mobilidade "quando aplicável": fica vazia em Push/Pull (sessões mais
  // especializadas), continua presente em Legs (relevante antes do agachamento).
  6: [
    sessao('intermediario-6-sessao-push', 'Push', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m6pu-p1', 'c1'), 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('m6pu-f1', 'e1', 5, 6, 8, 90, 1, { metodo: 'conjugado', groupId: 'm6pug1', notas: 'Conjugado: força principal' }),
        forca('m6pu-f2', 'e7', 3, 8, 12, 60, 2, { metodo: 'conjugado', groupId: 'm6pug1', notas: 'Complementar técnico (tempo rápido na subida)' }),
        forca('m6pu-f3', 'e24', 4, 8, 12, 42, 2),
        forca('m6pu-f4', 'e5', 4, 10, 12, 42, 2, { notas: 'Isometria de 2s no pico de contração' }),
        forca('m6pu-f5', 'e34', 4, 10, 12, 42, 2),
        forca('m6pu-f6', 'e78', 3, 8, 12, 42, 2, { notas: 'Fase excêntrica controlada de 3s' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-6-sessao-pull', 'Pull', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m6pl-p1', 'c6'), 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('m6pl-f1', 'e8', 5, 6, 8, 90, 1, { metodo: 'conjugado', groupId: 'm6plg1', notas: 'Conjugado: força principal' }),
        forca('m6pl-f2', 'e10', 3, 10, 12, 60, 2, { metodo: 'conjugado', groupId: 'm6plg1', notas: 'Complementar técnico unilateral' }),
        forca('m6pl-f3', 'e54', 4, 8, 12, 42, 2),
        forca('m6pl-f4', 'e28', 4, 12, 15, 42, 2, { notas: 'Isometria de 2s' }),
        forca('m6pl-f5', 'e71', 4, 10, 12, 42, 2),
        forca('m6pl-f6', 'e74', 3, 21, 21, 42, 2),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-6-sessao-legs', 'Legs', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m6le-p1', 'c3'), 5),
      bloco('mobilidade', [forca('m6le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m6le-f1', 'e14', 5, 6, 8, 90, 1, { metodo: 'conjugado', groupId: 'm6leg1', notas: 'Conjugado: força principal' }),
        forca('m6le-f2', 'e18', 3, 10, 12, 60, 2, { metodo: 'conjugado', groupId: 'm6leg1', notas: 'Complementar técnico unilateral' }),
        forca('m6le-f3', 'e63', 4, 8, 12, 42, 2),
        forca('m6le-f4', 'e17', 4, 10, 12, 42, 2, { notas: 'Fase excêntrica controlada de 3s' }),
        forca('m6le-f5', 'e79', 3, 15, 20, 42, 2),
      ]),
      bloco('cardio', []),
    ]),
  ],

  // N7 — Push/Pull/Legs. Fecha o ciclo combinando Bi-Set/Tri-Set/Superset/
  // Circuito na mesma sessão (conforme o bloco) — nenhum método novo.
  7: [
    sessao('intermediario-7-sessao-push', 'Push', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m7pu-p1', 'c1'), 5),
      bloco('mobilidade', []),
      bloco('forca', [
        forca('m7pu-f1', 'e1', 5, 6, 8, 0, 1, { metodo: 'biset', groupId: 'm7pug1', groupType: 'biset' }),
        forca('m7pu-f2', 'e48', 5, 10, 12, 40, 2, { metodo: 'biset', groupId: 'm7pug1', groupType: 'biset' }),
        forca('m7pu-f3', 'e67', 5, 6, 8, 0, 1, { metodo: 'superset', groupId: 'm7pug2', groupType: 'supersets' }),
        forca('m7pu-f4', 'e26', 5, 12, 15, 40, 2, { metodo: 'superset', groupId: 'm7pug2', groupType: 'supersets' }),
        forca('m7pu-f5', 'e33', 3, 10, 12, 15, 1, { metodo: 'circuito', groupId: 'm7pug3', groupType: 'circuito', notas: '3 voltas' }),
        forca('m7pu-f6', 'e78', 3, 8, 12, 15, 1, { metodo: 'circuito', groupId: 'm7pug3', groupType: 'circuito' }),
        forca('m7pu-f7', 'e51', 3, 8, 12, 90, 1, { metodo: 'circuito', groupId: 'm7pug3', groupType: 'circuito' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-7-sessao-pull', 'Pull', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m7pl-p1', 'c6'), 5),
      bloco('mobilidade', [forca('m7pl-m1', 'e87', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m7pl-f1', 'e8', 5, 6, 8, 0, 1, { metodo: 'triset', groupId: 'm7plg1', groupType: 'triset' }),
        forca('m7pl-f2', 'e9', 5, 8, 10, 0, 1, { metodo: 'triset', groupId: 'm7plg1', groupType: 'triset' }),
        forca('m7pl-f3', 'e28', 5, 12, 15, 60, 2, { metodo: 'triset', groupId: 'm7plg1', groupType: 'triset' }),
        forca('m7pl-f4', 'e54', 5, 8, 10, 0, 1, { metodo: 'superset', groupId: 'm7plg2', groupType: 'supersets' }),
        forca('m7pl-f5', 'e53', 5, 10, 12, 40, 2, { metodo: 'superset', groupId: 'm7plg2', groupType: 'supersets' }),
        forca('m7pl-f6', 'e29', 3, 10, 12, 15, 1, { metodo: 'circuito', groupId: 'm7plg3', groupType: 'circuito', notas: '3 voltas' }),
        forca('m7pl-f7', 'e31', 3, 10, 12, 15, 1, { metodo: 'circuito', groupId: 'm7plg3', groupType: 'circuito' }),
        forca('m7pl-f8', 'e73', 3, 10, 12, 90, 1, { metodo: 'circuito', groupId: 'm7plg3', groupType: 'circuito' }),
      ]),
      bloco('cardio', []),
    ]),
    sessao('intermediario-7-sessao-legs', 'Legs', 'Push/Pull/Legs', [
      bloco('preparacao', prep5('m7le-p1', 'c3'), 5),
      bloco('mobilidade', [forca('m7le-m1', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('m7le-f1', 'e14', 5, 6, 8, 0, 1, { metodo: 'biset', groupId: 'm7leg1', groupType: 'biset' }),
        forca('m7le-f2', 'e23', 5, 12, 15, 40, 2, { metodo: 'biset', groupId: 'm7leg1', groupType: 'biset' }),
        forca('m7le-f3', 'e63', 5, 8, 10, 0, 1, { metodo: 'superset', groupId: 'm7leg2', groupType: 'supersets' }),
        forca('m7le-f4', 'e64', 5, 8, 10, 40, 2, { metodo: 'superset', groupId: 'm7leg2', groupType: 'supersets' }),
        forca('m7le-f5', 'e37', 3, 15, 20, 15, 1, { metodo: 'circuito', groupId: 'm7leg3', groupType: 'circuito', notas: '3 voltas' }),
        forca('m7le-f6', 'e79', 3, 15, 20, 15, 1, { metodo: 'circuito', groupId: 'm7leg3', groupType: 'circuito' }),
        forca('m7le-f7', 'e83', 3, 30, 40, 90, 1, { metodo: 'circuito', groupId: 'm7leg3', groupType: 'circuito' }),
      ]),
      bloco('cardio', []),
    ]),
  ],
};

/**
 * Aplica o conteúdo dos 7 níveis Intermediário aos `TrainingModel`
 * correspondentes de um catálogo (clona as sessões — nunca compartilha
 * referência entre chamadas). Modelos de outras categorias passam
 * inalterados.
 */
export function aplicarSessoesIntermediario(modelos: TrainingModel[]): TrainingModel[] {
  return modelos.map((modelo) => {
    if (modelo.categoria !== 'intermediario') return modelo;
    const sessoes = SESSOES_INTERMEDIARIO[modelo.nivel];
    return { ...modelo, sessoes: JSON.parse(JSON.stringify(sessoes)) };
  });
}
