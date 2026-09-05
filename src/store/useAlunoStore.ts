import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Aluno, AlunoExercicio, AlunoRotinaDia } from '../types/aluno';
import { criarRotinaVazia } from '../types/aluno';

interface AlunoState {
  /** Alunos ativos do Personal. Equivale a `cli_dados_alunos` (jg3_alunos).
   *  Sem seed fictício — a lista começa vazia, populada pelo Personal. */
  alunos: Aluno[];

  addAluno: (data: Omit<Aluno, 'id' | 'rotina' | 'status'>) => Aluno;
  updateAluno: (id: string, patch: Partial<Omit<Aluno, 'id' | 'rotina'>>) => void;
  removeAluno: (id: string) => void;
  getAluno: (id: string) => Aluno | undefined;

  /** Substitui o dia inteiro (equivale a mutar `a.rotina[d]` diretamente). */
  setRotinaDia: (alunoId: string, day: number, dia: AlunoRotinaDia) => void;
  addExercicio: (alunoId: string, day: number, ex: AlunoExercicio) => void;
  /** Anexa vários exercícios de uma vez (importação de texto) num único set. */
  addExerciciosBulk: (alunoId: string, day: number, exs: AlunoExercicio[]) => void;
  updateExercicio: (alunoId: string, day: number, idx: number, ex: AlunoExercicio) => void;
  removeExercicio: (alunoId: string, day: number, idx: number) => void;
  reorderExercicios: (alunoId: string, day: number, fromIdx: number, toIdx: number) => void;
  marcarDescanso: (alunoId: string, day: number) => void;

  /** Atualiza `ultimoTreino` para a data de hoje (chamado ao publicar). */
  marcarPublicadoHoje: (alunoId: string) => void;
}

function updateDia(aluno: Aluno, day: number, updater: (dia: AlunoRotinaDia) => AlunoRotinaDia): Aluno {
  const rotina = [...aluno.rotina];
  rotina[day] = updater(rotina[day]);
  return { ...aluno, rotina };
}

export const useAlunoStore = create<AlunoState>()(
  persist(
    (set, get) => ({
      alunos: [],

      addAluno: (data) => {
        const aluno: Aluno = {
          id: `aluno-${Date.now()}`,
          status: 'ativo',
          rotina: criarRotinaVazia(),
          ...data,
        };
        set((state) => ({ alunos: [...state.alunos, aluno] }));
        return aluno;
      },

      updateAluno: (id, patch) =>
        set((state) => ({
          alunos: state.alunos.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),

      removeAluno: (id) => set((state) => ({ alunos: state.alunos.filter((a) => a.id !== id) })),

      getAluno: (id) => get().alunos.find((a) => a.id === id),

      setRotinaDia: (alunoId, day, dia) =>
        set((state) => ({
          alunos: state.alunos.map((a) => (a.id === alunoId ? updateDia(a, day, () => dia) : a)),
        })),

      addExercicio: (alunoId, day, ex) =>
        set((state) => ({
          alunos: state.alunos.map((a) =>
            a.id === alunoId
              ? updateDia(a, day, (dia) => ({
                  tipo: dia.tipo === 'Descanso Total' ? 'Treino Personalizado' : dia.tipo,
                  exercicios: [...dia.exercicios, ex],
                }))
              : a
          ),
        })),

      addExerciciosBulk: (alunoId, day, exs) =>
        set((state) => ({
          alunos: state.alunos.map((a) =>
            a.id === alunoId
              ? updateDia(a, day, (dia) => ({
                  tipo: dia.tipo === 'Descanso Total' ? 'Treino Personalizado' : dia.tipo,
                  exercicios: [...dia.exercicios, ...exs],
                }))
              : a
          ),
        })),

      updateExercicio: (alunoId, day, idx, ex) =>
        set((state) => ({
          alunos: state.alunos.map((a) =>
            a.id === alunoId
              ? updateDia(a, day, (dia) => ({
                  ...dia,
                  exercicios: dia.exercicios.map((e, i) => (i === idx ? ex : e)),
                }))
              : a
          ),
        })),

      removeExercicio: (alunoId, day, idx) =>
        set((state) => ({
          alunos: state.alunos.map((a) =>
            a.id === alunoId
              ? updateDia(a, day, (dia) => {
                  const exercicios = dia.exercicios.filter((_, i) => i !== idx);
                  return { tipo: exercicios.length ? dia.tipo : 'Descanso Total', exercicios };
                })
              : a
          ),
        })),

      reorderExercicios: (alunoId, day, fromIdx, toIdx) =>
        set((state) => ({
          alunos: state.alunos.map((a) =>
            a.id === alunoId
              ? updateDia(a, day, (dia) => {
                  const exercicios = [...dia.exercicios];
                  const [moved] = exercicios.splice(fromIdx, 1);
                  exercicios.splice(toIdx, 0, moved);
                  return { ...dia, exercicios };
                })
              : a
          ),
        })),

      marcarDescanso: (alunoId, day) =>
        set((state) => ({
          alunos: state.alunos.map((a) =>
            a.id === alunoId ? updateDia(a, day, () => ({ tipo: 'Descanso Total', exercicios: [] })) : a
          ),
        })),

      marcarPublicadoHoje: (alunoId) =>
        set((state) => ({
          alunos: state.alunos.map((a) =>
            a.id === alunoId ? { ...a, ultimoTreino: new Date().toLocaleDateString('pt-BR') } : a
          ),
        })),
    }),
    {
      // Sucessor direto de jg3_alunos.
      name: 'jg3_alunos',
    }
  )
);
