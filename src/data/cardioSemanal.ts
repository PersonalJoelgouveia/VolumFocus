/**
 * Meta de cardio semanal dos Modelos (Ferramentas > Modelos).
 *
 * Define, por categoria×nível, quantos minutos de cardio por semana o
 * nível representa (`CARDIO_SEMANAL_META`), e como esses minutos se
 * distribuem pelas sessões de qualquer frequência (2x/3x/4x/5x — a meta
 * semanal não muda com a frequência, só como ela é repartida entre as
 * sessões existentes).
 *
 * O cardio da meta semanal fica só no bloco de fase 'cardio' de cada
 * sessão (TrainingModelBloco, types/trainingModel.ts) — nunca no bloco de
 * Preparação. A Preparação continua ~5min de referência (aquecimento),
 * separada da musculação (45–60min) e de propósito NUNCA contabilizada
 * aqui, mesmo quando ela própria usa um exercício cardio (Esteira/Bike/
 * Elíptico) só pra aquecer — `calcularCardioSemanalAtual` só soma o
 * bloco de fase 'cardio', nunca o de 'preparacao'.
 *
 * Progressão (nunca repete o mesmo valor entre níveis vizinhos):
 * - Iniciante:      40 → 100 min/semana (N1 a N7, +10min por nível)
 * - Intermediário:  90 → 150 min/semana (N1 a N7, +10min por nível)
 * - Avançado:       70 → 150 min/semana (N1 a N7, degraus de 10-15min —
 *   climba mais devagar no início, mais rápido perto do fim, uma curva
 *   diferente da do Intermediário mesmo chegando na mesma meta em N7)
 *
 * Tipo de cardio por sessão reaproveita exatamente data/preparacaoCardio.ts
 * (Bike p/ predominância de membros inferiores, Elíptico p/ maior
 * participação de membros superiores, Esteira p/ geral) — sem taxonomia
 * paralela, só decide o `PreparacaoFoco` a partir do texto do `foco` da
 * sessão no esqueleto (data/frequenciaSemanal.ts).
 */

import type { TrainingModel, TrainingModelCategoria, TrainingModelEntradaCardio, TrainingModelNivel, TrainingModelSessao } from '../types/trainingModel';
import { criarSessaoVazia, FREQUENCIA_LABELS } from '../types/trainingModel';
import type { EsqueletoFrequencia } from './frequenciaSemanal';
import { PREPARACAO_CARDIO_SUGERIDO } from './preparacaoCardio';
import type { PreparacaoFoco } from './preparacaoCardio';

/** Minutos de cardio por semana, por categoria×nível — a meta em si (não muda com a frequência). */
const CARDIO_SEMANAL_META: Record<TrainingModelCategoria, Record<TrainingModelNivel, number>> = {
  iniciante: { 1: 40, 2: 50, 3: 60, 4: 70, 5: 80, 6: 90, 7: 100 },
  intermediario: { 1: 90, 2: 100, 3: 110, 4: 120, 5: 130, 6: 140, 7: 150 },
  avancado: { 1: 70, 2: 85, 3: 95, 4: 110, 5: 120, 6: 135, 7: 150 },
};

export function getMetaCardioSemanal(categoria: TrainingModelCategoria, nivel: TrainingModelNivel): number {
  return CARDIO_SEMANAL_META[categoria][nivel];
}

/**
 * Reparte `metaMinutos` em `numeroSessoes` partes inteiras cuja soma bate
 * EXATAMENTE com `metaMinutos` — o mais uniforme possível (a diferença
 * entre a maior e a menor parte nunca passa de 1 minuto). Base
 * matemática do requisito "a soma dos cardios das sessões deve
 * corresponder à meta semanal do nível".
 */
export function distribuirCardioPorSessoes(metaMinutos: number, numeroSessoes: number): number[] {
  if (numeroSessoes <= 0) return [];
  const base = Math.floor(metaMinutos / numeroSessoes);
  const resto = metaMinutos - base * numeroSessoes;
  return Array.from({ length: numeroSessoes }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Decide o foco de cardio (data/preparacaoCardio.ts) a partir do texto de foco de uma sessão do esqueleto. */
function focoCardioDaSessao(focoSessao: string): PreparacaoFoco {
  const f = focoSessao.toLowerCase();
  if (f.includes('inferior') || f.includes('quadríceps') || f.includes('posteriores')) return 'membros_inferiores';
  if (f.includes('superior') || f.includes('dorsais') || f.includes('peitorais') || f.includes('deltoide') || f.includes('bíceps') || f.includes('tríceps')) {
    return 'membros_superiores';
  }
  return 'geral'; // Full Body e demais
}

/**
 * Sessões iniciais de um modelo, já com o bloco de cardio de cada sessão
 * preenchido conforme a meta semanal do nível — distribuído pelas
 * sessões do esqueleto da frequência, com o tipo de cardio compatível com
 * o foco de cada sessão. Preparação/Mobilidade/Força continuam vazios
 * (conteúdo de força é edição manual do Personal, fora do escopo desta
 * etapa). Usada por `useModeloStore.garantirSessoesIniciais`.
 */
export function gerarSessoesComCardioSemanal(
  esqueleto: EsqueletoFrequencia,
  categoria: TrainingModelCategoria,
  nivel: TrainingModelNivel
): TrainingModelSessao[] {
  const metaSemanal = getMetaCardioSemanal(categoria, nivel);
  const minutosPorSessao = distribuirCardioPorSessoes(metaSemanal, esqueleto.sessoes.length);

  return esqueleto.sessoes.map((sessaoEsqueleto, i) => {
    const sessao = criarSessaoVazia(`${sessaoEsqueleto.nome} — ${sessaoEsqueleto.foco}`, FREQUENCIA_LABELS[esqueleto.frequencia]);
    const minutos = minutosPorSessao[i];
    if (minutos <= 0) return sessao;

    const foco = focoCardioDaSessao(sessaoEsqueleto.foco);
    const exId = PREPARACAO_CARDIO_SUGERIDO[foco][0];
    const entradaCardio: TrainingModelEntradaCardio = {
      id: `cardio-semanal-${sessaoEsqueleto.nome}`,
      exId,
      tipo: 'cardio',
      duracaoMinutos: minutos,
      intensidade: 'Moderada',
      notas: 'Cardio da meta semanal — contado separado da preparação/vascularização.',
    };
    return {
      ...sessao,
      blocos: sessao.blocos.map((b) => (b.fase === 'cardio' ? { ...b, exercicios: [entradaCardio] } : b)),
    };
  });
}

/**
 * Soma os minutos de cardio ATUAIS do modelo (só o bloco de fase
 * 'cardio' de cada sessão — nunca a Preparação, mesmo que ela use um
 * exercício cardio só pra aquecer). Reflete o estado real depois de
 * qualquer edição manual do Personal, não necessariamente igual à meta
 * (`getMetaCardioSemanal`) se algo foi alterado à mão.
 */
export function calcularCardioSemanalAtual(modelo: TrainingModel): number {
  return modelo.sessoes.reduce((total, sessao) => {
    const blocoCardio = sessao.blocos.find((b) => b.fase === 'cardio');
    if (!blocoCardio) return total;
    return total + blocoCardio.exercicios.reduce((soma, e) => soma + (isCardio(e) ? e.duracaoMinutos : 0), 0);
  }, 0);
}

function isCardio(e: { tipo?: 'cardio' }): e is { tipo: 'cardio'; duracaoMinutos: number } {
  return e.tipo === 'cardio';
}

/** Minutos de cardio (bloco de fase 'cardio') de UMA sessão específica do modelo — pro "tempo de cardio de cada sessão" exigido na tela. */
export function calcularCardioDaSessao(sessao: TrainingModelSessao): number {
  const blocoCardio = sessao.blocos.find((b) => b.fase === 'cardio');
  if (!blocoCardio) return 0;
  return blocoCardio.exercicios.reduce((soma, e) => soma + (isCardio(e) ? e.duracaoMinutos : 0), 0);
}
