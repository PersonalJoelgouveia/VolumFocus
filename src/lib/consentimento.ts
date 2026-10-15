/**
 * Menores de idade e consentimento do responsável (LGPD) — regras PURAS (sem Firebase).
 *
 * IMPORTANTE: nada aqui "prova" consentimento. A prova é o registro gravado pelo RESPONSÁVEL logado
 * no Firestore (coleção `consentimentos`), com hora do servidor e validado pelas Security Rules.
 * Os textos abaixo são RASCUNHOS técnicos e DEVEM ser revisados por profissional jurídico antes de produção
 * (ver docs/LGPD_Menores_Requisitos.md).
 */

export const FINALIDADES = ['tratamento_dados', 'atendimento', 'uso_imagem'] as const;
export type Finalidade = (typeof FINALIDADES)[number];
export type Decisao = 'aceito' | 'recusado' | 'revogado';
export type TipoEvento = 'consentimento_responsavel' | 'aceite_avaliacao_online';

/** Finalidades sem as quais o app NÃO é liberado ao menor (uso_imagem é opcional e só libera fotos/vídeos). */
export const FINALIDADES_OBRIGATORIAS: readonly Finalidade[] = ['tratamento_dados', 'atendimento'];

export interface TextoConsentimento {
  finalidade: Finalidade;
  /** Mude a versão a CADA alteração do texto: autorizações de versão antiga pedem nova decisão. */
  versao: string;
  titulo: string;
  obrigatoria: boolean;
  texto: string;
}

export const TEXTOS_CONSENTIMENTO: Record<Finalidade, TextoConsentimento> = {
  tratamento_dados: {
    finalidade: 'tratamento_dados',
    versao: '0.1-rascunho',
    titulo: 'Tratamento de dados pessoais do menor',
    obrigatoria: true,
    texto:
      'Autorizo o Personal Trainer responsável a tratar os dados pessoais do(a) menor sob minha responsabilidade ' +
      '(nome, e-mail, data de nascimento, contato, objetivo, restrições/lesões informadas, rotinas de treino e ' +
      'avaliações físicas registradas) exclusivamente para planejar, acompanhar e registrar o treinamento. ' +
      'Os dados não serão usados para publicidade nem compartilhados com terceiros para outras finalidades. ' +
      'Posso consultar, corrigir, pedir a eliminação dos dados ou revogar esta autorização a qualquer momento, ' +
      'sem custo, por este mesmo painel.',
  },
  atendimento: {
    finalidade: 'atendimento',
    versao: '0.1-rascunho',
    titulo: 'Autorização para atendimento',
    obrigatoria: true,
    texto:
      'Autorizo o(a) menor sob minha responsabilidade a receber orientação e acompanhamento de treinamento físico ' +
      'do Personal Trainer responsável. Declaro estar ciente de que o aluno só terá acesso ao aplicativo depois ' +
      'desta autorização e de que posso revogá-la a qualquer momento.',
  },
  uso_imagem: {
    finalidade: 'uso_imagem',
    versao: '0.1-rascunho',
    titulo: 'Fotos e vídeos (opcional)',
    obrigatoria: false,
    texto:
      'Autorizo o registro de fotos e vídeos do(a) menor sob minha responsabilidade (por exemplo, fotos comparativas ' +
      'de avaliação e vídeos de execução de exercícios), usados somente no acompanhamento do treinamento e ' +
      'guardados no dispositivo. Esta autorização é separada das demais: recusá-la não impede o atendimento.',
  },
};

/** Aceite do aluno ADULTO ao enviar a avaliação online (dado de saúde). Rascunho: revisão jurídica (J4/J5). */
export const TEXTO_AVALIACAO_ONLINE: Omit<TextoConsentimento, 'finalidade'> & { finalidade: 'avaliacao_online' } = {
  finalidade: 'avaliacao_online',
  versao: '0.1-rascunho',
  titulo: 'Envio da avaliação física online',
  obrigatoria: true,
  texto:
    'Confirmo que as informações desta avaliação (medidas, hábitos e respostas de saúde) são verdadeiras e autorizo ' +
    'o Personal Trainer responsável a usá-las, exclusivamente, para planejar e acompanhar o meu treinamento. ' +
    'Posso pedir a correção ou a eliminação desses dados quando quiser.',
};

export type FaixaEtaria = 'crianca' | 'adolescente' | 'adulto';

function parseIso(d?: string | null): { y: number; m: number; d: number } | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const [y, m, dd] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== dd) return null;
  return { y, m, d: dd };
}

/** Idade em anos completos na data `hoje` (null se a data de nascimento for inválida ou futura). */
export function idadeEm(dataNascimento: string | undefined | null, hoje: Date = new Date()): number | null {
  const n = parseIso(dataNascimento);
  if (!n) return null;
  let idade = hoje.getFullYear() - n.y;
  const m = hoje.getMonth() + 1 - n.m;
  if (m < 0 || (m === 0 && hoje.getDate() < n.d)) idade--;
  return idade < 0 ? null : idade;
}

/** criança < 12; adolescente 12–17; adulto ≥ 18 (ECA, art. 2º). null = data ausente/inválida. */
export function faixaEtaria(dataNascimento: string | undefined | null, hoje: Date = new Date()): FaixaEtaria | null {
  const idade = idadeEm(dataNascimento, hoje);
  if (idade === null) return null;
  if (idade < 12) return 'crianca';
  if (idade < 18) return 'adolescente';
  return 'adulto';
}

export function isMenor(dataNascimento: string | undefined | null, hoje: Date = new Date()): boolean {
  const f = faixaEtaria(dataNascimento, hoje);
  return f === 'crianca' || f === 'adolescente';
}

/** Data (AAAA-MM-DD) do 18º aniversário. 29/02 vira 01/03 em ano não bissexto. null se inválida. */
export function maioridadeIso(dataNascimento: string | undefined | null): string | null {
  const n = parseIso(dataNascimento);
  if (!n) return null;
  const y = n.y + 18;
  let m = n.m;
  let d = n.d;
  if (m === 2 && d === 29 && !((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) {
    m = 3;
    d = 1;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** O aluno cuja `maioridadeEm` (do Firestore) ainda não chegou continua sendo menor. */
export function aindaMenorPorMaioridade(maioridadeEm: unknown, hoje: Date = new Date()): boolean {
  if (typeof maioridadeEm !== 'string') return false;
  const n = parseIso(maioridadeEm);
  if (!n) return true; // fail-closed: valor estranho = trata como menor
  return hoje.getTime() < Date.UTC(n.y, n.m - 1, n.d);
}

/** SHA-256 (hex) — evidência do texto EXATO exibido ao responsável. */
export async function sha256Hex(texto: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function textoParaHash(t: { finalidade: string; versao: string; titulo: string; texto: string }): string {
  return `${t.finalidade}|${t.versao}|${t.titulo}|${t.texto}`;
}

export interface EstadoConsentimento {
  finalidade: Finalidade;
  decisao: Decisao;
  versaoTexto: string;
  responsavelEmail: string;
  /** Evento imutável que originou esta decisão (para ligar correções). */
  eventoId?: string;
}

/** Autorização vigente = concedida, na versão atual do texto e dada pelo responsável hoje vinculado. */
export function estadoVigente(
  e: EstadoConsentimento | null | undefined,
  responsavelEmail: string | null | undefined
): boolean {
  if (!e || !responsavelEmail) return false;
  return (
    e.decisao === 'aceito' &&
    e.versaoTexto === TEXTOS_CONSENTIMENTO[e.finalidade].versao &&
    e.responsavelEmail === responsavelEmail
  );
}

export function consentimentoObrigatorioOk(
  estados: Partial<Record<Finalidade, EstadoConsentimento | null>>,
  responsavelEmail: string | null | undefined
): boolean {
  return FINALIDADES_OBRIGATORIAS.every((f) => estadoVigente(estados[f], responsavelEmail));
}

/** Campos do evento que o app envia. O servidor NÃO os aceita às cegas: as Rules conferem uid, e-mail do
 *  responsável, provedor e momento do login contra o token validado, `criadoEm` == hora do servidor e
 *  `ownerUUID` == o gravado no cliente. Sem IP, user-agent, CPF ou documento (ver docs/Registro_Consentimento_Evidencias.md). */
export interface EventoBase {
  alunoEmail: string;
  ownerUUID: string;
  autorUid: string;
  autorPapel: 'responsavel' | 'aluno';
  tipo: TipoEvento;
  finalidade: Finalidade | 'avaliacao_online';
  decisao: Decisao;
  versaoTexto: string;
  textoHash: string;
  provedor: string;
  authTime: number;
  responsavelEmail?: string;
  avaliacaoId?: string;
  substituiEventoId?: string;
}

/** Remove campos opcionais vazios (as Rules usam hasOnly) e normaliza e-mails. */
export function montarEvento(e: EventoBase): EventoBase {
  const out: EventoBase = { ...e, alunoEmail: e.alunoEmail.toLowerCase() };
  if (e.responsavelEmail) out.responsavelEmail = e.responsavelEmail.toLowerCase();
  else delete out.responsavelEmail;
  if (!e.avaliacaoId) delete out.avaliacaoId;
  if (!e.substituiEventoId) delete out.substituiEventoId;
  return out;
}

/** Id determinístico do aceite da avaliação online (as Rules exigem este formato). */
export function idAceiteAvaliacao(avaliacaoId: string): string {
  return `aceite_${avaliacaoId}`;
}
