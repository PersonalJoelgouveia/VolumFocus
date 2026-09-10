import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'pt-BR' | 'es' | 'en';

function applyLocale(locale: Locale) {
  document.documentElement.setAttribute('lang', locale);
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * Idioma da interface — seleção explícita do usuário, independente do
 * idioma do navegador. Persistido isoladamente (jg3_locale, fora do
 * payload de backup em nuvem) por ser preferência local do dispositivo,
 * mesmo padrão de useThemeStore. Aplica lang no <html> a cada mudança e
 * na reidratação inicial (ver initLocale(), chamado em main.tsx antes do
 * primeiro render) — junto com translate="no"/notranslate no index.html,
 * isso garante que a escolha explícita do usuário prevaleça sobre a
 * tradução automática do navegador.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'pt-BR',
      setLocale: (locale) => {
        applyLocale(locale);
        set({ locale });
      },
    }),
    {
      name: 'jg3_locale',
      onRehydrateStorage: () => (state) => {
        if (state) applyLocale(state.locale);
      },
    }
  )
);

/** Aplica o locale persistido antes do primeiro paint (chamar em main.tsx, ao lado de initTheme()). */
export function initLocale() {
  applyLocale(useLocaleStore.getState().locale);
}
