/**
 * Sugestão de cardio para o bloco de Preparação/Vascularização dos Modelos
 * (TrainingModelBloco com fase 'preparacao', ver types/trainingModel.ts).
 *
 * Só referencia exercícios `cardio` já existentes em data/defaultExercises.ts
 * pelo `exId` — não cria exercício novo nem estrutura muscular nova. É uma
 * sugestão pro Personal escolher ao montar o bloco (etapa futura do
 * editor); nada aqui insere um exercício automaticamente num modelo.
 *
 * REGRA: Bike pra preparação de predominância de membros inferiores;
 * Elíptico quando há maior participação de membros superiores; Esteira
 * pra preparação geral.
 */

export type PreparacaoFoco = 'membros_inferiores' | 'membros_superiores' | 'geral';

export const PREPARACAO_FOCO_LABELS: Record<PreparacaoFoco, string> = {
  membros_inferiores: 'Predominância de membros inferiores',
  membros_superiores: 'Maior participação de membros superiores',
  geral: 'Preparação geral',
};

/**
 * exId (data/defaultExercises.ts) sugeridos por foco, em ordem de
 * prioridade — o primeiro de cada lista é a escolha padrão sugerida.
 */
export const PREPARACAO_CARDIO_SUGERIDO: Record<PreparacaoFoco, string[]> = {
  membros_inferiores: ['c3', 'c10'], // Bicicleta Ergométrica, Bicicleta ao Ar Livre
  membros_superiores: ['c4'], // Elíptico
  geral: ['c1', 'c2'], // Esteira (Corrida), Esteira (Caminhada)
};

export function getPreparacaoCardioSugerido(foco: PreparacaoFoco): string[] {
  return PREPARACAO_CARDIO_SUGERIDO[foco];
}
