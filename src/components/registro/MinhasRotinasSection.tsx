import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import {
  selectRotinasOrdenadas,
  selectStatusMinhasRotinas,
  useMinhasRotinasStore,
} from '../../store/useMinhasRotinasStore';
import { DetalheRotinaLeitura, ListaCartoesRotina } from './RotinaCartoes';
import type { TreinoAgrupado } from '../../utils/agruparTreinos';
import './MinhasRotinasSection.css';

interface MinhasRotinasSectionProps {
  /** Rotina aberta no detalhe (estado controlado por RegistroView), ou null = lista. */
  abertaId: string | null;
  onAbrir: (id: string) => void;
  onVoltar: () => void;
  /** Aluno tocou em "Usar treino": o pai confirma sobreposição e aplica no dia de hoje. */
  onUsarTreino?: (treino: TreinoAgrupado) => void;
}

/**
 * Seção "Rotinas" do aluno em Treinos: cards com TODAS as rotinas dele (a ativa
 * primeiro, marcada "Atual"). Tocar num card abre o DETALHE da rotina (semana
 * completa, somente leitura) no lugar da lista, com botão para voltar — NÃO
 * importa nada para a Semana Atual e não toca no useWorkoutStore.
 *
 * Dados: useMinhasRotinasStore (identidade vem do Firebase Auth, leitura única).
 * Sem controles de Personal: é somente leitura.
 */
export function MinhasRotinasSection({ abertaId, onAbrir, onVoltar, onUsarTreino }: MinhasRotinasSectionProps) {
  const email = useAuthStore((s) => s.user?.email);
  const rotinas = useMinhasRotinasStore(selectRotinasOrdenadas);
  const status = useMinhasRotinasStore(selectStatusMinhasRotinas);
  const erro = useMinhasRotinasStore((s) => s.erro);
  const carregar = useMinhasRotinasStore((s) => s.carregar);

  // Só o id é guardado; a rotina é resolvida na lista atual (nunca fica cópia obsoleta).
  const aberta = abertaId ? rotinas.find((r) => r.id === abertaId) : undefined;

  useEffect(() => {
    void carregar();
  }, [email, carregar]);

  if (status === 'nao-autorizado') return null;

  if (abertaId) {
    return (
      <section className="mrs" aria-label="Detalhe da rotina">
        {aberta ? (
          <DetalheRotinaLeitura rotina={aberta} onVoltar={onVoltar} onUsarTreino={onUsarTreino} rotuloUsar="Usar" />
        ) : (
          <>
            <button className="btn btn-ghost btn-sm mrs-voltar" onClick={onVoltar}>
              ← Voltar às rotinas
            </button>
            <div className="mrs-note">
              {status === 'carregando' ? 'Carregando rotina…' : 'Esta rotina não está mais disponível.'}
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="mrs" aria-label="Rotinas">
      <div className="mrs-head">
        <div className="mrs-title">Rotinas</div>
        <button className="btn btn-ghost btn-sm" onClick={() => void carregar()} disabled={status === 'carregando'}>
          {status === 'carregando' ? 'Atualizando…' : '🔄 Atualizar'}
        </button>
      </div>

      {status === 'erro' && <div className="mrs-note">⚠️ {erro ?? 'Não foi possível carregar suas rotinas.'}</div>}
      {status === 'carregando' && rotinas.length === 0 && <div className="mrs-note">Carregando suas rotinas…</div>}
      {status === 'pronto' && rotinas.length === 0 && (
        <div className="mrs-note">Seu Personal ainda não criou rotinas para você.</div>
      )}

      {rotinas.length > 0 && <ListaCartoesRotina rotinas={rotinas} onAbrir={onAbrir} />}

    </section>
  );
}
