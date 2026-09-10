export type CardioModality = 'esteira' | 'bike';
export type CardioProtocol = 'bruce' | 'astrand' | 'storer' | 'cooper12';

export interface CardioZone {
  key: string;
  name: string;
  desc: string;
  min: number;
  max: number;
  cls: string;
  bpmMin: number;
  bpmMax: number;
}

export interface Vo2Classification {
  key: 'fraco' | 'abaixo' | 'medio' | 'bom' | 'excelente';
  label: string;
  cls: string;
}

/** Inputs de um teste — migrado do objeto `inputs` de cardioCalculate() (index.html ~8951). */
export interface CardioTestInputs {
  gender: 'M' | 'F';
  age: number;
  weight: number;
  fcRest: number;
  vo2Ergo?: number | null;
  modality: CardioModality;
  protocol: CardioProtocol;
  bruceTime?: string;
  bruceFc?: number | null;
  astrandLoad?: number;
  astrandFc?: number;
  storerLoad?: number;
  storerFc?: number | null;
  /** Distância em metros — só para 'cooper12' (protocolo novo, não presente no HTML de referência). */
  cooperDistance?: number;
}

/**
 * Um teste salvo no histórico — sucessor de `jg3_cardio_data`
 * (index.html ~8690), que no original guardava só o ÚLTIMO resultado
 * (um objeto, sobrescrito a cada cálculo). Aqui vira um array — pedido
 * explícito de histórico + comparação entre testes.
 */
export interface CardioTestResult {
  id: string;
  data: string;
  inputs: CardioTestInputs;
  vo2: number;
  fcMax: number;
  fcRest: number;
  fcr: number;
  classification: Vo2Classification;
  zones: CardioZone[];
  formulaUsed: string;
}
