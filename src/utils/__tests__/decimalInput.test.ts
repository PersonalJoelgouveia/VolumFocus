import { describe, expect, it } from 'vitest';
import { decimalToInputText, parseDecimal, sanitizeDecimalInput } from '../decimalInput';

describe('parseDecimal', () => {
  it('aceita ponto e vírgula', () => {
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('20,75')).toBe(20.75);
    expect(parseDecimal(' 7 ')).toBe(7);
  });
  it('retorna undefined para vazio/inválido', () => {
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal(',')).toBeUndefined();
    expect(parseDecimal('abc')).toBeUndefined();
    expect(parseDecimal(null)).toBeUndefined();
  });
  it('tolera estado intermediário "12,"', () => {
    expect(parseDecimal('12,')).toBe(12);
  });
});

describe('sanitizeDecimalInput', () => {
  it('preserva o separador digitado e remove lixo', () => {
    expect(sanitizeDecimalInput('12,')).toBe('12,');
    expect(sanitizeDecimalInput('12.5kg')).toBe('12.5');
    expect(sanitizeDecimalInput('-5')).toBe('5');
  });
  it('aceita só um separador e limita casas decimais', () => {
    expect(sanitizeDecimalInput('1.2,3')).toBe('1.23');
    expect(sanitizeDecimalInput('20,755')).toBe('20,75');
  });
});

describe('decimalToInputText', () => {
  it('formata sem zeros à direita', () => {
    expect(decimalToInputText(12.5)).toBe('12.5');
    expect(decimalToInputText(10)).toBe('10');
    expect(decimalToInputText(undefined)).toBe('');
  });
});
