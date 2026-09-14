import { describe, expect, it } from 'vitest';
import type { PhysicalAssessment, SkinfoldSet } from '../../types/assessment';
import { SKINFOLD_SITES } from '../pollock7';
import {
  METRICAS,
  buildResumoCards,
  buildSerieMetrica,
  buildSeriesCircunferencia,
  buildSeriesDobras,
  buildSerieSomaDobras,
  calcularComparativo,
  formatarDiferenca,
  formatarValor,
  formatarVariacaoPercentual,
  CIRCUMFERENCE_GROUPS,
} from '../assessmentDashboard';

function skinfoldSet(media: number): SkinfoldSet {
  const m = { measurement1: media, measurement2: media, measurement3: media, average: media };
  return SKINFOLD_SITES.reduce((acc, site) => ({ ...acc, [site]: m }), {} as SkinfoldSet);
}

function baseAssessment(overrides: Partial<PhysicalAssessment> = {}): PhysicalAssessment {
  return {
    id: overrides.id ?? `a-${Math.random()}`,
    alunoId: 'aluno-1',
    date: '2026-01-01T00:00:00.000Z',
    protocol: 'skinfold',
    anthropometry: { peso: 80, altura: 180, imc: 80 / 1.8 ** 2 },
    circumferences: [],
    skinfolds: skinfoldSet(10),
    results: { percentualGordura: 20, percentualMassaGorda: 20, massaGordaKg: 16, percentualMassaLegra: 80, massaMagraKg: 64 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildResumoCards', () => {
  it('usa o valor mais recente que de fato existe pra cada métrica, mesmo vindo de avaliações diferentes', () => {
    const antiga = baseAssessment({
      id: 'antiga',
      date: '2026-01-01T00:00:00.000Z',
      protocol: 'bioimpedance',
      results: {
        percentualGordura: 25,
        percentualMassaGorda: 25,
        massaGordaKg: 20,
        percentualMassaLegra: 75,
        massaMagraKg: 60,
        gorduraVisceral: 9,
        metabolismoBasal: 1700,
      },
    });
    const recente = baseAssessment({ id: 'recente', date: '2026-06-01T00:00:00.000Z', protocol: 'skinfold' });

    const cards = buildResumoCards([antiga, recente]);

    const peso = cards.find((c) => c.key === 'peso')!;
    expect(peso.valor).toBe(80);
    expect(peso.dataFonte).toBe('2026-06-01T00:00:00.000Z'); // veio da mais recente

    const visceral = cards.find((c) => c.key === 'gorduraVisceral')!;
    expect(visceral.valor).toBe(9); // só a antiga (bioimpedância) tem esse campo
    expect(visceral.dataFonte).toBe('2026-01-01T00:00:00.000Z');
  });

  it('retorna null (não zero) quando nenhuma avaliação tem a métrica', () => {
    const cards = buildResumoCards([baseAssessment()]);
    const visceral = cards.find((c) => c.key === 'gorduraVisceral')!;
    expect(visceral.valor).toBeNull();
    expect(visceral.dataFonte).toBeNull();
  });
});

describe('buildSerieMetrica', () => {
  it('inclui só avaliações onde a métrica existe, em ordem cronológica', () => {
    const a1 = baseAssessment({ id: '1', date: '2026-03-01T00:00:00.000Z' });
    const a2 = baseAssessment({ id: '2', date: '2026-01-01T00:00:00.000Z' });
    const metricaGorduraVisceral = METRICAS.find((m) => m.key === 'gorduraVisceral')!;

    expect(buildSerieMetrica([a1, a2], metricaGorduraVisceral)).toEqual([]);

    const metricaPeso = METRICAS.find((m) => m.key === 'peso')!;
    const serie = buildSerieMetrica([a1, a2], metricaPeso);
    expect(serie.map((p) => p.date)).toEqual(['2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z']);
  });
});

describe('buildSeriesCircunferencia', () => {
  it('gera uma série por lado que tem medida, ignora lado nunca medido', () => {
    const a1 = baseAssessment({
      circumferences: [{ id: 'bracoDireito', nome: 'Braço direito', valor: 32, unidade: 'cm', lado: 'direito' }],
    });
    const grupoBraço = CIRCUMFERENCE_GROUPS.find((g) => g.label === 'Braço')!;
    const series = buildSeriesCircunferencia([a1], grupoBraço);
    expect(series).toHaveLength(1);
    expect(series[0].ladoLabel).toBe('Direito');
    expect(series[0].pontos).toEqual([{ date: '2026-01-01T00:00:00.000Z', valor: 32 }]);
  });

  it('retorna vazio quando nenhuma avaliação tem esse grupo medido', () => {
    const grupoQuadril = CIRCUMFERENCE_GROUPS.find((g) => g.label === 'Quadril')!;
    expect(buildSeriesCircunferencia([baseAssessment()], grupoQuadril)).toEqual([]);
  });
});

describe('buildSeriesDobras / buildSerieSomaDobras', () => {
  it('só considera avaliações do protocolo skinfold', () => {
    const dobras = baseAssessment({ protocol: 'skinfold', skinfolds: skinfoldSet(12) });
    const bio = baseAssessment({ id: 'bio', protocol: 'bioimpedance', date: '2026-02-01T00:00:00.000Z' });

    const series = buildSeriesDobras([dobras, bio]);
    expect(series[0].pontos).toHaveLength(1);
    expect(series[0].pontos[0].valor).toBe(12);

    const soma = buildSerieSomaDobras([dobras, bio]);
    expect(soma).toHaveLength(1);
    expect(soma[0].valor).toBeCloseTo(12 * 7, 10);
  });
});

describe('calcularComparativo', () => {
  const serie = [
    { date: '2026-01-01', valor: 90 },
    { date: '2026-02-01', valor: 85 },
    { date: '2026-03-01', valor: 82 },
  ];

  it('retorna null com menos de 2 pontos', () => {
    expect(calcularComparativo([{ date: '2026-01-01', valor: 90 }], 'anterior-atual', 'kg')).toBeNull();
  });

  it('modo anterior-atual usa os dois últimos pontos', () => {
    const r = calcularComparativo(serie, 'anterior-atual', 'kg')!;
    expect(r.valorInicial).toBe(85);
    expect(r.valorAtual).toBe(82);
    expect(r.diferenca).toBeCloseTo(-3, 10);
    expect(r.unidadeDiferenca).toBe('kg');
  });

  it('modo primeira-atual usa o primeiro e o último ponto', () => {
    const r = calcularComparativo(serie, 'primeira-atual', 'kg')!;
    expect(r.valorInicial).toBe(90);
    expect(r.valorAtual).toBe(82);
    expect(r.diferenca).toBeCloseTo(-8, 10);
    expect(r.variacaoPercentual).toBeCloseTo((-8 / 90) * 100, 10);
  });

  it('expressa a diferença em p.p. (não %) quando a métrica em si é uma %', () => {
    const seriePct = [
      { date: '2026-01-01', valor: 25 },
      { date: '2026-02-01', valor: 22 },
    ];
    const r = calcularComparativo(seriePct, 'anterior-atual', '%')!;
    expect(r.diferenca).toBeCloseTo(-3, 10);
    expect(r.unidadeDiferenca).toBe('p.p.');
    expect(r.unidade).toBe('%');
  });

  it('variação percentual é null quando o valor de referência é zero', () => {
    const serieComZero = [
      { date: '2026-01-01', valor: 0 },
      { date: '2026-02-01', valor: 5 },
    ];
    const r = calcularComparativo(serieComZero, 'anterior-atual', 'kg')!;
    expect(r.variacaoPercentual).toBeNull();
  });
});

describe('formatação', () => {
  it('formatarValor aplica casas decimais por unidade', () => {
    expect(formatarValor(78.456, 'kg')).toBe('78.5 kg');
    expect(formatarValor(6.789, 'mm')).toBe('6.79 mm');
    expect(formatarValor(24.3, '')).toBe('24.3');
  });

  it('formatarDiferenca inclui sinal explícito', () => {
    expect(formatarDiferenca(2.3, 'kg')).toBe('+2.3 kg');
    expect(formatarDiferenca(-1.1, 'p.p.')).toBe('-1.1 p.p.');
    expect(formatarDiferenca(0, 'kg')).toBe('0.0 kg');
  });

  it('formatarVariacaoPercentual sempre em %, com sinal, ou travessão quando null', () => {
    expect(formatarVariacaoPercentual(3.24)).toBe('+3.2%');
    expect(formatarVariacaoPercentual(-8.888)).toBe('-8.9%');
    expect(formatarVariacaoPercentual(null)).toBe('—');
  });
});
