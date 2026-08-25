import { useUIStore } from '../../store/useUIStore';
import { PRIMARY_NAV, PT_NAV, TOOLS_NAV, VIEW_META } from '../../types/view';
import type { ViewId } from '../../types/view';
import './Sidebar.css';

const ICONS: Partial<Record<ViewId, string>> = {
  conquistas: '🏆',
  banco: '🏋️',
  'nova-semana': '🔄',
};

function NavButton({ view }: { view: ViewId }) {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const isActive = activeView === view;

  return (
    <button
      className={`nav-item${isActive ? ' active' : ''}`}
      onClick={() => setActiveView(view)}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="ni-icon">{ICONS[view] ?? '•'}</div>
      <span className="ni-label">{VIEW_META[view].title}</span>
    </button>
  );
}

/**
 * Sidebar desktop — sucessora de `<nav id="sidebar">` (index.html ~2466).
 * Views marcadas `ptOnly` só aparecem quando `isPersonalMode` estiver ativo,
 * equivalente à classe `.pt-only` do monolito.
 */
export function Sidebar() {
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);

  return (
    <nav id="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-icon">💪</div>
        <div className="sb-logo-text">
          <div className="sb-logo-name">Joel Gouveia</div>
          <div className="sb-logo-sub">Performance</div>
        </div>
      </div>

      <div className="sb-nav">
        <div className="sb-section">Principal</div>
        {PRIMARY_NAV.map((view) => (
          <NavButton key={view} view={view} />
        ))}
        {isPersonalMode && PT_NAV.map((view) => <NavButton key={view} view={view} />)}
      </div>

      <div className="sb-bottom">
        <div className="sb-section">Ferramentas</div>
        {TOOLS_NAV.map((view) => (
          <NavButton key={view} view={view} />
        ))}
      </div>
    </nav>
  );
}
