import { describe, expect, it } from 'vitest';
import { dateInputParaISO, formatarDataCurta, hojeISODate, paraDateInputValue } from '../timelineDate';

describe('formatarDataCurta', () => {
  it('formata como "DD MES AAAA" em maiúsculas', () => {
    expect(formatarDataCurta(new Date(2026, 8, 11))).toBe('11 SET 2026');
  });

  it('aceita string ISO', () => {
    expect(formatarDataCurta('2026-01-05T12:00:00')).toBe('05 JAN 2026');
  });

  it('preenche o dia com zero à esquerda', () => {
    expect(formatarDataCurta(new Date(2026, 11, 3))).toBe('03 DEZ 2026');
  });
});

describe('hojeISODate / paraDateInputValue / dateInputParaISO', () => {
  it('hojeISODate bate com paraDateInputValue(new Date())', () => {
    expect(hojeISODate()).toBe(paraDateInputValue(new Date()));
  });

  it('paraDateInputValue converte pro formato YYYY-MM-DD', () => {
    expect(paraDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(paraDateInputValue('2026-09-11T12:00:00')).toBe('2026-09-11');
  });

  it('dateInputParaISO/paraDateInputValue fazem a viagem de ida e volta sem trocar o dia', () => {
    const iso = dateInputParaISO('2026-03-20');
    expect(paraDateInputValue(iso)).toBe('2026-03-20');
  });
});
