import { useEffect, useState } from 'react';
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

/**
 * Seção "Rotinas" do aluno em Treinos: cards com TODAS as rotinas dele (a ativa
 * primeiro, marcada "Atual"). Tocar num card abre a prescrição semanal em modo
 * leitura — NÃO importa nada para a Semana Atual e não toca no useWorkoutStore.
 *
 * Dados: useMinhasRotinasStore (identidade vem do Firebase Auth, leitura única).
 * Sem controles de Personal: é somente leitura.
 */
export function MinhasRotinasSection() {
  const email = useAuthStore((s) => s.user?.email);
  const rotinas = useMinhasRotinasStore(selectRotinasOrdenadas);
  const status = useMinhasRotinasStore(selectStatusMinhasRotinas);
  const erro = useMinhasRotinasStore((s) => s.erro);
  const carregar = useMinhasRotinasStore((s) => s.carregar);

  // Guarda só o id; a rotina é resolvida na lista atual (nunca fica cópia obsoleta).
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const aberta = abertaId ? rotinas.find((r) => r.id === abertaId) : undefined;

  useEffect(() => {
    void carregar();
  }, [email, carregar]);

  if (status === 'nao-autorizado') return null;

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
            <CartaoRotina key={r.id} rotina={r} onAbrir={() => setAbertaId(r.id)} />
          ))}
        </div>
      )}

      {aberta && (
        <div className="modal-backdrop" onClick={() => setAbertaId(null)}>
          <div className="cli-detail-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>
                {aberta.nome} {aberta.ativa && <span className="mrs-badge">Atual</span>}
              </h2>
              <button className="modal-close" onClick={() => setAbertaId(null)} aria-label="Fechar">
                ×
              </button>
            </div>
            {aberta.atualizadaEm && <div className="cli-last">Atualizada em: {dataCurta(aberta.atualizadaEm)}</div>}
            <p className="mrs-readonly">Somente leitura — abrir a rotina não altera seu treino da semana.</p>
            <RotinaSemanaLeitura key={aberta.id} rotina={aberta.rotina} />
          </div>
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
