import type { Locale } from '../store/useLocaleStore';

/**
 * Dicionários de tradução. Chaves namespaced por view (settings.*) pra
 * permitir expansão pra outras telas sem colisão. Copy revisada pra tirar
 * jargão técnico e manter tom direto/mobile-first em qualquer idioma.
 */
export const translations: Record<Locale, Record<string, string>> = {
  'pt-BR': {
    'settings.group.account': 'Conta',
    'settings.row.profile': 'Perfil',
    'settings.row.account': 'Segurança e acesso',
    'settings.row.language': 'Idioma',
    'settings.comingSoon': 'Em breve',
    'settings.group.appearance': 'Aparência',
    'settings.theme.label': 'Tema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Escuro',
    'settings.theme.aria': 'Escolher tema',
    'settings.language.label': 'Idioma',
    'settings.language.aria': 'Escolher idioma',
  },
  es: {
    'settings.group.account': 'Cuenta',
    'settings.row.profile': 'Perfil',
    'settings.row.account': 'Seguridad y acceso',
    'settings.row.language': 'Idioma',
    'settings.comingSoon': 'Próximamente',
    'settings.group.appearance': 'Apariencia',
    'settings.theme.label': 'Tema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    'settings.theme.aria': 'Elegir tema',
    'settings.language.label': 'Idioma',
    'settings.language.aria': 'Elegir idioma',
  },
  en: {
    'settings.group.account': 'Account',
    'settings.row.profile': 'Profile',
    'settings.row.account': 'Security & access',
    'settings.row.language': 'Language',
    'settings.comingSoon': 'Coming soon',
    'settings.group.appearance': 'Appearance',
    'settings.theme.label': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.theme.aria': 'Choose theme',
    'settings.language.label': 'Language',
    'settings.language.aria': 'Choose language',
  },
};

/** Nomes nativos — sempre exibidos no próprio idioma, independente do locale ativo (padrão de seletores de idioma). */
export const LOCALE_NAMES: Record<Locale, string> = {
  'pt-BR': 'Português',
  es: 'Español',
  en: 'English',
};
