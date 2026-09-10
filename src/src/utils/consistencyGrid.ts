import type { Exercise } from '../types/exercise';
import type { ExDoneMap, WeekLog, WorkoutDayLog } from '../types/workout';
import { exDoneKey } from '../types/workout';
import type { HistoricoSemana } from '../types/history';

/**
 * Migrado fielmente de cgrid.buildMonthMap()/render() (index.html
 * ~8521-8680): mapa dia→{forca,cardio} combinando a semana atual
 * (weekLog + exDone) com as semanas arquivadas do histórico, mesma regra
 * de prioridade (semana atual > histórico) e mesmo fallback para semanas
 * arquivadas sem doneState granular ("sem done → assume feito" — o caso
 * de toda semana arquivada aqui, já que HistoricoSemana não carrega um
 * snapshot de exDone; ver nota em types/history.ts).
 */

export interface DayActivity {
  forca: boolean;
  cardio: boolean;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(d: Date): Date {
  const dow = d.getDay(); // 0=Dom...6=Sáb
  const offsetToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + offsetToMon);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function buildMonthMap(
  year: number,
  month: number,
  weekLog: WeekLog,
  exDone: ExDoneMap,
  historico: HistoricoSemana[],
  exercises: Exercise[]
): Record<string, DayActivity> {
  const map: Record<string, DayActivity> = {};

  function analyzeLog(log: WorkoutDayLog, isDone: (idx: number) => boolean) {
    let forca = false;
    let cardio = false;
    (log ?? []).forEach((entry, logIdx) => {
      const ex = exercises.find((e) => e.id === entry.exId);
      const isCardioEx = ex?.type === 'cardio';
      if (isDone(logIdx)) {
        if (isCardioEx) cardio = true;
        else forca = true;
      }
    });
    return { forca, cardio };
  }

  // 1. Semana atual (weekLog + exDone)
  const mondayCur = mondayOf(new Date());
  for (let appDay = 0; appDay < 7; appDay++) {
    const date = new Date(mondayCur);
    date.setDate(mondayCur.getDate() + appDay);
    if (date.getFullYear() !== year || date.getMonth() !== month) continue;
    const k = dateKey(date);
    const { forca, cardio } = analyzeLog(weekLog[appDay] ?? [], (idx) => !!exDone[exDoneKey(appDay, idx)]);
    if (forca || cardio) map[k] = { forca, cardio };
  }

  // 2. Semanas arquivadas com interseção no mesmo mês (sem sobrescrever a atual)
  historico.forEach((snap) => {
    if (!snap?.data) return;
    const snapMon = mondayOf(new Date(snap.data));
    for (let appDay = 0; appDay < 7; appDay++) {
      const date = new Date(snapMon);
      date.setDate(snapMon.getDate() + appDay);
      if (date.getFullYear() !== year || date.getMonth() !== month) continue;
      const k = dateKey(date);
      if (map[k]) continue; // semana atual tem prioridade
      // Sem exDone salvo no snapshot → presença do exercício já conta como feito.
      const { forca, cardio } = analyzeLog(snap.weekLog[appDay] ?? [], () => true);
      if (forca || cardio) map[k] = { forca, cardio };
    }
  });

  return map;
}

export interface CgridCell {
  day: number;
  state: 'cgrid-vazio' | 'cgrid-forca' | 'cgrid-cardio' | 'cgrid-ambos';
  isToday: boolean;
  isFuture: boolean;
}

export interface CgridData {
  monthLabel: string;
  cells: CgridCell[];
  leadingEmpty: number;
  totalForca: number;
  totalCardio: number;
  totalAmbos: number;
  pctDoMes: number;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function buildCgridData(weekLog: WeekLog, exDone: ExDoneMap, historico: HistoricoSemana[], exercises: Exercise[]): CgridData {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const monthMap = buildMonthMap(year, month, weekLog, exDone, historico, exercises);

  let totalForca = 0;
  let totalCardio = 0;
  let totalAmbos = 0;
  let totalAtivos = 0;

  const cells: CgridCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data = monthMap[k];
    const forca = data?.forca ?? false;
    const cardio = data?.cardio ?? false;

    let state: CgridCell['state'] = 'cgrid-vazio';
    if (forca && cardio) {
      state = 'cgrid-ambos';
      totalAmbos++;
      totalAtivos++;
    } else if (forca) {
      state = 'cgrid-forca';
      totalForca++;
      totalAtivos++;
    } else if (cardio) {
      state = 'cgrid-cardio';
      totalCardio++;
      totalAtivos++;
    }

    cells.push({ day: d, state, isToday: d === today, isFuture: d > today });
  }

  return {
    monthLabel: `${MONTH_NAMES[month]} ${year}`,
    cells,
    leadingEmpty: firstDow,
    totalForca,
    totalCardio,
    totalAmbos,
    pctDoMes: today > 0 ? Math.round((totalAtivos / today) * 100) : 0,
  };
}
