import type { ReactNode } from 'react';
import { useThemeStore } from '../store/useThemeStore';
import './SettingsView.css';

/** Ícones minimalistas — traçado idêntico ao Lucide (Sun/Moon), inline pra
 *  não adicionar lucide-react como dependência nova (projeto não a usa
 *  hoje em nenhum outro componente). */
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function SettingsNavRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="stg-row stg-row-disabled" aria-disabled="true">
      <span className="stg-row-icon">{icon}</span>
      <span className="stg-row-label">{label}</span>
      <span className="stg-row-soon">Em breve</span>
      <ChevronIcon />
    </div>
  );
}

/**
 * Menu Configurações — estrutura inspirada em hevy.com/settings: seções
 * agrupadas em cards, cada uma com linhas de navegação. Perfil/Conta/Idiomas
 * ficam como placeholders desabilitados (fora de escopo desta entrega); só
 * Tema é funcional. Aberta via item "Configurações" do drawer mobile e do
 * botão ⚙️ no UserMenu (desktop) — ver AppShell.tsx/MobileSidebar.tsx.
 */
export function SettingsView() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="stg-view">
      <div className="stg-group">
        <div className="stg-group-title">Conta</div>
        <div className="stg-card">
          <SettingsNavRow icon="👤" label="Perfil" />
          <div className="stg-divider" />
          <SettingsNavRow icon="🔐" label="Conta" />
          <div className="stg-divider" />
          <SettingsNavRow icon="🌐" label="Idiomas" />
        </div>
      </div>

      <div className="stg-group">
        <div className="stg-group-title">Aparência</div>
        <div className="stg-card">
          <div className="stg-row stg-row-theme">
            <span className="stg-row-label">Tema</span>
            <div className="stg-theme-switch" role="group" aria-label="Escolher tema">
              <button
                type="button"
                className={`stg-theme-opt${theme === 'light' ? ' active' : ''}`}
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
              >
                <SunIcon />
                <span>Claro</span>
              </button>
              <button
                type="button"
                className={`stg-theme-opt${theme === 'dark' ? ' active' : ''}`}
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
              >
                <MoonIcon />
                <span>Escuro</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
