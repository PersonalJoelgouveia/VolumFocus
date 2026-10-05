import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * Testes das Security Rules do Firestore (ataques da auditoria P5).
 * Rodar com o Emulator: ver rules-tests/LEIA-ME.md.
 */
let env: RulesTestEnvironment;

const PT = 'joelgouveia16@gmail.com';
const ALUNO_A = 'a@x.com';
const ALUNO_B = 'b@x.com';
const ESTRANHO = 's@x.com'; // conta Google qualquer, NÃO cadastrada

const ctxPT = () => env.authenticatedContext('uid-pt', { email: PT, email_verified: true }).firestore();
const ctxA = () => env.authenticatedContext('uid-a', { email: ALUNO_A, email_verified: true }).firestore();
const ctxB = () => env.authenticatedContext('uid-b', { email: ALUNO_B, email_verified: true }).firestore();
const ctxEstranho = () => env.authenticatedContext('uid-s', { email: ESTRANHO, email_verified: true }).firestore();
/** Alguém que registrou o e-mail do aluno A por um provedor sem verificação. */
const ctxFalsoA = () => env.authenticatedContext('uid-x', { email: ALUNO_A, email_verified: false }).firestore();
const ctxAnon = () => env.unauthenticatedContext().firestore();

const avaliacaoOnline = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  alunoId: 'aluno-123',
  date: '2026-10-01T12:00:00.000Z',
  protocol: 'online',
  anthropometry: { peso: 80, altura: 180, imc: 24.7 },
  circumferences: [{ id: 'cintura', nome: 'Cintura', valor: 84, unidade: 'cm', lado: 'none' }],
  skinfolds: {},
  results: { relacaoCinturaEstatura: 0.47 },
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  status: 'enviada',
  submittedBy: 'aluno',
  questionnaire: { horasSono: 7 },
  ...extra,
});

const notificacao = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  alunoEmail: ALUNO_A,
  alunoNome: 'Aluno A',
  dia: 2,
  dataTreino: '2026-10-02',
  lida: false,
  criadaEm: '2026-10-02T10:00:00.000Z',
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'volumfocus-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'alunos', ALUNO_A), { perfilAluno: { nome: 'A' }, rotina: {} });
    await setDoc(doc(db, 'alunos', ALUNO_B), { perfilAluno: { nome: 'B' }, rotina: {} });
    await setDoc(doc(db, 'alunos', ALUNO_A, 'avaliacoesFisicas', 'af-existente'), avaliacaoOnline('af-existente'));
    await setDoc(doc(db, 'alunos', ALUNO_B, 'avaliacoesFisicas', 'af-b'), avaliacaoOnline('af-b'));
    await setDoc(doc(db, 'alunos', ALUNO_A, 'anotacoes', 'n1'), { alunoId: 'x', conteudo: 'privado do Personal' });
    await setDoc(doc(db, 'backups', ALUNO_A), { workout: {} });
    await setDoc(doc(db, 'backups', ALUNO_B), { workout: {} });
    await setDoc(doc(db, 'notificacoesTreinos', 'n-existente'), notificacao('n-existente'));
  });
});

describe('/alunos/{email} — leitura cruzada, spoofing e enumeração', () => {
  it('Personal lê qualquer aluno e lista a coleção', async () => {
    await assertSucceeds(getDoc(doc(ctxPT(), 'alunos', ALUNO_A)));
    await assertSucceeds(getDocs(collection(ctxPT(), 'alunos')));
  });
  it('T1: aluno lê o próprio doc, mas NÃO o de outro aluno', async () => {
    await assertSucceeds(getDoc(doc(ctxA(), 'alunos', ALUNO_A)));
    await assertFails(getDoc(doc(ctxA(), 'alunos', ALUNO_B)));
  });
  it('gate do app: conta não cadastrada consegue ler o PRÓPRIO caminho (doc inexistente), nunca o dos outros', async () => {
    await assertSucceeds(getDoc(doc(ctxEstranho(), 'alunos', ESTRANHO)));
    await assertFails(getDoc(doc(ctxEstranho(), 'alunos', ALUNO_A)));
  });
  it('enumeração: aluno e estranho NÃO listam a coleção de alunos', async () => {
    await assertFails(getDocs(collection(ctxA(), 'alunos')));
    await assertFails(getDocs(collection(ctxEstranho(), 'alunos')));
  });
  it('T11: e-mail NÃO verificado (provedor sem verificação) não passa como o aluno', async () => {
    await assertFails(getDoc(doc(ctxFalsoA(), 'alunos', ALUNO_A)));
    await assertFails(getDoc(doc(ctxFalsoA(), 'alunos', ALUNO_A, 'avaliacoesFisicas', 'af-existente')));
    await assertFails(getDoc(doc(ctxFalsoA(), 'backups', ALUNO_A)));
  });
  it('não autenticado não lê nada', async () => {
    await assertFails(getDoc(doc(ctxAnon(), 'alunos', ALUNO_A)));
  });
  it('T2/T14: aluno NÃO escreve no próprio doc de aluno (perfil/rotina são do Personal)', async () => {
    await assertFails(setDoc(doc(ctxA(), 'alunos', ALUNO_A), { rotina: { hack: true } }, { merge: true }));
    await assertFails(setDoc(doc(ctxA(), 'alunos', ALUNO_B), { rotina: {} }, { merge: true }));
    await assertFails(setDoc(doc(ctxEstranho(), 'alunos', ESTRANHO), { rotina: {} }));
  });
  it('Personal escreve e apaga', async () => {
    await assertSucceeds(setDoc(doc(ctxPT(), 'alunos', 'novo@x.com'), { perfilAluno: {} }));
    await assertSucceeds(deleteDoc(doc(ctxPT(), 'alunos', 'novo@x.com')));
  });
});

describe('/alunos/{email}/avaliacoesFisicas — o aluno só CRIA a própria avaliação online', () => {
  const col = (db: ReturnType<typeof ctxA>, email: string) => collection(db, 'alunos', email, 'avaliacoesFisicas');
  const ref = (db: ReturnType<typeof ctxA>, email: string, id: string) => doc(db, 'alunos', email, 'avaliacoesFisicas', id);

  it('leitura: aluno lê só as próprias; Personal lê todas', async () => {
    await assertSucceeds(getDocs(col(ctxA(), ALUNO_A)));
    await assertSucceeds(getDoc(ref(ctxA(), ALUNO_A, 'af-existente')));
    await assertFails(getDocs(col(ctxA(), ALUNO_B)));
    await assertFails(getDoc(ref(ctxA(), ALUNO_B, 'af-b')));
    await assertSucceeds(getDocs(col(ctxPT(), ALUNO_B)));
  });

  it('create válido do aluno no próprio caminho', async () => {
    await assertSucceeds(setDoc(ref(ctxA(), ALUNO_A, 'af-novo'), avaliacaoOnline('af-novo')));
  });
  it('create válido sem campos opcionais (notes/questionnaire)', async () => {
    const { questionnaire, ...semOpcionais } = avaliacaoOnline('af-min');
    void questionnaire;
    await assertSucceeds(setDoc(ref(ctxA(), ALUNO_A, 'af-min'), semOpcionais));
  });
  it('T2: aluno NÃO cria no caminho de outro aluno', async () => {
    await assertFails(setDoc(ref(ctxA(), ALUNO_B, 'af-x'), avaliacaoOnline('af-x')));
  });
  it('conta Google NÃO cadastrada não cria avaliação nem no próprio caminho', async () => {
    await assertFails(setDoc(ref(ctxEstranho(), ESTRANHO, 'af-s'), avaliacaoOnline('af-s')));
  });
  it('T3: submittedBy diferente de "aluno" é recusado', async () => {
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-p'), avaliacaoOnline('af-p', { submittedBy: 'personal' })));
  });
  it('protocolo diferente de "online" é recusado', async () => {
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-d'), avaliacaoOnline('af-d', { protocol: 'skinfold' })));
  });
  it('T5: avaliação já "revisada" / com review forjado / evaluator é recusada', async () => {
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-r1'), avaliacaoOnline('af-r1', { status: 'revisada' })));
    await assertFails(
      setDoc(ref(ctxA(), ALUNO_A, 'af-r2'), avaliacaoOnline('af-r2', { review: { reviewedBy: PT, reviewedAt: '2026-10-02T00:00:00Z' } }))
    );
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-r3'), avaliacaoOnline('af-r3', { evaluator: PT })));
  });
  it('T7: campo id diferente do id do documento é recusado (IDOR interno)', async () => {
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-doc'), avaliacaoOnline('af-existente')));
  });
  it('T6: campos extras, tipos errados e faixas absurdas são recusados', async () => {
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-e1'), avaliacaoOnline('af-e1', { isAdmin: true })));
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-e2'), avaliacaoOnline('af-e2', { anthropometry: null })));
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-e3'), avaliacaoOnline('af-e3', { anthropometry: { peso: '80', altura: 180, imc: 24 } })));
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-e4'), avaliacaoOnline('af-e4', { anthropometry: { peso: 1e9, altura: 180, imc: 24 } })));
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-e5'), avaliacaoOnline('af-e5', { circumferences: 'x' })));
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-e6'), avaliacaoOnline('af-e6', { results: { percentualGordura: 1 } })));
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-e7'), avaliacaoOnline('af-e7', { notes: 'x'.repeat(5001) })));
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-e8'), avaliacaoOnline('af-e8', { alunoId: 123 })));
  });
  it('T8: aluno NÃO altera nem apaga avaliação existente (setDoc sobre id existente vira update)', async () => {
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'af-existente'), avaliacaoOnline('af-existente', { status: 'enviada' })));
    await assertFails(updateDoc(ref(ctxA(), ALUNO_A, 'af-existente'), { status: 'revisada' }));
    await assertFails(deleteDoc(ref(ctxA(), ALUNO_A, 'af-existente')));
  });
  it('T11: e-mail não verificado não cria avaliação', async () => {
    await assertFails(setDoc(ref(ctxFalsoA(), ALUNO_A, 'af-f'), avaliacaoOnline('af-f')));
  });
  it('Personal cria (qualquer protocolo/campos), atualiza e apaga', async () => {
    await assertSucceeds(setDoc(ref(ctxPT(), ALUNO_A, 'af-pt'), { ...avaliacaoOnline('af-pt'), protocol: 'skinfold', evaluator: PT }));
    await assertSucceeds(updateDoc(ref(ctxPT(), ALUNO_A, 'af-existente'), { status: 'revisada' }));
    await assertSucceeds(deleteDoc(ref(ctxPT(), ALUNO_A, 'af-pt')));
  });
  it('listagem ordenada por data (como o app) funciona para o dono', async () => {
    await assertSucceeds(getDocs(query(col(ctxA(), ALUNO_A), orderBy('date', 'desc'))));
  });
});

describe('/alunos/{email}/anotacoes — prontuário só do Personal', () => {
  const ref = (db: ReturnType<typeof ctxA>, id: string) => doc(db, 'alunos', ALUNO_A, 'anotacoes', id);
  it('aluno NÃO lê (mesmo as do próprio caminho), nem escreve, nem lista', async () => {
    await assertFails(getDoc(ref(ctxA(), 'n1')));
    await assertFails(getDocs(collection(ctxA(), 'alunos', ALUNO_A, 'anotacoes')));
    await assertFails(setDoc(ref(ctxA(), 'n2'), { alunoId: 'x', conteudo: 'oi' }));
  });
  it('Personal lê, cria, atualiza, apaga; limite de tamanho vale', async () => {
    await assertSucceeds(getDoc(ref(ctxPT(), 'n1')));
    await assertSucceeds(setDoc(ref(ctxPT(), 'n3'), { alunoId: 'x', conteudo: 'ok' }));
    await assertSucceeds(updateDoc(ref(ctxPT(), 'n3'), { conteudo: 'novo' }));
    await assertFails(setDoc(ref(ctxPT(), 'n4'), { alunoId: 'x', conteudo: 'x'.repeat(200001) }));
    await assertFails(setDoc(ref(ctxPT(), 'n5'), { alunoId: 5, conteudo: 'ok' }));
    await assertSucceeds(deleteDoc(ref(ctxPT(), 'n3')));
  });
});

const rotina = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  nome: 'Hipertrofia A',
  rotina: Array.from({ length: 7 }, () => ({ tipo: 'Descanso Total', exercicios: [] })),
  ativa: false,
  criadaEm: '2026-10-05T12:00:00.000Z',
  atualizadaEm: '2026-10-05T12:00:00.000Z',
  personalEmail: PT,
  ...extra,
});

describe('/alunos/{email}/rotinas — só o Personal escreve; aluno lê as próprias', () => {
  const ref = (c: ReturnType<typeof ctxPT>, email: string, id: string) => doc(c, 'alunos', email, 'rotinas', id);

  it('Personal cria rotina válida com o próprio personalEmail', async () => {
    await assertSucceeds(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1')));
  });
  it('Personal NÃO forja personalEmail de outro na criação, nem grava campo extra/estrutura inválida', async () => {
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1', { personalEmail: 'outro@x.com' })));
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1', { extra: 1 })));
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1', { rotina: [] })));
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('outro-id')));
  });
  it('aluno não escreve nem na própria subcoleção', async () => {
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'r1'), rotina('r1', { personalEmail: ALUNO_A })));
  });
  it('aluno lê as próprias rotinas, não as de outro; estranho e anônimo não leem', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'alunos', ALUNO_A, 'rotinas', 'r1'), rotina('r1'));
    });
    await assertSucceeds(getDoc(ref(ctxA(), ALUNO_A, 'r1')));
    await assertSucceeds(getDocs(collection(ctxA(), 'alunos', ALUNO_A, 'rotinas')));
    await assertFails(getDoc(ref(ctxB(), ALUNO_A, 'r1')));
    await assertFails(getDoc(ref(ctxEstranho(), ALUNO_A, 'r1')));
    await assertFails(getDoc(ref(ctxAnon(), ALUNO_A, 'r1')));
  });
  it('Personal atualiza (ativa) e exclui; aluno não', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'alunos', ALUNO_A, 'rotinas', 'r1'), rotina('r1'));
    });
    await assertFails(updateDoc(ref(ctxA(), ALUNO_A, 'r1'), { ativa: true }));
    await assertSucceeds(updateDoc(ref(ctxPT(), ALUNO_A, 'r1'), { ativa: true, atualizadaEm: '2026-10-06T00:00:00.000Z' }));
    await assertFails(deleteDoc(ref(ctxA(), ALUNO_A, 'r1')));
    await assertSucceeds(deleteDoc(ref(ctxPT(), ALUNO_A, 'r1')));
  });
});

describe('/notificacoesTreinos — aluno cadastrado só cria a própria', () => {
  const ref = (db: ReturnType<typeof ctxA>, id: string) => doc(db, 'notificacoesTreinos', id);
  it('aluno cadastrado cria a própria', async () => {
    await assertSucceeds(setDoc(ref(ctxA(), 'a_x_com_2026-10-02_2'), notificacao('a_x_com_2026-10-02_2')));
  });
  it('T9: conta Google NÃO cadastrada não cria (spam)', async () => {
    await assertFails(setDoc(ref(ctxEstranho(), 's1'), notificacao('s1', { alunoEmail: ESTRANHO })));
  });
  it('spoofing: alunoEmail de outra pessoa é recusado', async () => {
    await assertFails(setDoc(ref(ctxA(), 'n-spoof'), notificacao('n-spoof', { alunoEmail: ALUNO_B })));
    await assertFails(setDoc(ref(ctxB(), 'n-spoof2'), notificacao('n-spoof2', { alunoEmail: ALUNO_A })));
  });
  it('lida=true, id divergente, campos extras e tipos errados são recusados', async () => {
    await assertFails(setDoc(ref(ctxA(), 'n1x'), notificacao('n1x', { lida: true })));
    await assertFails(setDoc(ref(ctxA(), 'n2x'), notificacao('outro-id')));
    await assertFails(setDoc(ref(ctxA(), 'n3x'), notificacao('n3x', { extra: 1 })));
    await assertFails(setDoc(ref(ctxA(), 'n4x'), notificacao('n4x', { dia: 'terça' })));
    await assertFails(setDoc(ref(ctxA(), 'n5x'), notificacao('n5x', { alunoNome: 'x'.repeat(121) })));
  });
  it('aluno não lê, não atualiza e não apaga (nem a própria); regravar o mesmo id é negado', async () => {
    await assertFails(getDoc(ref(ctxA(), 'n-existente')));
    await assertFails(updateDoc(ref(ctxA(), 'n-existente'), { lida: true }));
    await assertFails(deleteDoc(ref(ctxA(), 'n-existente')));
    await assertFails(setDoc(ref(ctxA(), 'n-existente'), notificacao('n-existente')));
  });
  it('e-mail não verificado não cria', async () => {
    await assertFails(setDoc(ref(ctxFalsoA(), 'n-f'), notificacao('n-f')));
  });
  it('Personal lê o feed (orderBy criadaEm, limit 50), marca lida e apaga', async () => {
    await assertSucceeds(getDocs(query(collection(ctxPT(), 'notificacoesTreinos'), orderBy('criadaEm', 'desc'), limit(50))));
    await assertSucceeds(updateDoc(ref(ctxPT(), 'n-existente'), { lida: true }));
    await assertSucceeds(deleteDoc(ref(ctxPT(), 'n-existente')));
  });
  it('aluno não lê o feed', async () => {
    await assertFails(getDocs(query(collection(ctxA(), 'notificacoesTreinos'), orderBy('criadaEm', 'desc'), limit(50))));
  });
});

describe('/backups/{email} — cada usuário só no próprio', () => {
  it('dono lê e escreve', async () => {
    await assertSucceeds(getDoc(doc(ctxA(), 'backups', ALUNO_A)));
    await assertSucceeds(setDoc(doc(ctxA(), 'backups', ALUNO_A), { workout: { x: 1 } }));
  });
  it('outro aluno, estranho e até o Personal NÃO acessam o backup alheio', async () => {
    await assertFails(getDoc(doc(ctxB(), 'backups', ALUNO_A)));
    await assertFails(setDoc(doc(ctxB(), 'backups', ALUNO_A), { workout: {} }));
    await assertFails(getDoc(doc(ctxEstranho(), 'backups', ALUNO_A)));
    await assertFails(getDoc(doc(ctxPT(), 'backups', ALUNO_A)));
  });
  it('o Personal usa o próprio backup', async () => {
    await assertSucceeds(setDoc(doc(ctxPT(), 'backups', PT), { workout: {} }));
    await assertSucceeds(getDoc(doc(ctxPT(), 'backups', PT)));
  });
});

describe('default deny', () => {
  it('coleções não previstas são negadas, inclusive para o Personal', async () => {
    await assertFails(setDoc(doc(ctxPT(), 'qualquer', 'coisa'), { x: 1 }));
    await assertFails(getDoc(doc(ctxA(), 'users', 'a')));
    await assertFails(getDoc(doc(ctxA(), 'alunos', ALUNO_A, 'outra', 'x')));
  });
});
