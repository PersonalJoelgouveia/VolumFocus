import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import {
  selectRotinasOrdenadas,
  selectStatusMinhasRotinas,
  useMinhasRotinasStore,
} from '../../store/useMinhasRotinasStore';
import { resumirRotina } from '../../utils/resumoRotina';
import { DAYS_SHORT } from '../../types/workout';
import type { AlunoRotinaSalva } from '../../types/aluno';
import { RotinaSemanaLeitura } from './RotinaSemanaLeitura';
import './RotinasModal.css';
import './MinhasRotinasSection.css';

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

interface MinhasRotinasSectionProps {
  /** Rotina aberta no detalhe (estado controlado por RegistroView), ou null = lista. */
  abertaId: string | null;
  onAbrir: (id: string) => void;
  onVoltar: () => void;
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
export function MinhasRotinasSection({ abertaId, onAbrir, onVoltar }: MinhasRotinasSectionProps) {
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
        <button className="btn btn-ghost btn-sm mrs-voltar" onClick={onVoltar}>
          ← Voltar às rotinas
        </button>

        {!aberta ? (
          <div className="mrs-note">
            {status === 'carregando' ? 'Carregando rotina…' : 'Esta rotina não está mais disponível.'}
          </div>
        ) : (
          <>
            <div className="mrs-detalhe-head">
              <div className="mrs-detalhe-nome">{aberta.nome}</div>
              {aberta.ativa && <span className="mrs-badge">Atual</span>}
            </div>
            <div className="routine-meta">
              {resumirRotina(aberta.rotina).diasComTreino.length} dias de treino ·{' '}
              {resumirRotina(aberta.rotina).totalExercicios} exercícios
              {aberta.atualizadaEm && ` · atualizada em ${dataCurta(aberta.atualizadaEm)}`}
            </div>
            <p className="mrs-readonly">Somente leitura — abrir a rotina não altera seu treino da semana.</p>
            <RotinaSemanaLeitura key={aberta.id} rotina={aberta.rotina} />
            <button className="btn btn-ghost btn-sm btn-full mrs-voltar-fim" onClick={onVoltar}>
              ← Voltar às rotinas
            </button>
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

      {rotinas.length > 0 && (
        <div className="mrs-list">
          {rotinas.map((r) => (
            <CartaoRotina key={r.id} rotina={r} onAbrir={() => onAbrir(r.id)} />
          ))}
        </div>
      )}

    </section>
  );
}

function CartaoRotina({ rotina, onAbrir }: { rotina: AlunoRotinaSalva; onAbrir: () => void }) {
  const { diasComTreino, totalExercicios } = resumirRotina(rotina.rotina);
  return (
    <button className={`mrs-card${rotina.ativa ? ' mrs-card-ativa' : ''}`} onClick={onAbrir}>
      <div className="mrs-card-top">
        <span className="mrs-card-nome">{rotina.nome}</span>
        {rotina.ativa && <span className="mrs-badge">Atual</span>}
      </div>
      <div className="routine-meta">
        {diasComTreino.length} dia{diasComTreino.length === 1 ? '' : 's'} · {totalExercicios} ex.
        {rotina.atualizadaEm && ` · ${dataCurta(rotina.atualizadaEm)}`}
      </div>
      {diasComTreino.length > 0 && (
        <div className="mrs-pills">
          {diasComTreino.map((d) => (
            <span className="routine-day-pill" key={d}>
              {DAYS_SHORT[d]}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
