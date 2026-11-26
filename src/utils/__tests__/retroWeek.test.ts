import { describe, expect, it } from 'vitest';
import { formatWeekRange, isCurrentWeek, mondayOf, shiftWeek, weekAllowed, weekAndDayOf } from '../retroWeek';

describe('retroWeek', () => {
  it('semana e dia do app (0=Seg…6=Dom) de uma data', () => {
    expect(weekAndDayOf(new Date(2026, 10, 25))).toEqual({ key: '2026-11-23', day: 2 }); // quarta
    expect(weekAndDayOf(new Date(2026, 10, 23))).toEqual({ key: '2026-11-23', day: 0 });
    expect(weekAndDayOf(new Date(2026, 10, 29))).toEqual({ key: '2026-11-23', day: 6 }); // domingo
    expect(weekAndDayOf(new Date(2026, 11, 1))).toEqual({ key: '2026-11-30', day: 1 });
  });
  it('mondayOf, shiftWeek e virada de ano', () => {
    expect(mondayOf(new Date(2027, 0, 1)).getDate()).toBe(28); // sex 01/01/2027 → seg 28/12/2026
    expect(shiftWeek('2026-11-23', -1)).toBe('2026-11-16');
    expect(shiftWeek('2026-12-28', 1)).toBe('2027-01-04');
  });
  it('formata o intervalo e valida limites', () => {
    expect(formatWeekRange('2026-11-23')).toBe('23/11 – 29/11/2026');
    const now = new Date(2026, 10, 26);
    expect(isCurrentWeek('2026-11-23', now)).toBe(true);
    expect(isCurrentWeek('2026-11-16', now)).toBe(false);
    expect(weekAllowed('2026-11-16', now)).toBe(true);
    expect(weekAllowed('2026-11-30', now)).toBe(false); // futuro bloqueado
  });
});
