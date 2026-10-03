import { SKINFOLD_SITES } from './pollock7';
import { sanearQuestionario } from './onlineDraftSanitize';
import type {
  AssessmentProtocol,
  AssessmentResults,
  AssessmentReview,
  AssessmentSubmitter,
  CircumferenceEntry,
  CircumferenceSide,
  OnlineAssessmentStatus,
  PhysicalAssessment,
  SkinfoldMeasurement,
  SkinfoldSet,
} from '../types/assessment';

/**
 * Validação de uma avaliação LIDA do Firestore (fronteira de confiança).
 *
 * O documento pode ter sido gravado por outra pessoa — o aluno cria a própria
 * avaliação online — ou por um cliente adulterado. Nada vindo da nuvem é
 * confiável: a UI do Personal faz `peso.toFixed()`, `circumferences.map(...)`,
 * `skinfolds[site].average` etc. sem checar, então um documento malformado
 * derrubaria a tela a cada carregamento. Aqui o documento vira um
 * `PhysicalAssessment` bem formado ou é rejeitado (`null`).
 *
 * O `id` SEMPRE é o id do documento — nunca o campo `id` do conteúdo, que o
 * autor do documento controla (e que o app usa em editar/excluir/fotos).
 * A autenticidade de `status`/`review`/`submittedBy` NÃO pode ser provada aqui:
 * quem a garante são as Security Rules (firestore.rules).
 */

const PROTOCOLOS: readonly AssessmentProtocol[] = ['skinfold', 'bioimpedance', 'online', 'custom'];
const STATUS: readonly OnlineAssessmentStatus[] = ['rascunho', 'em_preenchimento', 'enviada', 'revisada'];
const SUBMITTERS: readonly AssessmentSubmitter[] = ['aluno', 'personal'];
const LADOS: readonly CircumferenceSide[] = ['direito', 'esquerdo', 'none'];

const MAX_CIRCUNFERENCIAS = 60;
const MAX_BIO_CAMPOS = 80;
const MAX_CORRECOES = 50;
const ID_DOCUMENTO = /^[A-Za-z0-9_-]{1,128}$/;

type Obj = Record<string, unknown>;

function ehObjeto(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function numero(v: unknown, max = 100000): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
}

function texto(v: unknown, max: number): string | undefined {
  return typeof v === 'string' ? v.slice(0, max) : undefined;
}

/** Aceita string ISO e `Timestamp` do Firestore (objeto com `toDate`). Devolve ISO ou `null`. */
function dataISO(v: unknown): string | null {
  let d: Date | null = null;
  if (typeof v === 'string') d = new Date(v);
  else if (v instanceof Date) d = v;
  else if (ehObjeto(v) && typeof v.toDate === 'function') {
    try {
      d = (v as unknown as { toDate: () => Date }).toDate();
    } catch {
      d = null;
    }
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  const ano = d.getUTCFullYear();
  if (ano < 1900 || ano > 2200) return null;
  return typeof v === 'string' ? v : d.toISOString();
}

function sanearDobra(raw: unknown): SkinfoldMeasurement | null {
  if (!ehObjeto(raw)) return null;
  const media = numero(raw.average, 1000);
  if (media === null) return null;
  return {
    measurement1: numero(raw.measurement1, 1000) ?? 0,
    measurement2: numero(raw.measurement2, 1000) ?? 0,
    measurement3: numero(raw.measurement3, 1000) ?? 0,
    average: media,
  };
}

/** Protocolo "skinfold" exige as 7 dobras; os demais recebem zeros (como o app grava). */
function sanearDobras(raw: unknown, exigir: boolean): SkinfoldSet | null {
  const origem = ehObjeto(raw) ? raw : {};
  const conjunto = {} as SkinfoldSet;
  for (const site of SKINFOLD_SITES) {
    const dobra = sanearDobra(origem[site]);
    if (!dobra && exigir) return null;
    conjunto[site] = dobra ?? { measurement1: 0, measurement2: 0, measurement3: 0, average: 0 };
  }
  return conjunto;
}

function sanearCircunferencias(raw: unknown): CircumferenceEntry[] {
  if (!Array.isArray(raw)) return [];
  const saida: CircumferenceEntry[] = [];
  for (const item of raw.slice(0, MAX_CIRCUNFERENCIAS)) {
    if (!ehObjeto(item)) continue;
    const id = texto(item.id, 64);
    const nome = texto(item.nome, 80);
    const valor = numero(item.valor, 1000);
    if (!id || !nome || valor === null) continue;
    const entrada: CircumferenceEntry = {
      id,
      nome,
      valor,
      unidade: 'cm',
      lado: (LADOS as readonly unknown[]).includes(item.lado) ? (item.lado as CircumferenceSide) : 'none',
    };
    if (item.personalizada === true) entrada.personalizada = true;
    const metodo = texto(item.measurementMethod, 40);
    if (metodo) entrada.measurementMethod = metodo;
    saida.push(entrada);
  }
  return saida;
}

function sanearResultados(raw: unknown): AssessmentResults {
  const r: AssessmentResults = {};
  if (!ehObjeto(raw)) return r;
  const campos = [
    'percentualGordura', 'percentualMassaGorda', 'massaGordaKg', 'percentualMassaLegra', 'massaMagraKg',
    'gorduraVisceral', 'metabolismoBasal', 'relacaoCinturaQuadril', 'relacaoCinturaEstatura',
  ] as const;
  for (const campo of campos) {
    const v = numero(raw[campo], 100000);
    if (v !== null) r[campo] = v;
  }
  return r;
}

function sanearBioimpedancia(raw: unknown): Record<string, number> | undefined {
  if (!ehObjeto(raw)) return undefined;
  const saida: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw).slice(0, MAX_BIO_CAMPOS)) {
    const n = numero(v, 100000);
    if (n !== null && k.length <= 64) saida[k] = n;
  }
  return saida;
}

function sanearRevisao(raw: unknown): AssessmentReview | undefined {
  if (!ehObjeto(raw)) return undefined;
  const reviewedBy = texto(raw.reviewedBy, 200);
  const reviewedAt = dataISO(raw.reviewedAt);
  if (!reviewedBy || !reviewedAt) return undefined;
  const revisao: AssessmentReview = { reviewedBy, reviewedAt };
  const nota = texto(raw.reviewNote, 2000);
  if (nota) revisao.reviewNote = nota;
  if (Array.isArray(raw.corrections)) {
    const correcoes = [];
    for (const c of raw.corrections.slice(0, MAX_CORRECOES)) {
      if (!ehObjeto(c)) continue;
      const field = texto(c.field, 80);
      const originalValue = texto(c.originalValue, 200);
      const reviewedValue = texto(c.reviewedValue, 200);
      if (field !== undefined && originalValue !== undefined && reviewedValue !== undefined) {
        correcoes.push({ field, originalValue, reviewedValue });
      }
    }
    if (correcoes.length > 0) revisao.corrections = correcoes;
  }
  return revisao;
}

/**
 * Converte o conteúdo bruto do documento `docId` em `PhysicalAssessment`, ou `null`
 * se estiver malformado a ponto de quebrar a interface. Campos opcionais inválidos
 * são descartados em vez de rejeitar o documento.
 */
export function validarAvaliacaoRemota(raw: unknown, docId: string): PhysicalAssessment | null {
  if (!ID_DOCUMENTO.test(docId) || !ehObjeto(raw)) return null;

  const protocol = raw.protocol;
  if (typeof protocol !== 'string' || !(PROTOCOLOS as readonly string[]).includes(protocol)) return null;

  const date = dataISO(raw.date);
  if (!date) return null;

  if (!ehObjeto(raw.anthropometry)) return null;
  const peso = numero(raw.anthropometry.peso, 1000);
  const altura = numero(raw.anthropometry.altura, 1000);
  const imc = numero(raw.anthropometry.imc, 1000);
  if (peso === null || altura === null || imc === null) return null;
  const anthropometry: PhysicalAssessment['anthropometry'] = { peso, altura, imc };
  if (raw.anthropometry.sexoBiologico === 'M' || raw.anthropometry.sexoBiologico === 'F') {
    anthropometry.sexoBiologico = raw.anthropometry.sexoBiologico;
  }
  const idade = numero(raw.anthropometry.idadeAnos, 150);
  if (idade !== null) anthropometry.idadeAnos = idade;

  const skinfolds = sanearDobras(raw.skinfolds, protocol === 'skinfold');
  if (!skinfolds) return null;

  const avaliacao: PhysicalAssessment = {
    id: docId,
    alunoId: texto(raw.alunoId, 128) ?? '',
    date,
    protocol: protocol as AssessmentProtocol,
    anthropometry,
    circumferences: sanearCircunferencias(raw.circumferences),
    skinfolds,
    results: sanearResultados(raw.results),
    createdAt: dataISO(raw.createdAt) ?? date,
    updatedAt: dataISO(raw.updatedAt) ?? dataISO(raw.createdAt) ?? date,
  };

  const evaluator = texto(raw.evaluator, 200);
  if (evaluator) avaliacao.evaluator = evaluator;
  const notes = texto(raw.notes, 5000);
  if (notes) avaliacao.notes = notes;
  const bio = sanearBioimpedancia(raw.bioimpedance);
  if (bio) avaliacao.bioimpedance = bio;
  if (typeof raw.status === 'string' && (STATUS as readonly string[]).includes(raw.status)) {
    avaliacao.status = raw.status as OnlineAssessmentStatus;
  }
  if (typeof raw.submittedBy === 'string' && (SUBMITTERS as readonly string[]).includes(raw.submittedBy)) {
    avaliacao.submittedBy = raw.submittedBy as AssessmentSubmitter;
  }
  if (ehObjeto(raw.questionnaire)) avaliacao.questionnaire = sanearQuestionario(raw.questionnaire);
  const review = sanearRevisao(raw.review);
  if (review) avaliacao.review = review;

  return avaliacao;
}
