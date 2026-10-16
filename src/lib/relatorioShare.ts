/**
 * Link protegido do relatório de avaliação — regras PURAS (sem Firebase).
 *
 * O link é só um PONTEIRO opaco: `#/relatorio/<shareId>`. O e-mail do aluno, o id da avaliação e o
 * ownerUUID ficam no documento `compartilhamentos/{shareId}` (protegido pelas Security Rules), nunca na URL.
 * O fragmento (#...) não é enviado ao servidor nem no cabeçalho Referer.
 */

export const SHARE_ID_RE = /^[A-Za-z0-9_-]{22}$/;
export const DIAS_VALIDADE_PADRAO = 7;
export const DIAS_VALIDADE_MAX = 30; // as Rules recusam expiraEm > 30 dias
export const OPCOES_VALIDADE_DIAS = [1, 7, 30] as const;

/** 128 bits aleatórios (crypto), base64url sem padding = 22 caracteres. Não é derivado de dado pessoal. */
export function gerarShareId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function shareIdValido(id: unknown): id is string {
  return typeof id === 'string' && SHARE_ID_RE.test(id);
}

/** "#/relatorio/<id>" -> id (ou null se o formato for inválido: nada é consultado no servidor). */
export function parseRelatorioHash(hash: string): string | null {
  const m = /^#\/relatorio\/([^/?#]+)$/.exec(hash);
  return m && shareIdValido(m[1]) ? m[1] : null;
}

export function montarLink(base: string, shareId: string): string {
  return `${base.split('#')[0]}#/relatorio/${shareId}`;
}

export function expiraEmDias(dias: number, agora: Date = new Date()): Date {
  const d = Math.min(Math.max(Math.floor(dias), 1), DIAS_VALIDADE_MAX);
  // Margem de 1 min abaixo do limite das Rules (request.time + 30d) para não falhar por relógio/latência.
  return new Date(agora.getTime() + d * 86_400_000 - (d === DIAS_VALIDADE_MAX ? 60_000 : 0));
}

export type EstadoShare = 'ativo' | 'revogado' | 'expirado';

export interface ShareDoc {
  shareId: string;
  alunoEmail: string;
  avaliacaoId: string;
  ownerUUID: string;
  criadoPorUid: string;
  criadoEm: Date | null;
  expiraEm: Date | null;
  revogadoEm: Date | null;
  paraAluno: boolean;
}

/** Revogado tem precedência. Sem `expiraEm` válido = expirado (fail-closed). */
export function estadoDoShare(s: Pick<ShareDoc, 'revogadoEm' | 'expiraEm'>, agora: Date = new Date()): EstadoShare {
  if (s.revogadoEm) return 'revogado';
  if (!s.expiraEm || Number.isNaN(s.expiraEm.getTime()) || agora.getTime() >= s.expiraEm.getTime()) return 'expirado';
  return 'ativo';
}

export const MENSAGEM_LINK_INDISPONIVEL =
  'Este link não está disponível para a sua conta. Ele pode ter sido revogado, ter expirado ou não ser destinado a você.';
