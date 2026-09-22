/**
 * Ponte entre `TrainingModel` (Ferramentas > Modelos, vinculado ao Banco
 * de Exercícios por `exId`) e `AlunoRotina` (rotina do Cliente — schema
 * de texto livre já existente, ver types/aluno.ts). É a peça que faltava
 * pro fluxo "Copiar para Cliente": o Modelo nunca é mutado por essa
 * conversão — tudo aqui só LÊ o modelo e constrói objetos `AlunoExercicio`
 * novos, do zero, sem compartilhar referência com nada do modelo.
 *
 * Casamento de exercício por `exId` (não por nome, ao contrário da ponte
 * inversa em utils/importAlunoRotina.ts): se o exId do modelo não existir
 * mais no banco atual do usuário (ex: foi removido do Banco de
 * Exercícios), o exercício ainda é copiado — com um nome de fallback — e
 * o exId é reportado em `exerciciosNaoEncontrados` pra o Personal revisar.
 *
 * As sessões do modelo (Full Body/Upper/Lower/Push/Pull/Legs — uma lista
 * livre, não fixada a 7 dias) são distribuídas o mais espaçadas possível
 * ao longo da semana; os dias restantes ficam "Descanso Total". É uma
 * distribuição de partida, não uma prescrição de frequência — o Personal
 * edita livremente a rotina do Cliente depois de copiada.
 */

import type { AlunoExercicio, AlunoExercicioCardio, AlunoExercicioForca, AlunoRotina } from '../types/aluno';
import { criarRotinaVazia } from '../types/aluno';
import type { Exercise } from '../types/exercise';
import type { TrainingModel, TrainingModelEntrada, TrainingModelSessao } from '../types/trainingModel';
import { TRAINING_MODEL_METODO_LABELS, isTrainingModelEntradaCardio } from '../types/trainingModel';

export interface ConversaoModeloResult {
  rotina: AlunoRotina;
  /** exIds do modelo que não foram encontrados no Banco de Exercícios atual. */
  exerciciosNaoEncontrados: string[];
}

/** Espalha `n` índices (0-6) o mais uniformemente possível numa semana de 7 dias. */
function indicesEspacados(n: number, total = 7): number[] {
  if (n <= 0) return [];
  if (n >= total) return Array.from({ length: total }, (_, i) => i);
  const indices = Array.from({ length: n }, (_, i) => Math.round((i * total) / n));
  return Array.from(new Set(indices)).sort((a, b) => a - b);
}

function nomeExercicio(exId: string, exercises: Exercise[]): { nome: string; encontrado: boolean } {
  const ex = exercises.find((e) => e.id === exId);
  return ex ? { nome: ex.name, encontrado: true } : { nome: `Exercício não encontrado (${exId})`, encontrado: false };
}

/** Junta a nota livre do modelo com o nome do método (quando não for série tradicional) — a rotina do Cliente não tem campo próprio pra método, então isso preserva a informação em texto. */
function montarNotes(entrada: TrainingModelEntrada): string | undefined {
  const partes: string[] = [];
  if (entrada.notas) partes.push(entrada.notas);
  if (entrada.metodo && entrada.metodo !== 'series_tradicionais') partes.push(`Método: ${TRAINING_MODEL_METODO_LABELS[entrada.metodo]}`);
  return partes.length ? partes.join(' — ') : undefined;
}

function converterEntrada(entrada: TrainingModelEntrada, exercises: Exercise[], naoEncontrados: Set<string>): AlunoExercicio {
  const { nome, encontrado } = nomeExercicio(entrada.exId, exercises);
  if (!encontrado) naoEncontrados.add(entrada.exId);
  const notes = montarNotes(entrada);

  if (isTrainingModelEntradaCardio(entrada)) {
    const ex: AlunoExercicioCardio = {
      nome,
      cardio: true,
      duracao: `${entrada.duracaoMinutos} min`,
      intensidade: entrada.intensidade,
      ...(notes ? { notes } : {}),
      ...(entrada.groupId ? { groupId: entrada.groupId, groupType: entrada.groupType } : {}),
    };
    return ex;
  }

  const reps = entrada.repsMin === entrada.repsMax ? `${entrada.repsMin}` : `${entrada.repsMin}-${entrada.repsMax}`;
  const ex: AlunoExercicioForca = {
    nome,
    series: entrada.series,
    reps,
    // Carga real fica a critério do Personal ao aplicar no Cliente — 0 é o
    // mesmo padrão usado no formulário de exercício do Cliente (ver
    // ExercicioFormModal), não um erro de conversão.
    carga: entrada.cargaSugerida ?? 0,
    ...(entrada.rir != null ? { rir: entrada.rir } : {}),
    ...(notes ? { notes } : {}),
    ...(entrada.groupId ? { groupId: entrada.groupId, groupType: entrada.groupType } : {}),
  };
  return ex;
}

function converterSessao(sessao: TrainingModelSessao, exercises: Exercise[], naoEncontrados: Set<string>) {
  const exercicios = sessao.blocos.flatMap((bloco) => bloco.exercicios.map((e) => converterEntrada(e, exercises, naoEncontrados)));
  // `sessao.nome` é o rótulo específico do dia (ex: "Push", "Upper", "Full
  // Body A — Familiarização") — `sessao.tipo` é a categoria mais ampla da
  // divisão (ex: "Push/Pull/Legs") e pode ser igual em várias sessões do
  // mesmo modelo, então não serve pra distinguir o dia na rotina do Cliente.
  return { tipo: sessao.nome, exercicios };
}

/**
 * Converte um `TrainingModel` numa `AlunoRotina` completa (7 dias), pronta
 * pra escrever na rotina de um Cliente via `useAlunoStore.setRotinaDia`.
 * Não muta `modelo` nem `exercises` — só lê.
 */
export function buildAlunoRotinaFromTrainingModel(modelo: TrainingModel, exercises: Exercise[]): ConversaoModeloResult {
  const rotina = criarRotinaVazia();
  const naoEncontrados = new Set<string>();

  const diasTreino = indicesEspacados(modelo.sessoes.length);
  diasTreino.forEach((diaIndex, i) => {
    rotina[diaIndex] = converterSessao(modelo.sessoes[i], exercises, naoEncontrados);
  });

  return { rotina, exerciciosNaoEncontrados: Array.from(naoEncontrados) };
}
