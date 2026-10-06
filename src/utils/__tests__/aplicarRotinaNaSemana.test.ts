import { beforeEach, describe, expect, it } from 'vitest';
import type { AlunoRotina } from '../../types/aluno';
import { criarRotinaVazia } from '../../types/aluno';
import type { Exercise } from '../../types/exercise';
import type { StrengthLogEntry } from '../../types/workout';
import type { RotinaAtivaResolvida } from '../../lib/rotinaAtivaAluno';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useRotinaSyncStore } from '../../store/useRotinaSyncStore';
import { aplicarRotinaNaSemana } from '../aplicarRotinaNaSemana';
import { decidirSincronizacao } from '../rotinaSync';

const banco: Exercise[] = [
  { id: 'e1', name: 'Supino', agonist: 'Peito', synergist: [], stabilizer: [] },
  { id: 'e2', name: 'Remada', agonist: 'Costas', synergist: [], stabilizer: [] },
];
const rotinaCom = (...dias: Array<[number, string]>): AlunoRotina => {
  const r = criarRotinaVazia();
  dias.forEach(([d, nome]) => {
    r[d] = { tipo: 'Treino', exercicios: [{ nome, series: 3, reps: '10', carga: 40 }] };
  });
  return r;
};
const resolvida = (id: string, rotina: AlunoRotina): RotinaAtivaResolvida => ({
  rotina, version: `multi:${id}@t`, origem: 'multiplas', nome: id,
});
const nada = () => undefined;

/** Reproduz o que o banner faz a cada verificação. */
function sincronizar(r: RotinaAtivaResolvida): 'aplicada' | 'perguntar' | 'ja-vista' {
  const sync = useRotinaSyncStore.getState();
  if (r.version === sync.lastSeenAt) return 'ja-vista';
  const w = useWorkoutStore.getState();
  const d = decidirSincronizacao({
    weekLog: w.weekLog, exDone: w.exDone, weekPSE: w.weekPSE, exercises: banco, fingerprintImportada: sync.lastImportedFingerprint,
  });
  if (d === 'perguntar') return 'perguntar';
  aplicarRotinaNaSemana(r, banco, nada, 'substituir-semana');
  return 'aplicada';
}

describe('sincronização da rotina ativa — cenários', () => {
  beforeEach(() => {
    useWorkoutStore.setState({ weekLog: {}, weekPSE: {}, exDone: {} });
    useRotinaSyncStore.setState({ lastSeenAt: null, lastImportedFingerprint: null });
  });

  it('3) Personal troca a ativa ANTES de o aluno treinar → a nova vira a semana inteira', () => {
    const A = resolvida('A', rotinaCom([0, 'Supino'], [2, 'Supino']));
    const B = resolvida('B', rotinaCom([1, 'Remada']));
    expect(sincronizar(A)).toBe('aplicada'); // 2) primeira rotina, semana vazia
    expect(Object.keys(useWorkoutStore.getState().weekLog)).toEqual(['0', '2']);
    expect(sincronizar(B)).toBe('aplicada');
    // substituição completa: nada de A sobra (dias 0 e 2)
    expect(Object.keys(useWorkoutStore.getState().weekLog)).toEqual(['1']);
    expect(useRotinaSyncStore.getState().lastSeenAt).toBe('multi:B@t');
    expect(sincronizar(B)).toBe('ja-vista'); // não reaplica a mesma versão
  });

  it('4) Personal troca a ativa DEPOIS de o aluno treinar → pergunta e preserva o progresso', () => {
    const A = resolvida('A', rotinaCom([0, 'Supino']));
    const B = resolvida('B', rotinaCom([0, 'Remada']));
    sincronizar(A);
    useWorkoutStore.setState({ exDone: { '0:0': true }, weekPSE: { 0: 8 } });
    const antes = JSON.stringify(useWorkoutStore.getState().weekLog);
    expect(sincronizar(B)).toBe('perguntar');
    expect(JSON.stringify(useWorkoutStore.getState().weekLog)).toBe(antes);
    expect(useWorkoutStore.getState().exDone).toEqual({ '0:0': true });
    expect(useRotinaSyncStore.getState().lastSeenAt).toBe('multi:A@t');
  });

  it('4b) aluno editou o plano sem treinar → também pergunta', () => {
    sincronizar(resolvida('A', rotinaCom([0, 'Supino'])));
    const w = useWorkoutStore.getState().weekLog;
    useWorkoutStore.setState({ weekLog: { 0: [{ ...(w[0][0] as StrengthLogEntry), sets: 5 }] } });
    expect(sincronizar(resolvida('B', rotinaCom([0, 'Remada'])))).toBe('perguntar');
  });

  it('confirmado pelo aluno (mesclar-dias): troca só os dias da nova rotina e zera progresso desses dias', () => {
    sincronizar(resolvida('A', rotinaCom([0, 'Supino'], [3, 'Supino'])));
    useWorkoutStore.setState({ exDone: { '0:0': true, '3:0': true }, weekPSE: { 0: 8, 3: 6 } });
    aplicarRotinaNaSemana(resolvida('B', rotinaCom([0, 'Remada'])), banco, nada, 'mesclar-dias');
    const s = useWorkoutStore.getState();
    expect(s.weekLog[0][0].exId).toBe('e2'); // dia 0 trocado
    expect(s.weekLog[3][0].exId).toBe('e1'); // dia 3 intocado
    expect(s.exDone).toEqual({ '3:0': true }); // só o progresso do dia intocado sobrevive
    expect(s.weekPSE).toEqual({ 3: 6 });
  });
});
