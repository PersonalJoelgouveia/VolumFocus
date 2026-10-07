import { describe, it, expect } from 'vitest';
import { agruparTreinosDaSemana, formatarDias } from '../agruparTreinos';
import { criarRotinaVazia } from '../../types/aluno';
import type { AlunoRotinaDia } from '../../types/aluno';

const a: AlunoRotinaDia = { tipo: 'Peito', exercicios: [{ nome: 'Supino', series: 3, reps: '10', carga: 40 }] };
const b: AlunoRotinaDia = { tipo: 'Costas', exercicios: [{ nome: 'Remada', series: 3, reps: '10', carga: 30 }] };
const c: AlunoRotinaDia = { tipo: 'Pernas', exercicios: [{ nome: 'Agachamento', series: 4, reps: '8', carga: 60 }] };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('agruparTreinosDaSemana', () => {
  it('ABC repetido em 6 dias vira 3 treinos + 1 descanso', () => {
    const r = criarRotinaVazia();
    [a, b, c, a, b, c].forEach((t, i) => (r[i] = clone(t)));
    const { treinos, descanso } = agruparTreinosDaSemana(r);
    expect(treinos.map((t) => [t.letra, t.dias])).toEqual([['A', [0, 3]], ['B', [1, 4]], ['C', [2, 5]]]);
    expect(descanso).toEqual([6]);
    expect(formatarDias(treinos[0].dias)).toBe('SEG · QUI');
  });

  it('dias que diferem em carga NÃO são fundidos', () => {
    const r = criarRotinaVazia();
    r[0] = clone(a);
    r[2] = clone(a);
    (r[2].exercicios[0] as { carga: number }).carga = 45;
    expect(agruparTreinosDaSemana(r).treinos).toHaveLength(2);
  });

  it('ignora o nome dos ids de grupo ao comparar', () => {
    const g = (id: string): AlunoRotinaDia => ({
      tipo: 'X',
      exercicios: [
        { nome: 'E1', series: 3, reps: '10', carga: 10, groupId: id, groupType: 'biset' },
        { nome: 'E2', series: 3, reps: '10', carga: 10, groupId: id, groupType: 'biset' },
      ],
    });
    const r = criarRotinaVazia();
    r[0] = g('abc');
    r[3] = g('xyz');
    expect(agruparTreinosDaSemana(r).treinos).toHaveLength(1);
  });

  it('semana vazia: sem treinos, 7 de descanso', () => {
    const s = agruparTreinosDaSemana(criarRotinaVazia());
    expect(s.treinos).toEqual([]);
    expect(s.descanso).toHaveLength(7);
  });
});
