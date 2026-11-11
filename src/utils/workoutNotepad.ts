import type { Exercise } from '../types/exercise';
import type { GroupType, StrengthLogEntry, CardioLogEntry, WorkoutDayLog, WorkoutLogEntry } from '../types/workout';
import { GROUP_LABELS, isCardioLogEntry } from '../types/workout';
import { buildDayLogRows } from './dayLogGrouping';
import { norm, parseConjugateLine, parseExLine } from './importParser';
import { genLogEntryId } from './logEntryId';

/**
 * Bloco de Notas do Treino — conversor de ida e volta entre o log do dia
 * (`WorkoutDayLog`) e texto. O formato é o INVERSO do importador
 * (`parseImportText`): tudo que `serializeDayLog` escreve, o importador também
 * entende, e vice-versa.
 *
 *   Supino Reto 4x10 80kg #focar na descida     ← força: SxR + carga + #nota
 *   Agachamento 3x8/8/6 100kg 102.5kg 105kg      ← reps e cargas por série
 *   Rosca Direta 3x12 12,5kg                     ← vírgula ou ponto nos decimais
 *   Remada 3x12 30kg + Pulldown 3x12 40kg        ← "+" = conjugado (2=Bi-Set, 3+=Tri-Set)
 *   [Superset] A 3x10 20kg + B 3x10 15kg         ← tipo que não se deduz pela contagem
 *   Esteira 30min int 6                          ← cardio: duração + intensidade (PSE)
 *   PSE: 7                                       ← PSE do dia
 */

/* ───────────────────────── Ida: log → texto ───────────────────────── */

function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Nome sem os caracteres que têm significado no formato (`+` conjuga, `#` abre nota). */
function safeName(s: string): string {
  return s.replace(/[+#]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Nota numa linha só e sem `+` (que separaria as partes de um conjugado). */
function safeNote(s: string): string {
  return s.replace(/\s*\r?\n+\s*/g, ' ').replace(/\+/g, '＋').trim();
}

function exerciseName(e: WorkoutLogEntry, exercises: Exercise[]): string {
  return exercises.find((x) => x.id === e.exId)?.name ?? e.exId;
}

function entryToText(e: WorkoutLogEntry, exercises: Exercise[]): string {
  const name = safeName(exerciseName(e, exercises));
  let body: string;

  if (isCardioLogEntry(e)) {
    body = `${name} ${fmtNum(e.duration)}min int ${fmtNum(e.intensity)}`;
  } else {
    const sets = Math.max(1, e.sets || e.serieLoads.length || 1);
    const reps = Array.from({ length: sets }, (_, i) => e.serieReps[i] ?? e.reps);
    const loads = Array.from({ length: sets }, (_, i) => e.serieLoads[i] ?? e.load);
    const repsTxt = reps.every((r) => r === reps[0]) ? String(reps[0]) : reps.join('/');
    let loadTxt = '';
    if (loads.every((l) => l === loads[0])) {
      if (loads[0] > 0) loadTxt = ` ${fmtNum(loads[0])}kg`;
    } else {
      loadTxt = ' ' + loads.map((l) => `${fmtNum(l)}kg`).join(' ');
    }
    body = `${name} ${sets}x${repsTxt}${loadTxt}`;
  }

  const note = e.notes ? safeNote(e.notes) : '';
  return note ? `${body} #${note}` : body;
}

/**
 * Busca no Banco mais estrita que o `fuzzyMatch` do importador: nome exato ou
 * um contido no outro (mín. 4 letras). Sem a pontuação por palavras soltas, que
 * aceitava nomes inventados — aqui um erro de digitação deve aparecer como
 * erro, não virar silenciosamente outro exercício.
 */
function matchBank(name: string, exercises: Exercise[]): Exercise | null {
  const n = norm(name);
  if (n.length < 4) return null;
  return (
    exercises.find((e) => norm(e.name) === n) ??
    exercises.find((e) => {
      const en = norm(e.name);
      return n.includes(en) || en.includes(n);
    }) ??
    null
  );
}

function inferredGroupType(size: number): GroupType {
  return size >= 3 ? 'triset' : 'biset';
}

/** Log do dia (+ PSE opcional) → texto estruturado, uma linha por exercício/conjugado. */
export function serializeDayLog(dayLog: WorkoutDayLog, exercises: Exercise[], pse?: number | null): string {
  const lines: string[] = [];
  for (const row of buildDayLogRows(dayLog)) {
    if (row.kind === 'free') {
      lines.push(entryToText(row.entry, exercises));
      continue;
    }
    const parts = row.members.map((m) => entryToText(m.entry, exercises));
    const type = row.members[0].entry.groupType ?? 'biset';
    const tag = type !== inferredGroupType(row.members.length) ? `[${GROUP_LABELS[type]}] ` : '';
    lines.push(tag + parts.join(' + '));
  }
  if (pse != null) lines.push(`PSE: ${pse}`);
  return lines.join('\n');
}

/* ───────────────────────── Volta: texto → itens ───────────────────────── */

export interface NotepadItem {
  line: number;
  rawName: string;
  kind: 'strength' | 'cardio';
  sets: number;
  serieReps: number[];
  serieLoads: number[];
  duration: number;
  intensity: number | null;
  notes?: string;
  /** Presente quando o item pertence a uma linha conjugada (`A + B`). */
  groupKey?: string;
  groupType?: GroupType;
}

export interface NotepadError {
  /** Linha (1-based) no texto; 0 = erro geral (não ligado a uma linha). */
  line: number;
  text: string;
  reason: string;
}

export interface NotepadParseResult {
  items: NotepadItem[];
  pse: number | null;
  errors: NotepadError[];
}

const TAG_RE = /^\[\s*(bi-?set|tri-?set|superset|circuito)\s*\]\s*/i;
const CARDIO_RE = /^(.*?)\s+(\d+(?:[.,]\d+)?)\s*min\b(?:\s*(?:int|pse|@)\s*(\d+))?/i;

function tagToGroupType(tag: string): GroupType {
  const t = tag.toLowerCase().replace('-', '');
  if (t === 'biset') return 'biset';
  if (t === 'triset') return 'triset';
  if (t === 'superset') return 'supersets';
  return 'circuito';
}

function splitNote(part: string): { body: string; notes?: string } {
  const i = part.indexOf('#');
  if (i === -1) return { body: part.trim() };
  return { body: part.slice(0, i).trim(), notes: part.slice(i + 1).trim() || undefined };
}

function parseCardioPart(part: string, line: number): NotepadItem | null {
  const { body, notes } = splitNote(part);
  const m = body.match(CARDIO_RE);
  if (!m || !m[1].trim()) return null;
  return {
    line,
    rawName: m[1].trim(),
    kind: 'cardio',
    sets: 0,
    serieReps: [],
    serieLoads: [],
    duration: parseFloat(m[2].replace(',', '.')),
    intensity: m[3] ? Math.min(10, Math.max(1, parseInt(m[3], 10))) : null,
    notes,
  };
}

function strengthFromParsed(p: ReturnType<typeof parseExLine> & object, line: number): NotepadItem {
  const sets = Math.max(1, p.sets);
  return {
    line,
    rawName: p.rawName,
    kind: 'strength',
    sets,
    // O importador não trunca "3x8/8/6/5" — aqui o nº de séries manda.
    serieReps: p.serieReps.slice(0, sets),
    serieLoads: p.serieLoads.slice(0, sets),
    duration: 0,
    intensity: null,
    notes: p.notes,
  };
}

/** Texto → itens estruturados (sem consultar o log atual). Linhas inválidas viram `errors`. */
export function parseNotepadText(text: string, exercises: Exercise[]): NotepadParseResult {
  const items: NotepadItem[] = [];
  const errors: NotepadError[] = [];
  let pse: number | null = null;

  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = idx + 1;
    let s = rawLine.trim();
    if (!s) return;

    const pseMatch = s.match(/^PSE\s*[:\s]\s*(\d+)\s*$/i);
    if (pseMatch) {
      pse = Math.min(10, Math.max(1, parseInt(pseMatch[1], 10)));
      return;
    }

    let tagType: GroupType | undefined;
    const tag = s.match(TAG_RE);
    if (tag) {
      tagType = tagToGroupType(tag[1]);
      s = s.slice(tag[0].length);
    }

    if (s.includes('+')) {
      const group = parseConjugateLine(s, exercises);
      if (!group) {
        errors.push({ line, text: rawLine, reason: 'Formato de conjugado não reconhecido. Use: A 3x10 20kg + B 3x10 15kg' });
        return;
      }
      const key = `L${line}`;
      group.forEach((g) =>
        items.push({
          ...strengthFromParsed(g, line),
          groupKey: key,
          groupType: tagType ?? g.groupType ?? inferredGroupType(group.length),
        })
      );
      return;
    }

    const parsed = parseExLine(s, exercises);
    if (parsed) {
      items.push(strengthFromParsed(parsed, line));
      return;
    }
    const cardio = parseCardioPart(s, line);
    if (cardio) {
      items.push(cardio);
      return;
    }
    errors.push({ line, text: rawLine, reason: 'Formato não reconhecido. Use: Nome 3x10 80kg  (ou  Esteira 30min int 6)' });
  });

  return { items, pse, errors };
}

/* ───────────────────── Reconciliação: itens → novo log ───────────────────── */

export interface ReconcileOptions {
  /** Aluno: só carga/reps (dentro da janela do Personal) e adicionar séries/exercícios. */
  role: 'personal' | 'aluno';
}

export interface ReconcileResult {
  log: WorkoutDayLog;
  /** Para cada entrada do novo log, o índice dela no log antigo (`null` = nova). Serve p/ remapear `exDone`. */
  oldIndexOf: (number | null)[];
  errors: NotepadError[];
  warnings: string[];
}

/**
 * Casa cada item do texto com uma entrada existente do log (pelo nome, na
 * ordem — suporta o mesmo exercício duas vezes) e preserva o que o texto não
 * expressa: `id`, `doneSerie`, janela de reps do Personal, hrZone/distância do
 * cardio etc. Itens sem entrada correspondente viram entradas novas, desde que
 * o nome exista no Banco de Exercícios. Nunca cria exercício "fantasma".
 */
export function reconcileNotepad(
  items: NotepadItem[],
  oldLog: WorkoutDayLog,
  exercises: Exercise[],
  { role }: ReconcileOptions
): ReconcileResult {
  const errors: NotepadError[] = [];
  const warnings: string[] = [];
  const used = new Set<number>();
  const log: WorkoutLogEntry[] = [];
  const oldIndexOf: (number | null)[] = [];
  const groupIds = new Map<string, string>();
  const claimedOldGroupIds = new Set<string>();

  function groupIdFor(key: string, base?: WorkoutLogEntry): string {
    const existing = groupIds.get(key);
    if (existing) return existing;
    let id: string | undefined;
    if (base?.groupId && !claimedOldGroupIds.has(base.groupId)) id = base.groupId;
    if (!id) id = `g${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    claimedOldGroupIds.add(id);
    groupIds.set(key, id);
    return id;
  }

  // Casa itens com entradas existentes em duas passadas — nome exato primeiro,
  // depois nome contido ("Supino Reto" ↔ "Supino Reto com Barra") — para que um
  // nome abreviado nunca "roube" a entrada de quem escreveu o nome completo.
  const assigned: number[] = items.map(() => -1);
  const assignPass = (matches: (o: WorkoutLogEntry, target: string) => boolean) => {
    items.forEach((item, k) => {
      if (assigned[k] !== -1) return;
      const target = norm(item.rawName);
      const wantCardio = item.kind === 'cardio';
      for (let j = 0; j < oldLog.length; j++) {
        if (used.has(j) || isCardioLogEntry(oldLog[j]) !== wantCardio) continue;
        if (matches(oldLog[j], target)) {
          assigned[k] = j;
          used.add(j);
          break;
        }
      }
    });
  };
  assignPass((o, t) => norm(exerciseName(o, exercises)) === t || norm(o.exId) === t);
  assignPass((o, t) => {
    const n = norm(exerciseName(o, exercises));
    return t.length >= 4 && (n.includes(t) || t.includes(n));
  });

  for (let k = 0; k < items.length; k++) {
    const item = items[k];
    const wantCardio = item.kind === 'cardio';

    const oldIdx = assigned[k];
    const base = oldIdx >= 0 ? oldLog[oldIdx] : undefined;

    let exId: string;
    if (base) {
      exId = base.exId;
    } else {
      const ex = matchBank(item.rawName, exercises);
      if (!ex) {
        errors.push({ line: item.line, text: item.rawName, reason: `Exercício "${item.rawName}" não encontrado no Banco.` });
        continue;
      }
      if ((ex.agonist === 'Cardio' || ex.type === 'cardio') !== wantCardio) {
        errors.push({
          line: item.line,
          text: item.rawName,
          reason: wantCardio
            ? `"${ex.name}" é de força — use o formato 3x10 80kg.`
            : `"${ex.name}" é cardio — use o formato 30min int 6.`,
        });
        continue;
      }
      exId = ex.id;
    }

    const grp = item.groupKey ? { groupId: groupIdFor(item.groupKey, base), groupType: item.groupType } : null;

    let entry: WorkoutLogEntry;
    if (wantCardio) {
      const b = base as CardioLogEntry | undefined;
      const next: CardioLogEntry = {
        ...(b ?? { id: genLogEntryId(), exId, type: 'cardio', hrZone: 3 }),
        exId,
        type: 'cardio',
        duration: item.duration,
        intensity: item.intensity ?? b?.intensity ?? 5,
      } as CardioLogEntry;
      if (item.notes) next.notes = item.notes;
      else delete next.notes;
      entry = next;
    } else {
      const b = base as StrengthLogEntry | undefined;
      let { sets, serieReps } = item;
      const serieLoads = item.serieLoads;

      if (role === 'aluno' && b) {
        if (sets < (b.sets || 1)) {
          errors.push({ line: item.line, text: item.rawName, reason: 'Só o Personal pode remover séries.' });
          continue;
        }
        const min = b.repRangeMin;
        const max = b.repRangeMax;
        if (min != null || max != null) {
          const clamped = serieReps.map((r) => Math.min(max ?? Infinity, Math.max(min ?? 1, r)));
          if (clamped.some((r, i) => r !== serieReps[i])) {
            warnings.push(
              `Linha ${item.line}: repetições ajustadas à janela do Personal (${min ?? '—'}–${max ?? '—'}).`
            );
          }
          serieReps = clamped;
        }
      }
      sets = Math.max(1, sets);

      const next: StrengthLogEntry = {
        ...(b ?? { id: genLogEntryId(), exId, sets, reps: 0, load: 0, serieLoads: [], serieReps: [] }),
        exId,
        sets,
        reps: serieReps[0] ?? 0,
        load: serieLoads[0] ?? 0,
        serieLoads: [...serieLoads],
        serieReps: [...serieReps],
      };
      if (b?.doneSerie) next.doneSerie = Array.from({ length: sets }, (_, i) => b.doneSerie?.[i] ?? false);
      if (item.notes) next.notes = item.notes;
      else delete next.notes;
      entry = next;
    }

    if (grp) {
      entry = { ...entry, groupId: grp.groupId, groupType: grp.groupType };
    } else {
      const { groupId: _g, groupType: _t, ...rest } = entry;
      entry = rest as WorkoutLogEntry;
    }

    log.push(entry);
    oldIndexOf.push(oldIdx >= 0 ? oldIdx : null);
  }

  if (role === 'aluno') {
    oldLog.forEach((o, j) => {
      if (!used.has(j)) {
        errors.push({
          line: 0,
          text: exerciseName(o, exercises),
          reason: `"${exerciseName(o, exercises)}" foi removido do texto — só o Personal pode remover ou trocar exercícios.`,
        });
      }
    });
  }

  return { log, oldIndexOf, errors, warnings };
}

/**
 * Atalho: texto → (itens + reconciliação). `ok` só é true quando NÃO há nenhum
 * erro — a UI só grava no treino nesse caso (tudo-ou-nada), para que uma linha
 * em edição/errada nunca apague exercícios por acidente.
 */
export function applyNotepadText(
  text: string,
  oldLog: WorkoutDayLog,
  exercises: Exercise[],
  opts: ReconcileOptions
): ReconcileResult & { pse: number | null; ok: boolean } {
  const parsed = parseNotepadText(text, exercises);
  const rec = reconcileNotepad(parsed.items, oldLog, exercises, opts);
  const errors = [...parsed.errors, ...rec.errors].sort((a, b) => a.line - b.line);
  return { ...rec, errors, pse: parsed.pse, ok: errors.length === 0 };
}
