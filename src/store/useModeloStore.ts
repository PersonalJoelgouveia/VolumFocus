import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModeloCategoria, ModeloTreino } from '../types/modelo';
import { criarCatalogoInicial } from '../types/modelo';

interface ModeloState {
  /** Catálogo fixo de 21 modelos (3 categorias × 7 níveis). Sem add/remove
   *  nesta etapa — só navegação/consulta da prateleira (ver types/modelo.ts).
   *  Edição de conteúdo (exercícios por dia) e "Copiar para Cliente" são
   *  etapas futuras, ainda não implementadas aqui de propósito. */
  modelos: ModeloTreino[];

  listarPorCategoria: (categoria: ModeloCategoria) => ModeloTreino[];
  getModelo: (id: string) => ModeloTreino | undefined;
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
    { name: 'jg3_modelos' }
  )
);
