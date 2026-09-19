import {
  Dumbbell,
  ClipboardCheck,
  ChartNoAxesCombined,
  Trophy,
  Library,
  Users,
  Bell,
  CalendarSync,
  HeartPulse,
  Settings,
  LogOut,
  Circle,
  Toolbox,
  type LucideIcon,
} from 'lucide-react';
import type { ViewId } from '../types/view';

/**
 * Mapa central ViewId → ícone Lucide. Única fonte de verdade para os ícones
 * de navegação (Sidebar desktop + MobileSidebar). Substitui o antigo
 * `VIEW_ICON` (emojis) de `src/types/view.ts`.
 *
 * Para adicionar um ícone a um novo ViewId: importe o ícone do lucide-react
 * acima e adicione a entrada abaixo. Nunca invente ViewIds aqui — este mapa
 * segue exatamente o tipo `ViewId` de `src/types/view.ts`.
 */
export const VIEW_ICON_MAP: Record<ViewId, LucideIcon> = {
  registro: Dumbbell,
  dashboard: ClipboardCheck,
  performance: ChartNoAxesCombined,
  conquistas: Trophy,
  banco: Library,
  clientes: Users,
  notifications: Bell,
  'nova-semana': CalendarSync,
  saude: HeartPulse,
  ferramentas: Toolbox,
  forca: Dumbbell,
  cardio: HeartPulse,
  settings: Settings,
};

/**
 * Ícones que não correspondem a um ViewId (ex.: ações da UI como sair da
 * conta). Fica separado de VIEW_ICON_MAP para não forçar um ViewId
 * inexistente só para caber aqui — ver README.md, seção "Adicionar ícones".
 */
export const ACTION_ICON_MAP = {
  logout: LogOut,
} as const;

/** Ícone de fallback — nunca deve aparecer se VIEW_ICON_MAP cobrir todo ViewId. */
export const FALLBACK_ICON: LucideIcon = Circle;

export function getViewIcon(view: ViewId): LucideIcon {
  return VIEW_ICON_MAP[view] ?? FALLBACK_ICON;
}

interface NavIconGraphicProps {
  view: ViewId;
  /** px — ver README.md para o padrão de tamanho (20–22px). */
  size?: number;
}

/**
 * SVG do ícone de navegação, sem o container 36×36 (esse fica a cargo do
 * `.ni-icon`/`.msb-icon` de cada Sidebar, que já tratam fundo/borda/glow).
 * Cor vem de `currentColor`, controlada via CSS (`.ni-icon`/`.msb-icon` e
 * seus estados `.active`) — nunca hardcoded aqui.
 */
export function NavIconGraphic({ view, size = 20 }: NavIconGraphicProps) {
  const Icon = getViewIcon(view);
  return <Icon size={size} strokeWidth={2} aria-hidden="true" focusable="false" />;
}
