import { describe, expect, it } from 'vitest';
import {
  ONLINE_CIRCUMFERENCE_POINTS,
  avaliarQualidadePonto,
  calcularIMC,
  calcularMedia,
  calcularRCE,
  calcularRCQ,
  classificarIMC,
  classificarRCE,
  classificarRCQ,
  criarPontosCircunferenciaOnline,
  derivarRCQDeCircunferencias,
  montarAvaliacaoOnline,
  paraRegistroHistoricoOnline,
  pontosCircunferenciaDoRegistro,
  precisaOrientacaoProfissional,
  temDiscrepanciaSignificativa,
  validarAltura,
  validarPeso,
  validarValorCircunferencia,
} from '../onlineAssessment';
import { paraDateInputValue } from '../timelineDate';

describe('calcularIMC', () => {
  it('calcula peso/altura²', () => {
    expect(calcularIMC(70, 175)).toBeCloseTo(70 / 1.75 ** 2, 6);
  });
});

describe('classificarIMC', () => {
  it('classifica as faixas da OMS', () => {
    expect(classificarIMC(17).label).toBe('Abaixo do peso');
    expect(classificarIMC(22).label).toBe('Peso normal');
    expect(classificarIMC(27).label).toBe('Sobrepeso');
    expect(classificarIMC(32).label).toBe('Obesidade grau I');
    expect(classificarIMC(37).label).toBe('Obesidade grau II');
    expect(classificarIMC(41).label).toBe('Obesidade grau III');
  });

  it('bordas ficam na faixa superior', () => {
    expect(classificarIMC(18.5).label).toBe('Peso normal');
    expect(classificarIMC(25).label).toBe('Sobrepeso');
    expect(classificarIMC(30).label).toBe('Obesidade grau I');
  });
});

describe('calcularRCQ / calcularRCE', () => {
  it('RCQ = cintura/quadril', () => {
    expect(calcularRCQ(80, 100)).toBeCloseTo(0.8, 6);
  });

  it('RCE = cintura/altura (mesma unidade)', () => {
    expect(calcularRCE(80, 175)).toBeCloseTo(80 / 175, 6);
  });
});

describe('classificarRCQ', () => {
  it('classifica homens pelas faixas da OMS (2008)', () => {
    expect(classificarRCQ(0.85, 'M')?.label).toBe('Baixo');
    expect(classificarRCQ(0.9, 'M')?.label).toBe('Baixo');
    expect(classificarRCQ(0.95, 'M')?.label).toBe('Moderado');
    expect(classificarRCQ(0.99, 'M')?.label).toBe('Moderado');
    expect(classificarRCQ(1.0, 'M')?.label).toBe('Alto');
    expect(classificarRCQ(1.1, 'M')?.label).toBe('Alto');
  });

  it('classifica mulheres pelas faixas da OMS (2008)', () => {
    expect(classificarRCQ(0.75, 'F')?.label).toBe('Baixo');
    expect(classificarRCQ(0.8, 'F')?.label).toBe('Baixo');
    expect(classificarRCQ(0.82, 'F')?.label).toBe('Moderado');
    expect(classificarRCQ(0.84, 'F')?.label).toBe('Moderado');
    expect(classificarRCQ(0.85, 'F')?.label).toBe('Alto');
    expect(classificarRCQ(0.95, 'F')?.label).toBe('Alto');
  });

  it('sem sexo biológico conhecido, não classifica (não inventa)', () => {
    expect(classificarRCQ(0.95, undefined)).toBeUndefined();
  });
});

describe('derivarRCQDeCircunferencias', () => {
  it('calcula RCQ quando cintura e quadril estão presentes', () => {
    const rcq = derivarRCQDeCircunferencias([
      { id: 'cintura', nome: 'Cintura', valor: 80, unidade: 'cm', lado: 'none' },
      { id: 'quadril', nome: 'Quadril', valor: 100, unidade: 'cm', lado: 'none' },
      { id: 'torax', nome: 'Tórax', valor: 95, unidade: 'cm', lado: 'none' },
    ]);
    expect(rcq).toBeCloseTo(0.8, 6);
  });

  it('retorna undefined quando falta cintura ou quadril — nunca inventa', () => {
    expect(derivarRCQDeCircunferencias([{ id: 'quadril', nome: 'Quadril', valor: 100, unidade: 'cm', lado: 'none' }])).toBeUndefined();
    expect(derivarRCQDeCircunferencias([])).toBeUndefined();
  });
});

describe('classificarRCE', () => {
  it('classifica as 3 faixas do pedido', () => {
    expect(classificarRCE(0.45).label).toMatch(/referência inferior/);
    expect(classificarRCE(0.55).label).toMatch(/aumentada/);
    expect(classificarRCE(0.65).label).toMatch(/elevada/);
  });

  it('sinaliza limitação quando IMC >= 35', () => {
    expect(classificarRCE(0.55, 36).limitacao).toBeDefined();
    expect(classificarRCE(0.55, 30).limitacao).toBeUndefined();
  });

  it('nunca retorna linguagem de diagnóstico', () => {
    const r = classificarRCE(0.65);
    expect(r.label.toLowerCase()).not.toMatch(/saudáv|doente/);
  });
});

describe('temDiscrepanciaSignificativa / avaliarQualidadePonto', () => {
  it('sinaliza diferença acima do limiar', () => {
    expect(temDiscrepanciaSignificativa(80, 81.5)).toBe(true);
    expect(temDiscrepanciaSignificativa(80, 80.5)).toBe(false);
  });

  it('checklist reflete duas medidas + diferença pequena', () => {
    expect(avaliarQualidadePonto(80, 80.4)).toEqual({ duasMedidasRealizadas: true, diferencaPequena: true });
    expect(avaliarQualidadePonto(80, 82)).toEqual({ duasMedidasRealizadas: true, diferencaPequena: false });
    expect(avaliarQualidadePonto(80, undefined)).toEqual({ duasMedidasRealizadas: false, diferencaPequena: false });
  });
});

describe('calcularMedia', () => {
  it('média aritmética simples', () => {
    expect(calcularMedia(80, 82)).toBe(81);
  });
});

describe('validações básicas', () => {
  it('peso', () => {
    expect(validarPeso(undefined)).toBeDefined();
    expect(validarPeso(0)).toBeDefined();
    expect(validarPeso(-5)).toBeDefined();
    expect(validarPeso(400)).toBeDefined();
    expect(validarPeso(75)).toBeUndefined();
  });

  it('altura', () => {
    expect(validarAltura(undefined)).toBeDefined();
    expect(validarAltura(0)).toBeDefined();
    expect(validarAltura(300)).toBeDefined();
    expect(validarAltura(175)).toBeUndefined();
  });

  it('circunferência é opcional, mas valida faixa quando preenchida', () => {
    expect(validarValorCircunferencia(undefined)).toBeUndefined();
    expect(validarValorCircunferencia(-1)).toBeDefined();
    expect(validarValorCircunferencia(400)).toBeDefined();
    expect(validarValorCircunferencia(80)).toBeUndefined();
  });
});

describe('ONLINE_CIRCUMFERENCE_POINTS', () => {
  it('tem 11 pontos, cintura e quadril padronizados com WHO_STEPS', () => {
    expect(ONLINE_CIRCUMFERENCE_POINTS).toHaveLength(11);
    const cintura = ONLINE_CIRCUMFERENCE_POINTS.find((p) => p.id === 'cintura');
    const quadril = ONLINE_CIRCUMFERENCE_POINTS.find((p) => p.id === 'quadril');
    expect(cintura?.padronizada).toBe(true);
    expect(cintura?.measurementMethod).toBe('WHO_STEPS');
    expect(quadril?.padronizada).toBe(true);
    expect(quadril?.measurementMethod).toBe('WHO_STEPS');
    const outros = ONLINE_CIRCUMFERENCE_POINTS.filter((p) => p.id !== 'cintura' && p.id !== 'quadril');
    expect(outros.every((p) => !p.padronizada)).toBe(true);
  });
});

describe('criarPontosCircunferenciaOnline / paraRegistroHistoricoOnline', () => {
  it('cria os 11 pontos vazios', () => {
    const pontos = criarPontosCircunferenciaOnline();
    expect(pontos).toHaveLength(11);
    expect(pontos.every((p) => p.m1 === '' && p.m2 === '')).toBe(true);
  });

  it('usa a média das duas medidas quando ambas existem', () => {
    const pontos = criarPontosCircunferenciaOnline();
    const cintura = pontos.find((p) => p.id === 'cintura')!;
    cintura.m1 = '80';
    cintura.m2 = '82';
    const registro = paraRegistroHistoricoOnline(pontos);
    const entrada = registro.find((r) => r.id === 'cintura')!;
    expect(entrada.valor).toBe(81);
    expect(entrada.measurementMethod).toBe('WHO_STEPS');
  });

  it('usa a única medida quando só uma foi tirada', () => {
    const pontos = criarPontosCircunferenciaOnline();
    const torax = pontos.find((p) => p.id === 'torax')!;
    torax.m1 = '95';
    const registro = paraRegistroHistoricoOnline(pontos);
    expect(registro.find((r) => r.id === 'torax')?.valor).toBe(95);
  });

  it('pontos sem nenhuma medida não entram no registro', () => {
    const pontos = criarPontosCircunferenciaOnline();
    const registro = paraRegistroHistoricoOnline(pontos);
    expect(registro).toHaveLength(0);
  });
});

describe('montarAvaliacaoOnline', () => {
  it('monta o registro com IMC/RCQ/RCE calculados e status/submittedBy corretos', () => {
    const pontos = criarPontosCircunferenciaOnline();
    const cintura = pontos.find((p) => p.id === 'cintura')!;
    cintura.m1 = '80';
    cintura.m2 = '80';
    const quadril = pontos.find((p) => p.id === 'quadril')!;
    quadril.m1 = '100';
    quadril.m2 = '100';

    const assessment = montarAvaliacaoOnline(
      'aluno-1',
      {
        assessmentId: 'af-teste-1',
        data: '2026-05-10',
        maoDominante: 'direita',
        objetivoPrincipal: 'Emagrecimento',
        nivelExperiencia: 'Iniciante',
        peso: '80',
        altura: '160',
        pontosCircunferencia: pontos,
        questionario: {},
      },
      'enviada'
    );

    expect(assessment.protocol).toBe('online');
    expect(assessment.status).toBe('enviada');
    expect(assessment.submittedBy).toBe('aluno');
    expect(assessment.anthropometry.imc).toBeCloseTo(calcularIMC(80, 160), 6);
    expect(assessment.results.relacaoCinturaQuadril).toBeCloseTo(0.8, 6);
    expect(assessment.results.relacaoCinturaEstatura).toBeCloseTo(0.5, 6);
    expect(assessment.results.percentualGordura).toBeUndefined();
    expect(assessment.notes).toContain('Mão dominante: Direita');
    expect(assessment.questionnaire?.objetivoPrincipal).toBe('Emagrecimento');
    expect(paraDateInputValue(assessment.date)).toBe('2026-05-10');
  });
});

describe('pontosCircunferenciaDoRegistro', () => {
  it('reconstrói m1=m2=média salva pros pontos padrão e cria extras pra personalizadas', () => {
    const pontos = pontosCircunferenciaDoRegistro([
      { id: 'cintura', nome: 'Cintura', valor: 81, unidade: 'cm', lado: 'none', measurementMethod: 'WHO_STEPS' },
      { id: 'circ-custom-1', nome: 'Punho', valor: 17, unidade: 'cm', lado: 'none', personalizada: true },
    ]);
    const cintura = pontos.find((p) => p.id === 'cintura')!;
    expect(cintura.m1).toBe('81');
    expect(cintura.m2).toBe('81');
    const punho = pontos.find((p) => p.id === 'circ-custom-1')!;
    expect(punho.personalizada).toBe(true);
    expect(punho.nome).toBe('Punho');
    expect(punho.m1).toBe('17');
  });
});

describe('triagem de saúde', () => {
  it('sem respostas não precisa de orientação', () => {
    expect(precisaOrientacaoProfissional(undefined)).toBe(false);
    expect(precisaOrientacaoProfissional({ condicaoCardiaca: false })).toBe(false);
  });

  it('qualquer resposta true já sinaliza', () => {
    expect(precisaOrientacaoProfissional({ condicaoCardiaca: false, dorPeitoRepouso: true })).toBe(true);
  });
});
