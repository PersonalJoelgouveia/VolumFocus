/**
 * Id estável por instância de entrada de log (StrengthLogEntry/CardioLogEntry).
 * Só serve de `key` React p/ a lista do dia — não é usado como identidade de
 * negócio em nenhum lugar (isso continua sendo o índice no array, ex:
 * exDoneKey `${dayIdx}:${logIdx}`). Sem isso a lista usava `key={index}`,
 * que o React reatribui a linhas erradas quando o array muda de tamanho
 * (ex: ao adicionar exercício) — causa raiz mais provável do NotFoundError
 * "removeChild" relatado.
 */
export function genLogEntryId(): string {
  return `le-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
