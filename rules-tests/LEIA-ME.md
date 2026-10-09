# Testes das Security Rules (Emulator)

**As regras (`firestore.rules`, `storage.rules`) são uma PROPOSTA: não estão publicadas e
não foram executadas por quem as escreveu (o Emulator não rodou no ambiente de criação).
Só publique depois de passar nestes testes e no Rules Playground.**

## Pré-requisitos (uma vez)
- Java 21+ (o Firestore Emulator exige) — `java -version`
- `npm i -D @firebase/rules-unit-testing firebase-tools`
  (altera `package.json`, `package-lock.json` e `node_modules`)

## Rodar
```bash
npx firebase emulators:exec --only firestore,storage --project volumfocus-rules-test \
  "node node_modules/vitest/vitest.mjs run --config vitest.rules.config.ts"
```
Não precisa de login nem de projeto real. Os testes ficam fora do `npm test` normal
(extensão `.rtest.ts`), que não depende do Emulator.

## Antes de publicar (ordem)
1. **Backup**: Console → Firestore → Regras → copie as regras atuais para um arquivo seguro (idem Storage).
2. Rodar os testes acima; todos devem passar.
3. Console → Rules Playground: conferir à mão (aluno lendo outro aluno; estranho criando notificação; etc.).
4. Publicar **primeiro em um projeto de teste**, se existir; senão, publicar fora do horário de uso.
5. Smoke test no app: login Personal, login Aluno, enviar avaliação online, concluir treino (notificação), upload de imagem de exercício, backup/restauração.
6. Se algo quebrar, restaure o backup do passo 1 no Console (Regras → histórico).

> `firebase.json` aponta para os dois arquivos. **`firebase deploy` sem `--only` publicaria as regras.**
> Para publicar de propósito: `npx firebase deploy --only firestore:rules,storage --project <ID-DO-PROJETO>`.

## Manutenção
- A lista de Personals existe em 3 lugares: `PT_EMAILS` (`src/store/useAuthStore.ts`), `firestore.rules` e `storage.rules`. Mude os três juntos.
- Mudou o formato da avaliação online (`montarAvaliacaoOnline`)? Atualize `avaliacaoOnlineValida` e os testes.

## Antes de publicar as Rules desta etapa (F1/F2/F3)

1. `firebase deploy --only firestore:indexes` (índice `notificacoesTreinos`: ownerUUID ASC, criadaEm DESC — `firestore.indexes.json`).
2. Rodar a migração: `node scripts/migrar-legados-ownership.mjs` (dry-run) e depois `--apply` (ver cabeçalho do script).
3. Só então `firebase deploy --only firestore:rules`. Com `aceitarLegadoSemDono() = false`, clientes/notificações sem `ownerUUID` ficam inacessíveis ao Personal.
