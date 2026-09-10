/**
 * Migrado fielmente de mxOnYtInput()/_mxIdFromEmbedUrl() (index.html
 * ~5296-5315, ~5194-5199): mesma regex, suporta link normal
 * (watch?v=), youtu.be, /shorts/, /embed/ e /v/.
 */

const YT_REGEX = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;

/** Extrai o ID de 11 caracteres de uma URL do YouTube em qualquer formato suportado. */
export function extractYoutubeId(url: string): string | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(YT_REGEX);
  if (match && match[2]?.length === 11) return match[2];
  return null;
}

/** Extrai o ID a partir de uma URL de embed já salva (`.../embed/ID`). */
export function idFromEmbedUrl(embedUrl: string | null | undefined): string | null {
  if (!embedUrl) return null;
  const m = embedUrl.match(/embed\/([^?&#/]+)/);
  return m ? m[1] : null;
}

export function embedUrlFromId(id: string): string {
  return `https://www.youtube.com/embed/${id}`;
}

export function thumbnailUrlFromId(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
