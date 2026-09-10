import type { ReactNode } from 'react';
import { useThemeStore } from '../store/useThemeStore';
import { useLocaleStore, type Locale } from '../store/useLocaleStore';
import { useT } from '../i18n/useT';
import { LOCALE_NAMES } from '../i18n/translations';
import './SettingsView.css';

const LOCALES: Locale[] = ['pt-BR', 'es', 'en'];

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

function SettingsNavRow({ icon, label, soonLabel }: { icon: ReactNode; label: string; soonLabel: string }) {
  return (
    <div className="stg-row stg-row-disabled" aria-disabled="true">
      <span className="stg-row-icon">{icon}</span>
      <span className="stg-row-label">{label}</span>
      <span className="stg-row-soon">{soonLabel}</span>
      <ChevronIcon />
    </div>
  );
}

/**
 * Menu Configurações — estrutura inspirada em hevy.com/settings: seções
 * agrupadas em cards, cada uma com linhas de navegação. Perfil/Conta ficam
 * como placeholders desabilitados (fora de escopo desta entrega); Tema e
 * Idioma são funcionais. Idioma vive em Aparência (não em Conta) por ser,
 * como Tema, preferência local do dispositivo — ver useLocaleStore. Aberta
 * via item "Configurações" do drawer mobile e do botão ⚙️ no UserMenu
 * (desktop) — ver AppShell.tsx/MobileSidebar.tsx.
 */
export function SettingsView() {
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <div className="stg-view" translate="no">
      <div className="stg-group">
        <div className="stg-group-title">{t('settings.group.account')}</div>
        <div className="stg-card">
          <SettingsNavRow icon="👤" label={t('settings.row.profile')} soonLabel={t('settings.comingSoon')} />
          <div className="stg-divider" />
          <SettingsNavRow icon="🔐" label={t('settings.row.account')} soonLabel={t('settings.comingSoon')} />
        </div>
      </div>

      <div className="stg-group">
        <div className="stg-group-title">{t('settings.group.appearance')}</div>
        <div className="stg-card">
          <div className="stg-row stg-row-theme">
            <span className="stg-row-label">{t('settings.theme.label')}</span>
            <div className="stg-theme-switch" role="group" aria-label={t('settings.theme.aria')}>
              <button
                type="button"
                className={`stg-theme-opt${theme === 'light' ? ' active' : ''}`}
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
              >
                <SunIcon />
                <span>{t('settings.theme.light')}</span>
              </button>
              <button
                type="button"
                className={`stg-theme-opt${theme === 'dark' ? ' active' : ''}`}
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
              >
                <MoonIcon />
                <span>{t('settings.theme.dark')}</span>
              </button>
            </div>
          </div>
          <div className="stg-divider" />
          <div className="stg-row stg-row-theme">
            <span className="stg-row-label">{t('settings.language.label')}</span>
            <div className="stg-lang-switch" role="group" aria-label={t('settings.language.aria')}>
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className={`stg-lang-opt${locale === loc ? ' active' : ''}`}
                  onClick={() => setLocale(loc)}
                  aria-pressed={locale === loc}
                >
                  {LOCALE_NAMES[loc]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
