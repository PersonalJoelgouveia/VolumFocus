import { describe, expect, it } from 'vitest';
import { criarRotinaVazia } from '../../types/aluno';
import { resumirRotina, rotinaSemExercicios } from '../resumoRotina';

describe('resumirRotina', () => {
  it('semana vazia → sem dias e 0 exercícios', () => {
    expect(resumirRotina(criarRotinaVazia())).toEqual({ diasComTreino: [], totalExercicios: 0 });
  });
  it('conta só os dias com exercício, na ordem da semana', () => {
    const r = criarRotinaVazia();
    r[0].exercicios = [{ nome: 'A', series: 3, reps: '10', carga: 10 }, { nome: 'B', cardio: true, duracao: '20 min', intensidade: '5' }];
    r[4].exercicios = [{ nome: 'C', series: 3, reps: '10', carga: 10 }];
    expect(resumirRotina(r)).toEqual({ diasComTreino: [0, 4], totalExercicios: 3 });
  });
});

describe('rotinaSemExercicios', () => {
  it('true só quando NENHUM dia tem exercício', () => {
    const r = criarRotinaVazia();
    expect(rotinaSemExercicios(r)).toBe(true);
    r[6].exercicios = [{ nome: 'A', series: 1, reps: '1', carga: 0 }];
    expect(rotinaSemExercicios(r)).toBe(false);
  });
});
