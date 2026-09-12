import { describe, expect, it } from 'vitest';
import {
  STANDARD_CIRCUMFERENCES,
  criarCircunferenciaPersonalizada,
  criarCircunferenciasPadrao,
  paraRegistroHistorico,
  validarCircunferencias,
} from '../circumference';

describe('criarCircunferenciasPadrao', () => {
  it('cria os 10 pontos padrão, sem valor', () => {
    const entries = criarCircunferenciasPadrao();
    expect(entries).toHaveLength(10);
    expect(entries.every((e) => e.valor === undefined)).toBe(true);
    expect(entries.every((e) => e.unidade === 'cm')).toBe(true);
    expect(entries.map((e) => e.id)).toEqual(STANDARD_CIRCUMFERENCES.map((s) => s.id));
  });

  it('marca o lado apenas nos pontos pareados, "none" nos demais', () => {
    const entries = criarCircunferenciasPadrao();
    const cintura = entries.find((e) => e.id === 'cintura');
    const bracoDireito = entries.find((e) => e.id === 'bracoDireito');
    expect(cintura?.lado).toBe('none');
    expect(bracoDireito?.lado).toBe('direito');
  });
});

describe('criarCircunferenciaPersonalizada', () => {
  it('cria uma medida vazia, sem lado, marcada como personalizada', () => {
    const entry = criarCircunferenciaPersonalizada();
    expect(entry.personalizada).toBe(true);
    expect(entry.nome).toBe('');
    expect(entry.valor).toBeUndefined();
    expect(entry.lado).toBe('none');
    expect(entry.id).toBeTruthy();
  });

  it('gera ids diferentes a cada chamada', () => {
    const a = criarCircunferenciaPersonalizada();
    const b = criarCircunferenciaPersonalizada();
    expect(a.id).not.toBe(b.id);
  });
});

describe('validarCircunferencias', () => {
  it('não acusa erro quando tudo está vazio (nenhuma medida é obrigatória)', () => {
    expect(validarCircunferencias(criarCircunferenciasPadrao())).toEqual([]);
  });

  it('aceita valores preenchidos válidos', () => {
    const entries = criarCircunferenciasPadrao().map((e) => (e.id === 'cintura' ? { ...e, valor: 82.5 } : e));
    expect(validarCircunferencias(entries)).toEqual([]);
  });

  it('acusa valor negativo', () => {
    const entries = criarCircunferenciasPadrao().map((e) => (e.id === 'cintura' ? { ...e, valor: -1 } : e));
    const erros = validarCircunferencias(entries);
    expect(erros.some((e) => e.id === 'cintura')).toBe(true);
  });

  it('acusa valor implausível', () => {
    const entries = criarCircunferenciasPadrao().map((e) => (e.id === 'coxaDireita' ? { ...e, valor: 500 } : e));
    const erros = validarCircunferencias(entries);
    expect(erros.some((e) => e.id === 'coxaDireita')).toBe(true);
  });

  it('acusa medida personalizada sem nome', () => {
    const entries = [...criarCircunferenciasPadrao(), { ...criarCircunferenciaPersonalizada(), valor: 30 }];
    const custom = entries[entries.length - 1];
    const erros = validarCircunferencias(entries);
    expect(erros.some((e) => e.id === custom.id)).toBe(true);
  });

  it('acusa nomes duplicados', () => {
    const entries = criarCircunferenciasPadrao();
    const duplicata = { ...criarCircunferenciaPersonalizada(), nome: 'Cintura', valor: 80 };
    const comDuplicata = [...entries, duplicata];
    const erros = validarCircunferencias(comDuplicata);
    expect(erros.some((e) => e.id === duplicata.id)).toBe(true);
  });
});

describe('paraRegistroHistorico', () => {
  it('inclui só medidas com valor preenchido, com nome/unidade/lado', () => {
    const entries = criarCircunferenciasPadrao().map((e) => {
      if (e.id === 'cintura') return { ...e, valor: 82.5 };
      if (e.id === 'quadril') return { ...e, valor: 101 };
      return e;
    });
    const registro = paraRegistroHistorico(entries);
    expect(registro).toHaveLength(2);
    expect(registro).toContainEqual({
      id: 'cintura',
      nome: 'Cintura',
      valor: 82.5,
      unidade: 'cm',
      lado: 'none',
      personalizada: false,
    });
    expect(registro).toContainEqual({
      id: 'quadril',
      nome: 'Quadril',
      valor: 101,
      unidade: 'cm',
      lado: 'none',
      personalizada: false,
    });
  });

  it('retorna array vazio quando nenhuma medida foi preenchida', () => {
    expect(paraRegistroHistorico(criarCircunferenciasPadrao())).toEqual([]);
  });

  it('inclui medidas personalizadas preenchidas, com lado quando informado', () => {
    const custom = { ...criarCircunferenciaPersonalizada(), nome: 'Punho direito', valor: 17.2, lado: 'direito' as const };
    const registro = paraRegistroHistorico([custom]);
    expect(registro).toEqual([
      { id: custom.id, nome: 'Punho direito', valor: 17.2, unidade: 'cm', lado: 'direito', personalizada: true },
    ]);
  });
});
