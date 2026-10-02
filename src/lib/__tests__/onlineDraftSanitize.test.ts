import { describe, expect, it } from 'vitest';
import { criarPontosCircunferenciaOnline } from '../../utils/onlineAssessment';
import { sanearEstadoOnline, type OnlineFormState } from '../../utils/onlineDraftSanitize';

const base = (): OnlineFormState => ({
  data: '2026-10-02',
  maoDominante: '',
  objetivoPrincipal: '',
  nivelExperiencia: '',
  peso: '',
  altura: '',
  pontosCircunferencia: criarPontosCircunferenciaOnline(),
  questionario: {},
});

describe('sanearEstadoOnline — rascunho restaurado nunca derruba a tela', () => {
  it('não-objeto → null', () => {
    for (const v of [null, undefined, 'x', 7, [], true]) expect(sanearEstadoOnline(v, base())).toBeNull();
  });

  it('rascunho de versão antiga (campos ausentes) vira estado completo e renderizável', () => {
    const r = sanearEstadoOnline({ peso: '80', altura: 180 }, base())!;
    expect(r.peso).toBe('80');
    expect(r.altura).toBe('180');
    expect(Array.isArray(r.pontosCircunferencia)).toBe(true);
    expect(r.pontosCircunferencia.length).toBe(base().pontosCircunferencia.length);
    expect(r.questionario).toEqual({});
    expect(r.data).toBe('2026-10-02');
  });

  it('pontosCircunferencia inválido (string/objeto/undefined) cai nos pontos padrão', () => {
    for (const v of ['x', {}, undefined, 5, [null, 3, 'a']]) {
      const r = sanearEstadoOnline({ pontosCircunferencia: v }, base())!;
      expect(r.pontosCircunferencia).toEqual(base().pontosCircunferencia);
    }
  });

  it('restaura m1/m2 dos pontos conhecidos e ignora nome/lado/método vindos do rascunho', () => {
    const r = sanearEstadoOnline(
      { pontosCircunferencia: [{ id: 'cintura', nome: '<img src=x>', lado: 'qualquer', m1: '80', m2: 81 }] },
      base()
    )!;
    const cintura = r.pontosCircunferencia.find((p) => p.id === 'cintura')!;
    expect(cintura.m1).toBe('80');
    expect(cintura.m2).toBe('81');
    expect(cintura.nome).toBe('Cintura');
    expect(cintura.lado).toBe('none');
  });

  it('mantém medida personalizada válida e descarta id fora do padrão', () => {
    const r = sanearEstadoOnline(
      {
        pontosCircunferencia: [
          { id: 'circ-online-1-abc', personalizada: true, nome: 'Panturrilha', lado: 'direito', m1: '35', m2: '' },
          { id: '../../x', personalizada: true, nome: 'ruim', m1: '1', m2: '1' },
          { id: 'cintura', personalizada: true, m1: '1', m2: '1' },
        ],
      },
      base()
    )!;
    const extras = r.pontosCircunferencia.filter((p) => p.personalizada);
    expect(extras.map((p) => p.id)).toEqual(['circ-online-1-abc']);
    expect(extras[0]).toMatchObject({ nome: 'Panturrilha', lado: 'direito', m1: '35', padronizada: false });
  });

  it('questionário: só campos conhecidos e do tipo certo; triagem só booleanos', () => {
    const r = sanearEstadoOnline(
      {
        questionario: {
          horasSono: 7,
          qualidadeSono: 12, // tipo errado
          observacoes: 'ok',
          frequenciaSemanalTreino: 'muita', // tipo errado
          maoDominante: 'esquerda',
          campoInventado: 'x',
          triagemSaude: { dorPeito: true, tontura: 'sim', outra: false },
        },
      },
      base()
    )!;
    expect(r.questionario).toEqual({
      horasSono: 7,
      observacoes: 'ok',
      maoDominante: 'esquerda',
      triagemSaude: { dorPeito: true, outra: false },
    });
  });

  it('data inválida volta para a data base; textos longos são truncados; __proto__ não vaza', () => {
    const r = sanearEstadoOnline(
      JSON.parse('{"data":"ontem","objetivoPrincipal":"' + 'x'.repeat(500) + '","__proto__":{"polluido":true},"maoDominante":"canhoto"}'),
      base()
    )!;
    expect(r.data).toBe('2026-10-02');
    expect(r.objetivoPrincipal.length).toBe(200);
    expect(r.maoDominante).toBe('');
    expect(({} as Record<string, unknown>).polluido).toBeUndefined();
  });
});
