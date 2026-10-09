#!/usr/bin/env node
/**
 * MIGRAÇÃO ÚNICA (Admin SDK) — carimba o ownerUUID nos clientes e notificações criados antes do
 * modelo de ownership. RODE ANTES de publicar `aceitarLegadoSemDono() { return false; }`
 * (firestore.rules): depois disso, cliente sem ownerUUID fica inacessível ao Personal.
 *
 * Uso (dry-run por padrão: só mostra o que faria):
 *   npm i --no-save firebase-admin
 *   export GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account.json
 *   node scripts/migrar-legados-ownership.mjs --owner-email joelgouveia16@gmail.com
 *   node scripts/migrar-legados-ownership.mjs --owner-email joelgouveia16@gmail.com --apply
 *
 * Opções:
 *   --owner-email <e-mail>   Personal dono de TODOS os legados (obrigatório, salvo se --map cobrir todos).
 *   --map <arquivo.json>     { "aluno@x.com": "personal@x.com", ... } — dono por cliente (sobrepõe --owner-email).
 *   --apply                  grava de verdade (sem isso é dry-run).
 *
 * Pré-requisito: cada Personal citado já entrou UMA vez no app com o ownerUUID (cria userOwners/{uid}).
 * O script NUNCA cria userOwners/ownerUUIDs, nunca troca ownerUUID existente e só escreve o campo `ownerUUID`.
 * Fase 2: notificacoesTreinos sem ownerUUID recebem o ownerUUID do cliente (alunos/{alunoEmail}),
 * para continuarem visíveis ao Personal dono depois das Rules novas.
 */
import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const apply = args.includes('--apply');
const ownerEmail = opt('--owner-email')?.toLowerCase();
const mapa = opt('--map') ? JSON.parse(readFileSync(opt('--map'), 'utf8')) : {};

if (!ownerEmail && !Object.keys(mapa).length) {
  console.error('Informe --owner-email <personal> e/ou --map <arquivo.json>.');
  process.exit(2);
}

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const cacheOwner = new Map(); // e-mail do Personal -> ownerUUID
async function ownerUUIDDe(email) {
  const e = email.toLowerCase();
  if (cacheOwner.has(e)) return cacheOwner.get(e);
  const user = await auth.getUserByEmail(e); // lança se a conta não existe
  const snap = await db.doc(`userOwners/${user.uid}`).get();
  const uuid = snap.exists ? snap.get('ownerUUID') : undefined;
  if (!UUID_V4.test(uuid ?? '')) throw new Error(`${e} ainda não tem ownerUUID (entre uma vez no app novo com essa conta).`);
  cacheOwner.set(e, uuid);
  return uuid;
}

let erros = 0;
const plano = [];

// ---- Fase 1: alunos sem ownerUUID ----
const alunos = await db.collection('alunos').select('ownerUUID').get();
const donoDoAluno = new Map(); // docId -> ownerUUID (existente ou planejado)
for (const d of alunos.docs) {
  const atual = d.get('ownerUUID');
  if (UUID_V4.test(atual ?? '')) { donoDoAluno.set(d.id, atual); continue; }
  if (atual !== undefined) { console.warn(`! ${d.id}: ownerUUID presente mas inválido (${JSON.stringify(atual)}) — ignorado, corrija à mão.`); erros++; continue; }
  const dono = (mapa[d.id] ?? ownerEmail)?.toLowerCase();
  if (!dono) { console.warn(`! ${d.id}: sem dono definido (use --owner-email ou --map).`); erros++; continue; }
  try {
    const uuid = await ownerUUIDDe(dono);
    plano.push({ ref: d.ref, uuid, rotulo: `alunos/${d.id} -> ${dono}` });
    donoDoAluno.set(d.id, uuid);
  } catch (e) { console.warn(`! ${d.id}: ${e.message}`); erros++; }
}

// ---- Fase 2: notificacoesTreinos sem ownerUUID ----
const notifs = await db.collection('notificacoesTreinos').select('ownerUUID', 'alunoEmail').get();
for (const d of notifs.docs) {
  if (d.get('ownerUUID') !== undefined) continue;
  const uuid = donoDoAluno.get(String(d.get('alunoEmail') ?? '').toLowerCase());
  if (!uuid) { console.warn(`! notificacoesTreinos/${d.id}: cliente sem dono conhecido — ficará ilegível (apague se quiser).`); continue; }
  plano.push({ ref: d.ref, uuid, rotulo: `notificacoesTreinos/${d.id}` });
}

console.log(`${apply ? 'APLICANDO' : 'DRY-RUN'}: ${plano.length} documento(s) a carimbar, ${erros} pendência(s).`);
for (const p of plano) console.log(' ', p.rotulo, p.uuid);

if (apply) {
  for (let i = 0; i < plano.length; i += 400) {
    const batch = db.batch();
    for (const p of plano.slice(i, i + 400)) batch.update(p.ref, { ownerUUID: p.uuid }); // update: nunca cria doc
    await batch.commit();
  }
  console.log('Concluído.');
} else {
  console.log('Nada foi gravado. Rode de novo com --apply.');
}
process.exit(erros ? 1 : 0);
