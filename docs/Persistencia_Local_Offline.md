# VolumFocus — Persistência local e modos online/offline

## 1. Inventário (evidência no código) e classificação

Não há Service Worker nem Cache API (`caches`) no projeto; o Firestore usa cache só em memória (sem `persistentLocalCache`). O Firebase Auth guarda a sessão no IndexedDB do SDK (`firebaseLocalStorageDb`) — é credencial de sessão, não dado de cliente.

| Mecanismo | Chave / local | Conteúdo | Classe | Tratamento nesta versão |
|---|---|---|---|---|
| localStorage (Zustand) | `jg3_alunos` | cadastro dos alunos (nome, e-mail, telefone, nascimento, gênero, objetivo, **restrições/lesões**, rotina) | **Pessoal; `restricoes` é dado de saúde** | segue persistido (precisa funcionar e entra no backup); **offline não grava em disco** (armazenamento guardado); apagado no logout |
| localStorage (Zustand) | `jg3_alunos` (campos `avaliacoes`, `notas`) | avaliações físicas (peso, medidas, triagem de saúde) e **anotações/prontuário** | **SENSÍVEL** (saúde) | **deixou de ser persistido** (era só cache do Firestore). Só em memória; migração sem perda (seção 4) |
| localStorage | `jg3_online_draft_<ownerUUID>:<aluno>` | rascunho da avaliação online (peso, medidas, triagem) | **SENSÍVEL** | online: grava (TTL 14 dias, namespace por dono); **offline/sem contexto autorizado: só memória** |
| localStorage (Zustand) | `jg3_sessoes_treino` | sessões presenciais (nome de cliente + treino do dia) | Pessoal | armazenamento guardado (offline só memória) |
| localStorage (Zustand) | `jg3_log`, `jg3_ex`, `jg3_met_peso`, `jg3_carga_progresso`, `jg3_rotinas`, `jg3_strength_records`, `jg3_conquistas`, `jg3_cardio_*`, `historico_semanas` | treino/progresso do próprio usuário | Pessoal, baixa sensibilidade | sem mudança (não é dado de cliente); apagados no logout |
| localStorage | `jg3_health_status`, `jg3_wearable_status` | 3 flags (disponível, permissão, última sync) | Não sensível | sem mudança |
| localStorage | `jg3_dirty` | marcador de sincronização | Não sensível | sem mudança |
| localStorage | `jg3_owner`, `jg3_owner_uuid` | uid / ownerUUID (identificador, não segredo) | Não sensível | sem mudança |
| localStorage | `jg3_theme`, `jg3_locale`, `jg3_timer_*`, `jg3_training_models_v9` | preferências/ferramentas | Não sensível | sem mudança |
| localStorage | `jg3_legado_sensivel_v1` (**novo, temporário**) | cópia do cache antigo de avaliações/anotações durante a migração | SENSÍVEL | só existe até a migração confirmar tudo na nuvem; apagada no logout |
| sessionStorage | `jg3_owner_wipe_pending` | flag anti-laço | Não sensível | sem mudança |
| IndexedDB | `volumfocus-assessment-media` | **fotos de avaliação** (Blob) | **SENSÍVEL** (imagem do corpo) | **mantida** (ver seção 5) |
| IndexedDB | `volumfocus-media` | **vídeos** de exercício (Blob) | Pessoal/imagem | **mantida** (ver seção 5) |
| IndexedDB | `volumfocus-wearables`, `jg3_wearable_keys` | frequência cardíaca etc. (cifrado, chave no mesmo IndexedDB) | **SENSÍVEL** (saúde) | limpo no logout. Proteção limitada (chave na mesma origem). Gravação offline não bloqueada nesta versão (pendência P2) |
| Object URLs | fotos/vídeos exibidos | referência temporária em memória | Derivado | revogadas após o uso (10 chamadas de `revokeObjectURL`) |
| Memória (Zustand sem persist) | `useMinhasRotinasStore`, `avaliacoes`, `notas` | rotinas do aluno, avaliações, anotações | SENSÍVEL em parte | só memória; limpa em logout/troca de conta/perda de contexto |

## 2. Política implementada

**Online** (rede + conta autorizada pelo gate): Rules do Firestore autorizam cada acesso; cache sensível em disco foi eliminado (avaliações/anotações); rascunho e cadastro seguem persistidos com isolamento por dono e limpeza no logout.

**Offline** (sem rede, ou sem contexto autorizado): `podePersistirSensivel()` é falso →
- cadastro, rascunho de avaliação e sessões **não são gravados em disco**: ficam em memória e se perdem ao recarregar/sair (comportamento desejado); ao reconectar **com o mesmo usuário** o valor pendente é gravado; com outra conta, é descartado;
- **indisponíveis** (mensagem clara + aviso no topo): cadastrar/editar aluno, registrar/editar/apagar avaliação (inclui envio da avaliação online), criar/remover anotação, autorização do responsável, backup/sincronização;
- anotação já aberta pode ser editada, mas só na memória; ao recarregar/fechar com texto não sincronizado, o navegador pede confirmação;
- nada entra em fila persistente: não existe sincronização posterior de dado de origem não comprovada. Escritas feitas depois, online, passam pelas Rules com o token da sessão.

**Limpeza** (`limparMemoriaSensivel` + `wipeLocalData`): ao perder a sessão, negar acesso, trocar de conta ou sair, zera avaliações/anotações em memória e os pendentes. No logout apaga também localStorage, rascunhos, a quarentena e IndexedDB de wearables. Cobre localStorage, IndexedDB e memória React/Zustand (não existe Cache API/SW a limpar).

## 3. Isolamento entre usuários

Mantidos: `jg3_owner` (troca de dono ⇒ limpeza + recarga), chaves de rascunho/mídia por ownerUUID + cliente, nenhum acesso sem sessão autorizada.

## 4. Migração sem perda acidental

1. Na primeira carga com a versão nova, o `migrate` do Zustand **copia** avaliações/anotações antigas para `jg3_legado_sensivel_v1` (com o dono do aparelho) antes de qualquer regravação.
2. Depois do login autorizado e **online**, `reconciliarLegadoSensivel()` confere cada item na nuvem: anotação ausente é enviada; mais nova que a da nuvem, atualizada; avaliação precisa existir na nuvem.
3. Só quando **tudo** está confirmado a quarentena é apagada e `jg3_alunos` é regravado sem o conteúdo sensível.
4. Itens não confirmados (rede caiu, avaliação inexistente na nuvem) **permanecem** na quarentena; o app avisa a quantidade.
5. Dono diferente do atual ou ausente ⇒ origem não comprovada: **nada é enviado**, nada é apagado.

## 5. Fotos e vídeos (análise separada — nada foi apagado)

- Existem **só neste aparelho** (plano Spark, sem Storage): apagar é perda definitiva. Por isso não há limpeza automática.
- Isolamento: chave por `ownerUUID` + cliente (+ avaliação/exercício); sem sessão autorizada nenhum registro é acessível pelo app; um usuário não monta a chave de outro.
- Ciclo de vida atual: permanecem após o logout (por decisão anterior); `hasLocalMedia`/`deletePhotosByOwner` existem mas não têm chamadores (sem tela para o usuário apagar tudo). Menores: só gravam com autorização de uso de imagem (Mini 5).
- **Pendência para decisão (jurídica/produto):** prazo de retenção da mídia, tela "apagar mídia deste aparelho" e se o logout deve oferecer apagar. Sem esse requisito aprovado, nada é removido automaticamente.
- Controle de acesso é lógico (namespace), **não criptografia**.

## 5b. Limites (não prometemos proteção contra)

Dispositivo comprometido/malware; pessoa com acesso ao perfil do navegador e ao sistema operacional (pode ler localStorage/IndexedDB no disco ou a memória); extensões do navegador; aparelho sem bloqueio de tela. Dado já gravado em disco antes de a versão nova (cadastro, mídia, wearables) continua lá até logout/limpeza. A "memória apenas" protege contra cópias persistentes, não contra quem tem o aparelho aberto e desbloqueado.

## 6. Pendências

- P1: levar `restricoes` (saúde) para fora do cadastro persistido (ou criptografar) exige mudar o backup/fonte de verdade — decisão de arquitetura.
- P2: gravação de wearables (IndexedDB) offline não bloqueada.
- P3: retenção/tela de apagar mídia (seção 5).
- P4: `navigator.onLine` não prova que o Firebase está acessível; falhas de rede reais continuam tratadas pelos erros existentes.
