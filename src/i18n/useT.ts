import { useLocaleStore } from '../store/useLocaleStore';
import { translations } from './translations';

/** Hook de tradução simples — sem lib externa (projeto não usa nenhuma hoje). Chave ausente cai pro próprio key como fallback visível em dev. */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return (key: string) => translations[locale]?.[key] ?? key;
}
