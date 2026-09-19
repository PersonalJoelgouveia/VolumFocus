import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrainingModel, TrainingModelCategoria } from '../types/trainingModel';
import { criarCatalogoInicial } from '../types/trainingModel';

interface ModeloState {
  /** Catálogo fixo de 21 modelos (3 categorias × 7 níveis). Sem add/remove
   *  nesta etapa — só navegação/consulta da prateleira (ver
   *  types/trainingModel.ts). Edição de conteúdo (sessões/exercícios) e
   *  "Copiar para Cliente" são etapas futuras, ainda não implementadas
   *  aqui de propósito. */
  modelos: TrainingModel[];

  listarPorCategoria: (categoria: TrainingModelCategoria) => TrainingModel[];
  getModelo: (id: string) => TrainingModel | undefined;
}

export const useModeloStore = create<ModeloState>()(
  persist(
    (_set, get) => ({
      modelos: criarCatalogoInicial(),

      listarPorCategoria: (categoria) =>
        get()
          .modelos.filter((m) => m.categoria === categoria)
          .sort((a, b) => a.nivel - b.nivel),

      getModelo: (id) => get().modelos.find((m) => m.id === id),
    }),
    // Chave renomeada de 'jg3_modelos' pra 'jg3_training_models' junto com a
    // troca de schema pra TrainingModel (antigo ModeloTreino usava `rotina`,
    // este usa `sessoes`) — evita que um localStorage antigo, com o shape
    // velho, seja carregado por engano e quebre contarExercicios().
    { name: 'jg3_training_models' }
  )
);
