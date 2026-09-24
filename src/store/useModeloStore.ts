import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FrequenciaSemanal,
  TrainingModel,
  TrainingModelBloco,
  TrainingModelCategoria,
  TrainingModelEntrada,
  TrainingModelFase,
  TrainingModelSessao,
  VariantePorGenero,
} from '../types/trainingModel';
import { criarCatalogoComProgressao } from '../data/trainingProgression';
import { getEsqueletoFrequencia } from '../data/frequenciaSemanal';
import { gerarSessoesComCardioSemanal } from '../data/cardioSemanal';
import { buildAlunoRotinaFromTrainingModel } from '../utils/buildAlunoRotinaFromTrainingModel';
import { useAlunoStore } from './useAlunoStore';
import { useExerciseStore } from './useExerciseStore';

export interface CopiarParaClienteResult {
  ok: boolean;
  exerciciosNaoEncontrados: string[];
}

function comBlocoAtualizado(
  sessao: TrainingModelSessao,
  fase: TrainingModelFase,
  updater: (exercicios: TrainingModelEntrada[]) => TrainingModelEntrada[]
): TrainingModelSessao {
  return {
    ...sessao,
    blocos: sessao.blocos.map((b): TrainingModelBloco => (b.fase === fase ? { ...b, exercicios: updater(b.exercicios) } : b)),
  };
}

interface ModeloState {
  /** Catálogo fixo — um modelo por categoria × (frequência, variante
   *  quando 4x) × nível (ver data/frequenciaSemanal.ts), nascendo com os
   *  metadados da matriz de progressão (data/trainingProgression.ts)
   *  preenchidos e `sessoes` vazio. `garantirSessoesIniciais` materializa
   *  o esqueleto de sessões na primeira vez que um nível é aberto pro
   *  Personal editar — a edição daí em diante fica só nessa instância do
   *  modelo, nunca em outro nem em Rotinas Salvas/Timer. */
  modelos: TrainingModel[];

  /** Frequências (e variante, quando 4x) com modelo cadastrado pra uma categoria. */
  listarFrequenciasPorCategoria: (categoria: TrainingModelCategoria) => { frequencia: FrequenciaSemanal; variante?: VariantePorGenero }[];
  /** Os 7 níveis de uma combinação categoria+frequência(+variante). */
  listarPorFrequencia: (
    categoria: TrainingModelCategoria,
    frequencia: FrequenciaSemanal,
    variante?: VariantePorGenero
  ) => TrainingModel[];
  getModelo: (id: string) => TrainingModel | undefined;

  /** Cria as sessões do modelo a partir do esqueleto da sua frequência
   *  (data/frequenciaSemanal.ts) — só age se `sessoes` ainda estiver
   *  vazio; chamar de novo depois de já ter conteúdo não faz nada. */
  garantirSessoesIniciais: (modeloId: string) => void;

  addExercicio: (modeloId: string, sessaoId: string, fase: TrainingModelFase, entrada: TrainingModelEntrada) => void;
  updateExercicio: (modeloId: string, sessaoId: string, fase: TrainingModelFase, entrada: TrainingModelEntrada) => void;
  removeExercicio: (modeloId: string, sessaoId: string, fase: TrainingModelFase, entradaId: string) => void;
  reorderExercicio: (modeloId: string, sessaoId: string, fase: TrainingModelFase, fromIdx: number, toIdx: number) => void;
  /** Duração de referência (min) de um bloco específico (ex: Preparação). */
  setBlocoDuracao: (modeloId: string, sessaoId: string, fase: TrainingModelFase, minutos: number | undefined) => void;
  /** Duração estimada do modelo como um todo (campo já existente em TrainingModel). */
  setDuracaoEstimada: (modeloId: string, minutos: number) => void;

  /**
   * Fluxo "Modelo → Copiar para Cliente": converte a VERSÃO ATUAL (já
   * editada) do modelo numa `AlunoRotina` nova (utils/
   * buildAlunoRotinaFromTrainingModel.ts) e grava na rotina do Cliente via
   * `useAlunoStore.setRotinaDia` — a mesma estrutura já existente de
   * Clientes/Rotinas, sem tocar em Rotinas Salvas (`useRotinaStore`) nem
   * no Timer em nenhum momento. A conversão só LÊ o modelo; ele nunca é
   * alterado por essa ação, e a rotina do Cliente criada é uma cópia
   * independente — editá-la depois nunca volta a afetar o modelo original.
   */
  copiarParaCliente: (modeloId: string, alunoId: string) => CopiarParaClienteResult;
}

export const useModeloStore = create<ModeloState>()(
  persist(
    (set, get) => ({
      modelos: criarCatalogoComProgressao(),

      listarFrequenciasPorCategoria: (categoria) => {
        const vistos = new Set<string>();
        const resultado: { frequencia: FrequenciaSemanal; variante?: VariantePorGenero }[] = [];
        for (const m of get().modelos) {
          if (m.categoria !== categoria) continue;
          const chave = `${m.frequencia}-${m.variante ?? ''}`;
          if (vistos.has(chave)) continue;
          vistos.add(chave);
          resultado.push({ frequencia: m.frequencia, variante: m.variante });
        }
        return resultado.sort((a, b) => a.frequencia - b.frequencia || (a.variante ?? '').localeCompare(b.variante ?? ''));
      },

      listarPorFrequencia: (categoria, frequencia, variante) =>
        get()
          .modelos.filter((m) => m.categoria === categoria && m.frequencia === frequencia && m.variante === variante)
          .sort((a, b) => a.nivel - b.nivel),

      getModelo: (id) => get().modelos.find((m) => m.id === id),

      garantirSessoesIniciais: (modeloId) =>
        set((state) => ({
          modelos: state.modelos.map((m) => {
            if (m.id !== modeloId || m.sessoes.length > 0) return m;
            const esqueleto = getEsqueletoFrequencia(m.frequencia, m.variante);
            const sessoes = gerarSessoesComCardioSemanal(esqueleto, m.categoria, m.nivel);
            return { ...m, sessoes };
          }),
        })),

      addExercicio: (modeloId, sessaoId, fase, entrada) =>
        set((state) => ({
          modelos: state.modelos.map((m) =>
            m.id !== modeloId
              ? m
              : {
                  ...m,
                  sessoes: m.sessoes.map((s) => (s.id === sessaoId ? comBlocoAtualizado(s, fase, (exs) => [...exs, entrada]) : s)),
                  atualizado: new Date().toISOString(),
                }
          ),
        })),

      updateExercicio: (modeloId, sessaoId, fase, entrada) =>
        set((state) => ({
          modelos: state.modelos.map((m) =>
            m.id !== modeloId
              ? m
              : {
                  ...m,
                  sessoes: m.sessoes.map((s) =>
                    s.id === sessaoId ? comBlocoAtualizado(s, fase, (exs) => exs.map((e) => (e.id === entrada.id ? entrada : e))) : s
                  ),
                  atualizado: new Date().toISOString(),
                }
          ),
        })),

      removeExercicio: (modeloId, sessaoId, fase, entradaId) =>
        set((state) => ({
          modelos: state.modelos.map((m) =>
            m.id !== modeloId
              ? m
              : {
                  ...m,
                  sessoes: m.sessoes.map((s) => (s.id === sessaoId ? comBlocoAtualizado(s, fase, (exs) => exs.filter((e) => e.id !== entradaId)) : s)),
                  atualizado: new Date().toISOString(),
                }
          ),
        })),

      reorderExercicio: (modeloId, sessaoId, fase, fromIdx, toIdx) =>
        set((state) => ({
          modelos: state.modelos.map((m) =>
            m.id !== modeloId
              ? m
              : {
                  ...m,
                  sessoes: m.sessoes.map((s) =>
                    s.id === sessaoId
                      ? comBlocoAtualizado(s, fase, (exs) => {
                          const arr = [...exs];
                          const [movido] = arr.splice(fromIdx, 1);
                          arr.splice(toIdx, 0, movido);
                          return arr;
                        })
                      : s
                  ),
                  atualizado: new Date().toISOString(),
                }
          ),
        })),

      setBlocoDuracao: (modeloId, sessaoId, fase, minutos) =>
        set((state) => ({
          modelos: state.modelos.map((m) =>
            m.id !== modeloId
              ? m
              : {
                  ...m,
                  sessoes: m.sessoes.map((s) =>
                    s.id === sessaoId ? { ...s, blocos: s.blocos.map((b) => (b.fase === fase ? { ...b, duracaoEstimadaMinutos: minutos } : b)) } : s
                  ),
                  atualizado: new Date().toISOString(),
                }
          ),
        })),

      setDuracaoEstimada: (modeloId, minutos) =>
        set((state) => ({
          modelos: state.modelos.map((m) => (m.id === modeloId ? { ...m, duracaoEstimadaMinutos: minutos, atualizado: new Date().toISOString() } : m)),
        })),

      copiarParaCliente: (modeloId, alunoId) => {
        const modelo = get().modelos.find((m) => m.id === modeloId);
        const alunoStore = useAlunoStore.getState();
        if (!modelo || !alunoStore.getAluno(alunoId)) {
          return { ok: false, exerciciosNaoEncontrados: [] };
        }

        const exercises = useExerciseStore.getState().exercises;
        const { rotina, exerciciosNaoEncontrados } = buildAlunoRotinaFromTrainingModel(modelo, exercises);
        rotina.forEach((dia, day) => alunoStore.setRotinaDia(alunoId, day, dia));

        return { ok: true, exerciciosNaoEncontrados };
      },
    }),
    // Chave renomeada de novo (era 'jg3_training_models_v7') ao ligar a
    // progressão de cardio semanal: `garantirSessoesIniciais` agora
    // preenche o bloco de cardio de cada sessão com a meta distribuída
    // (data/cardioSemanal.ts) em vez de nascer sempre vazio; modelos já
    // materializados na chave antiga ficariam sem esse cardio pra sempre.
    { name: 'jg3_training_models_v8' }
  )
);
