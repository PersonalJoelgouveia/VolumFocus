# VolumFocus — Menores de idade e consentimento do responsável (LGPD)

**Status: RASCUNHO TÉCNICO. NÃO ATIVAR EM PRODUÇÃO antes da revisão de um profissional jurídico (seção 5).**
Este documento não é parecer jurídico. Os textos de consentimento (`src/lib/consentimento.ts`) são rascunhos.

## 1. Dados pessoais coletados e finalidades (hoje)

| Dado | Onde fica | Quem lê | Finalidade |
|---|---|---|---|
| Nome, e-mail, WhatsApp, gênero, objetivo, foco | `alunos/{email}.perfilAluno` (nuvem) + `jg3_alunos` (dispositivo do Personal) | aluno (o próprio), Personal dono, **o outro Personal (get, treino cruzado)** | cadastro e acompanhamento |
| Data de nascimento | idem | idem | definir faixa etária e proteção de menores |
| Lesões/restrições (**dado de saúde**, sensível — LGPD art. 11) | idem | idem | segurança do treino |
| Rotinas, avaliações físicas, anotações (prontuário) | subcoleções de `alunos/{email}` | aluno (rotinas/avaliações), Personal dono (anotações só o dono) | planejamento e acompanhamento |
| Fotos e vídeos | IndexedDB do dispositivo (não vão à nuvem; plano Spark, sem Storage) | quem usa o dispositivo | comparação visual, execução |
| Backup do cliente | `backups/{email}` | o próprio usuário | continuidade |
| **Novo** — responsável: nome, e-mail Google, parentesco | `responsaveis/{aluno}` (+ dispositivo do Personal) | responsável, o próprio menor, Personal dono. **Não** o outro Personal | vincular a autorização |
| **Novo** — consentimento: finalidade, decisão, versão e hash do texto, e-mail do responsável, hora do servidor | `consentimentos/{aluno}/eventos|estado` | eventos: responsável e Personal dono (controlador); estado: responsável, menor, Personal dono | prova da autorização |

Não são coletados: CPF, documentos, IP, geolocalização. (Sem Cloud Functions no plano gratuito, nada disso é obtido do servidor.)

## 2. Perfis e fluxo

- **Adulto (≥ 18):** fluxo atual, sem mudança. Docs sem `maioridadeEm` = adulto.
- **Criança (< 12) / adolescente (12–17):** o Personal informa a data de nascimento; o app grava `maioridadeEm` (18º aniversário) e exige o responsável (nome, e-mail Google, parentesco). Para ambos as Rules exigem a autorização enquanto `maioridadeEm` estiver no futuro. A distinção criança/adolescente hoje só aparece no texto da tela (ver pendência J2).
- **Responsável legal:** entra com a conta Google do e-mail indicado. Vê **somente** o painel de autorização (nunca o app). Decide cada finalidade separadamente: autorizar, recusar, revogar, ou decidir de novo se o texto mudou de versão.
- **Personal responsável:** cadastra o menor e o vínculo; **não** pode autorizar, alterar nem apagar a prova.

Finalidades **separadas**: `tratamento_dados` e `atendimento` (obrigatórias para o acesso do aluno) e `uso_imagem` (opcional; só libera fotos/vídeos).

## 3. Como o Firebase controla (Etapa C — `firestore.etapaC.rules`)

- `alunos/{email}.maioridadeEm`: formato validado, **imutável** depois de gravado (o Personal não consegue "virar adulto").
- `responsaveis/{aluno}`: só o Personal **dono** cria/edita, e só para quem é menor. O responsável nunca pode ser Personal, nem o próprio aluno. Troca de responsável invalida as autorizações anteriores (o estado guarda o e-mail de quem decidiu e as Rules comparam com o vínculo atual).
- `consentimentos/.../eventos`: **create-only**, só o responsável vinculado, `criadoEm == request.time` (hora do servidor), hash SHA-256 do texto exibido, versão e finalidade validadas, sem update/delete. O evento só existe junto com o `estado` correspondente (mesmo batch, `existsAfter`).
- `consentimentos/.../estado`: só o responsável escreve; revogar só o que foi concedido. Sem delete.
- Bloqueio no servidor (`consentOk`) para menor sem autorização: leitura de rotinas/avaliações pelo aluno, avaliação online, backup, notificação, e criação/edição de rotinas, avaliações e anotações pelo Personal.
- Leitura: eventos do responsável e do Personal dono (que, como controlador, precisa demonstrar o consentimento). Estado: responsável, menor e Personal dono. O outro Personal e o menor não leem eventos; o outro Personal também não lê o vínculo nem o estado. Modelo completo de evidências: `docs/Registro_Consentimento_Evidencias.md`.

## 4. Limites técnicos conhecidos

1. **O Firebase só prova que "a conta Google X, com e-mail verificado, clicou autorizar em tal hora".** Não prova que X é pai/mãe/tutor. Quem indica X é o Personal (confiança no controlador). Verificação de vínculo (documento, assinatura gov.br etc.) exigiria coletar mais dados — decisão jurídica (J3).
2. O Personal declara a data de nascimento; as Rules não conseguem verificar. Erro de data exige correção administrativa (campo imutável).
3. O **outro Personal** (treino cruzado, Etapa B) lê o doc do aluno, incluindo `perfilAluno` (data de nascimento, lesões). O responsável fica de fora, mas esse acesso cruzado deve ser avaliado juridicamente para menores (J7).
4. Fotos/vídeos ficam no dispositivo e **não** são apagados na revogação (a UI apenas deixa de permitir novos registros).
5. Revogação bloqueia o acesso, **mas não apaga** dados já gravados. Eliminação a pedido é processo manual hoje.
6. Texto novo (versão nova) exige nova decisão **no cliente**; as Rules não conferem a versão (mudar o texto não exige republicar Rules).
7. Rules **não testadas no Emulator** (ver `etapaC.rules.test.mjs`).

## 5. Requisitos jurídicos pendentes — validar com profissional (advogado de proteção de dados)

- **J1. Base legal.** LGPD art. 14 exige consentimento específico e em destaque de ao menos um dos pais/responsável para **crianças**. Para **adolescentes**, há debate (ANPD, Enunciado nº 1/2023) sobre poder usar outras bases (arts. 7º/11), como execução de contrato ou tutela da saúde. Decidir a base por finalidade e faixa etária; o fluxo atual é o mais conservador (autorização para todos os menores).
- **J2. Faixas etárias.** Confirmar o tratamento diferenciado de <12, 12–15 (absolutamente incapazes), 16–17 (relativamente incapazes, assistidos) e se algo muda no texto/fluxo.
- **J3. Verificação do responsável.** Definir o nível de prova exigido (hoje: Google verificado indicado pelo Personal) e se é necessário confirmar o parentesco/guarda, e quais dados mínimos isso exigiria.
- **J4. Dado de saúde (art. 11).** "Lesões/restrições" é dado sensível; confirmar base legal e texto específico, inclusive para adultos.
- **J5. Textos.** Revisar/redigir os três textos: finalidade, dados, controlador (identificação do Personal e contato do encarregado/DPO), compartilhamento, prazo de retenção, direitos do titular (art. 18), forma de revogar, linguagem clara (art. 14 §6º).
- **J6. Retenção e eliminação.** Prazo de guarda da prova de consentimento e dos dados após revogação/fim do atendimento; procedimento de eliminação a pedido.
- **J7. Acesso entre Personals.** Cada Personal é controlador? Há operação conjunta? O acesso cruzado a dados de menores precisa de autorização específica?
- **J8. Imagem.** Fotos/vídeos de menores (ECA, direito de imagem): confirmar escopo, guarda e se o armazenamento local basta.
- **J9. Maioridade.** Procedimento ao atingir 18 anos (o app libera automaticamente; avaliar se o jovem deve ser informado e reafirmar o consentimento).
- **J10. Responsabilidade do Personal / atendimento.** Termo de autorização para atividade física de menor (aptidão, responsabilidade civil) — fora do escopo do app, mas relacionado a `atendimento`.
- **J11. Registro das operações (art. 37) e política de privacidade** do app.

## 6. Checklist para ativar (nesta ordem)

1. Revisão jurídica (seção 5) e ajuste dos textos e das versões.
2. Rodar `etapaC.rules.test.mjs` no Emulator (Cloud Shell) com 0 falhas; testar no Playground.
3. Publicar `firestore.etapaC.rules` (guardar as regras atuais antes).
4. Publicar o app (deploy). Sem a Etapa C publicada, cadastrar menores falha ao sincronizar (esperado).
5. Teste real com 3 contas: Personal, responsável, menor (cadastrar → bloqueado → autorizar → liberado → revogar → bloqueado).
