/**
 * Agregação de dados pro dashboard de evolução (PhysicalAssessmentDashboard).
 * Módulo puro: nenhuma dependência de React ou de biblioteca de gráficos.
 *
 * Regra que percorre todo o arquivo: nunca preencher um valor ausente.
 * Métrica que um protocolo não produz (ex.: gordura visceral em uma
 * avaliação de Dobras) fica de fora do card/ponto — não vira 0, média ou
 * interpolação.
 */
import type { PhysicalAssessment } from '../types/assessment';
import { SKINFOLD_SITES, SKINFOLD_SITE_LABELS, type SkinfoldSite } from './pollock7';

function dataISO(d: string | Date): string {
  return typeof d === 'string' ? d : d.toISOString();
}

function porDataAsc(assessments: PhysicalAssessment[]): PhysicalAssessment[] {
  return [...assessments].sort((a, b) => new Date(dataISO(a.date)).getTime() - new Date(dataISO(b.date)).getTime());
}

function porDataDesc(assessments: PhysicalAssessment[]): PhysicalAssessment[] {
  return [...assessments].sort((a, b) => new Date(dataISO(b.date)).getTime() - new Date(dataISO(a.date)).getTime());
}

/* ---------- Seção 1 — Resumo ---------- */

export type MetricKey =
  | 'peso'
  | 'imc'
  | 'percentualGordura'
  | 'massaGordaKg'
  | 'percentualMassaMagra'
  | 'massaMagraKg'
  | 'gorduraVisceral'
  | 'metabolismoBasal';

export interface MetricDef {
  key: MetricKey;
  label: string;
  /** '' para índices adimensionais (IMC, gordura visceral). */
  unidade: string;
  getValor: (a: PhysicalAssessment) => number | undefined;
}

/** `percentualMassaLegra` é o nome do campo em types/assessment.ts (typo pré-existente de "Magra"). */
export const METRICAS: MetricDef[] = [
  { key: 'peso', label: 'Peso', unidade: 'kg', getValor: (a) => a.anthropometry.peso },
  { key: 'imc', label: 'IMC', unidade: '', getValor: (a) => a.anthropometry.imc },
  { key: 'percentualGordura', label: '% Gordura', unidade: '%', getValor: (a) => a.results.percentualGordura },
  { key: 'massaGordaKg', label: 'Massa gorda', unidade: 'kg', getValor: (a) => a.results.massaGordaKg },
  {
    key: 'percentualMassaMagra',
    label: '% Massa magra',
    unidade: '%',
    getValor: (a) => a.results.percentualMassaLegra,
  },
  { key: 'massaMagraKg', label: 'Massa magra', unidade: 'kg', getValor: (a) => a.results.massaMagraKg },
  { key: 'gorduraVisceral', label: 'Gordura visceral', unidade: '', getValor: (a) => a.results.gorduraVisceral },
  {
    key: 'metabolismoBasal',
    label: 'Metabolismo basal',
    unidade: 'kcal/dia',
    getValor: (a) => a.results.metabolismoBasal,
  },
];

/** Métricas com evolução em linha do tempo (Seção 2). */
export const METRICAS_EVOLUCAO: MetricKey[] = [
  'peso',
  'percentualGordura',
  'massaMagraKg',
  'imc',
  'metabolismoBasal',
];

export interface ResumoCard {
  key: MetricKey;
  label: string;
  unidade: string;
  /** null quando nenhuma avaliação registrou essa métrica ainda. */
  valor: number | null;
  /** Data da avaliação de onde o valor veio — cards podem vir de avaliações
   *  diferentes (nem todo protocolo produz todo campo). */
  dataFonte: string | null;
}

/** Um card por métrica, com o valor mais recente que de fato existe pra ela. */
export function buildResumoCards(assessments: PhysicalAssessment[]): ResumoCard[] {
  const desc = porDataDesc(assessments);
  return METRICAS.map((m) => {
    const achado = desc.find((a) => m.getValor(a) != null);
    return {
      key: m.key,
      label: m.label,
      unidade: m.unidade,
      valor: achado ? (m.getValor(achado) as number) : null,
      dataFonte: achado ? dataISO(achado.date) : null,
    };
  });
}

/* ---------- Seção 2 — Evolução ---------- */

export interface SeriePonto {
  date: string;
  valor: number;
}

/** Só entram pontos onde a métrica de fato existe — sem interpolar/zerar os que faltam. */
export function buildSerieMetrica(assessments: PhysicalAssessment[], metric: MetricDef): SeriePonto[] {
  return porDataAsc(assessments)
    .filter((a) => metric.getValor(a) != null)
    .map((a) => ({ date: dataISO(a.date), valor: metric.getValor(a) as number }));
}

/* ---------- Seção 3 — Circunferências ---------- */

export interface CircumferenceGroupDef {
  label: string;
  pontos: Array<{ id: string; ladoLabel: string }>;
}

/** Os 7 grupos do seletor — pareados (Braço/Coxa/Panturrilha) viram até 2 séries (D/E). */
export const CIRCUMFERENCE_GROUPS: CircumferenceGroupDef[] = [
  {
    label: 'Braço',
    pontos: [
      { id: 'bracoDireito', ladoLabel: 'Direito' },
      { id: 'bracoEsquerdo', ladoLabel: 'Esquerdo' },
    ],
  },
  { label: 'Tórax', pontos: [{ id: 'torax', ladoLabel: 'Tórax' }] },
  { label: 'Cintura', pontos: [{ id: 'cintura', ladoLabel: 'Cintura' }] },
  { label: 'Abdômen', pontos: [{ id: 'abdomen', ladoLabel: 'Abdômen' }] },
  { label: 'Quadril', pontos: [{ id: 'quadril', ladoLabel: 'Quadril' }] },
  {
    label: 'Coxa',
    pontos: [
      { id: 'coxaDireita', ladoLabel: 'Direita' },
      { id: 'coxaEsquerda', ladoLabel: 'Esquerda' },
    ],
  },
  {
    label: 'Panturrilha',
    pontos: [
      { id: 'panturrilhaDireita', ladoLabel: 'Direita' },
      { id: 'panturrilhaEsquerda', ladoLabel: 'Esquerda' },
    ],
  },
];

export interface CircumferenceSerie {
  ladoLabel: string;
  pontos: SeriePonto[];
}

/** Uma série por lado que de fato tem alguma medida registrada — lado nunca medido não aparece. */
export function buildSeriesCircunferencia(
  assessments: PhysicalAssessment[],
  group: CircumferenceGroupDef
): CircumferenceSerie[] {
  const asc = porDataAsc(assessments);
  return group.pontos
    .map(({ id, ladoLabel }) => {
      const pontos: SeriePonto[] = [];
      for (const a of asc) {
        const entrada = a.circumferences.find((c) => c.id === id);
        if (entrada) pontos.push({ date: dataISO(a.date), valor: entrada.valor });
      }
      return { ladoLabel, pontos };
    })
    .filter((s) => s.pontos.length > 0);
}

/* ---------- Seção 4 — Dobras cutâneas ---------- */

export interface SkinfoldSerie {
  site: SkinfoldSite;
  label: string;
  pontos: SeriePonto[];
}

function avaliacoesComDobras(assessments: PhysicalAssessment[]): PhysicalAssessment[] {
  return porDataAsc(assessments.filter((a) => a.protocol === 'skinfold'));
}

/** Uma série por ponto de dobra (só avaliações do protocolo Dobras têm esse dado). */
export function buildSeriesDobras(assessments: PhysicalAssessment[]): SkinfoldSerie[] {
  const comDobras = avaliacoesComDobras(assessments);
  return SKINFOLD_SITES.map((site) => ({
    site,
    label: SKINFOLD_SITE_LABELS[site],
    pontos: comDobras.map((a) => ({ date: dataISO(a.date), valor: a.skinfolds[site].average })),
  }));
}

/** Soma das 7 médias por avaliação — visualização própria, à parte de cada ponto individual. */
export function buildSerieSomaDobras(assessments: PhysicalAssessment[]): SeriePonto[] {
  return avaliacoesComDobras(assessments).map((a) => ({
    date: dataISO(a.date),
    valor: SKINFOLD_SITES.reduce((soma, site) => soma + a.skinfolds[site].average, 0),
  }));
}

/* ---------- Seção 5 — Comparativo ---------- */

export type ComparativoModo = 'primeira-atual' | 'anterior-atual';

export interface ComparativoResultado {
  valorInicial: number;
  valorAtual: number;
  diferenca: number;
  /** null quando o valor de referência é 0 (variação percentual não é calculável). */
  variacaoPercentual: number | null;
  /** Unidade da métrica em si — usada pra Valor inicial/atual. */
  unidade: string;
  /** Unidade da diferença: igual a `unidade`, exceto quando `unidade` é '%'
   *  — nesse caso a diferença é expressa em pontos percentuais ('p.p.'),
   *  não em '%' de novo (evita confundir "3 p.p. de gordura" com "3% a mais"). */
  unidadeDiferenca: string;
}

/**
 * Requer pelo menos 2 pontos na série. `anterior-atual` usa os dois
 * últimos pontos; `primeira-atual` usa o primeiro e o último.
 */
export function calcularComparativo(
  serie: SeriePonto[],
  modo: ComparativoModo,
  unidade: string
): ComparativoResultado | null {
  if (serie.length < 2) return null;

  const atual = serie[serie.length - 1];
  const referencia = modo === 'primeira-atual' ? serie[0] : serie[serie.length - 2];

  const diferenca = atual.valor - referencia.valor;
  const variacaoPercentual = referencia.valor !== 0 ? (diferenca / referencia.valor) * 100 : null;

  return {
    valorInicial: referencia.valor,
    valorAtual: atual.valor,
    diferenca,
    variacaoPercentual,
    unidade,
    unidadeDiferenca: unidade === '%' ? 'p.p.' : unidade,
  };
}

/* ---------- Formatação ---------- */

const CASAS_POR_UNIDADE: Record<string, number> = { kg: 1, cm: 1, mm: 2, '%': 1, 'p.p.': 1, 'kcal/dia': 0, '': 1 };

/** "78.5 kg", "21.4%", "24.3" (unidade vazia = índice adimensional, ex. IMC). */
export function formatarValor(valor: number, unidade: string): string {
  const casas = CASAS_POR_UNIDADE[unidade] ?? 1;
  const texto = valor.toFixed(casas);
  return unidade ? `${texto} ${unidade}` : texto;
}

/** Igual a formatarValor, mas com sinal explícito pra diferenças: "+2.3 kg", "-1.1 p.p.". */
export function formatarDiferenca(valor: number, unidade: string): string {
  const casas = CASAS_POR_UNIDADE[unidade] ?? 1;
  const sinal = valor > 0 ? '+' : '';
  const texto = `${sinal}${valor.toFixed(casas)}`;
  return unidade ? `${texto} ${unidade}` : texto;
}

/** "+3.2%" / "-1.8%" — sempre em %, mesmo quando a métrica em si já é uma %. */
export function formatarVariacaoPercentual(valor: number | null): string {
  if (valor == null) return '—';
  const sinal = valor > 0 ? '+' : '';
  return `${sinal}${valor.toFixed(1)}%`;
}
