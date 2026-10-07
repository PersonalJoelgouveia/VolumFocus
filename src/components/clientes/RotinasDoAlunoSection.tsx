import { useEffect, useState } from 'react';
import { selectRotinasDoAluno, useRotinasDoAlunoStore } from '../../store/useRotinasDoAlunoStore';
import type { AlunoRotinaSalva } from '../../types/aluno';
import { DetalheRotinaLeitura, ListaCartoesRotina } from '../registro/RotinaCartoes';
import '../registro/MinhasRotinasSection.css';

/**
 * Seção "Rotinas" do mini perfil do aluno (visão do Personal). Lê `alunos/{email}/rotinas`
 * direto da nuvem (useRotinasDoAlunoStore) — nada é duplicado no perfil. Ativa primeiro
 * ("Atual"); tocar numa rotina abre a semana em MODO LEITURA, sem tocar na execução do
 * aluno nem na Semana Atual de ninguém.
 */
export function RotinasDoAlunoSection({
  email,
  onEditar,
}: {
  email: string;
  /** Carrega a rotina aberta no editor do Personal (rascunho local). */
  onEditar?: (rotina: AlunoRotinaSalva) => void;
}) {
  const { status, ordenadas, erro } = useRotinasDoAlunoStore(selectRotinasDoAluno(email));
  const carregar = useRotinasDoAlunoStore((s) => s.carregar);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const aberta = abertaId ? ordenadas.find((r) => r.id === abertaId) : undefined;

  useEffect(() => {
    void carregar(email);
  }, [email, carregar]);

  if (abertaId) {
    return (
      <section className="mrs" aria-label="Detalhe da rotina">
        {aberta ? (
          <DetalheRotinaLeitura rotina={aberta} onVoltar={() => setAbertaId(null)} onEditar={onEditar ? () => onEditar(aberta) : undefined} />
        ) : (
          <>
            <button className="btn btn-ghost btn-sm mrs-voltar" onClick={() => setAbertaId(null)}>
              ← Voltar às rotinas
            </button>
            <div className="mrs-note">Esta rotina não está mais disponível.</div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="mrs" aria-label="Rotinas do aluno">
      <div className="mrs-head">
        <div className="mrs-title">Rotinas</div>
        <button className="btn btn-ghost btn-sm" onClick={() => void carregar(email)} disabled={status === 'carregando'}>
          {status === 'carregando' ? 'Atualizando…' : '🔄 Atualizar'}
        </button>
      </div>

      {status === 'erro' && <div className="mrs-note">⚠️ {erro}</div>}
      {status === 'carregando' && ordenadas.length === 0 && <div className="mrs-note">Carregando rotinas…</div>}
      {status === 'pronto' && ordenadas.length === 0 && (
        <div className="mrs-note">Nenhuma rotina salva para este aluno ainda. Use Rotinas → Salvar Atual numa sessão dele.</div>
      )}
      {status === 'pronto' && ordenadas.length > 0 && !ordenadas[0].ativa && (
        <div className="mrs-note">Este aluno não tem rotina ativa no momento.</div>
      )}

      {ordenadas.length > 0 && <ListaCartoesRotina rotinas={ordenadas} onAbrir={setAbertaId} />}
    </section>
  );
}
