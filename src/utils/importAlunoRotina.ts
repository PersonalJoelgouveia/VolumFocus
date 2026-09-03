import type { AlunoExercicio, AlunoRotina } from '../types/aluno';
import { isAlunoExercicioCardio } from '../types/aluno';
import type { Exercise } from '../types/exercise';
import type { CardioLogEntry, StrengthLogEntry, WeekLog } from '../types/workout';
import type { HrZone } from '../types/cardio';

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
    const novo: Exercise = {
      id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: ex.nome.trim(),
      agonist: isCardio ? 'Cardio' : 'Peito',
      synergist: [],
      stabilizer: [],
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
          exId,
          type: 'cardio',
          duration: parseDurationMin(ex.duracao),
          intensity,
          hrZone: intensityToHrZone(intensity),
          ...(ex.notes ? { notes: ex.notes } : {}),
        };
        return entry;
      }

      const reps = parseRepsNumber(ex.reps);
      const entry: StrengthLogEntry = {
        exId,
        sets: ex.series,
        reps,
        load: ex.carga,
        serieReps: Array(ex.series).fill(reps),
        serieLoads: Array(ex.series).fill(ex.carga),
        ...(ex.notes ? { notes: ex.notes } : {}),
      };
      return entry;
    });
  });

  return { weekLog, novosExercicios };
}
