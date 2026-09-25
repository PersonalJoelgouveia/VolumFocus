import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Aluno, AlunoExercicio, AlunoRotinaDia } from '../types/aluno';
import { criarRotinaVazia } from '../types/aluno';
import type { PhysicalAssessment } from '../types/assessment';
import type { TrainingNote } from '../types/trainingNote';

/** Referência estável — nunca criar `[]` novo dentro de um selector (ver
 *  `getAvaliacoes` abaixo): React (useSyncExternalStore) trata cada `[]`
 *  novo como "o estado mudou" e re-renderiza sem parar ("Maximum update
 *  depth exceeded" / erro #185) sempre que `avaliacoes[alunoId]` ainda não
 *  existe — ex.: aluno novo, ou fetch do Firestore que nunca populinha
 *  por falha de permissão. */
const AVALIACOES_VAZIAS: PhysicalAssessment[] = [];
/** Mesma proteção contra #185, aplicada ao cache de Anotações (ver acima). */
const NOTAS_VAZIAS: TrainingNote[] = [];

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

  /** Histórico de Avaliações Físicas por aluno. Mapa isolado (não embutido em
   *  `Aluno`) — desacoplado do papel de quem escreve/lê, para que a mesma
   *  leitura sirva tanto o app do Personal quanto, futuramente, o do Aluno. */
  avaliacoes: Record<string, PhysicalAssessment[]>;
  getAvaliacoes: (alunoId: string) => PhysicalAssessment[];
  getUltimaAvaliacao: (alunoId: string) => PhysicalAssessment | undefined;
  addAvaliacao: (alunoId: string, avaliacao: PhysicalAssessment) => void;
  /** Substitui a lista inteira (usado ao sincronizar com o Firestore). */
  setAvaliacoes: (alunoId: string, avaliacoes: PhysicalAssessment[]) => void;
  updateAvaliacao: (alunoId: string, assessmentId: string, patch: Partial<PhysicalAssessment>) => void;
  removeAvaliacao: (alunoId: string, assessmentId: string) => void;

  /** Histórico de Anotações (Ferramentas > Anotações) por aluno — mesmo
   *  desacoplamento de `avaliacoes` (mapa isolado, não embutido em `Aluno`),
   *  já que cada anotação é um documento independente no Firestore. */
  notas: Record<string, TrainingNote[]>;
  getNotas: (alunoId: string) => TrainingNote[];
  addNota: (alunoId: string, nota: TrainingNote) => void;
  /** Substitui a lista inteira (usado ao sincronizar com o Firestore). */
  setNotas: (alunoId: string, notas: TrainingNote[]) => void;
  updateNota: (alunoId: string, noteId: string, patch: Partial<TrainingNote>) => void;
  removeNota: (alunoId: string, noteId: string) => void;
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

      avaliacoes: {},

      getAvaliacoes: (alunoId) => get().avaliacoes[alunoId] ?? AVALIACOES_VAZIAS,

      getUltimaAvaliacao: (alunoId) => {
        const lista = get().avaliacoes[alunoId] ?? [];
        if (lista.length === 0) return undefined;
        return [...lista].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
      },

      addAvaliacao: (alunoId, avaliacao) =>
        set((state) => ({
          avaliacoes: {
            ...state.avaliacoes,
            [alunoId]: [...(state.avaliacoes[alunoId] ?? []), avaliacao],
          },
        })),

      setAvaliacoes: (alunoId, avaliacoes) =>
        set((state) => ({ avaliacoes: { ...state.avaliacoes, [alunoId]: avaliacoes } })),

      updateAvaliacao: (alunoId, assessmentId, patch) =>
        set((state) => ({
          avaliacoes: {
            ...state.avaliacoes,
            [alunoId]: (state.avaliacoes[alunoId] ?? []).map((a) =>
              a.id === assessmentId ? { ...a, ...patch } : a
            ),
          },
        })),

      removeAvaliacao: (alunoId, assessmentId) =>
        set((state) => ({
          avaliacoes: {
            ...state.avaliacoes,
            [alunoId]: (state.avaliacoes[alunoId] ?? []).filter((a) => a.id !== assessmentId),
          },
        })),

      notas: {},

      getNotas: (alunoId) => get().notas[alunoId] ?? NOTAS_VAZIAS,

      addNota: (alunoId, nota) =>
        set((state) => ({
          notas: { ...state.notas, [alunoId]: [nota, ...(state.notas[alunoId] ?? [])] },
        })),

      setNotas: (alunoId, notas) => set((state) => ({ notas: { ...state.notas, [alunoId]: notas } })),

      updateNota: (alunoId, noteId, patch) =>
        set((state) => ({
          notas: {
            ...state.notas,
            [alunoId]: (state.notas[alunoId] ?? []).map((n) => (n.id === noteId ? { ...n, ...patch } : n)),
          },
        })),

      removeNota: (alunoId, noteId) =>
        set((state) => ({
          notas: {
            ...state.notas,
            [alunoId]: (state.notas[alunoId] ?? []).filter((n) => n.id !== noteId),
          },
        })),
    }),
    {
      // Sucessor direto de jg3_alunos.
      name: 'jg3_alunos',
    }
  )
);
