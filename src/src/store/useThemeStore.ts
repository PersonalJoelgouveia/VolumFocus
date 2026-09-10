import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Tema claro/escuro — não existe no monolito (era só "Dark Glow" fixo em
 * tokens.css). Persistido isoladamente (jg3_theme, fora do payload de
 * backup em nuvem) por ser preferência local do dispositivo, não dado do
 * usuário. Aplica data-theme no <html> a cada mudança e na reidratação
 * inicial (ver initTheme(), chamado em main.tsx antes do primeiro render).
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
    }),
    {
      name: 'jg3_theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);

/** Aplica o tema persistido antes do primeiro paint (chamar em main.tsx). */
export function initTheme() {
  applyTheme(useThemeStore.getState().theme);
}
