// Testes (Emulator) do LINK PROTEGIDO do relatório (Mini 8) — NÃO executados ainda.
// Uso: firebase emulators:exec --only firestore "node relatorio.rules.test.mjs"  (ver docs/Relatorio_Link_Protegido.md)
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-vf', firestore: { rules: readFileSync('firestore.etapaC.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
const PT = 'joelgouveia16@gmail.com', PT2 = 'personaljoelgouveia@gmail.com';
const ADU = 'adulto@x.com', ADU2 = 'adulto2@x.com', OUTRO = 'outro@x.com', MEN = 'menor@x.com';
const U = '123e4567-e89b-42d3-a456-426614174000', U2 = '223e4567-e89b-42d3-a456-426614174001';
const ctx = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();
let ok = 0, bad = 0;
const t = async (n, p) => { try { await p; ok++; console.log('OK  ', n); } catch (e) { bad++; console.log('FAIL', n, String(e.message).slice(0, 140)); } };
const ID = 'AbCdEfGhIjKlMnOpQrStUv', ID_REV = 'RevRevRevRevRevRevRevRe', ID_EXP = 'ExpExpExpExpExpExpExpEx', ID_OUT = 'OutOutOutOutOutOutOutOu', ID_PT = 'PtPtPtPtPtPtPtPtPtPtPt';
const dias = (n) => Timestamp.fromDate(new Date(Date.now() + n * 86400000));
const base = (a, av, owner, extra = {}) => ({ alunoEmail: a, avaliacaoId: av, ownerUUID: owner, criadoPorUid: 'pt1', criadoEm: new Date(), expiraEm: dias(7), revogadoEm: null, paraAluno: true, ...extra });
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  await setDoc(doc(d, 'userOwners', 'pt1'), { ownerUUID: U }); await setDoc(doc(d, 'ownerUUIDs', U), { uid: 'pt1' });
  await setDoc(doc(d, 'userOwners', 'pt2'), { ownerUUID: U2 }); await setDoc(doc(d, 'ownerUUIDs', U2), { uid: 'pt2' });
  await setDoc(doc(d, 'alunos', ADU), { email: ADU, ownerUUID: U });
  await setDoc(doc(d, 'alunos', ADU2), { email: ADU2, ownerUUID: U });
  await setDoc(doc(d, 'alunos', MEN), { email: MEN, ownerUUID: U, maioridadeEm: '2099-01-01' });
  await setDoc(doc(d, 'alunos', ADU, 'avaliacoesFisicas', 'av1'), { id: 'av1' });
  await setDoc(doc(d, 'alunos', ADU2, 'avaliacoesFisicas', 'av2'), { id: 'av2' });
  await setDoc(doc(d, 'alunos', MEN, 'avaliacoesFisicas', 'av3'), { id: 'av3' });
  await setDoc(doc(d, 'compartilhamentos', ID), base(ADU, 'av1', U));
  await setDoc(doc(d, 'compartilhamentos', ID_REV), base(ADU, 'av1', U, { revogadoEm: new Date() }));
  await setDoc(doc(d, 'compartilhamentos', ID_EXP), base(ADU, 'av1', U, { expiraEm: Timestamp.fromDate(new Date(Date.now() - 1000)) }));
  await setDoc(doc(d, 'compartilhamentos', ID_OUT), base(ADU2, 'av2', U));
  await setDoc(doc(d, 'compartilhamentos', ID_PT), base(ADU, 'av1', U, { paraAluno: false }));
});
const pt = ctx('pt1', PT), pt2 = ctx('pt2', PT2), adu = ctx('a1', ADU), adu2 = ctx('a2', ADU2), outro = ctx('o1', OUTRO);
const anon = env.unauthenticatedContext().firestore();
const sh = (c, id) => getDoc(doc(c, 'compartilhamentos', id));

// 1) link SEM login
await t('sem login: NAO le o link', assertFails(sh(anon, ID)));
await t('sem login: NAO lista', assertFails(getDocs(collection(anon, 'compartilhamentos'))));
// 2) login autorizado
await t('PT dono le o link', assertSucceeds(sh(pt, ID)));
await t('aluno destinatario le o link ativo', assertSucceeds(sh(adu, ID)));
await t('aluno le a propria avaliacao (dados seguem nas Rules das avaliacoes)', assertSucceeds(getDoc(doc(adu, 'alunos', ADU, 'avaliacoesFisicas', 'av1'))));
// 3) login NAO autorizado
await t('outro usuario logado NAO le o link', assertFails(sh(outro, ID)));
await t('aluno de OUTRO cliente NAO le o link', assertFails(sh(adu2, ID)));
await t('outro PT (nao dono) NAO le o link', assertFails(sh(pt2, ID)));
await t('aluno NAO le link marcado paraAluno=false', assertFails(sh(adu, ID_PT)));
// 4) identificador adulterado
await t('id inexistente/adulterado: negado', assertFails(sh(adu, 'AbCdEfGhIjKlMnOpQrStUw')));
await t('trocar o link pelo de outro cliente: negado', assertFails(sh(adu, ID_OUT)));
await t('aluno NAO le avaliacao de outro cliente mesmo com link', assertFails(getDoc(doc(adu, 'alunos', ADU2, 'avaliacoesFisicas', 'av2'))));
// 5) revogado
await t('aluno NAO le link revogado', assertFails(sh(adu, ID_REV)));
await t('PT dono ainda ve o revogado (gestao)', assertSucceeds(sh(pt, ID_REV)));
// 6) expirado
await t('aluno NAO le link expirado', assertFails(sh(adu, ID_EXP)));
// criar
const novo = (id, o = {}) => setDoc(doc(pt, 'compartilhamentos', id), { ...base(ADU, 'av1', U), criadoEm: serverTimestamp(), ...o });
await t('PT dono cria link valido', assertSucceeds(novo('NewNewNewNewNewNewNewNe')));
await t('aluno NAO cria link', assertFails(setDoc(doc(adu, 'compartilhamentos', 'AluAluAluAluAluAluAluAl'), { ...base(ADU, 'av1', U), criadoPorUid: 'a1', criadoEm: serverTimestamp() })));
await t('PT2 NAO cria link p/ cliente do PT1', assertFails(setDoc(doc(pt2, 'compartilhamentos', 'Pt2Pt2Pt2Pt2Pt2Pt2Pt2P'), { ...base(ADU, 'av1', U2), criadoPorUid: 'pt2', criadoEm: serverTimestamp() })));
await t('NAO cria com ownerUUID de outro', assertFails(novo('BadBadBadBadBadBadBadBa', { ownerUUID: U2 })));
await t('NAO cria p/ avaliacao inexistente', assertFails(novo('NoaNoaNoaNoaNoaNoaNoaNo', { avaliacaoId: 'nao-existe' })));
await t('NAO cria com validade > 30 dias', assertFails(novo('LongLongLongLongLongL', { expiraEm: dias(45) })));
await t('NAO cria ja expirado', assertFails(novo('PastPastPastPastPastPa', { expiraEm: dias(-1) })));
await t('NAO cria com id fraco (curto)', assertFails(novo('abc')));
await t('NAO cria com campo extra', assertFails(novo('ExtExtExtExtExtExtExtEx', { senha: 'x' })));
await t('NAO cria p/ menor sem consentimento', assertFails(setDoc(doc(pt, 'compartilhamentos', 'MenMenMenMenMenMenMenMe'), { ...base(MEN, 'av3', U), criadoEm: serverTimestamp() })));
// revogar / editar / apagar
await t('PT dono revoga', assertSucceeds(updateDoc(doc(pt, 'compartilhamentos', ID), { revogadoEm: serverTimestamp() })));
await t('apos revogar, aluno NAO le', assertFails(sh(adu, ID)));
await t('NAO reativa (revogadoEm -> null)', assertFails(updateDoc(doc(pt, 'compartilhamentos', ID), { revogadoEm: null })));
await t('NAO estende validade', assertFails(updateDoc(doc(pt, 'compartilhamentos', ID_PT), { expiraEm: dias(20) })));
await t('aluno NAO revoga/edita', assertFails(updateDoc(doc(adu, 'compartilhamentos', ID_PT), { revogadoEm: serverTimestamp() })));
await t('PT2 NAO apaga link alheio', assertFails(deleteDoc(doc(pt2, 'compartilhamentos', ID_PT))));
await t('PT dono apaga', assertSucceeds(deleteDoc(doc(pt, 'compartilhamentos', ID_PT))));
// listar
await t('PT lista os proprios (filtro ownerUUID)', assertSucceeds(getDocs(query(collection(pt, 'compartilhamentos'), where('ownerUUID', '==', U)))));
await t('PT2 NAO lista os do PT1', assertFails(getDocs(query(collection(pt2, 'compartilhamentos'), where('ownerUUID', '==', U)))));
await t('aluno NAO lista', assertFails(getDocs(query(collection(adu, 'compartilhamentos'), where('alunoEmail', '==', ADU)))));
// trilha de acessos
const ac = (c, id, uid, papel, extra = {}) => setDoc(doc(collection(c, 'compartilhamentos', id, 'acessos')), { autorUid: uid, autorPapel: papel, acao: 'abriu', criadoEm: serverTimestamp(), ...extra });
await t('aluno destinatario registra acesso (link ativo)', assertSucceeds(ac(adu, 'NewNewNewNewNewNewNewNe', 'a1', 'aluno')));
await t('PT dono registra acesso', assertSucceeds(ac(pt, 'NewNewNewNewNewNewNewNe', 'pt1', 'personal')));
await t('NAO registra com autorUid falso', assertFails(ac(pt, 'NewNewNewNewNewNewNewNe', 'outro-uid', 'personal')));
await t('NAO registra com hora do cliente', assertFails(ac(pt, 'NewNewNewNewNewNewNewNe', 'pt1', 'personal', { criadoEm: new Date() })));
await t('outro usuario NAO registra', assertFails(ac(outro, 'NewNewNewNewNewNewNewNe', 'o1', 'aluno')));
await t('PT dono le a trilha', assertSucceeds(getDocs(collection(pt, 'compartilhamentos', 'NewNewNewNewNewNewNewNe', 'acessos'))));
await t('aluno NAO le a trilha', assertFails(getDocs(collection(adu, 'compartilhamentos', 'NewNewNewNewNewNewNewNe', 'acessos'))));
await t('trilha e imutavel', assertFails((async () => { const r = doc(collection(pt, 'compartilhamentos', 'NewNewNewNewNewNewNewNe', 'acessos')); await setDoc(r, { autorUid: 'pt1', autorPapel: 'personal', acao: 'abriu', criadoEm: serverTimestamp() }); await updateDoc(r, { acao: 'gerou_pdf' }); })()));
console.log(`\n${ok} ok, ${bad} falhas`);
await env.cleanup();
process.exit(bad ? 1 : 0);
