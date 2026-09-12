/**
 * Bioimpedância — cálculos derivados (IMC, massa gorda, massa magra) a
 * partir de leituras que o próprio aparelho já fornece (%Gordura,
 * %Massa Magra, Gordura Visceral, TMB). Módulo puro: nenhuma dependência
 * de React.
 *
 * Diferente do protocolo de Dobras (JP7), aqui não existe fórmula pra
 * estimar %Gordura/Gordura Visceral/TMB — esses três são lidos direto do
 * aparelho. Só IMC, Massa Gorda e Massa Magra são derivados aqui, e mesmo
 * esses dois últimos podem ser sobrescritos manualmente quando o aparelho
 * já entrega o valor absoluto em kg (ver `calcularBioimpedancia`).
 *
 * Nenhum valor é arredondado durante os cálculos — arredondamento é
 * responsabilidade exclusiva da camada de apresentação.
 */

export type OrigemValor = 'calculado' | 'manual';

export interface BioimpedanceResult {
  imc: number;
  massaGordaKg: number;
  massaMagraKg: number;
}

export interface BioimpedanceOverrides {
  massaGordaKg?: number;
  massaMagraKg?: number;
}

export interface BioimpedanceValidationInputs {
  pesoKg?: number;
  alturaCm?: number;
  percentualGordura?: number;
  percentualMassaMagra?: number;
  gorduraVisceral?: number;
  metabolismoBasal?: number;
  massaGordaKg?: number;
  massaMagraKg?: number;
}

export interface BioimpedanceValidationError {
  /** 'peso' | 'altura' | 'percentualGordura' | 'percentualMassaMagra' |
   *  'gorduraVisceral' | 'metabolismoBasal' | 'massaGorda' | 'massaMagra' */
  field: string;
  message: string;
}

/** IMC = peso(kg) / altura(m)². */
export function calcIMC(pesoKg: number, alturaCm: number): number {
  const alturaM = alturaCm / 100;
  return pesoKg / (alturaM * alturaM);
}

/** Massa gorda (kg) = peso × (%Gordura / 100). */
export function calcMassaGorda(pesoKg: number, percentualGordura: number): number {
  return pesoKg * (percentualGordura / 100);
}

/** Massa magra (kg) = peso × (%Massa Magra / 100). */
export function calcMassaMagra(pesoKg: number, percentualMassaMagra: number): number {
  return pesoKg * (percentualMassaMagra / 100);
}

/**
 * Roda o protocolo completo. `overrides.massaGordaKg`/`massaMagraKg`
 * têm prioridade sobre o cálculo via percentual — cobre o caso do
 * aparelho já informar o valor absoluto em kg diretamente.
 */
export function calcularBioimpedancia(
  pesoKg: number,
  alturaCm: number,
  percentualGordura: number,
  percentualMassaMagra: number,
  overrides: BioimpedanceOverrides = {}
): BioimpedanceResult {
  return {
    imc: calcIMC(pesoKg, alturaCm),
    massaGordaKg: overrides.massaGordaKg ?? calcMassaGorda(pesoKg, percentualGordura),
    massaMagraKg: overrides.massaMagraKg ?? calcMassaMagra(pesoKg, percentualMassaMagra),
  };
}

function checarFaixa(
  erros: BioimpedanceValidationError[],
  valor: number | undefined,
  field: string,
  label: string,
  min: number,
  max: number
) {
  if (valor == null || Number.isNaN(valor)) {
    erros.push({ field, message: `Informe ${label}.` });
  } else if (valor < min || valor > max) {
    erros.push({ field, message: `${label} fora da faixa plausível (${min}–${max}).` });
  }
}

/**
 * Validação de negócio: campos obrigatórios e faixas plausíveis.
 * `gorduraVisceral` assume a escala de índice 1–59 usada pela maioria dos
 * aparelhos de bioimpedância de consumo (Tanita/Omron) — ajuste os limites
 * se o seu aparelho usar outra escala.
 */
export function validarInputsBioimpedancia(inputs: BioimpedanceValidationInputs): BioimpedanceValidationError[] {
  const erros: BioimpedanceValidationError[] = [];

  checarFaixa(erros, inputs.pesoKg, 'peso', 'o peso', 0.1, 300);
  checarFaixa(erros, inputs.alturaCm, 'altura', 'a altura', 50, 250);
  checarFaixa(erros, inputs.percentualGordura, 'percentualGordura', 'o percentual de gordura', 1, 70);
  checarFaixa(erros, inputs.percentualMassaMagra, 'percentualMassaMagra', 'o percentual de massa magra', 30, 99);
  checarFaixa(erros, inputs.gorduraVisceral, 'gorduraVisceral', 'a gordura visceral', 1, 59);
  checarFaixa(erros, inputs.metabolismoBasal, 'metabolismoBasal', 'a taxa metabólica basal', 500, 5000);

  if (inputs.massaGordaKg == null || Number.isNaN(inputs.massaGordaKg)) {
    erros.push({ field: 'massaGorda', message: 'Informe a massa gorda.' });
  } else if (inputs.massaGordaKg < 0) {
    erros.push({ field: 'massaGorda', message: 'Massa gorda não pode ser negativa.' });
  } else if (inputs.pesoKg != null && inputs.massaGordaKg > inputs.pesoKg) {
    erros.push({ field: 'massaGorda', message: 'Massa gorda não pode ser maior que o peso total.' });
  }

  if (inputs.massaMagraKg == null || Number.isNaN(inputs.massaMagraKg)) {
    erros.push({ field: 'massaMagra', message: 'Informe a massa magra.' });
  } else if (inputs.massaMagraKg < 0) {
    erros.push({ field: 'massaMagra', message: 'Massa magra não pode ser negativa.' });
  } else if (inputs.pesoKg != null && inputs.massaMagraKg > inputs.pesoKg) {
    erros.push({ field: 'massaMagra', message: 'Massa magra não pode ser maior que o peso total.' });
  }

  return erros;
}
