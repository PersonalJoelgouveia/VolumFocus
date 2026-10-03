import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

/** Testes das Storage Rules (T10). Rodar com o Emulator: ver rules-tests/LEIA-ME.md. */
let env: RulesTestEnvironment;

const storagePT = () => env.authenticatedContext('uid-pt', { email: 'joelgouveia16@gmail.com', email_verified: true }).storage();
const storageAluno = () => env.authenticatedContext('uid-a', { email: 'a@x.com', email_verified: true }).storage();
const storageEstranho = () => env.authenticatedContext('uid-s', { email: 's@x.com', email_verified: true }).storage();
const storageFalsoPT = () => env.authenticatedContext('uid-x', { email: 'joelgouveia16@gmail.com', email_verified: false }).storage();
const storageAnon = () => env.unauthenticatedContext().storage();

const jpeg = { contentType: 'image/jpeg' };
const bytes = (n: number) => new Uint8Array(n);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'volumfocus-rules-test',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), 'exercicios/e1/inicio.jpg'), bytes(10), jpeg);
  });
});
afterAll(async () => {
  await env.cleanup();
});

describe('Storage exercicios/** — leitura pública, escrita só do Personal', () => {
  it('qualquer um (até anônimo) lê imagem de exercício', async () => {
    await assertSucceeds(getBytes(ref(storageAnon(), 'exercicios/e1/inicio.jpg')));
  });
  it('Personal envia imagem (< 5 MB, image/*) e apaga', async () => {
    await assertSucceeds(uploadBytes(ref(storagePT(), 'exercicios/e2/inicio.jpg'), bytes(100), jpeg));
    await assertSucceeds(deleteObject(ref(storagePT(), 'exercicios/e2/inicio.jpg')));
  });
  it('T10: aluno e conta Google qualquer NÃO escrevem nem apagam', async () => {
    await assertFails(uploadBytes(ref(storageAluno(), 'exercicios/e1/inicio.jpg'), bytes(100), jpeg));
    await assertFails(uploadBytes(ref(storageEstranho(), 'exercicios/e9/novo.jpg'), bytes(100), jpeg));
    await assertFails(deleteObject(ref(storageAluno(), 'exercicios/e1/inicio.jpg')));
    await assertFails(uploadBytes(ref(storageAnon(), 'exercicios/e9/novo.jpg'), bytes(100), jpeg));
  });
  it('Personal com e-mail NÃO verificado não escreve', async () => {
    await assertFails(uploadBytes(ref(storageFalsoPT(), 'exercicios/e3/x.jpg'), bytes(100), jpeg));
  });
  it('Personal: tamanho e tipo de conteúdo são validados', async () => {
    await assertFails(uploadBytes(ref(storagePT(), 'exercicios/e4/grande.jpg'), bytes(5 * 1024 * 1024 + 1), jpeg));
    await assertFails(uploadBytes(ref(storagePT(), 'exercicios/e4/texto.jpg'), bytes(100), { contentType: 'text/html' }));
  });
  it('caminhos fora de exercicios/** são negados (leitura e escrita), inclusive para o Personal', async () => {
    await assertFails(uploadBytes(ref(storagePT(), 'outros/x.jpg'), bytes(10), jpeg));
    await assertFails(getBytes(ref(storagePT(), 'outros/x.jpg')));
  });
});
