import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * Testes das Security Rules do Firestore (ataques da auditoria P5).
 * Rodar com o Emulator: ver rules-tests/LEIA-ME.md.
 */
let env: RulesTestEnvironment;

const PT = 'joelgouveia16@gmail.com'; // Personal A  (uid-pt,  ownerUUID = UUID_A)
const PT2 = 'personaljoelgouveia@gmail.com'; // Personal B (uid-pt2, ownerUUID = UUID_B)
const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UUID_N = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ALUNO_A = 'a@x.com';
const ALUNO_B = 'b@x.com';
const ESTRANHO = 's@x.com'; // conta Google qualquer, NÃO cadastrada
const ALUNO_C = 'c@x.com'; // cliente do Personal B
const ALUNO_L = 'legado@x.com'; // cliente antigo, SEM ownerUUID (pré-ownership)

const ctxPT = () => env.authenticatedContext('uid-pt', { email: PT, email_verified: true }).firestore();
const ctxPT2 = () => env.authenticatedContext('uid-pt2', { email: PT2, email_verified: true }).firestore();
/** Personal autêntico, mas cuja conta ainda não tem vínculo userOwners. */
const ctxPTSemVinculo = () => env.authenticatedContext('uid-pt-solto', { email: PT, email_verified: true }).firestore();
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
    // ownership: Personal A (UUID_A) e Personal B (UUID_B) com vínculo + índice reverso.
    await setDoc(doc(db, 'userOwners', 'uid-pt'), { ownerUUID: UUID_A, createdAt: new Date() });
    await setDoc(doc(db, 'ownerUUIDs', UUID_A), { uid: 'uid-pt', createdAt: new Date() });
    await setDoc(doc(db, 'userOwners', 'uid-pt2'), { ownerUUID: UUID_B, createdAt: new Date() });
    await setDoc(doc(db, 'ownerUUIDs', UUID_B), { uid: 'uid-pt2', createdAt: new Date() });
    // A e B são clientes do Personal A; C é cliente do Personal B; L é legado (sem dono).
    await setDoc(doc(db, 'alunos', ALUNO_A), { perfilAluno: { nome: 'A' }, rotina: {}, ownerUUID: UUID_A });
    await setDoc(doc(db, 'alunos', ALUNO_B), { perfilAluno: { nome: 'B' }, rotina: {}, ownerUUID: UUID_A });
    await setDoc(doc(db, 'alunos', ALUNO_C), { perfilAluno: { nome: 'C' }, rotina: {}, ownerUUID: UUID_B });
    await setDoc(doc(db, 'alunos', ALUNO_L), { perfilAluno: { nome: 'L' }, rotina: {} });
    await setDoc(doc(db, 'alunos', ALUNO_A, 'avaliacoesFisicas', 'af-existente'), avaliacaoOnline('af-existente'));
    await setDoc(doc(db, 'alunos', ALUNO_B, 'avaliacoesFisicas', 'af-b'), avaliacaoOnline('af-b'));
    await setDoc(doc(db, 'alunos', ALUNO_A, 'anotacoes', 'n1'), { alunoId: 'x', conteudo: 'privado do Personal' });
    await setDoc(doc(db, 'backups', ALUNO_A), { workout: {} });
    await setDoc(doc(db, 'backups', ALUNO_B), { workout: {} });
    await setDoc(doc(db, 'notificacoesTreinos', 'n-existente'), notificacao('n-existente'));
  });
});

describe('/alunos/{email} — leitura cruzada, spoofing e enumeração', () => {
  it('Personal lê os PRÓPRIOS clientes; ninguém lista a coleção (nem o Personal)', async () => {
    await assertSucceeds(getDoc(doc(ctxPT(), 'alunos', ALUNO_A)));
    await assertFails(getDocs(collection(ctxPT(), 'alunos')));
    await assertFails(getDocs(query(collection(ctxPT(), 'alunos'), where('ownerUUID', '==', UUID_A))));
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
  it('Personal escreve e apaga (cliente novo carimbado com o próprio ownerUUID)', async () => {
    await assertSucceeds(setDoc(doc(ctxPT(), 'alunos', 'novo@x.com'), { perfilAluno: {}, ownerUUID: UUID_A }));
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

const nota = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  alunoId: 'x',
  alunoNome: 'Aluno A',
  conteudo: 'ok',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  authorId: PT,
  ...extra,
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
    await assertSucceeds(setDoc(ref(ctxPT(), 'n3'), nota('n3')));
    await assertSucceeds(updateDoc(ref(ctxPT(), 'n3'), { conteudo: 'novo' }));
    await assertFails(setDoc(ref(ctxPT(), 'n4'), nota('n4', { conteudo: 'x'.repeat(200001) })));
    await assertFails(setDoc(ref(ctxPT(), 'n5'), nota('n5', { alunoId: 5 })));
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

describe('/alunos/{email}/rotinas — só o Personal escreve; aluno lê as próprias; sem delete', () => {
  const ref = (c: ReturnType<typeof ctxPT>, email: string, id: string) => doc(c, 'alunos', email, 'rotinas', id);
  const semear = async (id = 'r1', extra: Record<string, unknown> = {}, email = ALUNO_A) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'alunos', email, 'rotinas', id), rotina(id, extra));
    });

  it('PT cria rotina válida para aluno cadastrado, com o próprio personalEmail', async () => {
    await assertSucceeds(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1')));
  });
  it('PT NÃO cria para e-mail sem cadastro, nem forja autoria, nem foge do formato', async () => {
    await assertFails(setDoc(ref(ctxPT(), 'fantasma@x.com', 'r1'), rotina('r1')));
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1', { personalEmail: 'outro@x.com' })));
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1', { extra: 1 })));
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1', { rotina: [] })));
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1', { ativa: 'sim' })));
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('r1', { nome: '' })));
    await assertFails(setDoc(ref(ctxPT(), ALUNO_A, 'r1'), rotina('outro-id')));
  });
  it('PT ativa/desativa e edita; id, criadaEm e personalEmail são imutáveis', async () => {
    await semear('r1', { personalEmail: 'personaljoelgouveia@gmail.com' });
    await assertSucceeds(updateDoc(ref(ctxPT(), ALUNO_A, 'r1'), { ativa: true, atualizadaEm: '2026-10-06T00:00:00.000Z' }));
    await assertSucceeds(updateDoc(ref(ctxPT(), ALUNO_A, 'r1'), { nome: 'Novo nome' }));
    await assertFails(updateDoc(ref(ctxPT(), ALUNO_A, 'r1'), { personalEmail: PT }));
    await assertFails(updateDoc(ref(ctxPT(), ALUNO_A, 'r1'), { criadaEm: '2020-01-01T00:00:00.000Z' }));
    await assertFails(updateDoc(ref(ctxPT(), ALUNO_A, 'r1'), { id: 'r2' }));
    await assertFails(updateDoc(ref(ctxPT(), ALUNO_A, 'r1'), { rotina: [] }));
  });
  it('aluno lê (get/list) só as próprias', async () => {
    await semear('r1');
    await semear('rb', {}, ALUNO_B);
    await assertSucceeds(getDoc(ref(ctxA(), ALUNO_A, 'r1')));
    await assertSucceeds(getDocs(collection(ctxA(), 'alunos', ALUNO_A, 'rotinas')));
    await assertFails(getDoc(ref(ctxA(), ALUNO_B, 'rb')));
    await assertFails(getDocs(collection(ctxA(), 'alunos', ALUNO_B, 'rotinas')));
    await assertFails(getDoc(ref(ctxB(), ALUNO_A, 'r1')));
  });
  it('estranho, anônimo e e-mail NÃO verificado não leem', async () => {
    await semear('r1');
    await assertFails(getDoc(ref(ctxEstranho(), ALUNO_A, 'r1')));
    await assertFails(getDoc(ref(ctxAnon(), ALUNO_A, 'r1')));
    await assertFails(getDoc(ref(ctxFalsoA(), ALUNO_A, 'r1')));
    await assertFails(getDocs(collection(ctxFalsoA(), 'alunos', ALUNO_A, 'rotinas')));
  });
  it('aluno NÃO cria, NÃO altera (nem `ativa`) e NÃO apaga — nem na própria subcoleção', async () => {
    await semear('r1');
    await assertFails(setDoc(ref(ctxA(), ALUNO_A, 'novo'), rotina('novo', { personalEmail: ALUNO_A })));
    await assertFails(updateDoc(ref(ctxA(), ALUNO_A, 'r1'), { ativa: true }));
    await assertFails(updateDoc(ref(ctxA(), ALUNO_A, 'r1'), { nome: 'minha' }));
    await assertFails(deleteDoc(ref(ctxA(), ALUNO_A, 'r1')));
    await assertFails(setDoc(ref(ctxB(), ALUNO_A, 'r1'), rotina('r1')));
  });
  it('ninguém apaga, nem o Personal (histórico preservado)', async () => {
    await semear('r1');
    await assertFails(deleteDoc(ref(ctxPT(), ALUNO_A, 'r1')));
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

describe('ownership — Personal só acessa clientes do próprio contexto (alunos/{email})', () => {
  const av = (db: ReturnType<typeof ctxA>, email: string, id: string) => doc(db, 'alunos', email, 'avaliacoesFisicas', id);
  const ro = (db: ReturnType<typeof ctxA>, email: string, id: string) => doc(db, 'alunos', email, 'rotinas', id);
  const an = (db: ReturnType<typeof ctxA>, email: string, id: string) => doc(db, 'alunos', email, 'anotacoes', id);

  it('Usuário A → Cliente A permitido; Usuário A → Cliente do B negado (e vice-versa)', async () => {
    await assertSucceeds(getDoc(doc(ctxPT(), 'alunos', ALUNO_A)));
    await assertFails(getDoc(doc(ctxPT(), 'alunos', ALUNO_C)));
    await assertSucceeds(getDoc(doc(ctxPT2(), 'alunos', ALUNO_C)));
    await assertFails(getDoc(doc(ctxPT2(), 'alunos', ALUNO_A)));
  });
  it('acesso direto por conhecer o document ID: leitura, escrita e delete do cliente alheio negados', async () => {
    await assertFails(getDoc(doc(ctxPT2(), 'alunos', ALUNO_A)));
    await assertFails(setDoc(doc(ctxPT2(), 'alunos', ALUNO_A), { rotina: { x: 1 } }, { merge: true }));
    await assertFails(setDoc(doc(ctxPT2(), 'alunos', ALUNO_A), { rotina: { x: 1 }, ownerUUID: UUID_B }, { merge: true }));
    await assertFails(updateDoc(doc(ctxPT2(), 'alunos', ALUNO_A), { rotina: { x: 1 } }));
    await assertFails(deleteDoc(doc(ctxPT2(), 'alunos', ALUNO_A)));
  });
  it('subcoleções do cliente alheio (avaliações, rotinas, anotações) negadas: ler, criar, editar, apagar', async () => {
    await assertFails(getDoc(av(ctxPT2(), ALUNO_A, 'af-existente')));
    await assertFails(getDocs(collection(ctxPT2(), 'alunos', ALUNO_A, 'avaliacoesFisicas')));
    await assertFails(setDoc(av(ctxPT2(), ALUNO_A, 'af-x'), avaliacaoOnline('af-x')));
    await assertFails(updateDoc(av(ctxPT2(), ALUNO_A, 'af-existente'), { status: 'revisada' }));
    await assertFails(deleteDoc(av(ctxPT2(), ALUNO_A, 'af-existente')));
    await assertFails(getDoc(an(ctxPT2(), ALUNO_A, 'n1')));
    await assertFails(setDoc(an(ctxPT2(), ALUNO_A, 'n9'), nota('n9', { authorId: PT2 })));
    await assertFails(setDoc(ro(ctxPT2(), ALUNO_A, 'r1'), rotina('r1', { personalEmail: PT2 })));
    await assertFails(getDocs(collection(ctxPT2(), 'alunos', ALUNO_A, 'rotinas')));
    // e o próprio dono segue normal nas mesmas subcoleções
    await assertSucceeds(getDoc(av(ctxPT(), ALUNO_A, 'af-existente')));
    await assertSucceeds(getDoc(an(ctxPT(), ALUNO_A, 'n1')));
    await assertSucceeds(setDoc(ro(ctxPT(), ALUNO_A, 'r1'), rotina('r1')));
  });
  it('criar cliente atribuído a OUTRO dono é negado; sem ownerUUID, com ownerId, ou UUID inválido também', async () => {
    await assertFails(setDoc(doc(ctxPT(), 'alunos', 'x1@x.com'), { perfilAluno: {}, ownerUUID: UUID_B }));
    await assertFails(setDoc(doc(ctxPT(), 'alunos', 'x2@x.com'), { perfilAluno: {} }));
    await assertFails(setDoc(doc(ctxPT(), 'alunos', 'x3@x.com'), { perfilAluno: {}, ownerUUID: UUID_A, ownerId: 'uid-pt' }));
    await assertFails(setDoc(doc(ctxPT(), 'alunos', 'x4@x.com'), { perfilAluno: {}, ownerUUID: 'joel@x.com' }));
    await assertFails(setDoc(doc(ctxPT(), 'alunos', 'x5@x.com'), { perfilAluno: {}, ownerUUID: UUID_N })); // UUID que não é meu
    await assertSucceeds(setDoc(doc(ctxPT(), 'alunos', 'x6@x.com'), { perfilAluno: {}, ownerUUID: UUID_A }));
  });
  it('Personal sem vínculo userOwners não cria cliente nem com um UUID plausível', async () => {
    await assertFails(setDoc(doc(ctxPTSemVinculo(), 'alunos', 'y1@x.com'), { perfilAluno: {}, ownerUUID: UUID_A }));
    await assertFails(setDoc(doc(ctxPTSemVinculo(), 'alunos', 'y2@x.com'), { perfilAluno: {}, ownerUUID: UUID_N }));
  });
  it('alterar ownerUUID / ownerId do próprio cliente (DevTools) é negado; publicar normal passa', async () => {
    const ref = () => doc(ctxPT(), 'alunos', ALUNO_A);
    await assertFails(updateDoc(ref(), { ownerUUID: UUID_B })); // entregar a outro dono
    await assertFails(setDoc(ref(), { ownerUUID: UUID_B }, { merge: true }));
    await assertFails(updateDoc(ref(), { ownerUUID: deleteField() })); // virar "sem dono"
    await assertFails(updateDoc(ref(), { ownerId: 'uid-pt2' }));
    await assertFails(setDoc(ref(), { perfilAluno: { nome: 'A' }, ownerUUID: UUID_N })); // sobrescrita total
    await assertSucceeds(setDoc(ref(), { rotina: { ok: 1 }, ownerUUID: UUID_A }, { merge: true })); // fluxo do app
    await assertSucceeds(updateDoc(ref(), { rotina: { ok: 2 } }));
  });
  it('Personal B não "assume" cliente do A (nem trocando ownerUUID p/ o dele, nem p/ o de A)', async () => {
    await assertFails(updateDoc(doc(ctxPT2(), 'alunos', ALUNO_A), { ownerUUID: UUID_B }));
    await assertFails(updateDoc(doc(ctxPT2(), 'alunos', ALUNO_A), { ownerUUID: UUID_A }));
    await assertFails(setDoc(doc(ctxPT2(), 'alunos', ALUNO_A), { ownerUUID: UUID_B, perfilAluno: {} }));
  });
  it('aluno: lê só o próprio doc (que carrega o ownerUUID); não lê cliente alheio nem escreve dono', async () => {
    await assertSucceeds(getDoc(doc(ctxA(), 'alunos', ALUNO_A)));
    await assertFails(getDoc(doc(ctxA(), 'alunos', ALUNO_C)));
    await assertFails(updateDoc(doc(ctxA(), 'alunos', ALUNO_A), { ownerUUID: UUID_N }));
    await assertFails(setDoc(doc(ctxA(), 'alunos', ALUNO_A), { ownerUUID: UUID_N }, { merge: true }));
  });
  it('aluno segue lendo rotinas/avaliações próprias e enviando a avaliação online (sem regressão)', async () => {
    await assertSucceeds(getDocs(collection(ctxA(), 'alunos', ALUNO_A, 'rotinas')));
    await assertSucceeds(getDocs(collection(ctxA(), 'alunos', ALUNO_A, 'avaliacoesFisicas')));
    await assertSucceeds(setDoc(av(ctxA(), ALUNO_A, 'af-novo2'), avaliacaoOnline('af-novo2')));
  });

  describe('TRANSITÓRIO — clientes legados (sem ownerUUID)', () => {
    it('Personal reivindica um legado 1x com o PRÓPRIO UUID; depois o outro Personal perde o acesso', async () => {
      await assertSucceeds(getDoc(doc(ctxPT(), 'alunos', ALUNO_L)));
      await assertFails(updateDoc(doc(ctxPT(), 'alunos', ALUNO_L), { ownerUUID: UUID_B })); // UUID alheio
      await assertFails(updateDoc(doc(ctxPT(), 'alunos', ALUNO_L), { rotina: { x: 1 } })); // sem reivindicar
      await assertSucceeds(updateDoc(doc(ctxPT(), 'alunos', ALUNO_L), { ownerUUID: UUID_A }));
      await assertFails(getDoc(doc(ctxPT2(), 'alunos', ALUNO_L)));
      await assertFails(updateDoc(doc(ctxPT2(), 'alunos', ALUNO_L), { ownerUUID: UUID_B }));
    });
    it('subcoleções do legado seguem acessíveis ao Personal até a reivindicação', async () => {
      await assertSucceeds(setDoc(an(ctxPT(), ALUNO_L, 'n1'), nota('n1')));
    });
  });
});

describe('/userOwners e /ownerUUIDs — vínculo Auth UID → ownerUUID', () => {
  const link = (db: ReturnType<typeof ctxA>, uid: string, uuid: string) => {
    const b = writeBatch(db);
    b.set(doc(db, 'userOwners', uid), { ownerUUID: uuid, createdAt: serverTimestamp() });
    b.set(doc(db, 'ownerUUIDs', uuid), { uid, createdAt: serverTimestamp() });
    return b.commit();
  };
  it('aluno cadastrado cria o próprio vínculo (vínculo + índice juntos); lê o seu, não o dos outros', async () => {
    await assertSucceeds(link(ctxA(), 'uid-a', UUID_N));
    await assertSucceeds(getDoc(doc(ctxA(), 'userOwners', 'uid-a')));
    await assertFails(getDoc(doc(ctxA(), 'userOwners', 'uid-pt')));
    await assertFails(getDoc(doc(ctxA(), 'ownerUUIDs', UUID_A)));
    await assertFails(getDocs(collection(ctxA(), 'userOwners')));
  });
  it('vínculo é imutável: não troca para o UUID de outro, não apaga, não recria', async () => {
    await assertFails(updateDoc(doc(ctxPT(), 'userOwners', 'uid-pt'), { ownerUUID: UUID_B }));
    await assertFails(setDoc(doc(ctxPT(), 'userOwners', 'uid-pt'), { ownerUUID: UUID_B, createdAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(ctxPT(), 'userOwners', 'uid-pt')));
  });
  it('não reivindica UUID já usado; não grava vínculo sem índice (nem o inverso); UUID inválido negado', async () => {
    await assertFails(link(ctxA(), 'uid-a', UUID_B)); // índice de UUID_B já existe
    await assertFails(setDoc(doc(ctxA(), 'userOwners', 'uid-a'), { ownerUUID: UUID_N, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(ctxA(), 'ownerUUIDs', UUID_N), { uid: 'uid-a', createdAt: serverTimestamp() }));
    await assertFails(link(ctxA(), 'uid-b', UUID_N)); // vínculo de outro uid
    await assertFails(link(ctxA(), 'uid-a', 'nao-e-uuid'));
  });
  it('estranho (nem Personal nem cadastrado) e anônimo não ganham ownerUUID', async () => {
    await assertFails(link(ctxEstranho(), 'uid-s', UUID_N));
    await assertFails(link(ctxAnon(), 'uid-s', UUID_N));
  });
});

describe('etapa 4 — recursos sensíveis: Avaliação Física/Online e Anotações', () => {
  const av = (db: ReturnType<typeof ctxA>, email: string, id: string) => doc(db, 'alunos', email, 'avaliacoesFisicas', id);
  const an = (db: ReturnType<typeof ctxA>, email: string, id: string) => doc(db, 'alunos', email, 'anotacoes', id);
  const presencial = (id: string, extra: Record<string, unknown> = {}) => {
    const { submittedBy, status, questionnaire, ...base } = avaliacaoOnline(id);
    void submittedBy; void status; void questionnaire;
    return { ...base, protocol: 'skinfold', ...extra };
  };

  describe('Avaliação Física / Online', () => {
    it('Personal dono: cria, lê, atualiza (sem mexer nos imutáveis) e apaga', async () => {
      await assertSucceeds(setDoc(av(ctxPT(), ALUNO_A, 'p1'), presencial('p1')));
      await assertSucceeds(getDoc(av(ctxPT(), ALUNO_A, 'p1')));
      await assertSucceeds(updateDoc(av(ctxPT(), ALUNO_A, 'p1'), { notes: 'editado', alunoId: 'aluno-123' }));
      await assertSucceeds(deleteDoc(av(ctxPT(), ALUNO_A, 'p1')));
    });
    it('Personal NÃO-dono: nenhuma operação em avaliação alheia (nem conhecendo o ID do documento)', async () => {
      await assertFails(getDoc(av(ctxPT2(), ALUNO_A, 'af-existente')));
      await assertFails(getDocs(collection(ctxPT2(), 'alunos', ALUNO_A, 'avaliacoesFisicas')));
      await assertFails(setDoc(av(ctxPT2(), ALUNO_A, 'p2'), presencial('p2')));
      await assertFails(updateDoc(av(ctxPT2(), ALUNO_A, 'af-existente'), { notes: 'x' }));
      await assertFails(deleteDoc(av(ctxPT2(), ALUNO_A, 'af-existente')));
    });
    it('alunoId é imutável (não dá para "migrar" o registro para outro cliente)', async () => {
      await assertFails(updateDoc(av(ctxPT(), ALUNO_A, 'af-existente'), { alunoId: 'aluno-do-outro' }));
      await assertFails(setDoc(av(ctxPT(), ALUNO_A, 'af-existente'), { ...avaliacaoOnline('af-existente'), alunoId: 'outro' }));
    });
    it('submittedBy: imutável no update; valores fora de aluno|personal recusados no create', async () => {
      await assertFails(updateDoc(av(ctxPT(), ALUNO_A, 'af-existente'), { submittedBy: 'personal' }));
      await assertFails(updateDoc(av(ctxPT(), ALUNO_A, 'af-existente'), { submittedBy: deleteField() }));
      await assertSucceeds(setDoc(av(ctxPT(), ALUNO_A, 'p3'), presencial('p3')));
      await assertFails(updateDoc(av(ctxPT(), ALUNO_A, 'p3'), { submittedBy: 'aluno' })); // forjar autoria do aluno depois
      await assertFails(setDoc(av(ctxPT(), ALUNO_A, 'p4'), presencial('p4', { submittedBy: 'admin' })));
    });
    it('revisão do Personal (status/review) continua funcionando', async () => {
      await assertSucceeds(
        updateDoc(av(ctxPT(), ALUNO_A, 'af-existente'), {
          status: 'revisada',
          review: { reviewedBy: PT, reviewedAt: '2026-10-02T00:00:00Z' },
          alunoId: 'aluno-123',
          submittedBy: 'aluno',
        })
      );
    });
    it('ownerUUID/ownerId são reservados: nenhum recurso os carrega (create e update)', async () => {
      await assertFails(setDoc(av(ctxPT(), ALUNO_A, 'p5'), presencial('p5', { ownerUUID: UUID_B })));
      await assertFails(setDoc(av(ctxPT(), ALUNO_A, 'p6'), presencial('p6', { ownerId: 'uid-pt2' })));
      await assertFails(updateDoc(av(ctxPT(), ALUNO_A, 'af-existente'), { ownerUUID: UUID_B }));
      await assertFails(updateDoc(av(ctxPT(), ALUNO_A, 'af-existente'), { ownerId: 'uid-pt2' }));
      await assertFails(setDoc(av(ctxA(), ALUNO_A, 'o1'), avaliacaoOnline('o1', { ownerUUID: UUID_A })));
    });
    it('id do conteúdo diferente do id do documento é recusado no create do Personal', async () => {
      await assertFails(setDoc(av(ctxPT(), ALUNO_A, 'p7'), presencial('outro-id')));
    });
    it('Avaliação Online do aluno: submittedBy forjado negado; alunoId local do aparelho aceito; não edita depois', async () => {
      await assertFails(setDoc(av(ctxA(), ALUNO_A, 'o2'), avaliacaoOnline('o2', { submittedBy: 'personal' })));
      await assertSucceeds(setDoc(av(ctxA(), ALUNO_A, 'o3'), avaliacaoOnline('o3', { alunoId: 'id-local-do-aparelho' })));
      await assertFails(updateDoc(av(ctxA(), ALUNO_A, 'o3'), { alunoId: 'aluno-do-outro' }));
      await assertFails(updateDoc(av(ctxA(), ALUNO_A, 'o3'), { submittedBy: 'personal' }));
      await assertFails(deleteDoc(av(ctxA(), ALUNO_A, 'o3')));
    });
    it('aluno não lê/cria avaliação de outro cliente, mesmo sabendo o ID do documento', async () => {
      await assertFails(getDoc(av(ctxA(), ALUNO_B, 'af-b')));
      await assertFails(setDoc(av(ctxA(), ALUNO_B, 'o4'), avaliacaoOnline('o4')));
      await assertFails(getDoc(av(ctxB(), ALUNO_A, 'af-existente')));
    });
    it('cliente SEM doc-pai/dono: o Personal não cria avaliação em caminho órfão', async () => {
      await assertFails(setDoc(av(ctxPT(), 'fantasma@x.com', 'p8'), presencial('p8')));
    });
  });

  describe('Anotações / prontuário', () => {
    it('Personal dono: cria (autoria = e-mail do token), lê, edita conteúdo e apaga', async () => {
      await assertSucceeds(setDoc(an(ctxPT(), ALUNO_A, 'nn1'), nota('nn1')));
      await assertSucceeds(getDoc(an(ctxPT(), ALUNO_A, 'nn1')));
      await assertSucceeds(updateDoc(an(ctxPT(), ALUNO_A, 'nn1'), { conteudo: 'novo', updatedAt: '2026-10-02T00:00:00.000Z' }));
      await assertSucceeds(deleteDoc(an(ctxPT(), ALUNO_A, 'nn1')));
    });
    it('nota legada (formato antigo mínimo) continua editável pelo dono', async () => {
      await assertSucceeds(updateDoc(an(ctxPT(), ALUNO_A, 'n1'), { conteudo: 'revisado' }));
    });
    it('Personal NÃO-dono: nada (ler, listar, criar, editar, apagar)', async () => {
      await assertFails(getDoc(an(ctxPT2(), ALUNO_A, 'n1')));
      await assertFails(getDocs(collection(ctxPT2(), 'alunos', ALUNO_A, 'anotacoes')));
      await assertFails(setDoc(an(ctxPT2(), ALUNO_A, 'nn2'), nota('nn2', { authorId: PT2 })));
      await assertFails(updateDoc(an(ctxPT2(), ALUNO_A, 'n1'), { conteudo: 'x' }));
      await assertFails(deleteDoc(an(ctxPT2(), ALUNO_A, 'n1')));
    });
    it('aluno e anônimo NUNCA acessam o prontuário (nem o do próprio caminho, nem sabendo o ID)', async () => {
      await assertFails(getDoc(an(ctxA(), ALUNO_A, 'n1')));
      await assertFails(setDoc(an(ctxA(), ALUNO_A, 'nn3'), nota('nn3', { authorId: ALUNO_A })));
      await assertFails(updateDoc(an(ctxA(), ALUNO_A, 'n1'), { conteudo: 'x' }));
      await assertFails(deleteDoc(an(ctxA(), ALUNO_A, 'n1')));
      await assertFails(getDoc(an(ctxAnon(), ALUNO_A, 'n1')));
    });
    it('autoria não forjável: authorId diferente do token é recusado; alunoId/authorId/createdAt/id imutáveis', async () => {
      await assertFails(setDoc(an(ctxPT(), ALUNO_A, 'nn4'), nota('nn4', { authorId: PT2 })));
      await assertSucceeds(setDoc(an(ctxPT(), ALUNO_A, 'nn5'), nota('nn5')));
      await assertFails(updateDoc(an(ctxPT(), ALUNO_A, 'nn5'), { alunoId: 'outro-cliente' }));
      await assertFails(updateDoc(an(ctxPT(), ALUNO_A, 'nn5'), { authorId: PT2 }));
      await assertFails(updateDoc(an(ctxPT(), ALUNO_A, 'nn5'), { createdAt: '2020-01-01T00:00:00.000Z' }));
      await assertFails(updateDoc(an(ctxPT(), ALUNO_A, 'nn5'), { id: 'nn-outro' }));
    });
    it('ownerUUID/ownerId e campos desconhecidos são recusados; id do conteúdo = id do documento', async () => {
      await assertFails(setDoc(an(ctxPT(), ALUNO_A, 'nn6'), nota('nn6', { ownerUUID: UUID_B })));
      await assertFails(setDoc(an(ctxPT(), ALUNO_A, 'nn7'), nota('nn7', { ownerId: 'uid-pt2' })));
      await assertFails(setDoc(an(ctxPT(), ALUNO_A, 'nn8'), nota('nn8', { extra: 1 })));
      await assertFails(updateDoc(an(ctxPT(), ALUNO_A, 'n1'), { ownerUUID: UUID_B }));
      await assertFails(setDoc(an(ctxPT(), ALUNO_A, 'nn9'), nota('outro-id')));
    });
  });
});

describe('default deny', () => {
  it('coleções não previstas são negadas, inclusive para o Personal', async () => {
    await assertFails(setDoc(doc(ctxPT(), 'qualquer', 'coisa'), { x: 1 }));
    await assertFails(getDoc(doc(ctxA(), 'users', 'a')));
    await assertFails(getDoc(doc(ctxA(), 'alunos', ALUNO_A, 'outra', 'x')));
  });
});
