import type { Exercise, MuscleGroup } from '../types/exercise';
import type { GroupType } from '../types/workout';

export interface ParsedImportItem {
  rawName: string;
  sets: number;
  reps: number;
  serieReps: number[];
  load: number;
  serieLoads: number[];
  matched: Exercise | null;
  exId: string | null;
  newMuscle: MuscleGroup;
  notes?: string;
  /** Presentes quando a linha usa `+` (Bi-Set) ou `+...+` (Tri-Set) pra
   *  ligar exercícios conjugados — mesma convenção de groupId/groupType
   *  do modo "Conjugar" (types/workout.ts). */
  groupId?: string;
  groupType?: GroupType;
}

export interface ParsedImportResult {
  items: ParsedImportItem[];
  pse: number | null;
}

/** Migrado de norm(s) (index.html ~4302 / ~6302). */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Migrado de fuzzyMatch(name) (index.html ~6294). */
export function fuzzyMatch(name: string, exercises: Exercise[]): Exercise | null {
  const n = norm(name);
  const exact = exercises.find((e) => norm(e.name) === n);
  if (exact) return exact;
  const partial = exercises.find((e) => n.includes(norm(e.name)) || norm(e.name).includes(n)) ?? null;
  if (partial) return partial;
  const words = n.split(' ').filter((w) => w.length > 3);
  let best: Exercise | null = null;
  let bestScore = 0;
  exercises.forEach((ex) => {
    const exWords = norm(ex.name).split(' ');
    const score = words.filter((w) => exWords.some((ew) => ew.includes(w) || w.includes(ew))).length;
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  });
  return bestScore >= 2 ? best : null;
}

/** Migrado de parseExLine(line) (index.html ~6271) — mesmos regex, sem alterações. */
export function parseExLine(rawLine: string, exercises: Exercise[]): ParsedImportItem | null {
  let line = rawLine;
  let notes: string | undefined;
  const hashIdx = line.indexOf('#');
  if (hashIdx !== -1) {
    notes = line.substring(hashIdx + 1).trim() || undefined;
    line = line.substring(0, hashIdx).trim();
  }

  const setsMatch = line.match(/(\d+)\s*[xX×]\s*([\d/àa ]+?)(?=\s|\d+\s*kg|$)/);
  if (!setsMatch) return null;

  const sets = parseInt(setsMatch[1], 10);
  const repsRaw = setsMatch[2].trim();
  let reps = 0;
  let serieReps: number[] | null = null;

  if (repsRaw.includes('/')) {
    serieReps = repsRaw
      .split('/')
      .map((r) => parseInt(r.trim(), 10))
      .filter((r) => !isNaN(r));
    reps = serieReps[0];
  } else {
    const rangeMatch = repsRaw.match(/(\d+)\s*[àa]\s*(\d+)/);
    if (rangeMatch) {
      reps = Math.round((parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2);
    } else {
      reps = parseInt(repsRaw, 10) || 0;
    }
  }
  if (serieReps && serieReps.length < sets) {
    while (serieReps.length < sets) serieReps.push(serieReps[serieReps.length - 1]);
  }

  const nameRaw = line.substring(0, setsMatch.index).trim();
  if (!nameRaw) return null;

  const loadMatches = [...line.matchAll(/(\d+(?:[.,]\d+)?)\s*kg/gi)];
  const sLoads = loadMatches.map((m) => parseFloat(m[1].replace(',', '.')));
  const avgLoad = sLoads.length ? sLoads.reduce((a, b) => a + b, 0) / sLoads.length : 0;

  let fullLoads = [...sLoads];
  if (fullLoads.length > 0 && fullLoads.length < sets) {
    while (fullLoads.length < sets) fullLoads.push(fullLoads[fullLoads.length - 1]);
  } else if (!fullLoads.length) {
    for (let k = 0; k < sets; k++) fullLoads.push(0);
  }

  let fullReps = serieReps ? [...serieReps] : [];
  if (!fullReps.length) {
    for (let k = 0; k < sets; k++) fullReps.push(reps);
  }

  const matched = fuzzyMatch(nameRaw, exercises);

  return {
    rawName: nameRaw,
    sets,
    reps,
    serieReps: fullReps,
    load: avgLoad,
    serieLoads: fullLoads,
    matched,
    exId: matched ? matched.id : null,
    newMuscle: matched ? matched.agonist === 'Cardio' ? 'Peito' : matched.agonist : 'Peito',
    notes,
  };
}

/**
 * Parseia uma linha com um ou mais `+` como Bi-Set (2 partes) ou Tri-Set
 * (3+ partes) — Ex: "Flexão apoio de joelhos + PullOver 5kg 3x12/12/12" ou
 * "A 3X12+ B 3X15 4kg+ C 3X12 5kg". Cada parte é parseada independentemente
 * por parseExLine (ordem livre de sets/reps/carga). Quando uma parte não
 * tem sets/reps/carga próprios (ex: "Flexão apoio de joelhos +"), ela herda
 * a especificação da parte irmã que trouxe os números — cobre o caso comum
 * de escrever sets/reps/carga uma única vez pro conjunto todo. Todas as
 * partes recebem um groupId compartilhado. Retorna null se nenhuma parte
 * tiver sets/reps (linha não é reconhecível como treino).
 */
export function parseConjugateLine(rawLine: string, exercises: Exercise[]): ParsedImportItem[] | null {
  const parts = rawLine
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const parsedParts = parts.map((p) => parseExLine(p, exercises));
  const anyParsed = parsedParts.find((p): p is ParsedImportItem => p !== null);
  if (!anyParsed) return null;

  const groupId = `imp-grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const groupType: GroupType = parts.length >= 3 ? 'triset' : 'biset';

  return parts.map((rawPart, i) => {
    const parsed = parsedParts[i];
    if (parsed) return { ...parsed, groupId, groupType };

    // Parte sem números próprios: herda sets/reps/carga da parte irmã,
    // mas mantém o próprio nome (e faz seu próprio fuzzy match).
    const matched = fuzzyMatch(rawPart, exercises);
    const item: ParsedImportItem = {
      rawName: rawPart,
      sets: anyParsed.sets,
      reps: anyParsed.reps,
      serieReps: [...anyParsed.serieReps],
      load: anyParsed.load,
      serieLoads: [...anyParsed.serieLoads],
      matched,
      exId: matched ? matched.id : null,
      newMuscle: matched ? (matched.agonist === 'Cardio' ? 'Peito' : matched.agonist) : 'Peito',
      groupId,
      groupType,
    };
    return item;
  });
}

/** Migrado de parseImportText() (index.html ~6260). */
export function parseImportText(raw: string, exercises: Exercise[]): ParsedImportResult {
  const items: ParsedImportItem[] = [];
  let pse: number | null = null;
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const pseMatch = line.match(/PSE[:\s]*(\d+)/i);
    if (pseMatch) {
      pse = Math.min(10, Math.max(1, parseInt(pseMatch[1], 10)));
      return;
    }
    if (line.includes('+')) {
      const group = parseConjugateLine(line, exercises);
      if (group) {
        items.push(...group);
        return;
      }
    }
    const parsed = parseExLine(line, exercises);
    if (parsed) items.push(parsed);
  });

  return { items, pse };
}

/** Agrupa uma lista já parseada (ordem sequencial — grupos sempre
 *  contíguos, pois `parseConjugateLine` empurra as partes em sequência)
 *  em linhas "livre" ou "grupo", pro preview do modal de importação. */
export function groupParsedItems(items: ParsedImportItem[]): ParsedImportItem[][] {
  const rows: ParsedImportItem[][] = [];
  let i = 0;
  while (i < items.length) {
    const gid = items[i].groupId;
    if (!gid) {
      rows.push([items[i]]);
      i++;
      continue;
    }
    const group: ParsedImportItem[] = [];
    while (i < items.length && items[i].groupId === gid) {
      group.push(items[i]);
      i++;
    }
    rows.push(group);
  }
  return rows;
}
