/**
 * Id determinístico de registro sincronizado: Hash(provider + type +
 * timestamp). Mesma amostra, em qualquer execução do sync, sempre produz
 * o mesmo id — é isso que garante dedup e idempotência no
 * WearableLocalStore (put por id nunca cria linha duplicada).
 *
 * FNV-1a de 32 bits: determinístico, sem dependência externa, rápido o
 * bastante pra rodar em lote sobre milhares de amostras sem travar a UI.
 * Não precisa ser cripto-seguro — só estável e com baixíssima colisão
 * pro espaço de chaves (provider,type,timestamp) que realmente existe.
 */
export function hashRecordId(provider: string, type: string, timestamp: string): string {
  const input = `${provider}|${type}|${timestamp}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 força unsigned antes de virar hex — evita "-" no id.
  return (hash >>> 0).toString(16).padStart(8, '0');
}
