import type { ReactNode } from 'react';

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

/** Ícones inline no traçado Lucide (currentColor, strokeWidth 2), mesmo
 *  padrão já usado em SettingsView.tsx — sem adicionar lucide-react como
 *  dependência nova. */
function IconTreinos() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="3" height="6" rx="1" />
      <rect x="19" y="9" width="3" height="6" rx="1" />
      <rect x="6" y="7" width="2.5" height="10" rx="1" />
      <rect x="15.5" y="7" width="2.5" height="10" rx="1" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
    </svg>
  );
}

/** X-ray: bíceps estilizado com linhas de fibra muscular — ícone
 *  custom (sem equivalente direto no set Lucide). */
function IconXray() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21c-1.5-1-2-3-2-5V9c0-2.8 2-5 5-5.5 2-.4 3.8.4 4.8 2 .7 1 .9 2.3.5 3.5-.4 1.2-1.4 2-1.8 3.2-.5 1.4 0 2.8 1 3.8 1.3 1.3 1.8 3 1.2 4.6-.5 1.4-1.8 2.4-3.2 2.6-2 .3-4.3-.2-5.5-2.2Z" />
      <path d="M8 9.5c1.6.3 3.2.3 4.8 0" />
      <path d="M7.5 12.5c1.9.4 3.8.4 5.7 0" />
      <path d="M7.8 15.5c1.7.4 3.6.5 5.4.1" />
    </svg>
  );
}

/** Performance: TrendingUp com destaque na cor semântica --green (emerald). */
function IconPerformance() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 6" />
      <polyline points="14 6 21 6 21 13" />
    </svg>
  );
}

function IconClientes() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconNotificacoes() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/** Ícones por view — usado pela Sidebar desktop e pela MobileSidebar (rail mobile). */
export const VIEW_ICON: Partial<Record<ViewId, ReactNode>> = {
  registro: <IconTreinos />,
  dashboard: <IconXray />,
  performance: <IconPerformance />,
  clientes: <IconClientes />,
  notifications: <IconNotificacoes />,
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
