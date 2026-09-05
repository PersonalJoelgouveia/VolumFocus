/**
 * Views do app — migradas de VIEW_META (index.html ~4386) e dos ids
 * `view-*` do markup. `pt-only` indica views restritas ao modo Personal
 * Trainer (equivalente à classe CSS `.pt-only` do monolito).
 */
export type ViewId =
  | 'registro'
  | 'dashboard'
  | 'banco'
  | 'forca'
  | 'cardio'
  | 'performance'
  | 'nova-semana'
  | 'conquistas'
  | 'clientes'
  | 'notifications';

export interface ViewMeta {
  title: string;
  sub: string;
  ptOnly?: boolean;
  /** Restrita ao aluno logado — equivalente a `ptOnly`, mas para o outro papel. */
  alunoOnly?: boolean;
}

export const VIEW_META: Record<ViewId, ViewMeta> = {
  registro: { title: 'Treinos', sub: 'Semana Atual' },
  dashboard: { title: 'X-ray', sub: 'Análise & Resumo Unificado' },
  banco: { title: 'Banco de Exercícios', sub: 'Biblioteca Biomecânica', ptOnly: true },
  forca: { title: 'Força 1RM', sub: 'Teste de Carga Máxima — Multi-Fórmula' },
  cardio: { title: 'Cardio VO2', sub: 'VO2 Máx & Zonas de Treinamento' },
  performance: { title: 'Performance', sub: 'Testes de Força & Capacidade Aeróbica' },
  'nova-semana': { title: 'Nova Semana', sub: 'Reset de Ciclo' },
  conquistas: { title: 'Conquistas', sub: 'Badges & Recordes Pessoais' },
  clientes: { title: 'Clientes', sub: 'Gestão de Alunos & Rotinas', ptOnly: true },
  notifications: {
    title: 'Notificações',
    sub: 'Treinos concluídos & aprovações pendentes',
    ptOnly: true,
  },
};

/** Itens da navegação principal (sidebar desktop), na ordem do monolito. */
export const PRIMARY_NAV: ViewId[] = ['registro', 'dashboard', 'performance', 'conquistas'];
export const PT_NAV: ViewId[] = ['banco', 'clientes', 'notifications'];
/** Sem views exclusivas de aluno hoje — "Minha Rotina" foi fundida em Treinos. */
export const ALUNO_NAV: ViewId[] = [];
export const TOOLS_NAV: ViewId[] = ['nova-semana'];

/**
 * Itens da bottom-nav mobile: 5 visíveis + "Mais" (popover), migrado da
 * auditoria UX/UI de julho/2026 (redução de 7 para 6 itens na nav do PT).
 */
export const BOTTOM_NAV_MAIN: ViewId[] = ['registro', 'dashboard', 'performance', 'conquistas', 'nova-semana'];
export const BOTTOM_NAV_MORE: ViewId[] = ['clientes', 'notifications'];
