/**
 * Espaço do navegador para mídia local (vídeos/fotos). Sem dependências.
 * Mídia local é CÓPIA ÚNICA (nunca vai à nuvem): falhar com mensagem clara
 * antes de gravar, e pedir armazenamento persistente, evita perda silenciosa.
 */

/** Bytes livres estimados na cota da origem, ou `null` se o navegador não informa. */
export async function getFreeStorageBytes(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est || typeof est.quota !== 'number' || typeof est.usage !== 'number') return null;
    return Math.max(0, est.quota - est.usage);
  } catch {
    return null;
  }
}

let persistenciaPedida = false;

/**
 * Pede ao navegador que NÃO descarte o IndexedDB sob pressão de espaço (sem
 * isso o armazenamento é "best-effort" e pode ser limpo sem aviso). Uma vez
 * por carregamento; chamar logo após uma ação do usuário. Alguns navegadores
 * (ex.: Firefox) mostram um pedido de permissão.
 */
export function requestPersistentStorage(): void {
  if (persistenciaPedida) return;
  persistenciaPedida = true;
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* sem suporte */
  }
}
