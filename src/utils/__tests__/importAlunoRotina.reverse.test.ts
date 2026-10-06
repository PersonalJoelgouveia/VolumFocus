import { describe, expect, it } from 'vitest';
import type { AlunoRotina } from '../../types/aluno';
import { criarRotinaVazia } from '../../types/aluno';
import type { Exercise } from '../../types/exercise';
import type { StrengthLogEntry, WeekLog } from '../../types/workout';
import { buildAlunoRotinaFromWeekLog, buildWeekLogFromAlunoRotina } from '../importAlunoRotina';

const exercicios: Exercise[] = [
  { id: 'e1', name: 'Supino Reto', agonist: 'Peito', synergist: [], stabilizer: [] },
  { id: 'e2', name: 'Meu Exercício Custom', agonist: 'Peito', synergist: [], stabilizer: [] },
  { id: 'c1', name: 'Esteira', agonist: 'Cardio', type: 'cardio', synergist: [], stabilizer: [] },
];

const rotinaOriginal = (): AlunoRotina => [
  {
    tipo: 'Peito A',
    exercicios: [
      { nome: 'Supino Reto', series: 4, reps: '10', carga: 60, notes: 'Cluster Set', groupId: 'g1', groupType: 'biset' },
      { nome: 'Meu Exercício Custom', series: 3, reps: '12', carga: 20, groupId: 'g1', groupType: 'biset' },
      { nome: 'Esteira', cardio: true, duracao: '25 min', intensidade: '6' },
    ],
  },
  { tipo: 'Descanso Total', exercicios: [] },
  { tipo: 'Descanso Total', exercicios: [] },
  { tipo: 'Descanso Total', exercicios: [] },
  { tipo: 'Descanso Total', exercicios: [] },
  { tipo: 'Descanso Total', exercicios: [] },
  { tipo: 'Descanso Total', exercicios: [] },
];

/** Metadados que a volta passa a gravar, vindos do banco de exercícios. */
const infoDe = (id: string) => {
  const e = exercicios.find((x) => x.id === id)!;
  return { exercicioInfo: { agonist: e.agonist, synergist: e.synergist, stabilizer: e.stabilizer } };
};
const comInfo = (rotina: AlunoRotina): AlunoRotina =>
  rotina.map((d) => ({
    ...d,
    exercicios: d.exercicios.map((ex) => ({
      ...ex,
      ...infoDe(ex.nome === 'Supino Reto' ? 'e1' : ex.nome === 'Esteira' ? 'c1' : 'e2'),
    })),
  }));

describe('buildAlunoRotinaFromWeekLog', () => {
  it('round-trip: rotina → WeekLog → rotina preserva nome, ordem, séries, reps, carga, notas e grupo', () => {
    const { weekLog } = buildWeekLogFromAlunoRotina(rotinaOriginal(), exercicios, () => undefined);
    const { rotina, exerciciosNaoResolvidos } = buildAlunoRotinaFromWeekLog(weekLog, exercicios, {
      tiposDia: ['Peito A'],
    });
    expect(exerciciosNaoResolvidos).toEqual([]);
    expect(rotina).toEqual(comInfo(rotinaOriginal()));
  });

  it('sempre devolve 7 dias, mesmo com WeekLog vazio ou com chaves fora de 0-6', () => {
    const vazio = buildAlunoRotinaFromWeekLog({}, exercicios).rotina;
    expect(vazio).toHaveLength(7);
    expect(vazio.every((d) => d.tipo === 'Descanso Total' && d.exercicios.length === 0)).toBe(true);
    const fora = buildAlunoRotinaFromWeekLog({ 9: [] } as WeekLog, exercicios).rotina;
    expect(fora).toHaveLength(7);
  });

  it('não leva estado de execução: doneSerie, cargas/reps por série, id, distância, FC, zona', () => {
    const executado: StrengthLogEntry = {
      id: 'le-1', exId: 'e1', sets: 3, reps: 10, load: 50,
      serieLoads: [50, 55, 60], serieReps: [10, 8, 6], doneSerie: [true, true, false],
    };
    const weekLog: WeekLog = {
      2: [
        executado,
        { id: 'le-2', exId: 'c1', type: 'cardio', duration: 30, intensity: 7, hrZone: 4, distance: 5.2, avgHr: 151 },
      ],
    };
    const dia = buildAlunoRotinaFromWeekLog(weekLog, exercicios).rotina[2];
    expect(dia.tipo).toBe('Treino Personalizado');
    expect(dia.exercicios[0]).toEqual({ nome: 'Supino Reto', series: 3, reps: '10', carga: 50, ...infoDe('e1') });
    expect(dia.exercicios[1]).toEqual({ nome: 'Esteira', cardio: true, duracao: '30 min', intensidade: '7', ...infoDe('c1') });
    const json = JSON.stringify(dia);
    for (const campo of ['doneSerie', 'serieLoads', 'serieReps', 'distance', 'avgHr', 'hrZone', 'le-1']) {
      expect(json).not.toContain(campo);
    }
  });

  it('usa a janela de reps do Personal (min-max) quando existe', () => {
    const weekLog: WeekLog = {
      0: [{ exId: 'e1', sets: 3, reps: 10, load: 40, serieLoads: [], serieReps: [], repRangeMin: 8, repRangeMax: 12 }],
    };
    expect(buildAlunoRotinaFromWeekLog(weekLog, exercicios).rotina[0].exercicios[0]).toMatchObject({ reps: '8-12' });
  });

  it('exId inexistente é omitido e reportado; dia que ficar sem exercício vira Descanso Total', () => {
    const weekLog: WeekLog = {
      1: [{ exId: 'fantasma', sets: 3, reps: 10, load: 0, serieLoads: [], serieReps: [] }],
    };
    const { rotina, exerciciosNaoResolvidos } = buildAlunoRotinaFromWeekLog(weekLog, exercicios, {
      tiposDia: [undefined, 'Costas'],
    });
    expect(exerciciosNaoResolvidos).toEqual(['fantasma']);
    expect(rotina[1]).toEqual({ tipo: 'Descanso Total', exercicios: [] });
  });

  it('não muta o WeekLog nem compartilha referências com ele', () => {
    const weekLog: WeekLog = {
      0: [{ exId: 'e1', sets: 3, reps: 10, load: 40, serieLoads: [40], serieReps: [10], notes: 'x' }],
    };
    const copia = JSON.stringify(weekLog);
    const r1 = buildAlunoRotinaFromWeekLog(weekLog, exercicios).rotina;
    expect(JSON.stringify(weekLog)).toBe(copia);
    r1[0].exercicios[0].nome = 'alterado';
    expect(buildAlunoRotinaFromWeekLog(weekLog, exercicios).rotina[0].exercicios[0].nome).toBe('Supino Reto');
  });

  it('resultado é serializável para o Firestore (sem undefined)', () => {
    const { weekLog } = buildWeekLogFromAlunoRotina(rotinaOriginal(), exercicios, () => undefined);
    const { rotina } = buildAlunoRotinaFromWeekLog(weekLog, exercicios);
    expect(JSON.parse(JSON.stringify(rotina))).toEqual(rotina);
  });

  it('exercício CUSTOM: o nome e os metadados musculares vão na rotina e sobrevivem à serialização', () => {
    const custom: Exercise = { id: 'custom-1', name: 'Remada Cavalinho Minha', agonist: 'Costas', synergist: ['Bíceps'], stabilizer: ['Abdômen'] };
    const weekLog: WeekLog = { 1: [{ exId: 'custom-1', sets: 4, reps: 8, load: 30, serieLoads: [], serieReps: [] }] };
    const { rotina, exerciciosNaoResolvidos } = buildAlunoRotinaFromWeekLog(weekLog, [...exercicios, custom]);
    expect(exerciciosNaoResolvidos).toEqual([]);
    const gravada = JSON.parse(JSON.stringify(rotina)) as AlunoRotina; // o que o Firestore guarda
    expect(gravada[1].exercicios[0]).toMatchObject({
      nome: 'Remada Cavalinho Minha',
      exercicioInfo: { agonist: 'Costas', synergist: ['Bíceps'], stabilizer: ['Abdômen'] },
    });
  });

  it('aluno SEM o exercício custom: ao importar, ele é criado com os metadados corretos (não "Peito" genérico)', () => {
    const custom: Exercise = { id: 'custom-1', name: 'Remada Cavalinho Minha', agonist: 'Costas', synergist: ['Bíceps'], stabilizer: [] };
    const weekLog: WeekLog = { 1: [{ exId: 'custom-1', sets: 4, reps: 8, load: 30, serieLoads: [], serieReps: [] }] };
    const gravada = JSON.parse(JSON.stringify(buildAlunoRotinaFromWeekLog(weekLog, [custom]).rotina)) as AlunoRotina;

    const bancoDoAluno: Exercise[] = []; // não tem o custom
    const criados: Exercise[] = [];
    const { weekLog: semanaDoAluno, novosExercicios } = buildWeekLogFromAlunoRotina(gravada, bancoDoAluno, (e) => criados.push(e));
    expect(novosExercicios).toEqual(['Remada Cavalinho Minha']);
    expect(criados[0]).toMatchObject({ name: 'Remada Cavalinho Minha', agonist: 'Costas', synergist: ['Bíceps'], stabilizer: [] });
    expect(semanaDoAluno[1][0].exId).toBe(criados[0].id);
  });

  it('rotina ANTIGA (sem exercicioInfo) continua importando com o padrão genérico de sempre', () => {
    const antiga: AlunoRotina = rotinaOriginal();
    antiga[3] = { tipo: 'X', exercicios: [{ nome: 'Exercício Inédito', series: 3, reps: '10', carga: 0 }] };
    const criados: Exercise[] = [];
    buildWeekLogFromAlunoRotina(antiga, exercicios, (e) => criados.push(e));
    expect(criados[0]).toMatchObject({ name: 'Exercício Inédito', agonist: 'Peito', synergist: [], stabilizer: [] });
  });

  it('metadados adulterados/inválidos na rotina não entram no banco', () => {
    const r = criarRotinaVazia();
    r[0] = {
      tipo: 'X',
      exercicios: [{ nome: 'Estranho', series: 1, reps: '1', carga: 0, exercicioInfo: { agonist: 'Hacker' as never, synergist: ['Peito', 'Lixo'] as never, stabilizer: 'x' as never } }],
    };
    const criados: Exercise[] = [];
    buildWeekLogFromAlunoRotina(r, [], (e) => criados.push(e));
    expect(criados[0]).toMatchObject({ agonist: 'Peito', synergist: ['Peito'], stabilizer: [] });
  });
});
