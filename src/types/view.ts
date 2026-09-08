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
  | 'notifications'
  | 'settings';

export interface ViewMeta {
  title: string;
  sub: string;
  ptOnly?: boolean;
  /** Restrita ao aluno logado — equivalente a `ptOnly`, mas para o outro papel. */
  alunoOnly?: boolean;
}

/** Ícones por view — usado pela Sidebar desktop e pela MobileSidebar (rail mobile). */
export const VIEW_ICON: Partial<Record<ViewId, string>> = {
  conquistas: '🏆',
  banco: '🏋️',
  'nova-semana': '🔄',
};

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
  settings: { title: 'Configurações', sub: 'Preferências do aplicativo' },
};

/** Itens da navegação principal (sidebar desktop), na ordem do monolito. */
export const PRIMARY_NAV: ViewId[] = ['registro', 'dashboard', 'performance', 'conquistas'];
export const PT_NAV: ViewId[] = ['banco', 'clientes', 'notifications'];
/** Sem views exclusivas de aluno hoje — "Minha Rotina" foi fundida em Treinos. */
export const ALUNO_NAV: ViewId[] = [];
export const TOOLS_NAV: ViewId[] = ['nova-semana'];
