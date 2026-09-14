/**
 * Compara duas avaliações específicas (não precisa ser primeira/atual —
 * quem chama escolhe quais duas). Módulo puro: sem React.
 *
 * Regra central do módulo: a "direção" (redução/aumento/estabilidade) é
 * puramente descritiva. Redução não é rotulada como melhora nem aumento
 * como piora — a interpretação fica com quem lê. Por isso os três estados
 * têm o mesmo peso visual na camada de apresentação (ver CompareAssessmentsModal),
 * e este módulo não emite nenhum texto de avaliação ("bom", "ruim", "risco").
 *
 * Só entra item na comparação onde AMBAS as avaliações têm o dado — nunca
 * compara um valor real com um inventado (ex.: gordura visceral só some
 * pareada se as duas forem bioimpedância).
 */
import type { PhysicalAssessment } from '../types/assessment';
import { METRICAS } from './assessmentDashboard';
import { SKINFOLD_SITES } from './pollock7';

export type DirecaoIndicador = 'reducao' | 'aumento' | 'estavel';

export interface ItemComparacao {
  label: string;
  /** Unidade do valor em si ('kg', '%', 'cm', 'mm', '' pra índices como IMC). */
  unidade: string;
  /** Unidade da diferença — igual a `unidade`, exceto que '%' vira 'p.p.'
   *  (diferença de uma métrica que já é % é expressa em pontos percentuais). */
  unidadeDiferenca: string;
  valorInicial: number;
  valorAtual: number;
  diferenca: number;
  direcao: DirecaoIndicador;
}

const CASAS_ARREDONDAMENTO: Record<string, number> = { kg: 1, cm: 1, mm: 2, '%': 1, 'p.p.': 1, 'kcal/dia': 0, '': 1 };

/** Direção é definida pelo valor JÁ ARREDONDADO na precisão de exibição —
 *  uma diferença que aparece como "0.0" pro usuário é "estável", nunca
 *  "aumento" ou "redução" por uma fração invisível na tela. */
function direcaoDaDiferenca(diferenca: number, unidadeDiferenca: string): DirecaoIndicador {
  const casas = CASAS_ARREDONDAMENTO[unidadeDiferenca] ?? 1;
  const fator = 10 ** casas;
  const arredondado = Math.round(diferenca * fator) / fator;
  if (arredondado === 0) return 'estavel';
  return arredondado > 0 ? 'aumento' : 'reducao';
}

function montarItem(label: string, unidade: string, valorInicial: number, valorAtual: number): ItemComparacao {
  const diferenca = valorAtual - valorInicial;
  const unidadeDiferenca = unidade === '%' ? 'p.p.' : unidade;
  return {
    label,
    unidade,
    unidadeDiferenca,
    valorInicial,
    valorAtual,
    diferenca,
    direcao: direcaoDaDiferenca(diferenca, unidadeDiferenca),
  };
}

/**
 * `inicial`/`atual` são só nomes de papel — quem chama decide qual é qual
 * (o componente ordena as duas escolhidas por data antes de chamar esta
 * função, pra "inicial" ser sempre a mais antiga das duas).
 */
export function compararAvaliacoes(inicial: PhysicalAssessment, atual: PhysicalAssessment): ItemComparacao[] {
  const itens: ItemComparacao[] = [];

  for (const m of METRICAS) {
    const vi = m.getValor(inicial);
    const va = m.getValor(atual);
    if (vi != null && va != null) itens.push(montarItem(m.label, m.unidade, vi, va));
  }

  // Circunferências pareadas por nome (não por id — medidas personalizadas
  // ganham um id novo a cada avaliação, então nome é a única chave estável
  // entre duas avaliações diferentes).
  const porNomeInicial = new Map(inicial.circumferences.map((c) => [c.nome.trim().toLowerCase(), c]));
  for (const cAtual of atual.circumferences) {
    const cInicial = porNomeInicial.get(cAtual.nome.trim().toLowerCase());
    if (cInicial) itens.push(montarItem(cAtual.nome, 'cm', cInicial.valor, cAtual.valor));
  }

  if (inicial.protocol === 'skinfold' && atual.protocol === 'skinfold') {
    const somaInicial = SKINFOLD_SITES.reduce((soma, site) => soma + inicial.skinfolds[site].average, 0);
    const somaAtual = SKINFOLD_SITES.reduce((soma, site) => soma + atual.skinfolds[site].average, 0);
    itens.push(montarItem('Soma das dobras', 'mm', somaInicial, somaAtual));
  }

  return itens;
}

function paraVirgula(texto: string): string {
  return texto.replace('.', ',');
}

/** "78,0 kg", "23,4%", "24,3" (unidade vazia = índice adimensional). Vírgula decimal (pt-BR). */
export function formatarValorComparacao(valor: number, unidade: string): string {
  const casas = CASAS_ARREDONDAMENTO[unidade] ?? 1;
  const texto = paraVirgula(valor.toFixed(casas));
  if (!unidade) return texto;
  return unidade === '%' ? `${texto}%` : `${texto} ${unidade}`;
}

/**
 * "-3,8 kg", "+0,6 kg", "-4,7 pontos percentuais" — sinal explícito,
 * vírgula decimal, e 'p.p.' sempre por extenso aqui ("pontos percentuais"),
 * como pedido especificamente pra este módulo.
 */
export function formatarDiferencaDescritiva(diferenca: number, unidadeDiferenca: string): string {
  const casas = CASAS_ARREDONDAMENTO[unidadeDiferenca] ?? 1;
  const sinal = diferenca > 0 ? '+' : '';
  const texto = paraVirgula(diferenca.toFixed(casas));
  if (unidadeDiferenca === 'p.p.') return `${sinal}${texto} pontos percentuais`;
  return unidadeDiferenca ? `${sinal}${texto} ${unidadeDiferenca}` : `${sinal}${texto}`;
}
