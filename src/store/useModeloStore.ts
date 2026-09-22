import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrainingModel, TrainingModelCategoria } from '../types/trainingModel';
import { criarCatalogoComProgressao } from '../data/trainingProgression';
import { buildAlunoRotinaFromTrainingModel } from '../utils/buildAlunoRotinaFromTrainingModel';
import { useAlunoStore } from './useAlunoStore';
import { useExerciseStore } from './useExerciseStore';

export interface CopiarParaClienteResult {
  ok: boolean;
  exerciciosNaoEncontrados: string[];
}

interface ModeloState {
  /** Catálogo fixo de 21 modelos (3 categorias × 7 níveis), nascendo com
   *  os metadados da matriz de progressão (data/trainingProgression.ts) e
   *  o conteúdo real de sessões/exercícios já preenchidos (data/
   *  modelosIniciante.ts, modelosIntermediario.ts, modelosAvancado.ts).
   *  Sem add/remove/edição de conteúdo nesta etapa — só navegação/consulta
   *  da prateleira e o fluxo de cópia pra Cliente. */
  modelos: TrainingModel[];

  listarPorCategoria: (categoria: TrainingModelCategoria) => TrainingModel[];
  getModelo: (id: string) => TrainingModel | undefined;

  /**
   * Fluxo "Modelo → Copiar para Cliente": converte o modelo numa
   * `AlunoRotina` nova (utils/buildAlunoRotinaFromTrainingModel.ts) e
   * grava na rotina do Cliente via `useAlunoStore.setRotinaDia` — a mesma
   * estrutura já existente de Clientes/Rotinas, sem tocar em Rotinas
   * Salvas (`useRotinaStore`) em nenhum momento. A conversão só LÊ o
   * modelo; ele nunca é alterado por essa ação, e a rotina do Cliente
   * criada é uma cópia independente — editá-la depois nunca volta a
   * afetar o modelo original.
   */
  copiarParaCliente: (modeloId: string, alunoId: string) => CopiarParaClienteResult;
}

export const useModeloStore = create<ModeloState>()(
  persist(
    (_set, get) => ({
      modelos: criarCatalogoComProgressao(),

      listarPorCategoria: (categoria) =>
        get()
          .modelos.filter((m) => m.categoria === categoria)
          .sort((a, b) => a.nivel - b.nivel),

      getModelo: (id) => get().modelos.find((m) => m.id === id),

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
    // Chave renomeada de novo (era 'jg3_training_models_v4') ao ligar o
    // conteúdo real dos 7 níveis Avançado: um localStorage anterior, com
    // `sessoes` ainda vazio nesses modelos, não deve mascarar o conteúdo
    // novo no primeiro carregamento.
    { name: 'jg3_training_models_v5' }
  )
);
