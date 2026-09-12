/**
 * Domain model do módulo "Avaliação Física" — isolado por design.
 *
 * Não importa nem estende tipos de outros domínios (Aluno, Força, Cardio,
 * Saúde/Wearables). A única ligação com o resto do app é `alunoId`
 * (referência solta, sem import cruzado).
 */

/** Protocolo utilizado na avaliação. */
export type AssessmentProtocol = 'skinfold' | 'bioimpedance' | 'online' | 'custom';

/** Medição de dobra cutânea — 3 leituras + média. */
export interface SkinfoldMeasurement {
  measurement1: number;
  measurement2: number;
  measurement3: number;
  average: number;
}

/** Lado de uma circunferência, quando aplicável. */
export type CircumferenceSide = 'direito' | 'esquerdo' | 'none';

/** Só 'cm' é suportado hoje — campo existe desde já pra não exigir mudança
 *  de forma quando outra unidade for necessária. */
export type CircumferenceUnit = 'cm';

/** Uma circunferência registrada — padrão ou personalizada. `valor` só
 *  existe pra medidas de fato tiradas (histórico não guarda "não medido"). */
export interface CircumferenceEntry {
  id: string;
  nome: string;
  valor: number;
  unidade: CircumferenceUnit;
  lado: CircumferenceSide;
  personalizada?: boolean;
}

/** Conjunto de circunferências de uma avaliação. Array (não mais
 *  Record<string, number>) pra preservar nome/unidade/lado por medida —
 *  necessário pra gráficos de evolução por ponto e pra medidas
 *  personalizadas com nome livre. */
export type CircumferenceMeasurement = CircumferenceEntry[];

/** Dados brutos de bioimpedância (varia por aparelho/fabricante). */
export type BioimpedanceData = Record<string, number>;

/** Dados antropométricos básicos. */
export interface Anthropometry {
  peso: number;
  altura: number;
  imc: number;
}

/** Resultados calculados da avaliação (composição corporal). Nem todo
 *  protocolo produz todos os campos — ex.: dobras cutâneas (JP7) não
 *  estima gordura visceral nem TMB, que dependem de outro método
 *  (bioimpedância). Por isso os dois ficam opcionais. */
export interface AssessmentResults {
  percentualGordura: number;
  percentualMassaGorda: number;
  massaGordaKg: number;
  percentualMassaLegra: number;
  massaMagraKg: number;
  gorduraVisceral?: number;
  metabolismoBasal?: number;
}

/** Conjunto de dobras cutâneas do protocolo (7 pontos). */
export interface SkinfoldSet {
  peitoral: SkinfoldMeasurement;
  axilarMedia: SkinfoldMeasurement;
  triceps: SkinfoldMeasurement;
  subescapular: SkinfoldMeasurement;
  abdominal: SkinfoldMeasurement;
  supraIliaca: SkinfoldMeasurement;
  coxa: SkinfoldMeasurement;
}

/** Registro completo de uma Avaliação Física. */
export interface PhysicalAssessment {
  id: string;
  alunoId: string;
  date: string | Date;
  protocol: AssessmentProtocol;
  evaluator?: string;
  notes?: string;
  anthropometry: Anthropometry;
  circumferences: CircumferenceMeasurement;
  skinfolds: SkinfoldSet;
  bioimpedance?: BioimpedanceData;
  results: AssessmentResults;
  createdAt: string | Date;
  updatedAt: string | Date;
}
