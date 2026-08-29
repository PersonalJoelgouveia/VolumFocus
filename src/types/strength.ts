export type StrFormulaKey = 'hibrida' | 'epley' | 'brzycki' | 'lombardi';

export interface StrFormulaDef {
  key: StrFormulaKey;
  label: string;
  desc: string;
}

export interface StrZone {
  name: string;
  pct: number;
  reps: string;
  cssClass: 'str-zone-high' | 'str-zone-med' | 'str-zone-low';
}

export interface StrLevel {
  threshold: number;
  key: string;
  label: string;
  cssClass: string;
}

/** Um recorde pessoal de 1RM — sucessor direto de um valor em strState.records (jg3_strength_records). */
export interface StrRecord {
  weight: number;
  reps: number;
  rir: number;
  oneRM: number;
  formula: StrFormulaKey;
  date: string;
}

/** Resultado das 3 fórmulas + híbrida — sucessor de strCalcAll(). */
export interface StrCalcAllResult {
  epley: number | null;
  brzycki: number | null;
  lombardi: number | null;
  hibrida: number | null;
}
