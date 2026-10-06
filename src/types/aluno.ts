/**
 * Tipos do domínio "Clientes" (gestão de alunos + rotinas do Personal
 * Trainer). Migrados de `cli_dados_alunos_seed` / `cliEd_state`
 * (index.html ~10151-10222, ~10729-10952).
 *
 * Schema deliberadamente mais simples que WorkoutLogEntry: a rotina
 * prescrita pelo Personal é texto/números livres (nome, séries, reps,
 * carga), não vinculada por id ao banco de exercícios — só o nome vem,
 * opcionalmente, de uma busca no banco (ver AlunoExercicioFormModal).
 */

import { DAYS_SHORT } from './workout';
import type { GroupType } from './workout';
import type { ExerciseAgonist, MuscleGroup } from './exercise';

export type AlunoStatus = 'ativo' | 'inativo';

/** Campos de agrupamento pra Bi-Set/Tri-Set na rotina do Personal — mesma
 *  convenção de groupId/groupType usada em WorkoutLogEntry, preenchida
 *  pelo "Treino Por Extenso" (utils/importParser.ts). */
interface AlunoGroupable {
  groupId?: string;
  groupType?: GroupType;
}

/**
 * Metadados musculares do exercício, gravados junto da prescrição. Servem SÓ para quem
 * importa a rotina e ainda não tem esse exercício (ex.: um exercício custom criado pelo
 * Personal): sem isso ele nasceria com agonista genérico. Opcional — rotinas antigas não têm.
 * Exibição não depende disso (a rotina carrega o `nome`).
 */
export interface AlunoExercicioInfo {
  agonist: ExerciseAgonist;
  synergist: MuscleGroup[];
  stabilizer: MuscleGroup[];
}

interface AlunoExercicioBase extends AlunoGroupable {
  exercicioInfo?: AlunoExercicioInfo;
}

export interface AlunoExercicioForca extends AlunoExercicioBase {
  nome: string;
  cardio?: undefined;
  series: number;
  reps: string;
  carga: number;
  rir?: number;
  sugestao?: number;
  notes?: string;
}

export interface AlunoExercicioCardio extends AlunoExercicioBase {
  nome: string;
  cardio: true;
  duracao: string;
  intensidade: string;
  notes?: string;
}

export type AlunoExercicio = AlunoExercicioForca | AlunoExercicioCardio;

export function isAlunoExercicioCardio(ex: AlunoExercicio): ex is AlunoExercicioCardio {
  return ex.cardio === true;
}

export interface AlunoRotinaDia {
  tipo: string;
  exercicios: AlunoExercicio[];
}

/** Rotina semanal completa — um dia por posição, igual a DAYS_SHORT (0=Seg...6=Dom). */
export type AlunoRotina = AlunoRotinaDia[];

export interface Aluno {
  id: string;
  nome: string;
  email: string;
  status: AlunoStatus;
  foco: string;
  dataNascimento?: string;
  telefone?: string;
  genero?: string;
  objetivo?: string;
  restricoes?: string;
  ultimoTreino?: string;
  rotina: AlunoRotina;
}

/**
 * Rotina nomeada do aluno, persistida em `alunos/{email}/rotinas/{id}`.
 * Um aluno pode ter várias; no máximo UMA com `ativa === true`.
 * `rotina` reaproveita o mesmo schema semanal de `Aluno.rotina`.
 * Datas em ISO string (mesma convenção do restante do Firestore do app).
 */
export interface AlunoRotinaSalva {
  id: string;
  nome: string;
  rotina: AlunoRotina;
  ativa: boolean;
  criadaEm: string;
  atualizadaEm: string;
  /** E-mail (minúsculo) do Personal que criou/atualizou a rotina. */
  personalEmail: string;
}

/** Rotina vazia (7 dias de "Descanso Total") — equivale a cli_diaVazio(). */
export function criarRotinaVazia(): AlunoRotina {
  return DAYS_SHORT.map(() => ({ tipo: 'Descanso Total', exercicios: [] }));
}

export function calcularIdade(dataNascimento?: string): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(`${dataNascimento}T00:00:00`);
  if (isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

export function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
