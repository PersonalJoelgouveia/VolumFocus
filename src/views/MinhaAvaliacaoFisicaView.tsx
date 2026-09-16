import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useAlunoStore } from '../store/useAlunoStore';
import { AvaliacaoFisicaModal } from '../components/clientes/AvaliacaoFisicaModal';

/**
 * Avaliação Física do Aluno. Zero componente de UI novo: reusa
 * AvaliacaoFisicaModal (que já carrega Timeline, Dashboard de Evolução e
 * Comparar Avaliações) em `readOnly`. Bloqueio de escrita é redundante de
 * propósito — `readOnly` esconde os botões de Dobras/Bioimpedância
 * (exclusivos do Personal), mas quem garante de verdade é `canWrite`
 * (role==='personal') dentro do próprio AvaliacaoFisicaModal/
 * usePhysicalAssessments. O protocolo Online é a exceção: o botão
 * "Fazer minha autoavaliação" aparece mesmo com `readOnly`, porque o
 * Aluno pode (e deve) enviar sua própria autoavaliação — gate real é
 * `podeEnviarOnline` no hook, não este prop.
 *
 * `useAlunoStore.alunos` começa vazio numa sessão de Aluno (nunca carregou
 * o roster do Personal). O hook de avaliações resolve e-mail via
 * `getAluno(alunoId).email` — então garantimos aqui um registro local
 * mínimo (por e-mail, já que `addAluno` sempre gera seu próprio id) só pra
 * essa resolução funcionar. Não busca nem sobrescreve perfil/rotina; a
 * Avaliação Física em si vem inteira do Firestore (subcoleção por e-mail)
 * pela infra já existente.
 */
export function MinhaAvaliacaoFisicaView({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const email = user?.email?.toLowerCase();
  const existente = useAlunoStore((s) => s.alunos.find((a) => a.email?.toLowerCase() === email));
  const addAluno = useAlunoStore((s) => s.addAluno);
  const [meuAlunoId, setMeuAlunoId] = useState<string | undefined>(existente?.id);

  useEffect(() => {
    if (!email || meuAlunoId) return;
    if (existente) {
      setMeuAlunoId(existente.id);
      return;
    }
    const criado = addAluno({ nome: user?.name ?? email, email, foco: '' });
    setMeuAlunoId(criado.id);
  }, [email, existente, meuAlunoId, user?.name, addAluno]);

  if (!meuAlunoId) return null;

  return <AvaliacaoFisicaModal alunoId={meuAlunoId} onClose={onClose} readOnly />;
}
