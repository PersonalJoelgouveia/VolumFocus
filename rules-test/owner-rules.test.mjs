// Testa a camada ownerUUID (etapas 1+2) contra o emulador do Firestore.
// Rodar (na raiz do repo, com firebase.json contendo {"emulators":{"firestore":{"port":8080}}}):
//   npm i -D @firebase/rules-unit-testing
//   npx firebase emulators:exec --only firestore --project demo-vf "node --test rules-test/"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

const UA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// Fixtures SÓ de teste: exercitam os helpers por path e por payload.
const FIXTURES = `
  match /t_path/{ownerUUID}/items/{id} { allow read, write: if isMyOwnerUUID(ownerUUID); }
  match /t_payload/{id} {
    allow create: if ownedCreate();
    allow read, delete: if ownedRead();
    allow update: if ownedUpdate();
  }
`;
const RULES = `rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
${readFileSync(new URL('../firestore-owner-uuid.rules', import.meta.url), 'utf8')}
${FIXTURES}
} }`;

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-vf', firestore: { rules: RULES } });
});
after(() => env.cleanup());

const ctx = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();

/** Fluxo real do app: vínculo + índice na mesma operação atômica. */
const link = (db, uid, uuid) => {
  const b = writeBatch(db);
  b.set(doc(db, 'userOwners', uid), { ownerUUID: uuid, createdAt: serverTimestamp() });
  b.set(doc(db, 'ownerUUIDs', uuid), { uid, createdAt: serverTimestamp() });
  return b.commit();
};

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    for (const e of ['a@x.com', 'b@x.com', 'c@x.com', 'e@x.com']) await setDoc(doc(d, 'alunos', e), { email: e });
  });
});

const A = () => ctx('A', 'a@x.com');
const B = () => ctx('B', 'b@x.com');

async function setupAB() {
  await assertSucceeds(link(A(), 'A', UA));
  await assertSucceeds(link(B(), 'B', UB));
}

test('cada usuário cria o próprio vínculo; relê o seu e não lê o do outro', async () => {
  await setupAB();
  await assertSucceeds(getDoc(doc(A(), 'userOwners', 'A')));
  await assertFails(getDoc(doc(A(), 'userOwners', 'B')));
  await assertFails(getDoc(doc(A(), 'ownerUUIDs', UB)));
  await assertFails(getDocs(collection(A(), 'userOwners')));
});

test('A não consegue trocar o próprio vínculo para UUID-B (imutável)', async () => {
  await setupAB();
  await assertFails(updateDoc(doc(A(), 'userOwners', 'A'), { ownerUUID: UB }));
  await assertFails(setDoc(doc(A(), 'userOwners', 'A'), { ownerUUID: UB, createdAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(A(), 'userOwners', 'A')));
});

test('C (cadastrado, sem vínculo) não consegue reivindicar o UUID-B', async () => {
  await setupAB();
  await assertFails(link(ctx('C', 'c@x.com'), 'C', UB)); // índice UB já existe
});

test('não grava vínculo sem índice, nem índice sem vínculo, nem vínculo de outro uid', async () => {
  const d = ctx('C', 'c@x.com');
  await assertFails(setDoc(doc(d, 'userOwners', 'C'), { ownerUUID: UC, createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(d, 'ownerUUIDs', UC), { uid: 'C', createdAt: serverTimestamp() }));
  await assertFails(link(d, 'B', UC)); // tentando criar vínculo do uid B
  await assertFails(link(d, 'C', 'nao-e-uuid'));
});

test('conta sem cadastro (nem PT) não ganha ownerUUID', async () => {
  await assertFails(link(ctx('Z', 'z@x.com'), 'Z', UC));
  await assertFails(link(env.unauthenticatedContext().firestore(), 'Z', UC));
});

test('payload: A cria com UUID-A; com UUID-B (DevTools) é negado', async () => {
  await setupAB();
  await assertSucceeds(setDoc(doc(A(), 't_payload', 'd1'), { ownerUUID: UA, v: 1 }));
  await assertFails(setDoc(doc(A(), 't_payload', 'd2'), { ownerUUID: UB, v: 1 }));
  await assertFails(setDoc(doc(A(), 't_payload', 'd3'), { v: 1 })); // sem campo => nega
  // ownerId/role/email no payload não concedem nada: a regra só olha ownerUUID (e ele precisa ser o meu).
  await assertFails(setDoc(doc(A(), 't_payload', 'd4'), { ownerUUID: UB, ownerId: 'A', role: 'personal' }));
});

test('payload: A não lê, edita nem apaga doc do B; não troca o dono do próprio doc', async () => {
  await setupAB();
  await assertSucceeds(setDoc(doc(B(), 't_payload', 'db'), { ownerUUID: UB, v: 1 }));
  await assertFails(getDoc(doc(A(), 't_payload', 'db')));
  await assertFails(updateDoc(doc(A(), 't_payload', 'db'), { v: 2 }));
  await assertFails(deleteDoc(doc(A(), 't_payload', 'db')));
  await assertSucceeds(setDoc(doc(A(), 't_payload', 'da'), { ownerUUID: UA, v: 1 }));
  await assertFails(updateDoc(doc(A(), 't_payload', 'da'), { ownerUUID: UB })); // entrega o doc ao B
  await assertSucceeds(updateDoc(doc(A(), 't_payload', 'da'), { v: 2 }));
  await assertSucceeds(getDoc(doc(B(), 't_payload', 'db')));
});

test('path: A escreve em /UUID-A, nunca em /UUID-B; anônimo nunca', async () => {
  await setupAB();
  await assertSucceeds(setDoc(doc(A(), 't_path', UA, 'items', '1'), { v: 1 }));
  await assertFails(setDoc(doc(A(), 't_path', UB, 'items', '1'), { v: 1 }));
  await assertFails(getDoc(doc(A(), 't_path', UB, 'items', '1')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 't_path', UA, 'items', '1')));
});

test('usuário cadastrado mas SEM vínculo não passa em nenhuma verificação de dono', async () => {
  const E = ctx('E', 'e@x.com');
  await assertFails(setDoc(doc(E, 't_payload', 'x'), { ownerUUID: UA }));
  await assertFails(setDoc(doc(E, 't_path', UA, 'items', '1'), { v: 1 }));
});
