import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../../data/defaultExercises';
import type { CardioLogEntry, StrengthLogEntry, WorkoutDayLog } from '../../types/workout';
import { applyNotepadText, parseNotepadText, serializeDayLog } from '../workoutNotepad';
import { parseImportText } from '../importParser';

const EX = DEFAULT_EXERCISES;
const strength = EX.filter((e) => e.agonist !== 'Cardio' && e.type !== 'cardio');
const cardio = EX.find((e) => e.agonist === 'Cardio' || e.type === 'cardio')!;

function s(exId: string, over: Partial<StrengthLogEntry> = {}): StrengthLogEntry {
  return { id: `id-${exId}`, exId, sets: 3, reps: 10, load: 80, serieLoads: [80, 80, 80], serieReps: [10, 10, 10], ...over };
}

describe('serializeDayLog', () => {
  it('escreve no formato do importador (carga igual, reps iguais)', () => {
    const txt = serializeDayLog([s(strength[0].id)], EX);
    expect(txt).toBe(`${strength[0].name} 3x10 80kg`);
  });

  it('escreve reps e cargas por série, decimais e notas', () => {
    const e = s(strength[0].id, { serieReps: [8, 8, 6], serieLoads: [80, 82.5, 85], notes: 'focar na descida' });
    expect(serializeDayLog([e], EX)).toBe(`${strength[0].name} 3x8/8/6 80kg 82.5kg 85kg #focar na descida`);
  });

  it('omite a carga quando é zero e acrescenta PSE', () => {
    const e = s(strength[0].id, { load: 0, serieLoads: [0, 0, 0] });
    expect(serializeDayLog([e], EX, 7)).toBe(`${strength[0].name} 3x10\nPSE: 7`);
  });

  it('o importador existente entende o texto gerado', () => {
    const e = s(strength[1].id, { serieReps: [12, 10, 8], serieLoads: [20, 22.5, 25], notes: 'ok' });
    const r = parseImportText(serializeDayLog([e], EX, 6), EX);
    expect(r.pse).toBe(6);
    expect(r.items[0].exId).toBe(strength[1].id);
    expect(r.items[0].serieReps).toEqual([12, 10, 8]);
    expect(r.items[0].serieLoads).toEqual([20, 22.5, 25]);
    expect(r.items[0].notes).toBe('ok');
  });
});

describe('ida e volta (serialize → apply)', () => {
  it('TODOS os exercícios de força do Banco sobrevivem à ida e volta', () => {
    const bad: string[] = [];
    for (const ex of strength) {
      const log = [s(ex.id)];
      const txt = serializeDayLog(log, EX);
      const r = applyNotepadText(txt, log, EX, { role: 'personal' });
      if (!r.ok || r.log.length !== 1 || r.log[0].exId !== ex.id) bad.push(`${ex.name} → "${txt}"`);
    }
    expect(bad).toEqual([]);
  });

  it('resolve pelo Banco (sem entrada anterior) também para todos os nomes', () => {
    const bad: string[] = [];
    for (const ex of strength) {
      const txt = serializeDayLog([s(ex.id)], EX);
      const r = applyNotepadText(txt, [], EX, { role: 'personal' });
      if (!r.ok || r.log[0]?.exId !== ex.id) bad.push(ex.name);
    }
    expect(bad).toEqual([]);
  });

  it('log idêntico não muda nada (idempotente)', () => {
    const log: WorkoutDayLog = [
      s(strength[0].id, { notes: 'a' }),
      s(strength[1].id, { serieReps: [12, 10, 8], serieLoads: [20, 22.5, 25] }),
    ];
    const txt = serializeDayLog(log, EX, 5);
    const r = applyNotepadText(txt, log, EX, { role: 'personal' });
    expect(r.ok).toBe(true);
    expect(serializeDayLog(r.log, EX, r.pse)).toBe(txt);
  });
});

describe('edição pelo texto', () => {
  it('trocar carga/reps preserva id, doneSerie e janela de reps', () => {
    const e = s(strength[0].id, { doneSerie: [true, false, false], repRangeMin: 8, repRangeMax: 12 });
    const r = applyNotepadText(`${strength[0].name} 3x10 12,5kg`, [e], EX, { role: 'personal' });
    const out = r.log[0] as StrengthLogEntry;
    expect(r.ok).toBe(true);
    expect(out.id).toBe(e.id);
    expect(out.load).toBe(12.5);
    expect(out.serieLoads).toEqual([12.5, 12.5, 12.5]);
    expect(out.doneSerie).toEqual([true, false, false]);
    expect(out.repRangeMax).toBe(12);
    expect(r.oldIndexOf).toEqual([0]);
  });

  it('aceita decimais com ponto ou vírgula e 2 casas (20.75)', () => {
    const e = s(strength[0].id);
    const a = applyNotepadText(`${strength[0].name} 3x10 20.75kg`, [e], EX, { role: 'personal' });
    const b = applyNotepadText(`${strength[0].name} 3x10 20,75kg`, [e], EX, { role: 'personal' });
    expect((a.log[0] as StrengthLogEntry).load).toBe(20.75);
    expect((b.log[0] as StrengthLogEntry).load).toBe(20.75);
  });

  it('aumentar séries estende doneSerie; reordenar linhas gera oldIndexOf correto', () => {
    const a = s(strength[0].id, { doneSerie: [true, true, true] });
    const b = s(strength[1].id);
    const txt = `${strength[1].name} 3x10 80kg\n${strength[0].name} 4x10 80kg`;
    const r = applyNotepadText(txt, [a, b], EX, { role: 'personal' });
    expect(r.ok).toBe(true);
    expect(r.oldIndexOf).toEqual([1, 0]);
    expect((r.log[1] as StrengthLogEntry).doneSerie).toEqual([true, true, true, false]);
  });

  it('apagar uma linha remove o exercício (Personal)', () => {
    const r = applyNotepadText(`${strength[0].name} 3x10 80kg`, [s(strength[0].id), s(strength[1].id)], EX, { role: 'personal' });
    expect(r.ok).toBe(true);
    expect(r.log).toHaveLength(1);
  });

  it('linha duplicada do mesmo exercício casa por ordem', () => {
    const a = s(strength[0].id, { id: 'A' });
    const b = s(strength[0].id, { id: 'B' });
    const r = applyNotepadText(`${strength[0].name} 3x10 70kg\n${strength[0].name} 3x10 90kg`, [a, b], EX, { role: 'personal' });
    expect(r.log.map((e) => e.id)).toEqual(['A', 'B']);
    expect((r.log[1] as StrengthLogEntry).load).toBe(90);
  });

  it('nome abreviado ("Supino Reto") casa com a entrada existente, preservando o id', () => {
    const ex = strength.find((x) => x.name.length > 12)!;
    const short = ex.name.split(' ').slice(0, 2).join(' ');
    const e = s(ex.id, { id: 'KEEP' });
    for (const role of ['personal', 'aluno'] as const) {
      const r = applyNotepadText(`${short} 3x10 12,5kg`, [e], EX, { role });
      expect(r.ok).toBe(true);
      expect(r.log[0].id).toBe('KEEP');
      expect((r.log[0] as StrengthLogEntry).load).toBe(12.5);
    }
  });

  it('nome exato tem prioridade sobre o abreviado em duplicatas parciais', () => {
    const a = strength.find((x) => strength.some((y) => y.id !== x.id && y.name.startsWith(x.name + ' ')));
    if (!a) return;
    const b = strength.find((y) => y.id !== a.id && y.name.startsWith(a.name + ' '))!;
    const log = [s(b.id, { id: 'B' }), s(a.id, { id: 'A' })];
    const r = applyNotepadText(`${a.name} 3x10 70kg\n${b.name} 3x10 90kg`, log, EX, { role: 'personal' });
    expect(r.ok).toBe(true);
    expect(r.log.map((x) => x.id)).toEqual(['A', 'B']);
  });

  it('atualiza PSE', () => {
    const r = applyNotepadText(`${strength[0].name} 3x10 80kg\nPSE: 8`, [s(strength[0].id)], EX, { role: 'personal' });
    expect(r.pse).toBe(8);
  });
});

describe('conjugados', () => {
  it('Bi-Set e Tri-Set são deduzidos pela contagem; Superset/Circuito pelo prefixo', () => {
    const [a, b, c] = strength;
    const mk = (type: StrengthLogEntry['groupType'], ids: string[]) =>
      ids.map((id) => s(id, { groupId: 'G1', groupType: type }));

    for (const [type, ids] of [
      ['biset', [a.id, b.id]],
      ['triset', [a.id, b.id, c.id]],
      ['supersets', [a.id, b.id]],
      ['circuito', [a.id, b.id, c.id]],
    ] as const) {
      const log = mk(type, [...ids]);
      const txt = serializeDayLog(log, EX);
      const r = applyNotepadText(txt, log, EX, { role: 'personal' });
      expect(r.ok).toBe(true);
      expect(r.log.map((e) => e.groupType)).toEqual(log.map(() => type));
      expect(new Set(r.log.map((e) => e.groupId)).size).toBe(1);
    }
  });

  it('separar um conjugado em duas linhas desfaz o grupo', () => {
    const log = [s(strength[0].id, { groupId: 'G', groupType: 'biset' }), s(strength[1].id, { groupId: 'G', groupType: 'biset' })];
    const r = applyNotepadText(`${strength[0].name} 3x10 80kg\n${strength[1].name} 3x10 80kg`, log, EX, { role: 'personal' });
    expect(r.log.every((e) => e.groupId === undefined)).toBe(true);
  });
});

describe('cardio', () => {
  it('ida e volta preserva hrZone e distância', () => {
    const c: CardioLogEntry = { id: 'c1', exId: cardio.id, type: 'cardio', duration: 30, intensity: 6, hrZone: 3, distance: 5 };
    const txt = serializeDayLog([c], EX);
    expect(txt).toBe(`${cardio.name} 30min int 6`);
    const r = applyNotepadText(`${cardio.name} 40min int 7`, [c], EX, { role: 'personal' });
    const out = r.log[0] as CardioLogEntry;
    expect(out).toMatchObject({ id: 'c1', duration: 40, intensity: 7, hrZone: 3, distance: 5 });
  });
});

describe('erros e tudo-ou-nada', () => {
  it('linha sem formato válido gera erro com número da linha', () => {
    const r = parseNotepadText(`${strength[0].name} 3x10 80kg\nblablabla`, EX);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].line).toBe(2);
  });

  it('exercício inexistente no Banco não é aplicado (ok=false)', () => {
    const r = applyNotepadText('Exercício Totalmente Inventado XYZ 3x10 80kg', [], EX, { role: 'personal' });
    expect(r.ok).toBe(false);
    expect(r.errors[0].reason).toMatch(/não encontrado/);
  });

  it('força no formato de cardio e vice-versa é rejeitado', () => {
    const r1 = applyNotepadText(`${cardio.name} 3x10 80kg`, [], EX, { role: 'personal' });
    const r2 = applyNotepadText(`${strength[0].name} 30min int 6`, [], EX, { role: 'personal' });
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
  });

  it('nota com "#PSE 9" não é confundida com a linha de PSE do dia', () => {
    const r = parseNotepadText(`${strength[0].name} 3x10 80kg #PSE 9 ontem`, EX);
    expect(r.pse).toBeNull();
    expect(r.items[0].notes).toBe('PSE 9 ontem');
  });
});

describe('permissões do Aluno', () => {
  it('Aluno edita carga livremente', () => {
    const r = applyNotepadText(`${strength[0].name} 3x10 100kg`, [s(strength[0].id)], EX, { role: 'aluno' });
    expect(r.ok).toBe(true);
    expect((r.log[0] as StrengthLogEntry).load).toBe(100);
  });

  it('Aluno: reps são limitadas à janela do Personal (com aviso)', () => {
    const e = s(strength[0].id, { repRangeMin: 8, repRangeMax: 12 });
    const r = applyNotepadText(`${strength[0].name} 3x20 80kg`, [e], EX, { role: 'aluno' });
    expect(r.ok).toBe(true);
    expect((r.log[0] as StrengthLogEntry).serieReps).toEqual([12, 12, 12]);
    expect(r.warnings.length).toBe(1);
  });

  it('Aluno não remove séries nem exercícios', () => {
    const e = s(strength[0].id);
    expect(applyNotepadText(`${strength[0].name} 2x10 80kg`, [e], EX, { role: 'aluno' }).ok).toBe(false);
    expect(applyNotepadText('PSE: 5', [e], EX, { role: 'aluno' }).ok).toBe(false);
  });

  it('Aluno pode adicionar série e exercício novo do Banco', () => {
    const e = s(strength[0].id);
    const txt = `${strength[0].name} 4x10 80kg\n${strength[1].name} 3x10 20kg`;
    const r = applyNotepadText(txt, [e], EX, { role: 'aluno' });
    expect(r.ok).toBe(true);
    expect(r.log).toHaveLength(2);
  });
});
