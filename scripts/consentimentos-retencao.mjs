#!/usr/bin/env node
/**
 * RETENÇÃO / EXPORTAÇÃO / EXCLUSÃO dos eventos de consentimento (Admin SDK). Dry-run por padrão.
 * Não existe exclusão pelo app: os eventos são imutáveis para qualquer usuário. Só este script (admin),
 * depois de o prazo de retenção DEFINIDO PELA ASSESSORIA JURÍDICA vencer, remove eventos antigos.
 *
 *   npm i --no-save firebase-admin
 *   gcloud auth application-default login            # ou GOOGLE_APPLICATION_CREDENTIALS
 *   node scripts/consentimentos-retencao.mjs --aluno aluno@x.com --export ./saida.json        # exporta 1 aluno
 *   node scripts/consentimentos-retencao.mjs --anos 5 --export ./vencidos.json                # lista vencidos (dry-run)
 *   node scripts/consentimentos-retencao.mjs --anos 5 --export ./vencidos.json --apply --confirmo-prazo-juridico
 *
 * Segurança: SEMPRE exporta antes de apagar; nunca apaga o evento que o `estado` vigente referencia;
 * nunca apaga sem --apply E --confirmo-prazo-juridico.
 */
import { writeFileSync } from 'node:fs';
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const apply = args.includes('--apply') && args.includes('--confirmo-prazo-juridico');
const aluno = opt('--aluno')?.toLowerCase();
const anos = opt('--anos') ? Number(opt('--anos')) : null;
const out = opt('--export');
if (!out) { console.error('Informe --export <arquivo.json>'); process.exit(1); }
if (!aluno && !(anos > 0)) { console.error('Informe --aluno <e-mail> ou --anos <N>'); process.exit(1); }

admin.initializeApp();
const db = admin.firestore();
const corte = anos ? new Date(Date.now() - anos * 365.25 * 24 * 3600 * 1000) : null;

let q = db.collectionGroup('eventos');
const snap = await q.get();
const doAluno = (d) => d.ref.parent.parent?.parent?.id === 'consentimentos' ? d.ref.parent.parent.id : null;
const alvo = [];
for (const d of snap.docs) {
  const a = doAluno(d);
  if (!a) continue;
  if (aluno && a !== aluno) continue;
  const quando = d.get('criadoEm')?.toDate?.();
  if (corte && !(quando && quando < corte)) continue;
  alvo.push({ a, d, quando });
}
// protege eventos referenciados pelo estado vigente
const protegidos = new Set();
for (const a of new Set(alvo.map((x) => x.a))) {
  const est = await db.collection('consentimentos').doc(a).collection('estado').get();
  est.docs.forEach((e) => protegidos.add(`${a}/${e.get('eventoId')}`));
}
const exportar = alvo.map(({ a, d, quando }) => ({ alunoEmail: a, eventoId: d.id, ...d.data(), criadoEm: quando?.toISOString() ?? null }));
writeFileSync(out, JSON.stringify(exportar, null, 2));
const apagaveis = alvo.filter(({ a, d }) => anos && !protegidos.has(`${a}/${d.id}`));
console.log(`${exportar.length} evento(s) exportado(s) em ${out}; ${apagaveis.length} elegível(is) para exclusão (${protegidos.size} protegido(s) pelo estado vigente).`);
if (!anos) process.exit(0);
if (!apply) { console.log('DRY-RUN: nada foi apagado. Use --apply --confirmo-prazo-juridico para apagar.'); process.exit(0); }
for (const { d } of apagaveis) await d.ref.delete();
console.log('Exclusão concluída.');
