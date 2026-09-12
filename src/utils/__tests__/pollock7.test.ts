import { describe, expect, it } from 'vitest';
import {
  SKINFOLD_SITES,
  calcDensidadeCorporal,
  calcMediaDobra,
  calcPercentualGorduraSiri,
  calcularPollock7,
  inferirSexoDoGenero,
  somaSeteDobras,
  validarInputsPollock7,
  type SkinfoldTriples,
} from '../pollock7';

function triple(m1: number, m2: number, m3: number) {
  return { m1, m2, m3, media: calcMediaDobra(m1, m2, m3) };
}

/** 7 dobras iguais — soma é exatamente 7×valor, útil pra montar cenários. */
function uniformTriples(mediaAlvo: number): SkinfoldTriples {
  const t = triple(mediaAlvo, mediaAlvo, mediaAlvo);
  return SKINFOLD_SITES.reduce((acc, site) => ({ ...acc, [site]: t }), {} as SkinfoldTriples);
}

describe('calcMediaDobra', () => {
  it('calcula a média das 3 aferições sem arredondar', () => {
    expect(calcMediaDobra(12.4, 12.1, 12.3)).toBeCloseTo(12.266666666666667, 12);
  });
});

describe('somaSeteDobras', () => {
  it('soma a média dos 7 pontos', () => {
    const triples = uniformTriples(10); // soma = 70
    expect(somaSeteDobras(triples)).toBeCloseTo(70, 10);
  });

  it('soma corretamente médias distintas por ponto', () => {
    const triples: SkinfoldTriples = {
      peitoral: triple(10, 10, 10),
      axilarMedia: triple(8, 8, 8),
      triceps: triple(12, 12, 12),
      subescapular: triple(14, 14, 14),
      abdominal: triple(20, 20, 20),
      supraIliaca: triple(16, 16, 16),
      coxa: triple(18, 18, 18),
    };
    expect(somaSeteDobras(triples)).toBeCloseTo(98, 10);
  });
});

describe('calcDensidadeCorporal', () => {
  it('aplica a equação de homens (Jackson & Pollock 1978)', () => {
    expect(calcDensidadeCorporal('M', 100, 30)).toBeCloseTo(1.0653532, 6);
  });

  it('aplica a equação de mulheres (Jackson, Pollock & Ward 1980)', () => {
    expect(calcDensidadeCorporal('F', 120, 25)).toBeCloseTo(1.0454918, 6);
  });
});

describe('calcPercentualGorduraSiri', () => {
  it('converte densidade corporal em % de gordura', () => {
    expect(calcPercentualGorduraSiri(1.0653532)).toBeCloseTo(14.634639, 5);
  });
});

describe('calcularPollock7', () => {
  it('calcula o resultado completo para um homem', () => {
    const triples = uniformTriples(100 / 7);
    const r = calcularPollock7('M', 30, 80, triples);

    expect(r.somaDobras).toBeCloseTo(100, 9);
    expect(r.densidadeCorporal).toBeCloseTo(1.0653532, 6);
    expect(r.percentualGordura).toBeCloseTo(14.634639, 5);
    expect(r.massaGordaKg).toBeCloseTo(11.707712, 5);
    expect(r.massaMagraKg).toBeCloseTo(68.292288, 5);
    expect(r.percentualMassaMagra).toBeCloseTo(85.365361, 5);
    // massa gorda + massa magra sempre bate com o peso total
    expect(r.massaGordaKg + r.massaMagraKg).toBeCloseTo(80, 9);
  });

  it('calcula o resultado completo para uma mulher', () => {
    const triples = uniformTriples(120 / 7);
    const r = calcularPollock7('F', 25, 60, triples);

    expect(r.somaDobras).toBeCloseTo(120, 9);
    expect(r.percentualGordura).toBeCloseTo(23.461389, 5);
    expect(r.massaGordaKg).toBeCloseTo(14.076834, 5);
    expect(r.massaMagraKg).toBeCloseTo(45.923166, 5);
    expect(r.percentualMassaMagra).toBeCloseTo(76.538611, 5);
  });

  it('não arredonda em nenhuma etapa intermediária', () => {
    const triples = uniformTriples(97 / 7);
    const r = calcularPollock7('M', 41, 83.4, triples);
    // resultado bruto deve ter várias casas decimais (não é um número "redondo")
    expect(Number.isInteger(r.percentualGordura * 1000)).toBe(false);
  });
});

describe('validarInputsPollock7', () => {
  const triplesValidas = uniformTriples(10);

  it('não retorna erro para um conjunto de inputs válido', () => {
    expect(validarInputsPollock7('M', 30, 80, triplesValidas)).toEqual([]);
  });

  it('acusa sexo ausente', () => {
    const erros = validarInputsPollock7(undefined, 30, 80, triplesValidas);
    expect(erros.some((e) => e.field === 'sexo')).toBe(true);
  });

  it('acusa idade ausente ou fora da faixa', () => {
    expect(validarInputsPollock7('M', undefined, 80, triplesValidas).some((e) => e.field === 'idade')).toBe(true);
    expect(validarInputsPollock7('M', 15, 80, triplesValidas).some((e) => e.field === 'idade')).toBe(true);
    expect(validarInputsPollock7('M', 95, 80, triplesValidas).some((e) => e.field === 'idade')).toBe(true);
  });

  it('acusa peso ausente, negativo ou implausível', () => {
    expect(validarInputsPollock7('M', 30, undefined, triplesValidas).some((e) => e.field === 'peso')).toBe(true);
    expect(validarInputsPollock7('M', 30, -5, triplesValidas).some((e) => e.field === 'peso')).toBe(true);
    expect(validarInputsPollock7('M', 30, 400, triplesValidas).some((e) => e.field === 'peso')).toBe(true);
  });

  it('acusa dados insuficientes (dobra sem as 3 aferições)', () => {
    const incompletas = { ...triplesValidas, peitoral: { m1: 10, m2: undefined, m3: 10 } };
    const erros = validarInputsPollock7('M', 30, 80, incompletas);
    expect(erros.some((e) => e.field === 'peitoral')).toBe(true);
  });

  it('acusa aferição negativa', () => {
    const comNegativo = { ...triplesValidas, coxa: { m1: 10, m2: -1, m3: 10 } };
    const erros = validarInputsPollock7('M', 30, 80, comNegativo);
    expect(erros.some((e) => e.field === 'coxa')).toBe(true);
  });

  it('acusa aferição fisiologicamente implausível', () => {
    const comExagero = { ...triplesValidas, abdominal: { m1: 10, m2: 500, m3: 10 } };
    const erros = validarInputsPollock7('M', 30, 80, comExagero);
    expect(erros.some((e) => e.field === 'abdominal')).toBe(true);
  });
});

describe('inferirSexoDoGenero', () => {
  it.each(['M', 'masculino', 'Masculino', 'homem'])('reconhece "%s" como M', (g) => {
    expect(inferirSexoDoGenero(g)).toBe('M');
  });

  it.each(['F', 'feminino', 'Feminino', 'mulher'])('reconhece "%s" como F', (g) => {
    expect(inferirSexoDoGenero(g)).toBe('F');
  });

  it.each([undefined, '', 'Outro', 'prefiro não informar'])('retorna undefined para "%s" (ambíguo/ausente)', (g) => {
    expect(inferirSexoDoGenero(g)).toBeUndefined();
  });
});
