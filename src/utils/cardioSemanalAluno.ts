import { DAYS_SHORT, isCardioLogEntry } from '../types/workout';
import type { WeekLog } from '../types/workout';
import type { Exercise } from '../types/exercise';

/**
 * Resumo semanal de cardio do ALUNO, enviado pelo app dele para `alunos/{email}/cardioSemanal/{semana}`
 * e lido pelo Personal dono no perfil do cliente. É só o volume manual da semana (minutos/sessões);
 * o cardio do próprio Personal nunca entra aqui — cada app só envia o weekLog do aluno logado.
 */
export interface SessaoCardioResumo {
  dia: string;
  nome: string;
  duracao: number;
  intensidade: number;
}
export interface ResumoCardioSemanal {
  /** Segunda-feira da semana (AAAA-MM-DD) — também é o id do documento. */
  semana: string;
  totalMin: number;
  metaMin: number;
  sessoes: SessaoCardioResumo[];
  atualizadoEm: string;
}

export const MAX_SESSOES_RESUMO = 40;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Segunda-feira (data local) da semana de `d`, no formato AAAA-MM-DD. */
export function semanaId(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7; // seg=0 … dom=6
  x.setDate(x.getDate() - diff);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function montarResumoCardio(
  weekLog: WeekLog,
  exercises: Exercise[],
  metaMin: number,
  now: Date = new Date()
): ResumoCardioSemanal {
  const sessoes: SessaoCardioResumo[] = [];
  let totalMin = 0;
  for (let d = 0; d < 7; d++) {
    for (const e of weekLog[d] ?? []) {
      if (!isCardioLogEntry(e)) continue;
      const duracao = Math.max(0, Math.min(1440, Math.round(e.duration || 0)));
      totalMin += duracao;
      if (sessoes.length < MAX_SESSOES_RESUMO) {
        const ex = exercises.find((x) => x.id === e.exId);
        sessoes.push({
          dia: DAYS_SHORT[d] ?? '',
          nome: (ex ? ex.name : 'Cardio').slice(0, 120),
          duracao,
          intensidade: Math.max(0, Math.min(10, Math.round(e.intensity || 0))),
        });
      }
    }
  }
  return {
    semana: semanaId(now),
    totalMin,
    metaMin: Math.max(0, Math.min(10080, Math.round(metaMin || 0))),
    sessoes,
    atualizadoEm: now.toISOString(),
  };
}

/** Conteúdo comparável (sem o carimbo de hora) — evita regravar na nuvem sem mudança real. */
export function assinaturaResumo(r: ResumoCardioSemanal): string {
  return JSON.stringify({ s: r.semana, t: r.totalMin, m: r.metaMin, x: r.sessoes });
}

/** Lê um documento remoto sem confiar nele: tipos errados ⇒ null (ignorado). */
export function validarResumoRemoto(raw: unknown, docId: string): ResumoCardioSemanal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.semana !== 'string' || r.semana !== docId) return null;
  if (typeof r.totalMin !== 'number' || !Number.isFinite(r.totalMin) || r.totalMin < 0) return null;
  if (typeof r.metaMin !== 'number' || !Number.isFinite(r.metaMin) || r.metaMin < 0) return null;
  if (typeof r.atualizadoEm !== 'string') return null;
  if (!Array.isArray(r.sessoes)) return null;
  const sessoes: SessaoCardioResumo[] = [];
  for (const s of r.sessoes.slice(0, MAX_SESSOES_RESUMO)) {
    if (!s || typeof s !== 'object') return null;
    const o = s as Record<string, unknown>;
    if (typeof o.dia !== 'string' || typeof o.nome !== 'string') return null;
    if (typeof o.duracao !== 'number' || typeof o.intensidade !== 'number') return null;
    sessoes.push({ dia: o.dia, nome: o.nome, duracao: o.duracao, intensidade: o.intensidade });
  }
  return { semana: r.semana, totalMin: r.totalMin, metaMin: r.metaMin, sessoes, atualizadoEm: r.atualizadoEm };
}
