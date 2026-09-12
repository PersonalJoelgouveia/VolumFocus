import { describe, expect, it } from 'vitest';
import {
  calcIMC,
  calcMassaGorda,
  calcMassaMagra,
  calcularBioimpedancia,
  validarInputsBioimpedancia,
} from '../bioimpedance';

describe('calcIMC', () => {
  it('calcula peso / altura(m)²', () => {
    expect(calcIMC(80, 180)).toBeCloseTo(80 / 1.8 ** 2, 10);
  });
});

describe('calcMassaGorda', () => {
  it('calcula peso × %gordura/100', () => {
    expect(calcMassaGorda(80, 20)).toBeCloseTo(16, 10);
  });
});

describe('calcMassaMagra', () => {
  it('calcula peso × %massaMagra/100', () => {
    expect(calcMassaMagra(80, 80)).toBeCloseTo(64, 10);
  });
});

describe('calcularBioimpedancia', () => {
  it('usa os cálculos via percentual quando não há override', () => {
    const r = calcularBioimpedancia(80, 180, 20, 80);
    expect(r.imc).toBeCloseTo(80 / 1.8 ** 2, 10);
    expect(r.massaGordaKg).toBeCloseTo(16, 10);
    expect(r.massaMagraKg).toBeCloseTo(64, 10);
  });

  it('prioriza massaGordaKg manual sobre o cálculo via percentual', () => {
    const r = calcularBioimpedancia(80, 180, 20, 80, { massaGordaKg: 15 });
    expect(r.massaGordaKg).toBe(15);
    expect(r.massaMagraKg).toBeCloseTo(64, 10); // não afetado
  });

  it('prioriza massaMagraKg manual sobre o cálculo via percentual', () => {
    const r = calcularBioimpedancia(80, 180, 20, 80, { massaMagraKg: 63 });
    expect(r.massaMagraKg).toBe(63);
    expect(r.massaGordaKg).toBeCloseTo(16, 10); // não afetado
  });

  it('não arredonda em nenhuma etapa intermediária', () => {
    const r = calcularBioimpedancia(83.4, 176, 21.7, 76.8);
    expect(Number.isInteger(r.imc * 1000)).toBe(false);
  });
});

describe('validarInputsBioimpedancia', () => {
  const inputsValidos = {
    pesoKg: 80,
    alturaCm: 180,
    percentualGordura: 20,
    percentualMassaMagra: 80,
    gorduraVisceral: 8,
    metabolismoBasal: 1800,
    massaGordaKg: 16,
    massaMagraKg: 64,
  };

  it('não retorna erro para um conjunto de inputs válido', () => {
    expect(validarInputsBioimpedancia(inputsValidos)).toEqual([]);
  });

  it.each(['pesoKg', 'alturaCm', 'percentualGordura', 'percentualMassaMagra', 'gorduraVisceral', 'metabolismoBasal'])(
    'acusa %s ausente',
    (campo) => {
      const erros = validarInputsBioimpedancia({ ...inputsValidos, [campo]: undefined });
      expect(erros.length).toBeGreaterThan(0);
    }
  );

  it('acusa percentual de gordura fora da faixa plausível', () => {
    const erros = validarInputsBioimpedancia({ ...inputsValidos, percentualGordura: 95 });
    expect(erros.some((e) => e.field === 'percentualGordura')).toBe(true);
  });

  it('acusa gordura visceral fora da faixa plausível', () => {
    const erros = validarInputsBioimpedancia({ ...inputsValidos, gorduraVisceral: 100 });
    expect(erros.some((e) => e.field === 'gorduraVisceral')).toBe(true);
  });

  it('acusa TMB implausível', () => {
    const erros = validarInputsBioimpedancia({ ...inputsValidos, metabolismoBasal: 100 });
    expect(erros.some((e) => e.field === 'metabolismoBasal')).toBe(true);
  });

  it('acusa massa gorda ausente, negativa ou maior que o peso', () => {
    expect(
      validarInputsBioimpedancia({ ...inputsValidos, massaGordaKg: undefined }).some((e) => e.field === 'massaGorda')
    ).toBe(true);
    expect(validarInputsBioimpedancia({ ...inputsValidos, massaGordaKg: -1 }).some((e) => e.field === 'massaGorda')).toBe(
      true
    );
    expect(validarInputsBioimpedancia({ ...inputsValidos, massaGordaKg: 90 }).some((e) => e.field === 'massaGorda')).toBe(
      true
    );
  });

  it('acusa massa magra ausente, negativa ou maior que o peso', () => {
    expect(
      validarInputsBioimpedancia({ ...inputsValidos, massaMagraKg: undefined }).some((e) => e.field === 'massaMagra')
    ).toBe(true);
    expect(validarInputsBioimpedancia({ ...inputsValidos, massaMagraKg: -1 }).some((e) => e.field === 'massaMagra')).toBe(
      true
    );
    expect(validarInputsBioimpedancia({ ...inputsValidos, massaMagraKg: 90 }).some((e) => e.field === 'massaMagra')).toBe(
      true
    );
  });
});
