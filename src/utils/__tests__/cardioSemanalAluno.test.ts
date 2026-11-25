import { describe, expect, it } from 'vitest';
import { assinaturaResumo, montarResumoCardio, semanaId, validarResumoRemoto } from '../cardioSemanalAluno';

const ex = [{ id: 'e1', name: 'Esteira' }] as never;
const cardio = (d: number, i = 5) => ({ exId: 'e1', type: 'cardio', duration: d, intensity: i, hrZone: 'z2' });

describe('semanaId', () => {
  it('devolve a segunda-feira da semana', () => {
    expect(semanaId(new Date(2026, 10, 25))).toBe('2026-11-23'); // quarta
    expect(semanaId(new Date(2026, 10, 23))).toBe('2026-11-23'); // segunda
    expect(semanaId(new Date(2026, 10, 29))).toBe('2026-11-23'); // domingo
    expect(semanaId(new Date(2026, 11, 1))).toBe('2026-11-30');
  });
});

describe('montarResumoCardio', () => {
  it('soma só cardio e ignora força', () => {
    const log = { 0: [cardio(15), { exId: 'x', type: 'strength' }], 1: [cardio(24, 8)] } as never;
    const r = montarResumoCardio(log, ex, 90, new Date(2026, 10, 25));
    expect(r.totalMin).toBe(39);
    expect(r.sessoes).toHaveLength(2);
    expect(r.sessoes[1]).toMatchObject({ nome: 'Esteira', duracao: 24, intensidade: 8 });
    expect(r.semana).toBe('2026-11-23');
    expect(r.metaMin).toBe(90);
  });
  it('assinatura ignora o carimbo de hora', () => {
    const a = montarResumoCardio({} as never, ex, 90, new Date(2026, 10, 25, 10));
    const b = montarResumoCardio({} as never, ex, 90, new Date(2026, 10, 25, 11));
    expect(assinaturaResumo(a)).toBe(assinaturaResumo(b));
  });
});

describe('validarResumoRemoto', () => {
  const ok = { semana: '2026-11-23', totalMin: 10, metaMin: 90, atualizadoEm: 'x', sessoes: [{ dia: 'SEG', nome: 'a', duracao: 10, intensidade: 5 }] };
  it('aceita válido e rejeita malformado / id divergente', () => {
    expect(validarResumoRemoto(ok, '2026-11-23')).not.toBeNull();
    expect(validarResumoRemoto(ok, '2026-11-30')).toBeNull();
    expect(validarResumoRemoto({ ...ok, totalMin: 'x' }, '2026-11-23')).toBeNull();
    expect(validarResumoRemoto({ ...ok, sessoes: [1] }, '2026-11-23')).toBeNull();
    expect(validarResumoRemoto(null, '2026-11-23')).toBeNull();
  });
});
