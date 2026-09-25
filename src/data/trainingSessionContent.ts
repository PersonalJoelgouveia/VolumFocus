/**
 * Conteúdo real de Preparação/Mobilidade/Força dos Modelos (Ferramentas >
 * Modelos), organizado por FOCO da sessão (data/frequenciaSemanal.ts) — não
 * mais por divisão fixa (Full Body/Upper-Lower/PPL) como nos arquivos
 * legados (data/modelosIniciante.ts, modelosIntermediario.ts,
 * modelosAvancado.ts, hoje intocados e fora de uso, ver comentário em
 * data/trainingProgression.ts). Cobre os 8 focos distintos das 5
 * combinações de frequência (2x/3x/4x-masculina/4x-feminina/5x): Full
 * Body, Superiores, Inferiores, "Dorsais + Deltoide Lateral + Bíceps",
 * "Peitorais + Deltoide Anterior + Tríceps", Quadríceps, "Posteriores de
 * Coxa + Glúteos" e "Superiores Completo".
 *
 * Só referencia exercícios reais de data/defaultExercises.ts pelo `exId` —
 * nenhum exercício novo foi criado. O bloco de Cardio continua vindo de
 * `gerarSessoesComCardioSemanal` (data/cardioSemanal.ts), inalterado; este
 * arquivo só acrescenta Preparação/Mobilidade/Força em cima do resultado
 * dela (ver `gerarSessoesCompletas`, usada por useModeloStore).
 *
 * Progressão (types/trainingModel.ts, data/trainingProgression.ts): dentro
 * de uma categoria a seleção de exercícios de um foco fica estável entre
 * os 7 níveis — quem progride é volume/intensidade/densidade/
 * complexidade/método (séries, RIR, descanso, agrupamentos), nunca "mais
 * séries = nível maior" isolado.
 * - Iniciante: nunca usa agrupamento/método avançado (sempre
 *   `series_tradicionais`); complexidade sobe via nº de padrões de
 *   movimento combinados (3 compostos no N1 → todos os compostos do foco
 *   a partir do N2).
 * - Intermediário: introduz Bi-Set → Pirâmide crescente → Tri-Set →
 *   Superset → Pirâmide decrescente+Circuito → Conjugado → combinação
 *   final (N1→N7), mesmo cronograma de data/modelosIntermediario.ts,
 *   generalizado por foco via posição no "pool" de exercícios.
 * - Avançado: introduz Rest-Pause → Drop Set → Cluster Set → FST-7 → GVT →
 *   combinação de 2 → combinação de 3 (mesmo cronograma de
 *   data/modelosAvancado.ts), sempre no tipo de exercício certo (Drop Set
 *   só máquina/cabo, Cluster Set só composto pesado, FST-7/GVT só no(s)
 *   foco(s) especializado(s) do dia — `prioridade`/`GVT_FOCO` abaixo).
 *
 * Cobertura muscular (abdômen + extensores da coluna) garantida em toda
 * sessão via `nucleoAbdomen`/`nucleoLombar` de cada foco — alternados por
 * paridade do nível pra que os dois apareçam ao longo do ciclo 1–7 sem
 * inflar a duração da sessão (~45–60min de musculação, sem cardio).
 */

import type {
  TrainingModelCategoria,
  TrainingModelEntradaCardio,
  TrainingModelEntradaForca,
  TrainingModelMetodo,
  TrainingModelNivel,
  TrainingModelSessao,
} from '../types/trainingModel';
import type { GroupType } from '../types/workout';
import type { EsqueletoFrequencia } from './frequenciaSemanal';
import { gerarSessoesComCardioSemanal, focoCardioDaSessao } from './cardioSemanal';
import { PREPARACAO_CARDIO_SUGERIDO } from './preparacaoCardio';

// ─────────────────────────────────────────────────────────────────────────
// Biblioteca de exercícios por foco
// ─────────────────────────────────────────────────────────────────────────

interface FocoExercicios {
  /** 2–4 multiarticulares — o [0] é o principal (recebe Cluster Set/GVT/pirâmide). */
  compostos: string[];
  /** Isolamento prioritário — candidato a FST-7 quando `prioridade`. */
  isolA: string;
  /** Isolamento em máquina/cabo — candidato a Drop Set (nunca em barra livre). */
  isolB: string;
  /** Isolamento/acessório extra — candidato a Rest-Pause (isolamento pequeno). */
  isolC: string;
  /** Abdômen — usado em níveis ímpares (ou sempre, junto de `nucleoLombar`, nos níveis mais complexos). */
  nucleoAbdomen: string;
  /** Extensores da coluna — usado em níveis pares. */
  nucleoLombar: string;
  mobilidade: [string, string];
  /** Foco "especializado" do ciclo — recebe FST-7 no N4 (Avançado) em vez do carryover de Cluster Set. */
  prioridade?: boolean;
}

/** Único foco que recebe GVT (10x10) no N5 Avançado — os demais focos especializados recebem FST-7 nesse nível (ver cabeçalho). */
const GVT_FOCO = 'Dorsais + Deltoide Lateral + Bíceps';

const FOCO_LIBRARY: Record<string, FocoExercicios[]> = {
  'Full Body': [
    {
      compostos: ['e14', 'e8', 'e1', 'e20'],
      isolA: 'e26',
      isolB: 'e33',
      isolC: 'e29',
      nucleoAbdomen: 'e39',
      nucleoLombar: 'e44',
      mobilidade: ['e88', 'e89'],
    },
    {
      compostos: ['e15', 'e9', 'e2', 'e63'],
      isolA: 'e70',
      isolB: 'e36',
      isolC: 'e31',
      nucleoAbdomen: 'e41',
      nucleoLombar: 'e84',
      mobilidade: ['e86', 'e91'],
    },
  ],
  Superiores: [
    {
      compostos: ['e1', 'e9'],
      isolA: 'e26',
      isolB: 'e36',
      isolC: 'e29',
      nucleoAbdomen: 'e39',
      nucleoLombar: 'e40',
      mobilidade: ['e86', 'e87'],
    },
  ],
  Inferiores: [
    {
      compostos: ['e14', 'e15', 'e20'],
      isolA: 'e19',
      isolB: 'e16',
      isolC: 'e37',
      nucleoAbdomen: 'e42',
      nucleoLombar: 'e46',
      mobilidade: ['e89', 'e92'],
    },
    {
      compostos: ['e59', 'e17', 'e63'],
      isolA: 'e22',
      isolB: 'e79',
      isolC: 'e23',
      nucleoAbdomen: 'e81',
      nucleoLombar: 'e84',
      mobilidade: ['e90', 'e91'],
    },
  ],
  'Dorsais + Deltoide Lateral + Bíceps': [
    {
      compostos: ['e9', 'e8'],
      isolA: 'e57',
      isolB: 'e53',
      isolC: 'e29',
      nucleoAbdomen: 'e39',
      nucleoLombar: 'e40',
      mobilidade: ['e87', 'e86'],
      prioridade: true,
    },
  ],
  'Peitorais + Deltoide Anterior + Tríceps': [
    {
      compostos: ['e1', 'e67'],
      isolA: 'e4',
      isolB: 'e49',
      isolC: 'e33',
      nucleoAbdomen: 'e41',
      nucleoLombar: 'e44',
      mobilidade: ['e86', 'e87'],
      prioridade: true,
    },
  ],
  Quadríceps: [
    {
      compostos: ['e14', 'e59'],
      isolA: 'e16',
      isolB: 'e15',
      isolC: 'e61',
      nucleoAbdomen: 'e42',
      nucleoLombar: 'e44',
      mobilidade: ['e90', 'e89'],
      prioridade: true,
    },
  ],
  'Posteriores de Coxa + Glúteos': [
    {
      compostos: ['e63', 'e21'],
      isolA: 'e19',
      isolB: 'e65',
      isolC: 'e23',
      nucleoAbdomen: 'e41',
      nucleoLombar: 'e46',
      mobilidade: ['e89', 'e91'],
      prioridade: true,
    },
  ],
  'Superiores Completo': [
    {
      compostos: ['e1', 'e9', 'e67'],
      isolA: 'e26',
      isolB: 'e36',
      isolC: 'e29',
      nucleoAbdomen: 'e39',
      nucleoLombar: 'e40',
      mobilidade: ['e86', 'e87'],
    },
  ],
};

function getFocoExercicios(foco: string, ocorrencia: number): FocoExercicios {
  const variantes = FOCO_LIBRARY[foco] ?? FOCO_LIBRARY['Full Body'];
  return variantes[ocorrencia % variantes.length];
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers comuns
// ─────────────────────────────────────────────────────────────────────────

const PRANCHAS = new Set(['e40', 'e83']);

function classificarSlot(fx: FocoExercicios, exId: string): 'composto' | 'isolamento' | 'nucleo' {
  if (fx.compostos.includes(exId)) return 'composto';
  if (exId === fx.nucleoAbdomen || exId === fx.nucleoLombar) return 'nucleo';
  return 'isolamento';
}

/** Séries tradicionais: reps por tipo de slot — pranchas (e40/e83) usam a faixa como segundos, não repetições. */
function repsPara(exId: string, tipo: 'composto' | 'isolamento' | 'nucleo'): [number, number] {
  if (PRANCHAS.has(exId)) return [30, 40];
  if (tipo === 'composto') return [8, 12];
  if (tipo === 'nucleo') return [12, 20];
  return [12, 15];
}

function montarMobilidade(fx: FocoExercicios, prefix: string): TrainingModelEntradaForca[] {
  return fx.mobilidade.map((exId, i) => ({
    id: `${prefix}-mob${i + 1}`,
    exId,
    series: 1,
    repsMin: 8,
    repsMax: 10,
    descansoSegundos: 20,
    rir: 5,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Iniciante — sempre séries tradicionais, sem agrupamento/método avançado
// ─────────────────────────────────────────────────────────────────────────

const INICIANTE_COUNT: Record<TrainingModelNivel, number> = { 1: 5, 2: 6, 3: 6, 4: 7, 5: 7, 6: 8, 7: 8 };
const INICIANTE_SERIES: Record<TrainingModelNivel, number> = { 1: 2, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4 };
const INICIANTE_RIR: Record<TrainingModelNivel, number> = { 1: 5, 2: 4, 3: 4, 4: 3, 5: 3, 6: 2, 7: 2 };
const INICIANTE_REST: Record<TrainingModelNivel, number> = { 1: 90, 2: 75, 3: 60, 4: 50, 5: 45, 6: 42, 7: 40 };

function buildPoolIniciante(fx: FocoExercicios, nivel: TrainingModelNivel): string[] {
  // N1: só os 3 primeiros compostos (complexidade reduzida — 1 padrão de movimento por vez);
  // a partir do N2, todos os compostos do foco entram (combina mais padrões na mesma sessão).
  const compostos = nivel === 1 ? fx.compostos.slice(0, Math.min(3, fx.compostos.length)) : fx.compostos;
  return [...compostos, fx.isolA, fx.nucleoAbdomen, fx.isolC, fx.nucleoLombar];
}

function montarForcaIniciante(fx: FocoExercicios, nivel: TrainingModelNivel, prefix: string): TrainingModelEntradaForca[] {
  const pool = buildPoolIniciante(fx, nivel).slice(0, INICIANTE_COUNT[nivel]);
  const series = INICIANTE_SERIES[nivel];
  const rir = INICIANTE_RIR[nivel];
  const descanso = INICIANTE_REST[nivel];
  return pool.map((exId, i) => {
    const [repsMin, repsMax] = repsPara(exId, classificarSlot(fx, exId));
    return {
      id: `${prefix}-f${i + 1}`,
      exId,
      series,
      repsMin,
      repsMax,
      descansoSegundos: descanso,
      rir,
      metodo: 'series_tradicionais' as TrainingModelMetodo,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Intermediário — introduz agrupamentos/pirâmides progressivamente
// ─────────────────────────────────────────────────────────────────────────

const INTER_COUNT_FULLBODY: Record<TrainingModelNivel, number> = { 1: 7, 2: 7, 3: 8, 4: 8, 5: 8, 6: 9, 7: 9 };
const INTER_COUNT_SPLIT: Record<TrainingModelNivel, number> = { 1: 5, 2: 5, 3: 6, 4: 6, 5: 6, 6: 7, 7: 7 };
const INTER_SERIES: Record<TrainingModelNivel, number> = { 1: 4, 2: 4, 3: 4, 4: 4, 5: 5, 6: 5, 7: 5 };
const INTER_RIR: Record<TrainingModelNivel, number> = { 1: 3, 2: 3, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1 };
const INTER_REST: Record<TrainingModelNivel, number> = { 1: 50, 2: 50, 3: 45, 4: 40, 5: 40, 6: 35, 7: 30 };

function buildPoolIntermediario(fx: FocoExercicios): string[] {
  return [...fx.compostos, fx.isolA, fx.nucleoAbdomen, fx.isolB, fx.isolC, fx.nucleoLombar];
}

function montarForcaIntermediario(fx: FocoExercicios, nivel: TrainingModelNivel, foco: string, prefix: string): TrainingModelEntradaForca[] {
  const count = foco === 'Full Body' ? INTER_COUNT_FULLBODY[nivel] : INTER_COUNT_SPLIT[nivel];
  const pool = buildPoolIntermediario(fx).slice(0, count);
  const series = INTER_SERIES[nivel];
  const rir = INTER_RIR[nivel];
  const rest = INTER_REST[nivel];

  function trad(idx: number, overrides: Partial<TrainingModelEntradaForca> = {}): TrainingModelEntradaForca {
    const exId = pool[idx];
    const [repsMin, repsMax] = repsPara(exId, classificarSlot(fx, exId));
    return {
      id: `${prefix}-f${idx + 1}`,
      exId,
      series,
      repsMin,
      repsMax,
      descansoSegundos: rest,
      rir,
      metodo: 'series_tradicionais',
      ...overrides,
    };
  }

  const entradas: TrainingModelEntradaForca[] = pool.map((_, idx) => trad(idx));
  const gid = (suf: string) => `${prefix}-g${suf}`;
  const rirReduzido = Math.max(rir - 1, 0);

  switch (nivel) {
    case 1:
      if (pool.length >= 2) {
        entradas[0] = trad(0, { metodo: 'biset', groupId: gid('1'), groupType: 'biset' as GroupType, descansoSegundos: 0, notas: 'Bi-Set agonista/antagonista' });
        entradas[1] = trad(1, { metodo: 'biset', groupId: gid('1'), groupType: 'biset' as GroupType });
      }
      break;
    case 2:
      entradas[0] = trad(0, {
        metodo: 'piramide_crescente',
        repsMin: 6,
        repsMax: 12,
        notas: 'Pirâmide crescente: carga sobe e reps caem a cada série (ex.: 12→10→8→6)',
      });
      if (pool.length >= 3) {
        entradas[1] = trad(1, { metodo: 'biset', groupId: gid('2'), groupType: 'biset' as GroupType, descansoSegundos: 0 });
        entradas[2] = trad(2, { metodo: 'biset', groupId: gid('2'), groupType: 'biset' as GroupType });
      }
      break;
    case 3:
      if (pool.length >= 3) {
        entradas[0] = trad(0, { metodo: 'triset', groupId: gid('3'), groupType: 'triset' as GroupType, descansoSegundos: 0, notas: 'Tri-Set (pré-exaustão)' });
        entradas[1] = trad(1, { metodo: 'triset', groupId: gid('3'), groupType: 'triset' as GroupType, descansoSegundos: 0 });
        entradas[2] = trad(2, { metodo: 'triset', groupId: gid('3'), groupType: 'triset' as GroupType });
      }
      break;
    case 4:
      if (pool.length >= 2) {
        entradas[0] = trad(0, { metodo: 'superset', groupId: gid('4a'), groupType: 'supersets' as GroupType, descansoSegundos: 0 });
        entradas[1] = trad(1, { metodo: 'superset', groupId: gid('4a'), groupType: 'supersets' as GroupType });
      }
      if (pool.length >= 4) {
        entradas[2] = trad(2, { metodo: 'biset', groupId: gid('4b'), groupType: 'biset' as GroupType, descansoSegundos: 0 });
        entradas[3] = trad(3, { metodo: 'biset', groupId: gid('4b'), groupType: 'biset' as GroupType });
      }
      break;
    case 5:
      entradas[0] = trad(0, {
        metodo: 'piramide_decrescente',
        repsMin: 6,
        repsMax: 12,
        notas: 'Pirâmide decrescente: carga cai e reps sobem a cada série (ex.: 6→8→10→12)',
      });
      if (pool.length >= 3) {
        const tailStart = pool.length - 3;
        for (let k = tailStart; k < pool.length; k++) {
          entradas[k] = trad(k, {
            metodo: 'circuito',
            groupId: gid('5'),
            groupType: 'circuito' as GroupType,
            series: 3,
            descansoSegundos: k === pool.length - 1 ? 90 : 15,
            rir: rirReduzido,
            notas: k === tailStart ? '3 voltas' : undefined,
          });
        }
      }
      break;
    case 6:
      if (pool.length >= 2) {
        entradas[0] = trad(0, {
          metodo: 'conjugado',
          groupId: gid('6'),
          series: 5,
          repsMin: 6,
          repsMax: 8,
          descansoSegundos: 90,
          rir: rirReduzido,
          notas: 'Conjugado: força principal',
        });
        entradas[1] = trad(1, {
          metodo: 'conjugado',
          groupId: gid('6'),
          series: 3,
          repsMin: 10,
          repsMax: 12,
          descansoSegundos: rest,
          notas: 'Complementar técnico',
        });
      }
      break;
    case 7:
      if (pool.length >= 2) {
        entradas[0] = trad(0, { metodo: 'biset', groupId: gid('7a'), groupType: 'biset' as GroupType, descansoSegundos: 0, series: 5 });
        entradas[1] = trad(1, { metodo: 'biset', groupId: gid('7a'), groupType: 'biset' as GroupType, series: 5 });
      }
      if (pool.length >= 4) {
        entradas[2] = trad(2, { metodo: 'superset', groupId: gid('7b'), groupType: 'supersets' as GroupType, descansoSegundos: 0, series: 5 });
        entradas[3] = trad(3, { metodo: 'superset', groupId: gid('7b'), groupType: 'supersets' as GroupType, series: 5 });
      }
      if (pool.length >= 3) {
        const tailStart = Math.max(4, pool.length - 3);
        for (let k = tailStart; k < pool.length; k++) {
          entradas[k] = trad(k, {
            metodo: 'circuito',
            groupId: gid('7c'),
            groupType: 'circuito' as GroupType,
            series: 3,
            descansoSegundos: k === pool.length - 1 ? 90 : 15,
            rir: rirReduzido,
            notas: k === tailStart ? '3 voltas' : undefined,
          });
        }
      }
      break;
  }

  return entradas;
}

// ─────────────────────────────────────────────────────────────────────────
// Avançado — métodos de intensificação, sempre no exercício certo
// ─────────────────────────────────────────────────────────────────────────

function montarForcaAvancado(fx: FocoExercicios, nivel: TrainingModelNivel, prefix: string, ehFocoGVT: boolean): TrainingModelEntradaForca[] {
  const principal = fx.compostos[0];
  const secundario = fx.compostos[1] ?? fx.isolA;
  const entradas: TrainingModelEntradaForca[] = [];
  let idx = 0;

  function push(exId: string, params: Omit<TrainingModelEntradaForca, 'id' | 'exId'>) {
    idx += 1;
    entradas.push({ id: `${prefix}-f${idx}`, exId, ...params });
  }

  switch (nivel) {
    case 1:
      push(principal, { series: 4, repsMin: 8, repsMax: 10, descansoSegundos: 60, rir: 1, metodo: 'series_tradicionais' });
      push(secundario, { series: 5, repsMin: 6, repsMax: 8, descansoSegundos: 0, rir: 1, metodo: 'superset', groupId: `${prefix}-g1`, groupType: 'supersets' });
      push(fx.isolA, { series: 5, repsMin: 12, repsMax: 15, descansoSegundos: 45, rir: 1, metodo: 'superset', groupId: `${prefix}-g1`, groupType: 'supersets' });
      push(fx.isolC, { series: 1, repsMin: 6, repsMax: 8, descansoSegundos: 20, rir: 0, metodo: 'rest_pause', notas: 'Isolamento pequeno — 2-3 mini-pausas de 15-20s perto da falha' });
      break;
    case 2:
      push(principal, { series: 5, repsMin: 6, repsMax: 8, descansoSegundos: 60, rir: 1, metodo: 'series_tradicionais' });
      push(fx.isolB, { series: 3, repsMin: 10, repsMax: 12, descansoSegundos: 15, rir: 0, metodo: 'drop_set', notas: 'Máquina/cabo — carga ajustável na hora, nunca em barra livre' });
      push(fx.isolC, { series: 4, repsMin: 10, repsMax: 12, descansoSegundos: 45, rir: 1, metodo: 'series_tradicionais' });
      break;
    case 3:
      push(principal, { series: 4, repsMin: 3, repsMax: 5, descansoSegundos: 20, rir: 1, metodo: 'cluster_set', notas: 'Multiarticular de força' });
      push(secundario, { series: 4, repsMin: 8, repsMax: 12, descansoSegundos: 45, rir: 1, metodo: 'series_tradicionais' });
      push(fx.isolC, { series: 3, repsMin: 10, repsMax: 12, descansoSegundos: 45, rir: 1, metodo: 'series_tradicionais' });
      break;
    case 4:
      if (fx.prioridade) {
        push(principal, { series: 4, repsMin: 6, repsMax: 8, descansoSegundos: 75, rir: 1, metodo: 'series_tradicionais' });
        push(secundario, { series: 4, repsMin: 8, repsMax: 12, descansoSegundos: 45, rir: 1, metodo: 'series_tradicionais' });
        push(fx.isolA, { series: 7, repsMin: 12, repsMax: 15, descansoSegundos: 30, rir: 1, metodo: 'fst7', notas: 'Isolamento do grupamento priorizado do ciclo — bombeamento final' });
      } else {
        push(principal, { series: 4, repsMin: 3, repsMax: 5, descansoSegundos: 20, rir: 1, metodo: 'cluster_set', notas: 'Carryover — dia sem especialização neste ciclo' });
        push(fx.isolA, { series: 4, repsMin: 10, repsMax: 12, descansoSegundos: 42, rir: 1, metodo: 'series_tradicionais' });
        push(fx.isolC, { series: 3, repsMin: 10, repsMax: 12, descansoSegundos: 42, rir: 1, metodo: 'series_tradicionais' });
      }
      break;
    case 5:
      if (ehFocoGVT) {
        push(principal, {
          series: 10,
          repsMin: 10,
          repsMax: 10,
          descansoSegundos: 75,
          rir: 2,
          metodo: 'gvt',
          notas: 'GVT: carga submáxima fixa (~60% 1RM); RIR planejado a subir ao longo das 10 séries — grupamento priorizado do ciclo',
        });
        push(secundario, { series: 4, repsMin: 8, repsMax: 12, descansoSegundos: 45, rir: 1, metodo: 'series_tradicionais' });
      } else {
        push(principal, { series: 4, repsMin: 8, repsMax: 10, descansoSegundos: 60, rir: 2, metodo: 'series_tradicionais' });
        push(fx.isolA, { series: 7, repsMin: 12, repsMax: 15, descansoSegundos: 30, rir: 1, metodo: 'fst7', notas: 'FST-7 fora do grupamento priorizado — método consolidado, não exclusivo de um só grupo' });
        push(fx.isolC, { series: 3, repsMin: 10, repsMax: 12, descansoSegundos: 42, rir: 1, metodo: 'series_tradicionais' });
      }
      break;
    case 6:
      push(principal, { series: 4, repsMin: 3, repsMax: 5, descansoSegundos: 20, rir: 1, metodo: 'cluster_set', notas: 'Composto pesado' });
      if (fx.prioridade) {
        push(fx.isolA, { series: 7, repsMin: 12, repsMax: 15, descansoSegundos: 30, rir: 1, metodo: 'fst7', notas: 'Isolamento do grupamento priorizado, exercício diferente do Cluster Set' });
      } else {
        push(fx.isolB, { series: 3, repsMin: 10, repsMax: 12, descansoSegundos: 15, rir: 0, metodo: 'drop_set', notas: 'Isolamento, exercício diferente do Cluster Set' });
        push(fx.isolC, { series: 3, repsMin: 10, repsMax: 12, descansoSegundos: 40, rir: 1, metodo: 'series_tradicionais' });
      }
      break;
    case 7:
      push(principal, { series: 4, repsMin: 3, repsMax: 5, descansoSegundos: 20, rir: 1, metodo: 'cluster_set', notas: 'Único composto pesado da sessão' });
      if (fx.prioridade) {
        push(fx.isolA, { series: 7, repsMin: 12, repsMax: 15, descansoSegundos: 30, rir: 1, metodo: 'fst7', notas: 'Isolamento do grupamento priorizado do ciclo' });
      } else {
        push(fx.isolB, { series: 3, repsMin: 10, repsMax: 12, descansoSegundos: 15, rir: 0, metodo: 'drop_set', notas: 'Isolamento' });
      }
      push(fx.isolC, { series: 1, repsMin: 6, repsMax: 8, descansoSegundos: 20, rir: 0, metodo: 'rest_pause', notas: 'Isolamento pequeno — fecha a sessão perto da falha absoluta' });
      break;
  }

  // Núcleo (abdômen/lombar) — sempre presente, leve, sem competir com o
  // tempo já consumido pelos métodos avançados (curto: 2 séries).
  const nucleoExId = nivel % 2 === 0 ? fx.nucleoLombar : fx.nucleoAbdomen;
  const [repsMin, repsMax] = repsPara(nucleoExId, 'nucleo');
  push(nucleoExId, { series: 2, repsMin, repsMax, descansoSegundos: 30, rir: 2, metodo: 'series_tradicionais' });

  return entradas;
}

// ─────────────────────────────────────────────────────────────────────────
// Orquestração — pluga em cima do bloco de Cardio já existente
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sessões completas de um modelo: reaproveita `gerarSessoesComCardioSemanal`
 * pro esqueleto + bloco de Cardio (inalterado), e preenche Preparação
 * (cardio leve de aquecimento, mesma taxonomia de data/preparacaoCardio.ts),
 * Mobilidade e Força com conteúdo real, escolhido pelo foco de cada sessão
 * do esqueleto da frequência. Usada por `useModeloStore.garantirSessoesIniciais`.
 */
export function gerarSessoesCompletas(esqueleto: EsqueletoFrequencia, categoria: TrainingModelCategoria, nivel: TrainingModelNivel): TrainingModelSessao[] {
  const base = gerarSessoesComCardioSemanal(esqueleto, categoria, nivel);
  const contagemFoco: Record<string, number> = {};

  return base.map((sessaoBase, i) => {
    const esqSessao = esqueleto.sessoes[i];
    const foco = esqSessao.foco;
    const ocorrencia = contagemFoco[foco] ?? 0;
    contagemFoco[foco] = ocorrencia + 1;

    const fx = getFocoExercicios(foco, ocorrencia);
    const prefix = `m-${categoria[0]}${esqueleto.frequencia}${esqueleto.variante ? esqueleto.variante[0] : ''}-n${nivel}-${esqSessao.nome}`;

    const focoCardio = focoCardioDaSessao(foco);
    const exIdPrep = PREPARACAO_CARDIO_SUGERIDO[focoCardio][0];
    const preparacao: TrainingModelEntradaCardio[] = [
      {
        id: `${prefix}-prep`,
        exId: exIdPrep,
        tipo: 'cardio',
        duracaoMinutos: 5,
        intensidade: categoria === 'iniciante' ? 'Leve' : 'Moderada',
      },
    ];

    const mobilidade = montarMobilidade(fx, prefix);

    const forca =
      categoria === 'iniciante'
        ? montarForcaIniciante(fx, nivel, prefix)
        : categoria === 'intermediario'
          ? montarForcaIntermediario(fx, nivel, foco, prefix)
          : montarForcaAvancado(fx, nivel, prefix, foco === GVT_FOCO);

    return {
      ...sessaoBase,
      blocos: sessaoBase.blocos.map((b) => {
        if (b.fase === 'preparacao') return { ...b, exercicios: preparacao };
        if (b.fase === 'mobilidade') return { ...b, exercicios: mobilidade };
        if (b.fase === 'forca') return { ...b, exercicios: forca };
        return b; // 'cardio' já preenchido por gerarSessoesComCardioSemanal
      }),
    };
  });
}
