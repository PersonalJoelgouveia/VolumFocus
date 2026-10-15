# VolumFocus — Registro de consentimento e aceite eletrônico (evidências)

**Rascunho técnico. Não é assinatura digital qualificada (ICP-Brasil / MP 2.200-2) nem prova jurídica definitiva.**
É um *registro eletrônico de aceite* com evidências técnicas de autoria e momento; seu valor probatório deve ser avaliado por profissional jurídico (J12).

## 1. Fluxos que produzem eventos

| Fluxo | Quem aceita | Evento | Onde no código |
|---|---|---|---|
| Autorização do responsável legal (3 finalidades) | responsável (Google verificado, vinculado pelo Personal) | `consentimento_responsavel` | `ResponsavelPanel` → `registrarDecisao` |
| Envio da avaliação online (dado de saúde) | aluno **adulto** | `aceite_avaliacao_online` (id `aceite_<avaliaçãoId>`) | `OnlineReview` (checkbox) → `usePhysicalAssessments.salvar` → `criarAvaliacaoOnlineComAceite` |
| Cadastro do aluno pelo Personal | — (sem aceite do aluno ainda) | **não gera evento** | ver pendência J4/J1: base legal para adultos |
| Avaliação criada pelo Personal | — | não gera evento | idem |

Menor enviando avaliação: não grava aceite próprio (as Rules negam); vale a autorização vigente do responsável.

## 2. Metadados do evento (`consentimentos/{aluno}/eventos/{id}`)

| Requisito | Campo | Como é garantido |
|---|---|---|
| Identificador único | id do documento | Firestore auto-id (ou `aceite_<id>`); create-only |
| UID do autor | `autorUid` | Rules: `== request.auth.uid` |
| Proprietário | `ownerUUID` | Rules: `==` ownerUUID gravado em `alunos/{email}` |
| Cliente | `alunoEmail` | Rules: `==` caminho |
| Tipo / finalidade | `tipo`, `finalidade`, `autorPapel` | enums validados; papel conferido (`ehResponsavelDe` / `ehDono`) |
| Versão exata do texto | `versaoTexto`, `textoHash` | versão + SHA-256 do texto exibido (hash calculado no cliente: prova **qual texto o app tinha**, não que o usuário o leu) |
| Data/hora do servidor | `criadoEm` | Rules: `== request.time` |
| Resultado | `decisao` | `aceito` / `recusado` / `revogado` |
| Responsável | `responsavelEmail` | Rules: `== e-mail verificado do token` e `== vínculo` |
| Evidência técnica | `provedor`, `authTime` | Rules: `==` `request.auth.token.firebase.sign_in_provider` / `auth_time` (claims do ID token validado pelo Firebase) |
| Correção rastreável | `substituiEventoId` | aponta evento existente; o antigo nunca é alterado |

**Decisão sobre IP e user-agent: NÃO coletados.** Sem backend (plano Spark, sem Cloud Functions), o IP só viria do cliente (forjável) e não há finalidade demonstrada, prazo de retenção definido nem aviso ao usuário. Se a assessoria entender necessário, exige backend confiável (Blaze) e aviso específico.

## 3. O que o sistema consegue demonstrar

- Que a conta Google com UID X e e-mail verificado Y, autenticada pelo provedor P no instante T0 (`authTime`), criou o evento E no instante T (hora do servidor).
- Que o evento referencia o cliente e o proprietário corretos, e a versão/hash do texto que o app exibia.
- Que o registro não foi alterado pelo app depois de criado (Rules sem update/delete), e que correções geraram novos eventos encadeados.
- Que, para menor, as funcionalidades só funcionam enquanto houver autorização vigente (bloqueio também no servidor).

## 4. O que NÃO consegue demonstrar

- Que a pessoa que clicou é o pai/mãe/tutor (só que controla aquela conta Google indicada pelo Personal).
- Que o texto foi lido/compreendido; nem que o dispositivo/IP é o do titular.
- Integridade contra quem tem acesso **administrativo** ao projeto (Console/Admin SDK ignoram as Rules). Mitigações sem custo: poucos administradores, 2FA, e **exportações periódicas guardadas fora do Firebase** (`scripts/consentimentos-retencao.mjs --aluno … --export`). Selo de tempo de terceiro ou assinatura qualificada exigem serviço externo.
- Hash do texto: calculado no cliente; se o app for adulterado, pode divergir do que foi mostrado. Mitigação: o texto-fonte versionado fica no repositório (Git) junto com a versão.

## 5. Acesso, exportação, retenção e exclusão (PROPOSTA — validar juridicamente)

- **Acesso (Rules):** responsável lê os eventos dos seus menores; Personal **dono** lê os eventos dos seus clientes (controlador precisa demonstrar o consentimento); aluno adulto lê só os aceites que ele mesmo fez; menor e outro Personal: negado. Nenhuma página pública lê esses dados (todo o app está atrás do `AuthGate`; a coleção só responde a usuários autenticados e autorizados pelas Rules).
- **Exportação:** responsável baixa o histórico (JSON) no painel; Personal/admin exporta por script. Entrega ao titular por pedido (art. 18).
- **Retenção:** guardar enquanto durar o atendimento + prazo a definir pela assessoria (sugestão técnica inicial: 5 anos após o fim do atendimento ou da revogação, para defesa em eventual disputa). O script lista/exporta o que passou do prazo.
- **Exclusão:** não existe pelo app. Só o script admin, após vencer o prazo, com `--apply --confirmo-prazo-juridico`; exporta antes, protege o evento do estado vigente. Pedido de eliminação do titular x obrigação de guarda: decisão jurídica (J6).
- **Correção:** novo evento com `substituiEventoId`; nunca edição. Erro administrativo (ex.: data de nascimento) segue procedimento manual registrado.

## 6. Pendências adicionais para a assessoria jurídica

- J12. Valor probatório do aceite eletrônico simples (art. 10 §2º MP 2.200-2; art. 8º LGPD) e necessidade de assinatura avançada/qualificada em algum documento (ex.: termo de atendimento de menor).
- J13. Aceite do aluno **adulto** no cadastro (hoje só existe na avaliação online) e base legal para dados de saúde.
- J14. Prazo de retenção da prova e conflito com o pedido de eliminação.
- J15. Necessidade (ou não) de IP/user-agent e, se sim, aviso e retenção.

## 7. Ordem de publicação

Publicar `firestore.etapaC.rules` e o app **juntos** (um logo após o outro): as Rules novas exigem o evento de aceite na avaliação online de adulto, e o app novo grava esse evento (negado pelas Rules antigas). Janela curta; testar logo após.
