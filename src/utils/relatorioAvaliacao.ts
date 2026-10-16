/**
 * Dados do relatório de avaliação (módulo puro). Mínimo necessário: medidas e resultados.
 * NÃO entram: notas livres, questionário/triagem de saúde, revisão — dado de saúde autorrelatado
 * fica fora do PDF (ele circula fora do app depois de gerado).
 */
import type { PhysicalAssessment } from '../types/assessment';
import {
  METRICAS,
  METRICAS_EVOLUCAO,
  buildSerieMetrica,
  calcularComparativo,
  type MetricKey,
  type SeriePonto,
} from './assessmentDashboard';

const t = (d: string | Date) => new Date(d).getTime();

export interface LinhaMetrica {
  key: MetricKey;
  label: string;
  unidade: string;
  atual: number;
  anterior: number | null;
  difAnterior: number | null;
  difPrimeira: number | null;
  unidadeDif: string;
}

export interface LinhaCirc {
  nome: string;
  lado: string;
  atual: number;
  anterior: number | null;
  dif: number | null;
}

export interface DadosRelatorio {
  atual: PhysicalAssessment;
  anterior: PhysicalAssessment | null;
  /** Histórico até a avaliação escolhida (inclusive), mais antigo primeiro. */
  historico: PhysicalAssessment[];
  metricas: LinhaMetrica[];
  circunferencias: LinhaCirc[];
  dobras: Array<{ site: string; atual: number; anterior: number | null }>;
  evolucao: Array<{ key: MetricKey; label: string; unidade: string; pontos: SeriePonto[] }>;
  composicao: { magra: number; gordura: number } | null;
}

export function montarRelatorio(todas: PhysicalAssessment[], avaliacaoId: string): DadosRelatorio | null {
  const asc = [...todas].sort((a, b) => t(a.date) - t(b.date));
  const idx = asc.findIndex((a) => a.id === avaliacaoId);
  if (idx < 0) return null;
  const atual = asc[idx];
  const anterior = idx > 0 ? asc[idx - 1] : null;
  const historico = asc.slice(0, idx + 1);

  const metricas: LinhaMetrica[] = [];
  for (const m of METRICAS) {
    const va = m.getValor(atual);
    if (va == null) continue;
    const serie = buildSerieMetrica(historico, m);
    const ant = anterior ? m.getValor(anterior) ?? null : null;
    const cPrim = calcularComparativo(serie, 'primeira-atual', m.unidade);
    metricas.push({
      key: m.key,
      label: m.label,
      unidade: m.unidade,
      atual: va,
      anterior: ant,
      difAnterior: ant != null ? va - ant : null,
      difPrimeira: cPrim ? cPrim.diferenca : null,
      unidadeDif: m.unidade === '%' ? 'p.p.' : m.unidade,
    });
  }

  const circunferencias: LinhaCirc[] = atual.circumferences.map((c) => {
    const ant = anterior?.circumferences.find((x) => x.nome === c.nome && x.lado === c.lado)?.valor ?? null;
    return { nome: c.nome, lado: c.lado === 'none' ? '' : c.lado, atual: c.valor, anterior: ant, dif: ant != null ? c.valor - ant : null };
  });

  const dobras =
    atual.protocol === 'skinfold'
      ? (Object.keys(atual.skinfolds) as Array<keyof PhysicalAssessment['skinfolds']>).map((site) => ({
          site: String(site),
          atual: atual.skinfolds[site].average,
          anterior: anterior?.protocol === 'skinfold' ? anterior.skinfolds[site].average : null,
        }))
      : [];

  const evolucao = METRICAS_EVOLUCAO.map((k) => METRICAS.find((m) => m.key === k)!)
    .map((m) => ({ key: m.key, label: m.label, unidade: m.unidade, pontos: buildSerieMetrica(historico, m) }))
    .filter((e) => e.pontos.length > 0);

  const magra = atual.results.percentualMassaLegra;
  const gordura = atual.results.percentualGordura;
  return {
    atual,
    anterior,
    historico,
    metricas,
    circunferencias,
    dobras,
    evolucao,
    composicao: magra != null && gordura != null ? { magra, gordura } : null,
  };
}

/** Título do documento durante a impressão = nome sugerido do PDF. Sem nome do aluno (nome de arquivo circula). */
export function tituloDoPdf(data: string | Date): string {
  const d = new Date(data);
  const p = (n: number) => String(n).padStart(2, '0');
  return `Relatorio-avaliacao-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
