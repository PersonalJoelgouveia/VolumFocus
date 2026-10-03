import type { OnlineQuestionnaireData } from '../types/assessment';
import type { OnlinePointFormState } from './onlineAssessment';

/**
 * Estado do wizard da Avaliação Online (o que o rascunho guarda em `data`).
 * Vive aqui — e não no componente — para a restauração do rascunho ser
 * validada por uma função pura e testável.
 */
export interface OnlineFormState {
  data: string;
  maoDominante: 'direita' | 'esquerda' | '';
  objetivoPrincipal: string;
  nivelExperiencia: string;
  peso: string;
  altura: string;
  pontosCircunferencia: OnlinePointFormState[];
  questionario: OnlineQuestionnaireData;
}

const MAX_TEXTO = 5000;
const MAX_CURTO = 200;
const MAX_PONTOS = 60;
const LADOS = ['direito', 'esquerdo', 'none'] as const;

type Obj = Record<string, unknown>;

function ehObjeto(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function numeroOpcional(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function valorNumerico(v: unknown): string {
  if (typeof v === 'string') return v.slice(0, 12);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

export function sanearQuestionario(raw: unknown): OnlineQuestionnaireData {
  if (!ehObjeto(raw)) return {};
  const q: OnlineQuestionnaireData = {};
  const t = (k: keyof OnlineQuestionnaireData, max: number) => {
    if (typeof raw[k] === 'string') (q as Obj)[k] = (raw[k] as string).slice(0, max);
  };
  const n = (k: keyof OnlineQuestionnaireData) => {
    const v = numeroOpcional(raw[k]);
    if (v !== undefined) (q as Obj)[k] = v;
  };
  t('nivelAtividade', MAX_CURTO);
  t('modalidadePrincipal', MAX_CURTO);
  t('qualidadeSono', MAX_CURTO);
  t('frequenciaAerobica', MAX_CURTO);
  t('historicoTreinamento', MAX_TEXTO);
  t('observacoes', MAX_TEXTO);
  t('objetivoPrincipal', MAX_CURTO);
  t('nivelExperiencia', MAX_CURTO);
  n('frequenciaSemanalTreino');
  n('horasSono');
  n('tempoSentadoHoras');
  if (raw.maoDominante === 'direita' || raw.maoDominante === 'esquerda' || raw.maoDominante === '') {
    q.maoDominante = raw.maoDominante;
  }
  if (ehObjeto(raw.triagemSaude)) {
    const triagem: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(raw.triagemSaude)) {
      if (typeof v === 'boolean' && k.length <= 64) triagem[k] = v;
    }
    q.triagemSaude = triagem;
  }
  return q;
}

function sanearPontos(raw: unknown, base: OnlinePointFormState[]): OnlinePointFormState[] {
  const guardados = new Map<string, Obj>();
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, MAX_PONTOS)) {
      if (ehObjeto(item) && typeof item.id === 'string') guardados.set(item.id, item);
    }
  }
  // Pontos padrão: sempre os do app (nome/lado/método não vêm do rascunho), só m1/m2 são restaurados.
  const resultado = base.map((p) => {
    const g = guardados.get(p.id);
    return g ? { ...p, m1: valorNumerico(g.m1), m2: valorNumerico(g.m2) } : p;
  });
  // Medidas personalizadas (criadas pelo usuário).
  const idsBase = new Set(base.map((p) => p.id));
  for (const g of guardados.values()) {
    if (g.personalizada !== true || idsBase.has(g.id as string)) continue;
    if (!/^circ-online-[A-Za-z0-9_-]{1,64}$/.test(g.id as string)) continue;
    const lado = (LADOS as readonly unknown[]).includes(g.lado) ? (g.lado as OnlinePointFormState['lado']) : 'none';
    resultado.push({
      id: g.id as string,
      nome: texto(g.nome, 80),
      lado,
      padronizada: false,
      m1: valorNumerico(g.m1),
      m2: valorNumerico(g.m2),
      personalizada: true,
    });
  }
  return resultado;
}

/**
 * Valida e normaliza o `data` de um rascunho restaurado do localStorage. Aceita
 * rascunhos de versões anteriores do app (campos ausentes assumem o padrão) e
 * devolve `null` se o conteúdo não for um objeto. Nunca devolve estrutura que
 * quebre a renderização (ex.: `pontosCircunferencia` indefinido).
 */
export function sanearEstadoOnline(raw: unknown, base: OnlineFormState): OnlineFormState | null {
  if (!ehObjeto(raw)) return null;
  return {
    data: typeof raw.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.data) ? raw.data : base.data,
    maoDominante: raw.maoDominante === 'direita' || raw.maoDominante === 'esquerda' ? raw.maoDominante : '',
    objetivoPrincipal: texto(raw.objetivoPrincipal, MAX_CURTO),
    nivelExperiencia: texto(raw.nivelExperiencia, MAX_CURTO),
    peso: valorNumerico(raw.peso),
    altura: valorNumerico(raw.altura),
    pontosCircunferencia: sanearPontos(raw.pontosCircunferencia, base.pontosCircunferencia),
    questionario: sanearQuestionario(raw.questionario),
  };
}
