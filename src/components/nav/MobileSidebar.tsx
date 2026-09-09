import { useNotificationStore, selectUnreadCount } from '../../store/useNotificationStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useUIStore } from '../../store/useUIStore';
import { ALUNO_NAV, PRIMARY_NAV, PT_NAV, TOOLS_NAV, VIEW_ICON, VIEW_META } from '../../types/view';
import type { ViewId } from '../../types/view';
import { NavItem } from './NavItem';
import logoAzul from '../../assets/branding/JoelGouveia_Simbolo_Azul.png';
import logoBranco from '../../assets/branding/JoelGouveia_Simbolo_Branco.png';
import '../feedback/Notifications.css';
import './MobileSidebar.css';

/**
 * Sidebar retrátil mobile — sucessora da bottom-nav poluída (BottomNav.tsx,
 * removida). Rail icon-only fixa à esquerda por padrão: toque rápido navega,
 * toque-e-retenção revela o rótulo via Tooltip (ver NavItem), sem precisar
 * abrir nada. O handle no topo expande um drawer completo com overlay,
 * rótulos inline e sombra de elevação, para quem prefere ver tudo de uma vez
 * — fecha sozinho ao navegar (setActiveView já reseta isSidebarCollapsed).
 * Mesmo conjunto de itens da Sidebar desktop (PRIMARY_NAV + PT_NAV/ALUNO_NAV
 * + TOOLS_NAV); só a apresentação muda. Só renderiza abaixo de 860px (ver
 * MobileSidebar.css) — mesma quebra que antes escondia a Sidebar desktop.
 */
export function MobileSidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);
  const isAlunoMode = useUIStore((s) => s.isAlunoMode);
  const isCollapsed = useUIStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const collapseSidebar = useUIStore((s) => s.collapseSidebar);
  const unreadCount = useNotificationStore(selectUnreadCount);
  const theme = useThemeStore((s) => s.theme);
  const expanded = !isCollapsed;
  const logoSrc = theme === 'dark' ? logoBranco : logoAzul;

  const items: ViewId[] = [
    ...(isAlunoMode ? ALUNO_NAV : []),
    ...PRIMARY_NAV,
    ...(isPersonalMode ? PT_NAV : []),
    ...TOOLS_NAV,
  ];

  const handleSettingsSelect = () => {
    setActiveView('settings');
    collapseSidebar();
  };

  return (
    <>
      <div className={`msb-backdrop${expanded ? ' open' : ''}`} onClick={collapseSidebar} aria-hidden="true" />

      <nav className={`mobile-sidebar${expanded ? ' expanded' : ' collapsed'}`}>
        <button
          type="button"
          className="msb-handle msb-logo-btn"
          onClick={toggleSidebar}
          aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
          aria-expanded={expanded}
        >
          <img className="msb-logo-img" src={logoSrc} alt="Joel Gouveia" draggable={false} />
        </button>

        <div className="msb-list">
          {items.map((view) => (
            <NavItem
              key={view}
              icon={VIEW_ICON[view] ?? '•'}
              label={VIEW_META[view].title}
              isActive={activeView === view}
              expanded={expanded}
              badgeCount={view === 'notifications' ? unreadCount : 0}
              onSelect={() => setActiveView(view)}
            />
          ))}
        </div>

        <div className="msb-footer">
          <NavItem
            icon="⚙️"
            label="Configurações"
            isActive={activeView === 'settings'}
            expanded={expanded}
            onSelect={handleSettingsSelect}
          />
        </div>
      </nav>
    </>
  );
}
