/**
 * Esqueleto de sessões por Frequência Semanal (Ferramentas > Modelos —
 * Nível de Treinamento → Frequência Semanal → Nível 1–7).
 *
 * Define, pra cada frequência (e variante por gênero, só na 4x/semana),
 * a lista ORDENADA de sessões que a organização daquela frequência tem —
 * nome (A/B/C/D/E) e foco (ex: "Inferiores", "Full Body"). É só o
 * esqueleto (rótulos), não `TrainingModelSessao` com exercícios de
 * verdade — o conteúdo real (`TrainingModelBloco`/`TrainingModelEntrada`,
 * ver types/trainingModel.ts) é uma etapa futura, explicitamente adiada
 * ("não recrie ainda todos os exercícios/modelos").
 *
 * O nível 1–7 (ver data/trainingProgression.ts) progride volume/
 * intensidade/complexidade/densidade DENTRO da mesma organização de
 * sessões da frequência escolhida — a frequência é quem decide quantas
 * sessões existem e qual o foco de cada uma; o nível nunca muda isso.
 *
 * REGRAS (ver TrainingModel.duracaoEstimadaMinutos e TrainingModelBloco
 * de fase 'cardio' pra onde isso se conecta quando o conteúdo real for
 * criado):
 * - Cada sessão de musculação dura ~45–60min de referência, SEM contar
 *   cardio (`duracaoMusculacaoMinutos` abaixo é essa faixa).
 * - Cardio é somado à parte, fora da duração de musculação, pra fechar a
 *   meta semanal (`cardioNota` explica como isso se aplica pra cada
 *   frequência — nenhuma tem um número fixo de minutos definido ainda).
 */

import type { FrequenciaSemanal, VariantePorGenero } from '../types/trainingModel';

export interface SessaoEsqueleto {
  /** Rótulo da sessão dentro da frequência (A/B/C/D/E). */
  nome: string;
  /** Grupamento(s)/foco da sessão (ex: "Dorsais + Deltoide Lateral + Bíceps"). */
  foco: string;
}

export interface EsqueletoFrequencia {
  frequencia: FrequenciaSemanal;
  /** Só presente quando a estrutura difere por gênero (hoje só 4x/semana). */
  variante?: VariantePorGenero;
  sessoes: SessaoEsqueleto[];
  /** Faixa de referência (min) por sessão de musculação, sem contar cardio. */
  duracaoMusculacaoMinutos: readonly [number, number];
  cardioNota: string;
}

const DURACAO_PADRAO: readonly [number, number] = [45, 60];

export const ESQUELETOS_FREQUENCIA: EsqueletoFrequencia[] = [
  {
    frequencia: 2,
    sessoes: [
      { nome: 'A', foco: 'Full Body' },
      { nome: 'B', foco: 'Full Body' },
    ],
    duracaoMusculacaoMinutos: DURACAO_PADRAO,
    cardioNota: 'Cardio somado em cada uma das 2 sessões, separado da musculação, pra fechar a meta semanal.',
  },
  {
    frequencia: 3,
    sessoes: [
      { nome: 'A', foco: 'Superiores' },
      { nome: 'B', foco: 'Inferiores' },
      { nome: 'C', foco: 'Full Body' },
    ],
    duracaoMusculacaoMinutos: DURACAO_PADRAO,
    cardioNota: 'Cardio conforme a meta semanal, somado separadamente da musculação — não fixado a uma sessão específica.',
  },
  {
    frequencia: 4,
    variante: 'masculina',
    sessoes: [
      { nome: 'A', foco: 'Dorsais + Deltoide Lateral + Bíceps' },
      { nome: 'B', foco: 'Inferiores' },
      { nome: 'C', foco: 'Peitorais + Deltoide Anterior + Tríceps' },
      { nome: 'D', foco: 'Full Body' },
    ],
    duracaoMusculacaoMinutos: DURACAO_PADRAO,
    cardioNota: 'Cardio somado separadamente da musculação em cada sessão, pra fechar a meta semanal.',
  },
  {
    frequencia: 4,
    variante: 'feminina',
    sessoes: [
      { nome: 'A', foco: 'Quadríceps' },
      { nome: 'B', foco: 'Superiores' },
      { nome: 'C', foco: 'Posteriores de Coxa + Glúteos' },
      { nome: 'D', foco: 'Full Body' },
    ],
    duracaoMusculacaoMinutos: DURACAO_PADRAO,
    cardioNota: 'Cardio somado separadamente da musculação em cada sessão, pra fechar a meta semanal.',
  },
  {
    // Estrutura idêntica pras duas versões nesta frequência — por isso uma
    // única entrada, sem `variante` (ver cabeçalho do arquivo).
    frequencia: 5,
    sessoes: [
      { nome: 'A', foco: 'Dorsais + Deltoide Lateral + Bíceps' },
      { nome: 'B', foco: 'Inferiores' },
      { nome: 'C', foco: 'Peitorais + Deltoide Anterior + Tríceps' },
      { nome: 'D', foco: 'Inferiores' },
      { nome: 'E', foco: 'Superiores Completo' },
    ],
    duracaoMusculacaoMinutos: DURACAO_PADRAO,
    cardioNota: 'Cardio somado separadamente da musculação em cada sessão, pra fechar a meta semanal.',
  },
];

export function getEsqueletoFrequencia(frequencia: FrequenciaSemanal, variante?: VariantePorGenero): EsqueletoFrequencia {
  const encontrado = ESQUELETOS_FREQUENCIA.find((e) => e.frequencia === frequencia && e.variante === variante);
  // Sempre existe: as combinações válidas de (frequencia, variante) são fixas.
  return encontrado!;
}

/** Lista as combinações (frequência, variante) válidas — 2x, 3x, 4x-masculina, 4x-feminina, 5x. */
export function listarCombinacoesFrequencia(): { frequencia: FrequenciaSemanal; variante?: VariantePorGenero }[] {
  return ESQUELETOS_FREQUENCIA.map((e) => ({ frequencia: e.frequencia, variante: e.variante }));
}
