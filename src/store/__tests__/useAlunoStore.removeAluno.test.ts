import { beforeEach, describe, expect, it } from 'vitest';
import { useAlunoStore } from '../useAlunoStore';
import type { PhysicalAssessment } from '../../types/assessment';
import type { TrainingNote } from '../../types/trainingNote';

const avaliacao = (id: string) => ({ id } as unknown as PhysicalAssessment);
const nota = (id: string) => ({ id } as unknown as TrainingNote);

describe('useAlunoStore.removeAluno', () => {
  beforeEach(() => useAlunoStore.setState({ alunos: [], avaliacoes: {}, notas: {} }));

  it('remove o aluno E o cache local de avaliações e anotações dele, sem tocar nos outros', () => {
    const a = useAlunoStore.getState().addAluno({ nome: 'A', email: 'a@x.com', foco: '' });
    const b = useAlunoStore.getState().addAluno({ nome: 'B', email: 'b@x.com', foco: '' });
    useAlunoStore.getState().setAvaliacoes(a.id, [avaliacao('av-a')]);
    useAlunoStore.getState().setAvaliacoes(b.id, [avaliacao('av-b')]);
    useAlunoStore.getState().setNotas(a.id, [nota('n-a')]);
    useAlunoStore.getState().setNotas(b.id, [nota('n-b')]);

    useAlunoStore.getState().removeAluno(a.id);

    const s = useAlunoStore.getState();
    expect(s.alunos.map((x) => x.id)).toEqual([b.id]);
    expect(Object.keys(s.avaliacoes)).toEqual([b.id]);
    expect(Object.keys(s.notas)).toEqual([b.id]);
    expect(s.getAvaliacoes(b.id)).toHaveLength(1);
    expect(s.getNotas(b.id)).toHaveLength(1);
  });

  it('alunos criados no mesmo instante têm ids diferentes (antes: aluno-<Date.now()> colidia)', () => {
    const ids = Array.from({ length: 200 }, (_, i) =>
      useAlunoStore.getState().addAluno({ nome: `A${i}`, email: `a${i}@x.com`, foco: '' }).id
    );
    expect(new Set(ids).size).toBe(200);
    expect(ids.every((id) => /^aluno-\d+-[a-z0-9]+$/.test(id))).toBe(true);
  });

  it('id inexistente não altera nada', () => {
    const a = useAlunoStore.getState().addAluno({ nome: 'A', email: 'a@x.com', foco: '' });
    useAlunoStore.getState().setAvaliacoes(a.id, [avaliacao('av-a')]);
    useAlunoStore.getState().removeAluno('nao-existe');
    expect(useAlunoStore.getState().alunos).toHaveLength(1);
    expect(useAlunoStore.getState().getAvaliacoes(a.id)).toHaveLength(1);
  });
});
