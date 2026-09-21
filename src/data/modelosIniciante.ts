/**
 * Conteúdo dos 7 Modelos da categoria Iniciante (Ferramentas > Modelos).
 *
 * Cada nível é 1 sessão Full Body, estruturada nos 4 blocos fixos
 * (Preparação ~5min → Mobilidade → Força/Musculação → Cardio, ver
 * types/trainingModel.ts TrainingModelBloco/TRAINING_MODEL_FASES). Só
 * referencia exercícios já existentes em data/defaultExercises.ts pelo
 * `exId` — nenhum exercício novo foi criado aqui.
 *
 * Progressão gradual (não "mais séries = nível maior"):
 * - Volume quase não se move: 2 séries (N1) → 3 (N2–N3) → 4 (N4–N7).
 * - Intensidade (RIR): 4 (N1–N2) → 3 (N3–N4) → 2–3 (N5) → 2 (N6–N7).
 * - Densidade (descanso): 90s (N1) caindo até 40s (N7).
 * - Complexidade/seleção: máquina e peso corporal guiados (N1) →
 *   halteres livres e hip-hinge (N2) → variações de pegada/ângulo com
 *   barra livre (N3) → combina padrões / avanço unilateral (N4) → cobre
 *   os 5 padrões fundamentais numa sessão só (N5, ver comentário no
 *   nível) → unilateral com menor base de apoio (N6) → repertório
 *   completo com RIR mais baixo, fechando o ciclo iniciante (N7).
 * - Preparação cardio segue data/preparacaoCardio.ts (Esteira para
 *   preparação geral, Bike para predominância de membros inferiores,
 *   Elíptico para maior participação de membros superiores).
 * - Método sempre `series_tradicionais` — nenhum agrupamento (Bi-Set/
 *   Superset/etc.) nem método avançado é usado no Iniciante, por regra.
 * - Nenhuma sessão usa cardio dedicado além da preparação: o bloco de
 *   fase `cardio` fica presente, mas vazio, nos 7 níveis ("quando
 *   aplicável" — aqui não é).
 *
 * `aplicarSessoesIniciante` é o que efetivamente liga este conteúdo aos
 * `TrainingModel` da categoria iniciante (chamado por
 * `criarCatalogoComProgressao`, data/trainingProgression.ts) — os modelos
 * ficam prontos pra servir de base ao "Copiar para Cliente" (conversão em
 * si é etapa futura). Intermediário e Avançado continuam com `sessoes`
 * vazio, sem conteúdo ainda.
 */

import type {
  TrainingModel,
  TrainingModelBloco,
  TrainingModelEntradaCardio,
  TrainingModelEntradaForca,
  TrainingModelFase,
  TrainingModelNivel,
  TrainingModelSessao,
} from '../types/trainingModel';

function forca(
  id: string,
  exId: string,
  series: number,
  repsMin: number,
  repsMax: number,
  descansoSegundos: number,
  rir: number
): TrainingModelEntradaForca {
  return { id, exId, series, repsMin, repsMax, descansoSegundos, rir, metodo: 'series_tradicionais' };
}

function cardioPrep(id: string, exId: string, duracaoMinutos: number, intensidade: string): TrainingModelEntradaCardio {
  return { id, exId, tipo: 'cardio', duracaoMinutos, intensidade };
}

function bloco(fase: TrainingModelFase, exercicios: TrainingModelBloco['exercicios'], duracaoEstimadaMinutos?: number): TrainingModelBloco {
  return { fase, duracaoEstimadaMinutos, exercicios };
}

function sessao(nivel: TrainingModelNivel, nome: string, blocos: TrainingModelBloco[]): TrainingModelSessao {
  return { id: `iniciante-${nivel}-sessao-1`, nome, tipo: 'Full Body', blocos };
}

const SESSOES_INICIANTE: Record<TrainingModelNivel, TrainingModelSessao[]> = {
  1: [
    sessao(1, 'Full Body A — Familiarização', [
      bloco('preparacao', [cardioPrep('i1-p1', 'c2', 5, 'Leve')], 5),
      bloco('mobilidade', [forca('i1-m1', 'e88', 1, 8, 10, 20, 5), forca('i1-m2', 'e86', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('i1-f1', 'e15', 2, 12, 15, 90, 4), // Leg Press 45° — agachar
        forca('i1-f2', 'e13', 2, 12, 15, 90, 4), // Remada Máquina — puxar
        forca('i1-f3', 'e50', 2, 12, 15, 90, 4), // Supino Máquina — empurrar
        forca('i1-f4', 'e23', 2, 12, 15, 90, 4), // Cadeira Abdutora — quadril/glúteo
        forca('i1-f5', 'e39', 2, 12, 15, 90, 4), // Abdominal Crunch — core
      ]),
      bloco('cardio', []),
    ]),
  ],
  2: [
    sessao(2, 'Full Body B — Consolidação técnica', [
      bloco('preparacao', [cardioPrep('i2-p1', 'c2', 5, 'Leve')], 5),
      bloco('mobilidade', [forca('i2-m1', 'e88', 1, 8, 10, 20, 5), forca('i2-m2', 'e89', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('i2-f1', 'e15', 3, 10, 15, 75, 4), // Leg Press 45° — agachar
        forca('i2-f2', 'e8', 3, 10, 15, 75, 4), // Puxada Frontal — puxar
        forca('i2-f3', 'e2', 3, 10, 15, 75, 4), // Supino Inclinado com Halteres — empurrar (1º halter livre)
        forca('i2-f4', 'e20', 3, 10, 12, 75, 4), // Stiff — dobradiça (novo padrão)
        forca('i2-f5', 'e26', 3, 12, 15, 75, 4), // Elevação Lateral — ombro
        forca('i2-f6', 'e40', 2, 20, 30, 60, 4), // Prancha Isométrica (seg) — core
      ]),
      bloco('cardio', []),
    ]),
  ],
  3: [
    sessao(3, 'Full Body C — Repertório motor e cadência', [
      bloco('preparacao', [cardioPrep('i3-p1', 'c1', 5, 'Leve')], 5),
      bloco('mobilidade', [forca('i3-m1', 'e87', 1, 8, 10, 20, 5), forca('i3-m2', 'e92', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('i3-f1', 'e14', 3, 10, 12, 60, 3), // Agachamento Livre — agachar (evolui do leg press)
        forca('i3-f2', 'e10', 3, 10, 12, 60, 3), // Remada Unilateral — puxar (variação unilateral)
        forca('i3-f3', 'e1', 3, 8, 12, 60, 3), // Supino Reto com Barra — empurrar (nova pegada/ângulo)
        forca('i3-f4', 'e20', 3, 10, 12, 60, 3), // Stiff — dobradiça
        forca('i3-f5', 'e26', 3, 12, 15, 60, 3), // Elevação Lateral — ombro
        forca('i3-f6', 'e42', 3, 12, 15, 60, 3), // Abdominal Infra — core
      ]),
      bloco('cardio', []),
    ]),
  ],
  4: [
    sessao(4, 'Full Body D — Autonomia e progressão de carga', [
      bloco('preparacao', [cardioPrep('i4-p1', 'c3', 5, 'Leve')], 5),
      bloco('mobilidade', [forca('i4-m1', 'e90', 1, 6, 8, 25, 5), forca('i4-m2', 'e91', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('i4-f1', 'e14', 3, 8, 12, 50, 3), // Agachamento Livre — agachar
        forca('i4-f2', 'e8', 3, 8, 12, 50, 3), // Puxada Frontal — puxar
        forca('i4-f3', 'e2', 3, 8, 12, 50, 3), // Supino Inclinado com Halteres — empurrar
        forca('i4-f4', 'e18', 3, 10, 12, 50, 3), // Avanço (Lunge) — combina agachar + equilíbrio unilateral
        forca('i4-f5', 'e63', 3, 8, 12, 50, 3), // Levantamento Terra Romeno — dobradiça (evolui do Stiff)
        forca('i4-f6', 'e83', 3, 20, 30, 50, 3), // Prancha Lateral (seg) — core rotacional
      ]),
      bloco('cardio', []),
    ]),
  ],
  5: [
    // Sessão organizada pra cobrir os 5 padrões fundamentais numa sessão só:
    // agachar (e14), puxar (e8), empurrar (e1), dobradiça (e63), carregar/unilateral (e18).
    sessao(5, 'Full Body E — Os 5 padrões fundamentais', [
      bloco('preparacao', [cardioPrep('i5-p1', 'c4', 5, 'Moderada')], 5),
      bloco('mobilidade', [forca('i5-m1', 'e89', 1, 8, 10, 20, 5), forca('i5-m2', 'e87', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('i5-f1', 'e14', 4, 8, 12, 45, 3), // agachar
        forca('i5-f2', 'e8', 4, 8, 12, 45, 3), // puxar
        forca('i5-f3', 'e1', 4, 8, 12, 45, 3), // empurrar
        forca('i5-f4', 'e63', 4, 8, 12, 45, 3), // dobradiça
        forca('i5-f5', 'e18', 4, 10, 12, 45, 3), // carregar/unilateral
        forca('i5-f6', 'e40', 3, 30, 40, 40, 3), // Prancha Isométrica (seg) — core/estabilidade
      ]),
      bloco('cardio', []),
    ]),
  ],
  6: [
    sessao(6, 'Full Body F — Variedade de estímulo', [
      bloco('preparacao', [cardioPrep('i6-p1', 'c1', 5, 'Moderada')], 5),
      bloco('mobilidade', [forca('i6-m1', 'e90', 1, 6, 8, 25, 5), forca('i6-m2', 'e92', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('i6-f1', 'e60', 4, 8, 12, 42, 2), // Agachamento Búlgaro — unilateral (novo: instabilidade)
        forca('i6-f2', 'e10', 4, 8, 12, 42, 2), // Remada Unilateral — puxar
        forca('i6-f3', 'e2', 4, 8, 12, 42, 2), // Supino Inclinado com Halteres — empurrar (halteres = + instabilidade que barra)
        forca('i6-f4', 'e63', 4, 8, 12, 42, 2), // Levantamento Terra Romeno — dobradiça
        forca('i6-f5', 'e61', 4, 10, 12, 42, 2), // Step Up com Halteres — carregar/unilateral novo
        forca('i6-f6', 'e83', 3, 25, 35, 40, 2), // Prancha Lateral (seg) — core
      ]),
      bloco('cardio', []),
    ]),
  ],
  7: [
    sessao(7, 'Full Body G — Fechamento do ciclo iniciante', [
      bloco('preparacao', [cardioPrep('i7-p1', 'c1', 5, 'Moderada')], 5),
      bloco('mobilidade', [forca('i7-m1', 'e88', 1, 8, 10, 20, 5), forca('i7-m2', 'e91', 1, 8, 10, 20, 5)]),
      bloco('forca', [
        forca('i7-f1', 'e60', 4, 8, 12, 40, 2), // Agachamento Búlgaro — agachar unilateral
        forca('i7-f2', 'e8', 4, 8, 12, 40, 2), // Puxada Frontal — puxar
        forca('i7-f3', 'e1', 4, 8, 12, 40, 2), // Supino Reto com Barra — empurrar
        forca('i7-f4', 'e63', 4, 8, 12, 40, 2), // Levantamento Terra Romeno — dobradiça
        forca('i7-f5', 'e61', 4, 10, 12, 40, 2), // Step Up com Halteres — carregar/unilateral
        forca('i7-f6', 'e41', 3, 15, 20, 40, 2), // Russian Twist — core rotacional (fecha com variedade)
      ]),
      bloco('cardio', []),
    ]),
  ],
};

/**
 * Aplica o conteúdo dos 7 níveis Iniciante aos `TrainingModel`
 * correspondentes de um catálogo (clona as sessões — nunca compartilha
 * referência entre chamadas). Modelos de outras categorias passam
 * inalterados.
 */
export function aplicarSessoesIniciante(modelos: TrainingModel[]): TrainingModel[] {
  return modelos.map((modelo) => {
    if (modelo.categoria !== 'iniciante') return modelo;
    const sessoes = SESSOES_INICIANTE[modelo.nivel];
    return { ...modelo, sessoes: JSON.parse(JSON.stringify(sessoes)) };
  });
}
