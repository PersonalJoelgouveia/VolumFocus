import { describe, expect, it } from 'vitest';
import { validarAvaliacaoRemota } from '../assessmentValidation';

const base = () => ({
  id: 'af-online-1-abc',
  alunoId: 'aluno-1',
  date: '2026-10-01T12:00:00.000Z',
  protocol: 'online',
  anthropometry: { peso: 80, altura: 180, imc: 24.7 },
  circumferences: [{ id: 'cintura', nome: 'Cintura', valor: 84, unidade: 'cm', lado: 'none' }],
  skinfolds: {},
  results: { relacaoCinturaEstatura: 0.47 },
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  status: 'enviada',
  submittedBy: 'aluno',
  questionnaire: { horasSono: 7 },
});

describe('validarAvaliacaoRemota', () => {
  it('aceita uma avaliação online válida', () => {
    const a = validarAvaliacaoRemota(base(), 'af-online-1-abc')!;
    expect(a.id).toBe('af-online-1-abc');
    expect(a.anthropometry.peso).toBe(80);
    expect(a.skinfolds.peitoral).toEqual({ measurement1: 0, measurement2: 0, measurement3: 0, average: 0 });
    expect(a.circumferences).toHaveLength(1);
    expect(a.status).toBe('enviada');
  });

  it('o id é SEMPRE o do documento, nunca o campo id do conteúdo (IDOR interno)', () => {
    const forjado = { ...base(), id: 'af-presencial-do-personal' };
    const a = validarAvaliacaoRemota(forjado, 'doc-do-aluno')!;
    expect(a.id).toBe('doc-do-aluno');
  });

  it.each([
    ['raw nulo', null],
    ['raw string', 'x'],
    ['raw array', []],
    ['sem anthropometry', { ...base(), anthropometry: undefined }],
    ['anthropometry nulo', { ...base(), anthropometry: null }],
    ['peso texto', { ...base(), anthropometry: { peso: '80', altura: 180, imc: 24 } }],
    ['peso NaN', { ...base(), anthropometry: { peso: NaN, altura: 180, imc: 24 } }],
    ['peso negativo', { ...base(), anthropometry: { peso: -1, altura: 180, imc: 24 } }],
    ['peso absurdo', { ...base(), anthropometry: { peso: 1e9, altura: 180, imc: 24 } }],
    ['protocolo desconhecido', { ...base(), protocol: 'admin' }],
    ['sem protocolo', { ...base(), protocol: undefined }],
    ['data inválida', { ...base(), date: 'ontem' }],
    ['sem data', { ...base(), date: undefined }],
    ['data fora de faixa', { ...base(), date: '0001-01-01T00:00:00Z' }],
  ])('rejeita documento malformado: %s', (_nome, raw) => {
    expect(validarAvaliacaoRemota(raw, 'doc-1')).toBeNull();
  });

  it.each(['', 'a/b', 'uidB:af-1', '../x', 'a'.repeat(129)])('rejeita id de documento inseguro %j', (id) => {
    expect(validarAvaliacaoRemota(base(), id)).toBeNull();
  });

  it('protocolo skinfold exige as 7 dobras; os demais recebem zeros', () => {
    expect(validarAvaliacaoRemota({ ...base(), protocol: 'skinfold', skinfolds: {} }, 'd1')).toBeNull();
    const dobra = { measurement1: 10, measurement2: 11, measurement3: 12, average: 11 };
    const completo = Object.fromEntries(
      ['peitoral', 'axilarMedia', 'triceps', 'subescapular', 'abdominal', 'supraIliaca', 'coxa'].map((s) => [s, dobra])
    );
    const a = validarAvaliacaoRemota({ ...base(), protocol: 'skinfold', skinfolds: completo }, 'd1')!;
    expect(a.skinfolds.coxa.average).toBe(11);
    expect(validarAvaliacaoRemota({ ...base(), protocol: 'bioimpedance', skinfolds: 'x' }, 'd2')!.skinfolds.coxa.average).toBe(0);
  });

  it('circunferências: descarta entradas ruins sem rejeitar o documento; lado e unidade normalizados', () => {
    const a = validarAvaliacaoRemota(
      {
        ...base(),
        circumferences: [
          { id: 'ok', nome: 'Braço', valor: 30, unidade: 'polegada', lado: 'direito' },
          { id: 'sem-valor', nome: 'x' },
          { id: 'texto', nome: 'x', valor: '30' },
          null,
          'lixo',
          { id: 'lado-ruim', nome: 'Coxa', valor: 50, lado: 'cima' },
        ],
      },
      'd1'
    )!;
    expect(a.circumferences.map((c) => c.id)).toEqual(['ok', 'lado-ruim']);
    expect(a.circumferences[0]).toMatchObject({ unidade: 'cm', lado: 'direito' });
    expect(a.circumferences[1].lado).toBe('none');
  });

  it('circumferences não-array vira lista vazia (a UI faz .map/.length)', () => {
    expect(validarAvaliacaoRemota({ ...base(), circumferences: { 0: 1 } }, 'd1')!.circumferences).toEqual([]);
  });

  it('results: só números conhecidos; lixo é descartado', () => {
    const a = validarAvaliacaoRemota(
      { ...base(), results: { percentualGordura: 20, relacaoCinturaQuadril: 'x', admin: true, massaMagraKg: NaN } },
      'd1'
    )!;
    expect(a.results).toEqual({ percentualGordura: 20 });
  });

  it('status/submittedBy inválidos são descartados; campos desconhecidos não passam', () => {
    const a = validarAvaliacaoRemota({ ...base(), status: 'aprovada', submittedBy: 'admin', isAdmin: true, __proto__x: 1 }, 'd1')!;
    expect(a.status).toBeUndefined();
    expect(a.submittedBy).toBeUndefined();
    expect('isAdmin' in a).toBe(false);
  });

  it('review: normaliza e limita; review malformado é descartado (a autenticidade é das regras)', () => {
    const ok = validarAvaliacaoRemota(
      {
        ...base(),
        review: {
          reviewedBy: 'pt@x.com',
          reviewedAt: '2026-10-02T10:00:00.000Z',
          reviewNote: 'ok',
          corrections: [{ field: 'peso', originalValue: '80', reviewedValue: '81' }, { field: 'x' }],
        },
      },
      'd1'
    )!;
    expect(ok.review).toEqual({
      reviewedBy: 'pt@x.com',
      reviewedAt: '2026-10-02T10:00:00.000Z',
      reviewNote: 'ok',
      corrections: [{ field: 'peso', originalValue: '80', reviewedValue: '81' }],
    });
    expect(validarAvaliacaoRemota({ ...base(), review: { reviewedBy: 5 } }, 'd1')!.review).toBeUndefined();
    expect(validarAvaliacaoRemota({ ...base(), review: 'x' }, 'd1')!.review).toBeUndefined();
  });

  it('aceita Timestamp do Firestore (objeto com toDate) e converte para ISO', () => {
    const ts = { toDate: () => new Date('2026-09-30T10:00:00.000Z') };
    const a = validarAvaliacaoRemota({ ...base(), date: ts, createdAt: ts, updatedAt: ts }, 'd1')!;
    expect(a.date).toBe('2026-09-30T10:00:00.000Z');
    expect(a.createdAt).toBe('2026-09-30T10:00:00.000Z');
  });

  it('createdAt/updatedAt ausentes caem para a data da avaliação', () => {
    const { createdAt, updatedAt, ...resto } = base();
    void createdAt;
    void updatedAt;
    const a = validarAvaliacaoRemota(resto, 'd1')!;
    expect(a.createdAt).toBe(a.date);
    expect(a.updatedAt).toBe(a.date);
  });

  it('textos longos são truncados e o resultado nunca derruba as contas da UI', () => {
    const a = validarAvaliacaoRemota({ ...base(), notes: 'x'.repeat(9999), evaluator: 'e'.repeat(999) }, 'd1')!;
    expect(a.notes!.length).toBe(5000);
    expect(a.evaluator!.length).toBe(200);
    // o que a UI faz sem checar:
    expect(() => a.anthropometry.peso.toFixed(1)).not.toThrow();
    expect(() => a.circumferences.map((c) => c.nome.trim())).not.toThrow();
  });
});
