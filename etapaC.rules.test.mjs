// Testes (Emulator) do consentimento de responsável — NÃO executados ainda. Uso: ver docs/LGPD_Menores_Requisitos.md
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, getDocs, setDoc, collection, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-vf', firestore: { rules: readFileSync('firestore.etapaC.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
const PT = 'joelgouveia16@gmail.com', PT2 = 'personaljoelgouveia@gmail.com';
const MEN = 'menor@x.com', ADU = 'adulto@x.com', RESP = 'mae@x.com', OUTRO = 'outro@x.com', MEN2 = 'menor2@x.com';
const U = '123e4567-e89b-42d3-a456-426614174000', U2 = '223e4567-e89b-42d3-a456-426614174001';
const AT = 1760000000; // auth_time simulado no token; o evento TEM de repetir o mesmo valor (senão as Rules negam)
const ctx = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true, auth_time: AT, firebase: { sign_in_provider: 'google.com' } }).firestore();
let ok = 0, bad = 0;
const t = async (n, p) => { try { await p; ok++; console.log('OK  ', n); } catch (e) { bad++; console.log('FAIL', n, String(e.message).slice(0, 140)); } };
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  await setDoc(doc(d, 'userOwners', 'pt1'), { ownerUUID: U }); await setDoc(doc(d, 'ownerUUIDs', U), { uid: 'pt1' });
  await setDoc(doc(d, 'userOwners', 'pt2'), { ownerUUID: U2 }); await setDoc(doc(d, 'ownerUUIDs', U2), { uid: 'pt2' });
  await setDoc(doc(d, 'alunos', MEN), { email: MEN, ownerUUID: U, maioridadeEm: '2099-01-01' });
  await setDoc(doc(d, 'alunos', MEN2), { email: MEN2, ownerUUID: U, maioridadeEm: '2099-01-01' });
  await setDoc(doc(d, 'alunos', ADU), { email: ADU, ownerUUID: U });
  await setDoc(doc(d, 'responsaveis', MEN), { alunoEmail: MEN, alunoNome: 'M', responsavelEmail: RESP, responsavelNome: 'Mae', parentesco: 'Mãe', personalEmail: PT, atualizadoEm: new Date() });
});
const pt = ctx('pt1', PT), pt2 = ctx('pt2', PT2), men = ctx('m1', MEN), resp = ctx('r1', RESP), outro = ctx('o1', OUTRO), adu = ctx('a1', ADU);
const UIDS = { [RESP]: 'r1', [MEN]: 'm1', [PT]: 'pt1', [OUTRO]: 'o1' };
const evBase = (a, fin, dec, email, extra = {}) => ({ alunoEmail: a, ownerUUID: U, autorUid: UIDS[email] ?? 'x', autorPapel: 'responsavel', tipo: 'consentimento_responsavel', finalidade: fin, decisao: dec, versaoTexto: '0.1', textoHash: 'a'.repeat(64), provedor: 'google.com', authTime: AT, responsavelEmail: email, criadoEm: serverTimestamp(), ...extra });
const decidir = (c, a, fin, dec, evId, email = RESP, extra = {}) => {
  const b = writeBatch(c);
  b.set(doc(c, 'consentimentos', a, 'eventos', evId), evBase(a, fin, dec, email, extra));
  b.set(doc(c, 'consentimentos', a, 'estado', fin), { finalidade: fin, decisao: dec, versaoTexto: '0.1', textoHash: 'a'.repeat(64), responsavelEmail: email, eventoId: evId, atualizadoEm: serverTimestamp() });
  return b.commit();
};
// ---- antes da autorização: funcionalidades bloqueadas
await t('menor sem consent: NAO le rotinas', assertFails(getDoc(doc(men, 'alunos', MEN, 'rotinas', 'r1'))));
await t('menor sem consent: NAO escreve backup', assertFails(setDoc(doc(men, 'backups', MEN), { v: 1 })));
await t('menor le o proprio cadastro (gate)', assertSucceeds(getDoc(doc(men, 'alunos', MEN))));
await t('menor le o proprio vinculo', assertSucceeds(getDoc(doc(men, 'responsaveis', MEN))));
await t('PT NAO cria rotina p/ menor sem consent', assertFails(setDoc(doc(pt, 'alunos', MEN, 'rotinas', 'r1'), { id: 'r1' })));
await t('adulto segue normal (le rotinas)', assertSucceeds(getDoc(doc(adu, 'alunos', ADU, 'rotinas', 'r1'))));
// ---- quem NÃO pode aprovar
await t('menor NAO se autoaprova', assertFails(decidir(men, MEN, 'atendimento', 'aceito', 'e1', MEN)));
await t('PT NAO aprova pelo menor', assertFails(decidir(pt, MEN, 'atendimento', 'aceito', 'e2', PT)));
await t('estranho NAO aprova', assertFails(decidir(outro, MEN, 'atendimento', 'aceito', 'e3', OUTRO)));
await t('responsavel NAO forja outro e-mail no evento', assertFails(decidir(resp, MEN, 'atendimento', 'aceito', 'e4', OUTRO)));
await t('responsavel de OUTRO menor nao aprova este', assertFails(decidir(resp, MEN2, 'atendimento', 'aceito', 'e5')));
// ---- responsável
await t('responsavel concede tratamento_dados', assertSucceeds(decidir(resp, MEN, 'tratamento_dados', 'aceito', 'e10')));
await t('menor ainda bloqueado (falta atendimento)', assertFails(getDoc(doc(men, 'alunos', MEN, 'rotinas', 'r1'))));
await t('responsavel concede atendimento', assertSucceeds(decidir(resp, MEN, 'atendimento', 'aceito', 'e11')));
await t('menor agora le rotinas', assertSucceeds(getDoc(doc(men, 'alunos', MEN, 'rotinas', 'r1'))));
await t('PT agora cria rotina', assertSucceeds(setDoc(doc(pt, 'alunos', MEN, 'rotinas', 'r1'), { id: 'r1' })));
await t('evento e imutavel (update negado)', assertFails(setDoc(doc(resp, 'consentimentos', MEN, 'eventos', 'e10'), { x: 1 })));
await t('hash invalido negado', assertFails(decidir(resp, MEN, 'uso_imagem', 'aceito', 'e12', RESP, { textoHash: 'zz' })));
await t('hora do cliente (nao serverTimestamp) negada', assertFails(decidir(resp, MEN, 'uso_imagem', 'aceito', 'e13', RESP, { criadoEm: new Date() })));
await t('uid forjado no evento negado', assertFails(decidir(resp, MEN, 'uso_imagem', 'aceito', 'e15', RESP, { autorUid: 'outro-uid' })));
await t('provedor forjado negado', assertFails(decidir(resp, MEN, 'uso_imagem', 'aceito', 'e16', RESP, { provedor: 'password' })));
await t('authTime forjado negado', assertFails(decidir(resp, MEN, 'uso_imagem', 'aceito', 'e17', RESP, { authTime: 1 })));
await t('ownerUUID forjado negado', assertFails(decidir(resp, MEN, 'uso_imagem', 'aceito', 'e18', RESP, { ownerUUID: U2 })));
await t('campo extra (ip) negado', assertFails(decidir(resp, MEN, 'uso_imagem', 'aceito', 'e19', RESP, { ip: '1.2.3.4' })));
await t('uso_imagem decidido separadamente', assertSucceeds(decidir(resp, MEN, 'uso_imagem', 'recusado', 'e14')));
await t('estado sem evento correspondente negado', assertFails(setDoc(doc(resp, 'consentimentos', MEN, 'estado', 'uso_imagem'), { finalidade: 'uso_imagem', decisao: 'aceito', versaoTexto: '0.1', textoHash: 'a'.repeat(64), responsavelEmail: RESP, eventoId: 'nao-existe', atualizadoEm: serverTimestamp() })));
// ---- leitura restrita
await t('responsavel le seus eventos', assertSucceeds(getDoc(doc(resp, 'consentimentos', MEN, 'eventos', 'e10'))));
await t('menor NAO le eventos', assertFails(getDoc(doc(men, 'consentimentos', MEN, 'eventos', 'e10'))));
await t('PT dono le eventos (precisa demonstrar o consentimento)', assertSucceeds(getDoc(doc(pt, 'consentimentos', MEN, 'eventos', 'e10'))));
await t('outro PT NAO le eventos', assertFails(getDoc(doc(pt2, 'consentimentos', MEN, 'eventos', 'e10'))));
await t('PT dono le estado', assertSucceeds(getDoc(doc(pt, 'consentimentos', MEN, 'estado', 'atendimento'))));
await t('outro PT NAO le estado', assertFails(getDoc(doc(pt2, 'consentimentos', MEN, 'estado', 'atendimento'))));
await t('estranho NAO le estado', assertFails(getDoc(doc(outro, 'consentimentos', MEN, 'estado', 'atendimento'))));
await t('responsavel lista SEUS menores', assertSucceeds(getDocs(query(collection(resp, 'responsaveis'), where('responsavelEmail', '==', RESP)))));
await t('estranho NAO lista menores de outro', assertFails(getDocs(query(collection(outro, 'responsaveis'), where('responsavelEmail', '==', RESP)))));
await t('outro PT NAO le responsavel (dado do responsavel protegido)', assertFails(getDoc(doc(pt2, 'responsaveis', MEN))));
// ---- revogação / troca de responsável
await t('responsavel revoga atendimento (evento liga ao anterior)', assertSucceeds(decidir(resp, MEN, 'atendimento', 'revogado', 'e20', RESP, { substituiEventoId: 'e11' })));
await t('substituiEventoId inexistente negado', assertFails(decidir(resp, MEN, 'atendimento', 'revogado', 'e20b', RESP, { substituiEventoId: 'nao-existe' })));
await t('apos revogar: menor volta a ser bloqueado', assertFails(getDoc(doc(men, 'alunos', MEN, 'rotinas', 'r1'))));
await t('nao revoga o que nunca foi concedido', assertFails(decidir(resp, MEN, 'uso_imagem', 'revogado', 'e21')));
await t('responsavel reconcede (atualizacao)', assertSucceeds(decidir(resp, MEN, 'atendimento', 'aceito', 'e22')));
const vinc = (email, extra = {}) => ({ alunoEmail: MEN, alunoNome: 'M', responsavelEmail: email, responsavelNome: 'X', parentesco: 'Pai', personalEmail: PT, ownerUUID: U, atualizadoEm: serverTimestamp(), ...extra });
await t('PT NAO define a si mesmo como responsavel', assertFails(setDoc(doc(pt, 'responsaveis', MEN), vinc(PT))));
await t('PT NAO define o outro PT como responsavel', assertFails(setDoc(doc(pt, 'responsaveis', MEN), vinc(PT2))));
await t('PT NAO define o proprio aluno como responsavel', assertFails(setDoc(doc(pt, 'responsaveis', MEN), vinc(MEN))));
await t('PT troca o responsavel (permitido)', assertSucceeds(setDoc(doc(pt, 'responsaveis', MEN), vinc('pai@x.com'))));
await t('troca de responsavel invalida a autorizacao anterior', assertFails(getDoc(doc(men, 'alunos', MEN, 'rotinas', 'r1'))));
await t('PT NAO cria vinculo p/ adulto', assertFails(setDoc(doc(pt, 'responsaveis', ADU), vinc('x@x.com', { alunoEmail: ADU }))));
// ---- imutabilidade de maioridadeEm
await t('PT NAO remove maioridadeEm', assertFails(setDoc(doc(pt, 'alunos', MEN2), { email: MEN2, ownerUUID: U, maioridadeEm: null }, { merge: true })));
await t('PT NAO antecipa maioridadeEm', assertFails(setDoc(doc(pt, 'alunos', MEN2), { email: MEN2, ownerUUID: U, maioridadeEm: '2000-01-01' }, { merge: true })));
await t('PT marca adulto-legado como menor (permitido)', assertSucceeds(setDoc(doc(pt, 'alunos', ADU), { email: ADU, ownerUUID: U, maioridadeEm: '2099-01-01' }, { merge: true })));
await t('estado com campos vazios negado', assertFails(setDoc(doc(resp, 'consentimentos', MEN, 'estado', 'atendimento'), {})));
// ---- aceite eletrônico na avaliação online (aluno ADULTO)
const onl = (id) => ({ id, alunoId: 'loc1', date: '2026-10-09', protocol: 'online', anthropometry: { peso: 70, altura: 170, imc: 24.2 }, circumferences: [], skinfolds: {}, results: { relacaoCinturaQuadril: 0.8 }, createdAt: 'a', updatedAt: 'a', status: 'enviada', submittedBy: 'aluno' });
const aceite = (c, a, avId, extra = {}, evId = 'aceite_' + avId) => {
  const b = writeBatch(c);
  b.set(doc(c, 'alunos', a, 'avaliacoesFisicas', avId), onl(avId));
  b.set(doc(c, 'consentimentos', a, 'eventos', evId), { alunoEmail: a, ownerUUID: U, autorUid: 'a1', autorPapel: 'aluno', tipo: 'aceite_avaliacao_online', finalidade: 'avaliacao_online', decisao: 'aceito', versaoTexto: '0.1', textoHash: 'b'.repeat(64), provedor: 'google.com', authTime: AT, avaliacaoId: avId, criadoEm: serverTimestamp(), ...extra });
  return b.commit();
};
await t('adulto envia avaliacao COM aceite', assertSucceeds(aceite(adu, ADU, 'ov1')));
await t('adulto NAO envia avaliacao SEM evento de aceite', assertFails(setDoc(doc(adu, 'alunos', ADU, 'avaliacoesFisicas', 'ov2'), onl('ov2'))));
await t('aceite com id fora do padrao negado', assertFails(aceite(adu, ADU, 'ov3', {}, 'qualquer')));
await t('aceite com autorUid forjado negado', assertFails(aceite(adu, ADU, 'ov4', { autorUid: 'outro' })));
await t('aceite NAO pode ser "recusado/revogado" nesse caminho', assertFails(aceite(adu, ADU, 'ov5', { decisao: 'revogado' })));
await t('aluno le o proprio aceite', assertSucceeds(getDoc(doc(adu, 'consentimentos', ADU, 'eventos', 'aceite_ov1'))));
await t('aceite imutavel (update negado)', assertFails(setDoc(doc(adu, 'consentimentos', ADU, 'eventos', 'aceite_ov1'), { x: 1 })));
await t('menor NAO grava evento de aceite proprio', assertFails(aceite(men, MEN, 'ov6', { autorUid: 'm1' })));
console.log(`\n${ok} ok, ${bad} falhas`);
await env.cleanup();
