# Relatório PDF e link protegido de avaliação (Mini 8)

## O que existe
- **Relatório** (`RelatorioAvaliacao`): cabeçalho com aluno, data da avaliação, protocolo, avaliador, "comparada com", data/hora de geração e referência; resumo com comparação (atual × anterior × desde a 1ª); barra de composição corporal; gráficos de evolução (peso, % gordura, massa magra, IMC, TMB — só até a avaliação escolhida); circunferências; dobras; fotos comparativas (opcional).
- **PDF** = "Imprimir / Salvar PDF" do navegador, **gerado no aparelho** a partir de dados já carregados. Não há arquivo em servidor nem URL pública de PDF (requisito 1). O nome sugerido do arquivo é `Relatorio-avaliacao-AAAA-MM-DD` (sem nome do aluno).
- **Link protegido**: `…/#/relatorio/<id de 22 caracteres aleatórios>`. O Personal dono cria (1, 7 ou 30 dias) e pode revogar. Só abre dentro do `AuthGate` (login Google verificado).
- Botão **Relatório** em cada avaliação da timeline (Personal e aluno). **Link protegido…** só aparece para o Personal.

## Como a autorização funciona
| Requisito | Como é atendido |
|---|---|
| Autenticação antes de ver dado | A rota é renderizada dentro do `AuthGate`; sem login só aparece a tela de login (o `#` sobrevive ao popup de login). |
| Firebase valida o relatório e o cliente | `compartilhamentos/{shareId}`: leitura só pelo **Personal dono** (`ptDoAluno` + `isMyOwnerUUID`) ou pelo **próprio aluno** (`ehDono`) se `paraAluno`, ativo e `consentOk`. Depois, as avaliações são lidas **com as credenciais de quem abriu** e as Rules de `/alunos/{email}/avaliacoesFisicas` decidem de novo. |
| ownerUUID não é senha | Só serve para conferir o dono real do cliente nas Rules; nunca está na URL e nunca basta sozinho. |
| Não confiar em alunoId/assessmentId do frontend | A URL só tem o `shareId` opaco. E-mail do aluno e id da avaliação vêm do documento, que na criação é validado: `ownerUUID == dono real do cliente`, `exists()` da avaliação, `criadoPorUid == auth.uid`, `criadoEm == request.time`, validade ≤ 30 dias, campos fechados (`hasOnly`). |
| Trocar o identificador | Id inexistente, de outro dono ou de outro cliente → `permission-denied`; a tela mostra **a mesma mensagem genérica** para todos os casos (não revela se o link existe). |
| Ciclo de vida | `expiraEm` (máx. 30 dias, imposto pelas Rules); revogação = único update permitido (`revogadoEm: null → request.time`; não reativa nem estende); o dono pode apagar o registro. |
| Registro de eventos | `compartilhamentos/{id}/acessos`: create-only, hora do servidor, `autorUid == request.auth.uid`, ações `abriu`/`gerou_pdf`. Leitura **só pelo Personal dono**; sem update/delete. Sem IP nem user-agent. |
| Cache/persistência | Dados só em memória React (sem localStorage/IndexedDB; o Firestore não usa persistência offline neste projeto). A página injeta `noindex` e `referrer: no-referrer`; o fragmento `#` nunca vai ao servidor. GitHub Pages não permite cabeçalhos `Cache-Control` próprios — o HTML do app é estático e **não contém dados**; os dados vêm do Firestore autenticado. |
| Metadados / temporários / URLs | Sem PDF no servidor → sem URL de download. `document.title` é trocado durante a impressão e restaurado. As URLs de objeto das fotos são revogadas ao fechar. O PDF salvo pelo usuário é um arquivo comum no aparelho dele (fora do nosso controle — ver limites). |
| Fotos | Só se o Personal marcar "Incluir fotos", o aparelho tiver as fotos (IndexedDB local, nunca na nuvem) e o uso de imagem estiver liberado (adulto ou autorização vigente do responsável). **Nunca** no relatório aberto por link. |
| Conteúdo mínimo | Ficam de fora: notas livres, questionário e triagem de saúde, revisão do Personal. |

## Limite importante (leia)
O link é um **ponteiro + trilha + prazo**; **não é a barreira dos dados**. A barreira são as Rules das avaliações, que já valiam antes. Consequências honestas:
- Revogar/expirar derruba o **link**, mas o Personal dono e o aluno continuam podendo ver a avaliação dentro do app (direito que já tinham).
- O link **não dá acesso a ninguém novo**. Um terceiro, mesmo logado, só recebe a mensagem genérica.
- Para o Personal dono, revogado/expirado também é bloqueado na tela; no servidor, o dono continua vendo o registro do link (precisa dele para gerir).

## Decisão de produto SEPARADA: compartilhar com quem não tem conta
**Não implementado, de propósito.** Abrir para alguém sem conta (médico, nutricionista, familiar) exigiria enfraquecer a autenticação (link-segredo, código por e-mail ou PDF enviado). Isso muda o modelo de risco e, para menores, a base legal. Opções para decidir depois: (a) o próprio aluno baixa o PDF e envia por canal que ele escolher (já possível; é ato dele); (b) convidar o terceiro a criar conta Google e ser autorizado explicitamente; (c) link com código de uso único — exige backend confiável (Cloud Functions, indisponível no plano Spark) e revisão jurídica. **Responsável legal de menor** também não abre relatórios hoje (o painel dele só trata autorizações) — outra decisão de produto.

## Publicar
1. As Rules novas estão em `firestore.etapaC.rules` (bloco `/compartilhamentos`) — **publicar junto da Etapa C** e do app. Sem elas, criar link falha (negado); o botão "Relatório" local (PDF) continua funcionando.
2. Guarde backup das Rules atuais para reverter.

## Testes
- Unitários (rodaram): `src/lib/__tests__/relatorioShare.test.ts` — id aleatório, hash adulterado, link sem dados pessoais, estados ativo/expirado/revogado, validade ≤ 30 dias, relatório sem notas/triagem.
- Emulator (**NÃO executado**): `relatorio.rules.test.mjs` — sem login, login autorizado, não autorizado (outro usuário, aluno de outro cliente, outro PT), id adulterado, revogado, expirado, criação inválida, trilha imutável.
- **Não testado em navegador real:** abrir o link com duas contas, imprimir/salvar PDF, gráficos na impressão. Ficam para a auditoria final.

## Limites (sem promessa excessiva)
- Depois de salvo, o PDF é arquivo comum: quem o tem pode reenviá-lo. Dispositivo comprometido está fora do escopo.
- Admin do Firebase/Console ignora as Rules.
- Texto do rodapé é rascunho técnico; revisão jurídica pendente.
