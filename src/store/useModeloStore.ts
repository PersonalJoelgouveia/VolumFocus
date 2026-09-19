import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AlunoExercicio, AlunoRotinaDia } from '../types/aluno';
import type { ModeloCategoria, ModeloTreino } from '../types/modelo';
import { criarCatalogoInicial } from '../types/modelo';
import { useAlunoStore } from './useAlunoStore';

export type CopiaModo = 'substituir' | 'mesclar';

interface ModeloState {
  /** Catálogo fixo de 21 modelos (3 categorias × 7 níveis). Sem
   *  add/remove nesta etapa — o Personal edita o conteúdo dos 21 slots,
   *  não a prateleira em si (ver types/modelo.ts). */
  modelos: ModeloTreino[];

  listarPorCategoria: (categoria: ModeloCategoria) => ModeloTreino[];
  getModelo: (id: string) => ModeloTreino | undefined;

  atualizarInfo: (id: string, patch: Partial<Pick<ModeloTreino, 'nome' | 'objetivo' | 'observacoes'>>) => void;

  setRotinaDia: (modeloId: string, day: number, dia: AlunoRotinaDia) => void;
  addExercicio: (modeloId: string, day: number, ex: AlunoExercicio) => void;
  updateExercicio: (modeloId: string, day: number, idx: number, ex: AlunoExercicio) => void;
  removeExercicio: (modeloId: string, day: number, idx: number) => void;
  reorderExercicios: (modeloId: string, day: number, fromIdx: number, toIdx: number) => void;
  marcarDescanso: (modeloId: string, day: number) => void;

  /**
   * Fluxo "Copiar para Cliente": clona a semana do modelo (nunca a
   * referência) e grava na rotina do Aluno via useAlunoStore — a mesma
   * infraestrutura usada por ImportRotinaModal/RoutineEditorModal, sem
   * duplicar lógica de persistência/publicação. `substituir` troca o dia
   * inteiro (setRotinaDia); `mesclar` anexa só os dias do modelo que têm
   * exercício, preservando o resto da rotina atual do Cliente (mesmo
   * comportamento de useRotinaStore.aplicar(mode:'merge')). Alterar a
   * rotina do Cliente depois nunca volta a afetar este modelo — são cópias
   * independentes a partir daqui.
   */
  copiarParaCliente: (modeloId: string, alunoId: string, modo: CopiaModo) => boolean;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function updateModelo(modelos: ModeloTreino[], id: string, updater: (m: ModeloTreino) => ModeloTreino): ModeloTreino[] {
  return modelos.map((m) => (m.id === id ? updater(m) : m));
}

function updateDia(modelo: ModeloTreino, day: number, updater: (dia: AlunoRotinaDia) => AlunoRotinaDia): ModeloTreino {
  const rotina = [...modelo.rotina];
  rotina[day] = updater(rotina[day]);
  return { ...modelo, rotina, atualizado: new Date().toISOString() };
}

export const useModeloStore = create<ModeloState>()(
  persist(
    (set, get) => ({
      modelos: criarCatalogoInicial(),

      listarPorCategoria: (categoria) => get().modelos.filter((m) => m.categoria === categoria).sort((a, b) => a.nivel - b.nivel),

      getModelo: (id) => get().modelos.find((m) => m.id === id),

      atualizarInfo: (id, patch) =>
        set((state) => ({
          modelos: updateModelo(state.modelos, id, (m) => ({ ...m, ...patch, atualizado: new Date().toISOString() })),
        })),

      setRotinaDia: (modeloId, day, dia) =>
        set((state) => ({ modelos: updateModelo(state.modelos, modeloId, (m) => updateDia(m, day, () => dia)) })),

      addExercicio: (modeloId, day, ex) =>
        set((state) => ({
          modelos: updateModelo(state.modelos, modeloId, (m) =>
            updateDia(m, day, (dia) => ({
              tipo: dia.tipo === 'Descanso Total' ? 'Treino' : dia.tipo,
              exercicios: [...dia.exercicios, ex],
            }))
          ),
        })),

      updateExercicio: (modeloId, day, idx, ex) =>
        set((state) => ({
          modelos: updateModelo(state.modelos, modeloId, (m) =>
            updateDia(m, day, (dia) => ({ ...dia, exercicios: dia.exercicios.map((e, i) => (i === idx ? ex : e)) }))
          ),
        })),

      removeExercicio: (modeloId, day, idx) =>
        set((state) => ({
          modelos: updateModelo(state.modelos, modeloId, (m) =>
            updateDia(m, day, (dia) => {
              const exercicios = dia.exercicios.filter((_, i) => i !== idx);
              return { tipo: exercicios.length ? dia.tipo : 'Descanso Total', exercicios };
            })
          ),
        })),

      reorderExercicios: (modeloId, day, fromIdx, toIdx) =>
        set((state) => ({
          modelos: updateModelo(state.modelos, modeloId, (m) =>
            updateDia(m, day, (dia) => {
              const exercicios = [...dia.exercicios];
              const [moved] = exercicios.splice(fromIdx, 1);
              exercicios.splice(toIdx, 0, moved);
              return { ...dia, exercicios };
            })
          ),
        })),

      marcarDescanso: (modeloId, day) =>
        set((state) => ({
          modelos: updateModelo(state.modelos, modeloId, (m) => updateDia(m, day, () => ({ tipo: 'Descanso Total', exercicios: [] }))),
        })),

      copiarParaCliente: (modeloId, alunoId, modo) => {
        const modelo = get().modelos.find((m) => m.id === modeloId);
        const alunoStore = useAlunoStore.getState();
        if (!modelo || !alunoStore.getAluno(alunoId)) return false;

        modelo.rotina.forEach((diaModelo, day) => {
          if (modo === 'substituir') {
            alunoStore.setRotinaDia(alunoId, day, clone(diaModelo));
          } else if (diaModelo.exercicios.length > 0) {
            alunoStore.addExerciciosBulk(alunoId, day, clone(diaModelo.exercicios));
          }
        });
        return true;
      },
    }),
    { name: 'jg3_modelos' }
  )
);
