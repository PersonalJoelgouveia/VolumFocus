/**
 * Jackson & Pollock — Protocolo de 7 Dobras Cutâneas.
 *
 * Módulo puro: nenhuma dependência de React, nenhum I/O. Todas as
 * fórmulas do protocolo moram aqui — o componente (SkinfoldAssessmentForm)
 * só coleta os inputs e lê o resultado.
 *
 * Fontes:
 * - Densidade corporal: Jackson & Pollock (1978, homens) e
 *   Jackson, Pollock & Ward (1980, mulheres) — equação generalizada de
 *   7 dobras, validada originalmente para 18–61 anos.
 * - % de gordura a partir da densidade: Siri (1961).
 *
 * Nenhum valor é arredondado durante os cálculos — arredondamento é
 * responsabilidade exclusiva da camada de apresentação.
 */

export type Sex = 'M' | 'F';

/** Ordem oficial dos 7 pontos do protocolo. */
export const SKINFOLD_SITES = [
  'peitoral',
  'axilarMedia',
  'triceps',
  'subescapular',
  'abdominal',
  'supraIliaca',
  'coxa',
] as const;

export type SkinfoldSite = (typeof SKINFOLD_SITES)[number];

export const SKINFOLD_SITE_LABELS: Record<SkinfoldSite, string> = {
  peitoral: 'Peitoral',
  axilarMedia: 'Axilar média',
  triceps: 'Tríceps',
  subescapular: 'Subescapular',
  abdominal: 'Abdominal',
  supraIliaca: 'Supra-ilíaca',
  coxa: 'Coxa',
};

/** As 3 aferições (mm) de um ponto — sempre guardadas junto da média. */
export interface SkinfoldTriple {
  m1: number;
  m2: number;
  m3: number;
  media: number;
}

export type SkinfoldTriples = Record<SkinfoldSite, SkinfoldTriple>;

/** Resultado final do protocolo — nada aqui é inventado/estimado fora do
 *  que o JP7 + Siri produzem (sem % gordura visceral ou TMB, que exigiriam
 *  outro método). */
export interface Pollock7Result {
  somaDobras: number;
  densidadeCorporal: number;
  percentualGordura: number;
  massaGordaKg: number;
  massaMagraKg: number;
  percentualMassaMagra: number;
}

/** Payload completo pronto para persistência — inputs originais + resultado.
 *  `alturaCm` não entra em nenhuma fórmula do JP7; vai junto só porque quem
 *  persiste a avaliação (Anthropometry) precisa dela. */
export interface SkinfoldAssessmentPayload {
  sexo: Sex;
  idade: number;
  pesoKg: number;
  alturaCm: number;
  triples: SkinfoldTriples;
  resultado: Pollock7Result;
}

export interface Pollock7ValidationError {
  /** Nome do campo (um dos SKINFOLD_SITES, ou 'sexo' | 'idade' | 'peso'). */
  field: string;
  message: string;
}

/** Média aritmética das 3 aferições de um ponto, sem arredondamento. */
export function calcMediaDobra(m1: number, m2: number, m3: number): number {
  return (m1 + m2 + m3) / 3;
}

/** Soma as 7 médias (mm). */
export function somaSeteDobras(triples: SkinfoldTriples): number {
  return SKINFOLD_SITES.reduce((soma, site) => soma + triples[site].media, 0);
}

/**
 * Densidade corporal (g/mL) pela equação generalizada de 7 dobras.
 * Homens (Jackson & Pollock, 1978):
 *   Db = 1.112 - 0.00043499·Σ7 + 0.00000055·Σ7² - 0.00028826·idade
 * Mulheres (Jackson, Pollock & Ward, 1980):
 *   Db = 1.097 - 0.00046971·Σ7 + 0.00000056·Σ7² - 0.00012828·idade
 */
export function calcDensidadeCorporal(sexo: Sex, somaDobras: number, idade: number): number {
  if (sexo === 'M') {
    return 1.112 - 0.00043499 * somaDobras + 0.00000055 * somaDobras ** 2 - 0.00028826 * idade;
  }
  return 1.097 - 0.00046971 * somaDobras + 0.00000056 * somaDobras ** 2 - 0.00012828 * idade;
}

/** % de gordura corporal a partir da densidade — método de Siri (1961). */
export function calcPercentualGorduraSiri(densidadeCorporal: number): number {
  return 495 / densidadeCorporal - 450;
}

/** Roda o protocolo completo. Assume inputs já validados — chame
 *  `validarInputsPollock7` antes para mensagens de erro amigáveis. */
export function calcularPollock7(
  sexo: Sex,
  idade: number,
  pesoKg: number,
  triples: SkinfoldTriples
): Pollock7Result {
  const somaDobras = somaSeteDobras(triples);
  const densidadeCorporal = calcDensidadeCorporal(sexo, somaDobras, idade);
  const percentualGordura = calcPercentualGorduraSiri(densidadeCorporal);
  const massaGordaKg = pesoKg * (percentualGordura / 100);
  const massaMagraKg = pesoKg - massaGordaKg;
  const percentualMassaMagra = 100 - percentualGordura;

  return { somaDobras, densidadeCorporal, percentualGordura, massaGordaKg, massaMagraKg, percentualMassaMagra };
}

/** Uma aferição bruta (ainda como string do input, pode estar vazia/inválida). */
export interface SkinfoldTripleInput {
  m1?: number;
  m2?: number;
  m3?: number;
}

/**
 * Validação de negócio: campos vazios, valores negativos e valores
 * fisiologicamente implausíveis. Não faz cálculo — só coleta erros.
 */
export function validarInputsPollock7(
  sexo: Sex | undefined,
  idade: number | undefined,
  pesoKg: number | undefined,
  triples: Partial<Record<SkinfoldSite, SkinfoldTripleInput>>
): Pollock7ValidationError[] {
  const erros: Pollock7ValidationError[] = [];

  if (!sexo) erros.push({ field: 'sexo', message: 'Selecione o sexo biológico.' });

  if (idade == null || Number.isNaN(idade)) {
    erros.push({ field: 'idade', message: 'Informe a idade.' });
  } else if (idade <= 0) {
    erros.push({ field: 'idade', message: 'Idade inválida.' });
  } else if (idade < 18 || idade > 90) {
    // Faixa validada originalmente pelo JP7 é 18–61; a equação generalizada
    // é usada na prática além disso, mas fora de 18–90 o resultado perde confiabilidade.
    erros.push({ field: 'idade', message: 'Idade fora da faixa confiável do protocolo (18–90 anos).' });
  }

  if (pesoKg == null || Number.isNaN(pesoKg)) {
    erros.push({ field: 'peso', message: 'Informe o peso corporal.' });
  } else if (pesoKg <= 0) {
    erros.push({ field: 'peso', message: 'Peso deve ser maior que zero.' });
  } else if (pesoKg > 300) {
    erros.push({ field: 'peso', message: 'Peso informado é implausível.' });
  }

  for (const site of SKINFOLD_SITES) {
    const t = triples[site];
    const label = SKINFOLD_SITE_LABELS[site];
    if (!t || t.m1 == null || t.m2 == null || t.m3 == null) {
      erros.push({ field: site, message: `${label}: preencha as 3 aferições.` });
      continue;
    }
    ([t.m1, t.m2, t.m3] as const).forEach((v, i) => {
      if (Number.isNaN(v)) {
        erros.push({ field: site, message: `${label}: aferição ${i + 1} inválida.` });
      } else if (v < 0) {
        erros.push({ field: site, message: `${label}: aferição ${i + 1} não pode ser negativa.` });
      } else if (v > 100) {
        erros.push({ field: site, message: `${label}: aferição ${i + 1} fora da faixa plausível (máx. 100mm).` });
      }
    });
  }

  return erros;
}

/**
 * Infere o sexo biológico ('M'/'F') a partir do campo livre `genero` do
 * cadastro do aluno. Retorna undefined se ausente/ambíguo — nesse caso o
 * formulário deve pedir a seleção manual, nunca assumir um valor.
 */
export function inferirSexoDoGenero(genero: string | undefined): Sex | undefined {
  if (!genero) return undefined;
  const g = genero.trim().toLowerCase();
  if (['m', 'masculino', 'homem'].includes(g)) return 'M';
  if (['f', 'feminino', 'mulher'].includes(g)) return 'F';
  return undefined;
}
