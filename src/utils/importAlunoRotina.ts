import type {
  AlunoExercicio,
  AlunoExercicioCardio,
  AlunoExercicioForca,
  AlunoRotina,
  AlunoRotinaDia,
} from '../types/aluno';
import { isAlunoExercicioCardio } from '../types/aluno';
import { MUSCLE_GROUPS } from '../types/exercise';
import type { Exercise, MuscleGroup } from '../types/exercise';
import { DAYS_SHORT, isCardioLogEntry } from '../types/workout';
import type { CardioLogEntry, StrengthLogEntry, WeekLog, WorkoutLogEntry } from '../types/workout';
import type { HrZone } from '../types/cardio';
import { genLogEntryId } from './logEntryId';

/**
 * Ponte entre a rotina publicada pelo Personal (`AlunoRotina` — schema
 * simples de texto livre, sem vínculo com o banco de exercícios) e o
 * `WeekLog` que a Semana Atual realmente usa pra logar/executar
 * (StrengthLogEntry/CardioLogEntry, vinculados por `exId`).
 *
 * Sem essa ponte, publicar uma rotina nunca fazia ela aparecer em
 * Treinos → Semana Atual — o aluno só via em "Minha Rotina" (leitura) e
 * precisava recriar tudo manualmente pra poder logar.
 *
 * Casamento de exercício por NOME (case-insensitive): se o Personal
 * escreveu um nome que já existe no banco, usa o mesmo `exId`; se não
 * existe, cria um novo exercício no banco (agonista/tipo inferidos do
 * jeito possível a partir do texto livre — sem informação suficiente
 * pra sinergistas/estabilizadores, o Personal pode refinar depois no
 * Banco de Exercícios).
 */

/** Extrai um número representativo de uma string de reps tipo "10-12", "10" ou "até 15". */
function parseRepsNumber(reps: string): number {
  const nums = (reps.match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return 10;
  if (nums.length === 1) return nums[0];
  return Math.round((nums[0] + nums[1]) / 2);
}

/** Extrai minutos de uma string de duração tipo "25 min" ou "30". */
function parseDurationMin(duracao: string): number {
  const m = duracao.match(/\d+/);
  return m ? parseInt(m[0], 10) : 20;
}

/** Estima intensidade 0-10 a partir de texto livre ("Leve"/"Moderada"/"Alta" ou um número). */
function parseIntensity(intensidade: string): number {
  const s = intensidade.toLowerCase();
  const n = intensidade.match(/\d+/);
  if (n) return Math.min(10, Math.max(0, parseInt(n[0], 10)));
  if (s.includes('leve') || s.includes('baixa')) return 3;
  if (s.includes('alta') || s.includes('intens') || s.includes('forte')) return 8;
  return 5;
}

function intensityToHrZone(intensity: number): HrZone {
  const zone = Math.round(intensity / 2);
  return Math.min(5, Math.max(1, zone || 1)) as HrZone;
}

export interface ImportResult {
  weekLog: WeekLog;
  /** Nomes de exercícios criados no banco por não existirem ainda — pra avisar o usuário. */
  novosExercicios: string[];
}

/**
 * Converte a rotina inteira num WeekLog. `addExercise` é chamado pra
 * qualquer nome ainda não encontrado no banco local — o chamador deve
 * passar a action já vinda de useExerciseStore.
 */
export function buildWeekLogFromAlunoRotina(
  rotina: AlunoRotina,
  exercises: Exercise[],
  addExercise: (ex: Exercise) => void
): ImportResult {
  const byName = new Map(exercises.map((e) => [e.name.trim().toLowerCase(), e] as const));
  const novosExercicios: string[] = [];

  function resolveExerciseId(ex: AlunoExercicio): string {
    const key = ex.nome.trim().toLowerCase();
    const existing = byName.get(key);
    if (existing) return existing.id;

    const isCardio = isAlunoExercicioCardio(ex);
    // Exercício que o importador ainda não tem (ex.: custom do Personal): usa os metadados
    // gravados na rotina; sem eles (rotina antiga), cai no padrão genérico de sempre.
    const info = ex.exercicioInfo;
    const agonistaValido =
      info && (info.agonist === 'Cardio' || (MUSCLE_GROUPS as readonly string[]).includes(info.agonist));
    const grupos = (l: unknown) =>
      Array.isArray(l) ? l.filter((m): m is MuscleGroup => (MUSCLE_GROUPS as readonly string[]).includes(m)) : [];
    const novo: Exercise = {
      id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: ex.nome.trim(),
      agonist: isCardio ? 'Cardio' : agonistaValido && info.agonist !== 'Cardio' ? info.agonist : 'Peito',
      synergist: grupos(info?.synergist),
      stabilizer: grupos(info?.stabilizer),
      ...(isCardio ? { type: 'cardio' as const } : {}),
    };
    addExercise(novo);
    byName.set(key, novo);
    novosExercicios.push(novo.name);
    return novo.id;
  }

  const weekLog: WeekLog = {};

  rotina.forEach((dia, dayIdx) => {
    if (!dia.exercicios.length) return;
    weekLog[dayIdx] = dia.exercicios.map((ex) => {
      const exId = resolveExerciseId(ex);

      if (isAlunoExercicioCardio(ex)) {
        const intensity = parseIntensity(ex.intensidade);
        const entry: CardioLogEntry = {
          id: genLogEntryId(),
          exId,
          type: 'cardio',
          duration: parseDurationMin(ex.duracao),
          intensity,
          hrZone: intensityToHrZone(intensity),
          ...(ex.notes ? { notes: ex.notes } : {}),
          ...(ex.groupId ? { groupId: ex.groupId, groupType: ex.groupType } : {}),
        };
        return entry;
      }

      const reps = parseRepsNumber(ex.reps);
      const entry: StrengthLogEntry = {
        id: genLogEntryId(),
        exId,
        sets: ex.series,
        reps,
        load: ex.carga,
        serieReps: Array(ex.series).fill(reps),
        serieLoads: Array(ex.series).fill(ex.carga),
        ...(ex.notes ? { notes: ex.notes } : {}),
        ...(ex.groupId ? { groupId: ex.groupId, groupType: ex.groupType } : {}),
      };
      return entry;
    });
  });

  return { weekLog, novosExercicios };
}

// ---------------------------------------------------------------------------
// Caminho inverso: WeekLog → AlunoRotina (PRESCRIÇÃO, não histórico de execução)
// ---------------------------------------------------------------------------

export interface WeekLogToRotinaResult {
  rotina: AlunoRotina;
  /** `exId` de entradas omitidas por não existirem no banco (não dá pra obter o nome). */
  exerciciosNaoResolvidos: string[];
}

export interface WeekLogToRotinaOptions {
  /** Rótulo (`tipo`) de cada dia, por índice 0-6 — ex.: o `tipo` de uma rotina
   *  anterior do aluno. Só vale pra dias COM exercício; dia vazio é sempre
   *  "Descanso Total" (mesma regra de useAlunoStore). */
  tiposDia?: readonly (string | undefined)[];
}

/** Rótulo usado quando o dia tem exercício mas não há `tipo` conhecido
 *  (mesmo padrão de useAlunoStore ao sair de "Descanso Total"). */
const TIPO_DIA_PADRAO = 'Treino Personalizado';

function numeroFinito(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

/** Reps prescritas: janela do Personal (min-max) quando existe, senão o número base. */
function formatarReps(e: StrengthLogEntry): string {
  if (e.repRangeMin !== undefined && e.repRangeMax !== undefined) return `${e.repRangeMin}-${e.repRangeMax}`;
  return String(numeroFinito(e.reps, 10));
}

/**
 * Converte o `WeekLog` (Semana Atual) numa `AlunoRotina` — inverso de
 * `buildWeekLogFromAlunoRotina`. Guarda só o que PRESCREVE o treino
 * (exercício, ordem, séries, reps, carga base, agrupamento, notas); descarta
 * estado de execução/progresso (`doneSerie`, `serieLoads`/`serieReps` por série,
 * `distance`, `avgHr`, `id` da instância, `hrZone` derivada) — e nunca olha
 * `exDone`/`weekPSE`, que vivem fora do WeekLog. Sempre devolve 7 dias, com
 * objetos novos (nenhuma referência compartilhada com o `weekLog`).
 */
export function buildAlunoRotinaFromWeekLog(
  weekLog: WeekLog,
  exercises: readonly Exercise[],
  options: WeekLogToRotinaOptions = {}
): WeekLogToRotinaResult {
  const porId = new Map(exercises.map((e) => [e.id, e] as const));
  const exerciciosNaoResolvidos: string[] = [];

  function converter(entry: WorkoutLogEntry): AlunoExercicio | null {
    const exercicio = porId.get(entry.exId);
    if (!exercicio) {
      exerciciosNaoResolvidos.push(entry.exId);
      return null;
    }
    const nome = exercicio.name.trim();
    const extras = {
      exercicioInfo: {
        agonist: exercicio.agonist,
        synergist: [...exercicio.synergist],
        stabilizer: [...exercicio.stabilizer],
      },
      ...(entry.notes ? { notes: entry.notes } : {}),
      ...(entry.groupId ? { groupId: entry.groupId } : {}),
      ...(entry.groupType ? { groupType: entry.groupType } : {}),
    };

    if (isCardioLogEntry(entry)) {
      const ex: AlunoExercicioCardio = {
        nome,
        cardio: true,
        duracao: `${numeroFinito(entry.duration, 20)} min`,
        intensidade: String(numeroFinito(entry.intensity, 5)),
        ...extras,
      };
      return ex;
    }
    const ex: AlunoExercicioForca = {
      nome,
      series: numeroFinito(entry.sets, 0),
      reps: formatarReps(entry),
      carga: numeroFinito(entry.load, 0),
      ...extras,
    };
    return ex;
  }

  const rotina: AlunoRotina = DAYS_SHORT.map((_, dayIdx): AlunoRotinaDia => {
    const exercicios = (weekLog[dayIdx] ?? []).flatMap((entry) => {
      const ex = converter(entry);
      return ex ? [ex] : [];
    });
    if (!exercicios.length) return { tipo: 'Descanso Total', exercicios: [] };
    return { tipo: options.tiposDia?.[dayIdx]?.trim() || TIPO_DIA_PADRAO, exercicios };
  });

  return { rotina, exerciciosNaoResolvidos };
}
