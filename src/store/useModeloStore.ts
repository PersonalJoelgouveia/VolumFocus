import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrainingModel, TrainingModelCategoria } from '../types/trainingModel';
import { criarCatalogoComProgressao } from '../data/trainingProgression';

interface ModeloState {
  /** Catálogo fixo de 21 modelos (3 categorias × 7 níveis), nascendo com
   *  os metadados da matriz de progressão (data/trainingProgression.ts)
   *  já preenchidos. Sem add/remove nesta etapa — só navegação/consulta
   *  da prateleira. Edição de conteúdo (sessões/exercícios) e "Copiar
   *  para Cliente" são etapas futuras, ainda não implementadas aqui de
   *  propósito. */
  modelos: TrainingModel[];

  listarPorCategoria: (categoria: TrainingModelCategoria) => TrainingModel[];
  getModelo: (id: string) => TrainingModel | undefined;
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
    }),
    // Chave renomeada de novo (era 'jg3_training_models') ao ligar a matriz
    // de progressão: um localStorage anterior, com objetivo/volume/
    // intensidade/complexidade/densidade ainda em branco, não deve
    // sobrescrever o catálogo já preenchido no primeiro carregamento.
    { name: 'jg3_training_models_v2' }
  )
);
