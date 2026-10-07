import type { Exercise } from '../types/exercise';
import type { AlunoRotina } from '../types/aluno';
import { isAlunoExercicioCardio } from '../types/aluno';
import type { StrengthLogEntry, WeekLog, WorkoutLogEntry } from '../types/workout';
import { exDoneKey } from '../types/workout';

export type PapelCarga = 'aluno' | 'personal';

/** Última carga conhecida de um exercício (por nome), com quem a mudou e quando. */
export interface CargaCompartilhada {
  carga: number;
  em: string;
  por: PapelCarga;
}

export type MapaCargas = Record<string, CargaCompartilhada>;

/** Chave estável por NOME de exercício (a rotina e o log usam nomes; ids do banco diferem entre aparelhos). */
export function chaveExercicio(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

/** Valida um mapa vindo do Firestore (nunca confia no formato remoto). */
export function normalizarMapaCargas(raw: unknown): MapaCargas {
  const out: MapaCargas = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const { carga, em, por } = v as Record<string, unknown>;
    if (typeof carga !== 'number' || !Number.isFinite(carga) || carga < 0 || carga > 2000) continue;
    if (typeof em !== 'string' || (por !== 'aluno' && por !== 'personal')) continue;
    out[k] = { carga, em, por };
  }
  return out;
}

function ehForca(e: WorkoutLogEntry): e is StrengthLogEntry {
  return e.type !== 'cardio' && 'exId' in e;
}

/**
 * Carga do dia a aplicar numa entrada de força, preservando o que já foi EXECUTADO:
 * séries marcadas como feitas mantêm o peso usado. Se todas as séries tinham o mesmo peso,
 * a mudança vale para as restantes; se eram diferentes (pirâmide), só a 1ª série não feita muda.
 */
function aplicarNaEntrada(e: StrengthLogEntry, carga: number): StrengthLogEntry {
  const n = Math.max(e.serieLoads?.length || 0, e.sets || 0, 1);
  const atuais = Array.from({ length: n }, (_, i) => e.serieLoads?.[i] ?? e.load);
  const feitas = e.doneSerie ?? [];
  const uniforme = atuais.every((c) => c === atuais[0]);
  const novas = atuais.map((c, i) => {
    if (feitas[i]) return c;
    if (uniforme) return carga;
    return i === 0 ? carga : c;
  });
  return { ...e, serieLoads: novas, load: novas[0] };
}

/**
 * Aplica no WeekLog as cargas que o OUTRO lado (`meuPapel` diferente de `por`) gravou.
 * Pula exercícios já concluídos e chaves com gravação local pendente. Devolve o MESMO objeto
 * `weekLog` quando nada mudou (permite não disparar setState).
 */
export function aplicarCargasNoWeekLog(
  weekLog: WeekLog,
  exercises: readonly Exercise[],
  exDone: Record<string, boolean>,
  cargas: MapaCargas,
  meuPapel: PapelCarga,
  pendentes: ReadonlySet<string> = new Set()
): { weekLog: WeekLog; alterados: number } {
  const nomePorId = new Map(exercises.map((x) => [x.id, x.name] as const));
  let alterados = 0;
  const novo: WeekLog = { ...weekLog };
  for (const [dia, log] of Object.entries(weekLog)) {
    let mudouDia = false;
    const novoLog = (log ?? []).map((e, i) => {
      if (!ehForca(e) || exDone[exDoneKey(Number(dia), i)]) return e;
      const nome = nomePorId.get(e.exId);
      if (!nome) return e;
      const key = chaveExercicio(nome);
      const remota = cargas[key];
      if (!remota || remota.por === meuPapel || pendentes.has(key)) return e;
      if (remota.carga === e.load) return e;
      const atualizada = aplicarNaEntrada(e, remota.carga);
      if (atualizada.load === e.load && atualizada.serieLoads.every((c, k) => c === e.serieLoads?.[k])) return e;
      mudouDia = true;
      alterados++;
      return atualizada;
    });
    if (mudouDia) (novo as Record<string, WorkoutLogEntry[]>)[dia] = novoLog;
  }
  return alterados ? { weekLog: novo, alterados } : { weekLog, alterados: 0 };
}

/** Mesma ideia para o rascunho de rotina do Personal (Mini Perfil): só o campo `carga` da prescrição. */
export function aplicarCargasNaRotina(
  rotina: AlunoRotina,
  cargas: MapaCargas,
  meuPapel: PapelCarga
): { rotina: AlunoRotina; diasAlterados: number[] } {
  const diasAlterados: number[] = [];
  const nova = rotina.map((dia, d) => {
    let mudou = false;
    const exercicios = dia.exercicios.map((ex) => {
      if (isAlunoExercicioCardio(ex)) return ex;
      const remota = cargas[chaveExercicio(ex.nome)];
      if (!remota || remota.por === meuPapel || remota.carga === ex.carga) return ex;
      mudou = true;
      return { ...ex, carga: remota.carga };
    });
    if (mudou) diasAlterados.push(d);
    return mudou ? { ...dia, exercicios } : dia;
  });
  return { rotina: diasAlterados.length ? nova : rotina, diasAlterados };
}
