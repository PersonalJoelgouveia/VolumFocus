/**
 * Logging do módulo Wearables — silencioso em produção por padrão.
 * Auditoria de privacidade: os `console.warn` espalhados pelos providers/
 * store só devem existir como apoio de desenvolvimento; em build de
 * produção (o que roda no dispositivo do usuário) eles não devem emitir
 * nada no console, mesmo que o argumento seja só um `Error` (nunca deve
 * carregar payload de sensor, mas o objeto de erro pode, em alguns SDKs
 * nativos, ecoar parte do payload que falhou ao processar).
 */
export function warnDev(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}
