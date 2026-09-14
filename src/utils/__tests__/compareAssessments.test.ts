import { describe, expect, it } from 'vitest';
import type { PhysicalAssessment, SkinfoldSet } from '../../types/assessment';
import { SKINFOLD_SITES } from '../pollock7';
import { compararAvaliacoes, formatarDiferencaDescritiva, formatarValorComparacao } from '../compareAssessments';

function skinfoldSet(media: number): SkinfoldSet {
  const m = { measurement1: media, measurement2: media, measurement3: media, average: media };
  return SKINFOLD_SITES.reduce((acc, site) => ({ ...acc, [site]: m }), {} as SkinfoldSet);
}

function assessment(overrides: Partial<PhysicalAssessment> = {}): PhysicalAssessment {
  return {
    id: overrides.id ?? `a-${Math.random()}`,
    alunoId: 'aluno-1',
    date: '2026-01-01T00:00:00.000Z',
    protocol: 'skinfold',
    anthropometry: { peso: 78, altura: 175, imc: 78 / 1.75 ** 2 },
    circumferences: [],
    skinfolds: skinfoldSet(10),
    results: { percentualGordura: 23.4, percentualMassaGorda: 23.4, massaGordaKg: 18.3, percentualMassaLegra: 76.6, massaMagraKg: 59.7 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('compararAvaliacoes', () => {
  it('compara peso/%gordura/massa magra corretamente (exemplo do pedido)', () => {
    const inicial = assessment({ id: 'i', anthropometry: { peso: 78, altura: 175, imc: 78 / 1.75 ** 2 } });
    const atual = assessment({
      id: 'a',
      anthropometry: { peso: 74.2, altura: 175, imc: 74.2 / 1.75 ** 2 },
      results: { percentualGordura: 18.7, percentualMassaGorda: 18.7, massaGordaKg: 13.9, percentualMassaLegra: 81.3, massaMagraKg: 60.3 },
    });

    const itens = compararAvaliacoes(inicial, atual);

    const peso = itens.find((i) => i.label === 'Peso')!;
    expect(peso.diferenca).toBeCloseTo(-3.8, 5);
    expect(peso.direcao).toBe('reducao');

    const gordura = itens.find((i) => i.label === '% Gordura')!;
    expect(gordura.unidadeDiferenca).toBe('p.p.');
    expect(gordura.direcao).toBe('reducao');

    const massaMagra = itens.find((i) => i.label === 'Massa magra')!;
    expect(massaMagra.diferenca).toBeCloseTo(0.6, 5);
    expect(massaMagra.direcao).toBe('aumento');
  });

  it('classifica como estável quando a diferença arredonda pra zero na precisão de exibição', () => {
    const inicial = assessment({ id: 'i' });
    const atual = assessment({ id: 'a', anthropometry: { peso: 78.02, altura: 175, imc: 78.02 / 1.75 ** 2 } });
    const peso = compararAvaliacoes(inicial, atual).find((i) => i.label === 'Peso')!;
    expect(peso.direcao).toBe('estavel'); // 78,0 -> 78,0 na exibição (1 casa)
  });

  it('não assume que aumento é ruim nem redução é boa — só classifica a direção', () => {
    const inicial = assessment({ id: 'i' });
    const atual = assessment({ id: 'a', results: { ...assessment().results, massaMagraKg: 65 } });
    const item = compararAvaliacoes(inicial, atual).find((i) => i.label === 'Massa magra')!;
    expect(item.direcao).toBe('aumento');
    expect(item).not.toHaveProperty('interpretacao');
    expect(item).not.toHaveProperty('positivo');
  });

  it('pareia circunferências por nome (não por id), inclusive personalizadas', () => {
    const inicial = assessment({
      circumferences: [{ id: 'cintura', nome: 'Cintura', valor: 90, unidade: 'cm', lado: 'none' }],
    });
    const atual = assessment({
      circumferences: [{ id: 'cintura', nome: 'Cintura', valor: 84.8, unidade: 'cm', lado: 'none' }],
    });
    const item = compararAvaliacoes(inicial, atual).find((i) => i.label === 'Cintura')!;
    expect(item.diferenca).toBeCloseTo(-5.2, 5);
    expect(item.unidade).toBe('cm');
  });

  it('ignora circunferência que só existe em uma das duas avaliações', () => {
    const inicial = assessment({ circumferences: [] });
    const atual = assessment({
      circumferences: [{ id: 'cintura', nome: 'Cintura', valor: 84, unidade: 'cm', lado: 'none' }],
    });
    expect(compararAvaliacoes(inicial, atual).some((i) => i.label === 'Cintura')).toBe(false);
  });

  it('só compara soma das dobras quando as duas são do protocolo skinfold', () => {
    const dobras = assessment({ id: 'd', protocol: 'skinfold', skinfolds: skinfoldSet(10) });
    const bio = assessment({ id: 'b', protocol: 'bioimpedance' });

    expect(compararAvaliacoes(dobras, bio).some((i) => i.label === 'Soma das dobras')).toBe(false);

    const dobras2 = assessment({ id: 'd2', protocol: 'skinfold', skinfolds: skinfoldSet(8) });
    const item = compararAvaliacoes(dobras, dobras2).find((i) => i.label === 'Soma das dobras')!;
    expect(item.diferenca).toBeCloseTo((8 - 10) * 7, 5);
  });

  it('não inventa gordura visceral/TMB quando nenhuma das duas é bioimpedância', () => {
    const itens = compararAvaliacoes(assessment({ id: 'i' }), assessment({ id: 'a' }));
    expect(itens.some((i) => i.label === 'Gordura visceral')).toBe(false);
    expect(itens.some((i) => i.label === 'Metabolismo basal')).toBe(false);
  });
});

describe('formatação pt-BR (vírgula decimal)', () => {
  it('formatarValorComparacao usa vírgula', () => {
    expect(formatarValorComparacao(78, 'kg')).toBe('78,0 kg');
    expect(formatarValorComparacao(23.4, '%')).toBe('23,4%');
  });

  it('formatarDiferencaDescritiva escreve "pontos percentuais" por extenso', () => {
    expect(formatarDiferencaDescritiva(-4.7, 'p.p.')).toBe('-4,7 pontos percentuais');
  });

  it('formatarDiferencaDescritiva mantém unidades abreviadas fora de %', () => {
    expect(formatarDiferencaDescritiva(-3.8, 'kg')).toBe('-3,8 kg');
    expect(formatarDiferencaDescritiva(0.6, 'kg')).toBe('+0,6 kg');
    expect(formatarDiferencaDescritiva(-5.2, 'cm')).toBe('-5,2 cm');
  });
});
