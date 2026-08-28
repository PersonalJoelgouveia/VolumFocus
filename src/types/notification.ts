/**
 * Tipo "Treino concluído" — sucessor de `ntf_treinos` / `jg3_notificacoes_treinos`
 * (index.html ~10389-10430), agora um documento Firestore (não mais
 * localStorage) para o Personal poder ver a notificação vindo de outro
 * dispositivo do que o do aluno.
 *
 * O outro fluxo unificado na view #view-notifications do monolito —
 * "Solicitação de cadastro" via link de convite (cli_pendentes) — não foi
 * portado ainda: o formulário público de auto-cadastro em si (?convite=1)
 * é uma frente à parte, ainda não migrada para o React.
 */
export interface TreinoNotificacao {
  /** Id determinístico: `${alunoEmail}_${dataTreino}_${dia}` — mesma função do `dedupeKey` original. */
  id: string;
  alunoEmail: string;
  alunoNome: string;
  /** Índice do dia da semana concluído (0=Segunda...6=Domingo). */
  dia: number;
  /** Data do treino no formato YYYY-MM-DD. */
  dataTreino: string;
  lida: boolean;
  criadaEm: string;
}
