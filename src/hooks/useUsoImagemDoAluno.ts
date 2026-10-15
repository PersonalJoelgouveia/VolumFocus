import { useEffect, useState } from 'react';
import { useAlunoStore } from '../store/useAlunoStore';
import { isMenor, maioridadeIso } from '../lib/consentimento';
import { avaliarSituacaoDoMenor } from '../lib/consentimentoRepository';

/**
 * Lado do PERSONAL: fotos/vídeos de um aluno só são liberados se ele for adulto OU o responsável
 * autorizou o uso de imagem (finalidade separada). Enquanto carrega ou se a leitura falhar: NÃO liberado.
 */
export function useUsoImagemDoAluno(alunoId: string): boolean | null {
  const aluno = useAlunoStore((s) => s.alunos.find((a) => a.id === alunoId));
  const email = aluno?.email;
  const nasc = aluno?.dataNascimento;
  const menor = isMenor(nasc);
  const [ok, setOk] = useState<boolean | null>(menor ? null : true);

  useEffect(() => {
    if (!menor || !email) {
      setOk(true);
      return;
    }
    let vivo = true;
    setOk(null);
    avaliarSituacaoDoMenor(email, maioridadeIso(nasc))
      .then((s) => vivo && setOk(s.usoImagemOk))
      .catch(() => vivo && setOk(false));
    return () => {
      vivo = false;
    };
  }, [menor, email, nasc]);

  return ok;
}
