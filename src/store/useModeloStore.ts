import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FrequenciaSemanal, TrainingModel, TrainingModelCategoria, VariantePorGenero } from '../types/trainingModel';
import { criarCatalogoComProgressao } from '../data/trainingProgression';
import { buildAlunoRotinaFromTrainingModel } from '../utils/buildAlunoRotinaFromTrainingModel';
import { useAlunoStore } from './useAlunoStore';
import { useExerciseStore } from './useExerciseStore';

export interface CopiarParaClienteResult {
  ok: boolean;
  exerciciosNaoEncontrados: string[];
}

interface ModeloState {
  /** Catálogo fixo — um modelo por categoria × (frequência, variante
   *  quando 4x) × nível (ver data/frequenciaSemanal.ts), nascendo com os
   *  metadados da matriz de progressão (data/trainingProgression.ts)
   *  preenchidos. `sessoes` ainda vazio em todos — conteúdo real de
   *  treino é etapa futura. Sem add/remove nesta etapa — só navegação/
   *  consulta da prateleira e o fluxo de cópia pra Cliente. */
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
    // Chave renomeada de novo (era 'jg3_training_models_v5') ao adicionar
    // Frequência Semanal (2x/3x/4x-masc/4x-fem/5x) como novo eixo do
    // catálogo — muda o shape do TrainingModel (campos `frequencia`/
    // `variante` novos) e o id de cada modelo; um localStorage anterior,
    // no shape velho, não deve ser carregado por engano.
    { name: 'jg3_training_models_v6' }
  )
);
