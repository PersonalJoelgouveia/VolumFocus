import { useUIStore } from '../../store/useUIStore';
import { BOTTOM_NAV_MAIN, BOTTOM_NAV_MORE, VIEW_META } from '../../types/view';
import type { ViewId } from '../../types/view';
import './BottomNav.css';

const SHORT_LABEL: Partial<Record<ViewId, string>> = {
  registro: 'Treinos',
  dashboard: 'Stats',
  performance: 'Perf.',
  conquistas: 'Badges',
  'nova-semana': 'Semana',
};

/**
 * Bottom nav mobile — sucessora de `<nav class="bottom-nav">` (index.html ~2421).
 * Só renderiza (via CSS, ver BottomNav.css) abaixo de 860px, igual ao
 * monolito (.bottom-nav{display:none} + media query mobile).
 * 5 itens visíveis + botão "Mais" com popover, conforme a auditoria UX de
 * julho/2026 que reduziu a nav do PT de 7 para 6 itens.
 */
export function BottomNav() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);
  const isMoreMenuOpen = useUIStore((s) => s.isMoreMenuOpen);
  const toggleMoreMenu = useUIStore((s) => s.toggleMoreMenu);
  const closeMoreMenu = useUIStore((s) => s.closeMoreMenu);

  const moreItems = isPersonalMode ? BOTTOM_NAV_MORE : [];
  const isMoreActive = moreItems.includes(activeView);

  return (
    <nav className="bottom-nav">
      <div className="bn-row">
        {BOTTOM_NAV_MAIN.map((view) => (
          <button
            key={view}
            className={`bn-item${activeView === view ? ' active' : ''}`}
            onClick={() => setActiveView(view)}
          >
            <span>{SHORT_LABEL[view] ?? VIEW_META[view].title}</span>
          </button>
        ))}

        {moreItems.length > 0 && (
          <button
            className={`bn-item${isMoreActive ? ' active' : ''}`}
            onClick={toggleMoreMenu}
            aria-haspopup="true"
            aria-expanded={isMoreMenuOpen}
          >
            <span>Mais</span>
          </button>
        )}
      </div>

      {moreItems.length > 0 && (
        <>
          <div
            className={`bn-more-backdrop${isMoreMenuOpen ? ' open' : ''}`}
            onClick={closeMoreMenu}
          />
          <div className={`bn-more-menu${isMoreMenuOpen ? ' open' : ''}`}>
            {moreItems.map((view) => (
              <button key={view} className="bn-more-item" onClick={() => setActiveView(view)}>
                <span>{VIEW_META[view].title}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
