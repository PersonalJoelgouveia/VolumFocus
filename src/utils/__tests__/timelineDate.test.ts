import { describe, expect, it } from 'vitest';
import { formatarDataCurta } from '../timelineDate';

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
