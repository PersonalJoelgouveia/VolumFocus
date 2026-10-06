import { useEffect, useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useRotinaStore } from '../../store/useRotinaStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useSessionStore } from '../../store/useSessionStore';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useRotinasDoAlunoStore } from '../../store/useRotinasDoAlunoStore';
import { resolverRotinaAtivaDoAluno } from '../../lib/rotinaAtivaAluno';
import type { RotinaAtivaResolvida } from '../../lib/rotinaAtivaAluno';
import { criarRotinaAluno } from '../../lib/alunoRotinasRepository';
import { buildAlunoRotinaFromWeekLog } from '../../utils/importAlunoRotina';
import { aplicarRotinaNaSemana } from '../../utils/aplicarRotinaNaSemana';
import { DAYS_SHORT } from '../../types/workout';
import './RotinasModal.css';

type PtLoadState = 'idle' | 'loading' | 'error' | 'empty' | 'ready';

const MODAL_ID = 'rotinas';

/**
 * Sucessor de #modal-rotinas + openRotinasModal/renderRotinasList/
 * rotinaSaveFromCurrent/_rotinaExec/rotinaExcluir (index.html
 * ~5763-5912): salvar a semana atual como template nomeado, listar,
 * aplicar (substituir ou mesclar) e excluir.
 *
 * Também concentra, para o aluno, o acesso explícito à rotina publicada
 * pelo Personal (sucessora de MinhaRotinaView.tsx, removida após a fusão
 * de "Minha Rotina" em "Treinos"): fetchPublishedRotina + import via
 * utils/importAlunoRotina.ts. A checagem/aviso automático continua em
 * AlunoRotinaSyncBanner.tsx — este painel é só a via manual explícita.
 */
export function RotinasModal() {
  const openModalId = useUIStore((s) => s.openModalId);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const isAlunoMode = useUIStore((s) => s.isAlunoMode);
  const isOpen = openModalId === MODAL_ID;

  const weekLog = useWorkoutStore((s) => s.weekLog);
  const rotinas = useRotinaStore((s) => s.rotinas);
  const salvar = useRotinaStore((s) => s.salvar);
  const remover = useRotinaStore((s) => s.remover);
  const aplicar = useRotinaStore((s) => s.aplicar);

  const [nome, setNome] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  // Rotina publicada pelo Personal — via alternativa/explícita ao aviso
  // automático do AlunoRotinaSyncBanner (Treinos > Semana Atual), mesma
  // lógica de import de utils/importAlunoRotina.ts.
  const user = useAuthStore((s) => s.user);
  const exercises = useExerciseStore((s) => s.exercises);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const [ptState, setPtState] = useState<PtLoadState>('idle');
  const [ptRotina, setPtRotina] = useState<RotinaAtivaResolvida | null>(null);
  const [ptImporting, setPtImporting] = useState(false);

  // Sessão de aluno em foco (Personal acompanhando um aluno): "Salvar Atual"
  // grava a semana como NOVA rotina ativa do aluno, em vez de em Rotinas Salvas.
  // Selecionamos os arrays brutos (referência estável) e resolvemos fora do seletor.
  const role = useAuthStore((s) => s.role);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const alunos = useAlunoStore((s) => s.alunos);
  const sessaoAtiva = role === 'personal' && activeSessionId ? sessions.find((x) => x.id === activeSessionId) : undefined;
  const alunoDaSessao = sessaoAtiva ? alunos.find((a) => a.id === sessaoAtiva.alunoId) : undefined;
  const [salvandoAluno, setSalvandoAluno] = useState(false);

  useEffect(() => {
    if (!isOpen || !isAlunoMode || !user?.email) return;
    setPtState('loading');
    resolverRotinaAtivaDoAluno()
      .then((result) => {
        if (!result) return setPtState('empty');
        setPtRotina(result);
        setPtState('ready');
      })
      .catch((e) => {
        console.error('RotinasModal: falha ao carregar rotina publicada', e);
        setPtState('error');
      });
  }, [isOpen, isAlunoMode, user?.email]);

  if (!isOpen) return null;

  async function handleImportarDoPersonal() {
    if (!ptRotina) return;
    const ok = await useConfirmStore.getState().ask(
      'Importar esta rotina para Treinos → Semana Atual? Isso substitui o que já estiver registrado nos dias com exercícios prescritos.',
      { confirmLabel: 'Importar Rotina' }
    );
    if (!ok) return;

    setPtImporting(true);
    try {
      const { novosExercicios } = aplicarRotinaNaSemana(ptRotina, exercises, addExercise, 'mesclar-dias');
      const extra = novosExercicios.length ? ` (${novosExercicios.length} exercício(s) novo(s) criado(s) no banco)` : '';
      showToast(`✅ Rotina do Personal importada!${extra}`, 'success');
    } catch (e) {
      console.error('RotinasModal: falha ao importar rotina do Personal', e);
      showToast('⚠️ Não foi possível importar a rotina.', 'error');
    } finally {
      setPtImporting(false);
    }
  }

  async function handleSalvarParaAluno(trimmed: string) {
    const primeiroNome = (alunoDaSessao?.nome ?? sessaoAtiva?.alunoNome ?? 'aluno').split(' ')[0];
    // Sessão aberta mas sem e-mail resolvível: NÃO cai no salvamento pessoal (iria pro lugar errado).
    if (!alunoDaSessao?.email || !user?.email) {
      return showToast('⚠️ Não foi possível identificar o e-mail do aluno desta sessão.', 'error');
    }
    const { rotina, exerciciosNaoResolvidos } = buildAlunoRotinaFromWeekLog(weekLog, exercises);
    if (rotina.every((d) => d.exercicios.length === 0)) {
      return showToast('⚠️ A semana atual está vazia. Adicione exercícios antes de salvar.', 'warning');
    }
    const aviso = exerciciosNaoResolvidos.length
      ? ` ${exerciciosNaoResolvidos.length} exercício(s) não encontrado(s) no banco serão omitidos.`
      : '';
    const ok = await useConfirmStore.getState().ask(
      `Salvar "${trimmed}" como a nova rotina ativa de ${primeiroNome}? A rotina ativa anterior será mantida, mas desativada.${aviso}`,
      { confirmLabel: 'Salvar Rotina' }
    );
    if (!ok) return;

    setSalvandoAluno(true);
    try {
      await criarRotinaAluno(alunoDaSessao.email, {
        nome: trimmed,
        personalEmail: user.email,
        rotina,
        ativa: true,
      });
      setNome('');
      // Mini perfil do aluno passa a refletir a nova ativa sem recarregar a página.
      void useRotinasDoAlunoStore.getState().carregar(alunoDaSessao.email);
      showToast(`✅ Rotina "${trimmed}" salva e ativada para ${primeiroNome}!`, 'success');
    } catch (e) {
      console.error('RotinasModal: falha ao salvar rotina do aluno', e);
      showToast('⚠️ Não foi possível salvar a rotina do aluno. Tente novamente.', 'error');
    } finally {
      setSalvandoAluno(false);
    }
  }

  function handleSalvar() {
    const trimmed = nome.trim();
    if (!trimmed) return showToast('⚠️ Digite um nome para a rotina', 'warning');
    if (sessaoAtiva) {
      if (!salvandoAluno) void handleSalvarParaAluno(trimmed);
      return;
    }
    salvar(trimmed, weekLog);
    setNome('');
    showToast('✅ Rotina salva!', 'success');
  }

  async function handleExcluir(id: number) {
    const ok = await useConfirmStore.getState().ask('Excluir esta rotina?', { confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    remover(id);
    showToast('🗑️ Rotina removida', 'success');
  }

  function handleAplicar(id: number, mode: 'replace' | 'merge') {
    const r = aplicar(id, mode);
    if (!r) return;
    setLoadingId(null);
    closeModal();
    showToast(`✅ Rotina "${r.nome}" carregada!`, 'success');
  }

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="cli-detail-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>📁 Rotinas Salvas</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Fechar">
            ×
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 16 }}>
          Salve estruturas de treino para reutilizar como ponto de partida da semana.
        </p>

        {isAlunoMode && (
          <div className="routine-item" style={{ marginBottom: 18 }}>
            <div className="routine-name">📋 Rotina do Personal</div>
            {ptState === 'loading' && <div className="routine-meta">Carregando…</div>}
            {ptState === 'error' && (
              <div className="routine-meta">⚠️ Não foi possível carregar. Tente reabrir este painel.</div>
            )}
            {ptState === 'empty' && <div className="routine-meta">Seu Personal ainda não publicou uma rotina.</div>}
            {ptState === 'ready' && ptRotina && (
              <>
                {ptRotina.nome && <div className="routine-meta">Rotina atual: {ptRotina.nome}</div>}
                <button
                  className="btn btn-primary btn-sm btn-full"
                  style={{ marginTop: 8 }}
                  onClick={handleImportarDoPersonal}
                  disabled={ptImporting || ptRotina.rotina.every((d) => d.exercicios.length === 0)}
                >
                  {ptImporting ? 'Importando…' : '📥 Importar Rotina do Personal'}
                </button>
              </>
            )}
          </div>
        )}

        {sessaoAtiva && (
          <p style={{ fontSize: '0.78rem', color: 'var(--teal)', marginBottom: 8 }}>
            👤 Sessão de {sessaoAtiva.alunoNome}: "Salvar Atual" cria uma nova rotina para este aluno e a torna a rotina ativa.
          </p>
        )}
        <div className="rotinas-create-block">
          <input
            type="text"
            placeholder="Nome da rotina (ex: Push/Pull/Legs)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
          />
          <button className="btn btn-primary btn-sm" onClick={handleSalvar} disabled={salvandoAluno}>
            {salvandoAluno ? 'Salvando…' : '💾 Salvar Atual'}
          </button>
        </div>

        {rotinas.length === 0 ? (
          <div className="rotinas-empty">
            Nenhuma rotina salva ainda.
            <br />
            <span style={{ fontSize: '0.72rem' }}>Monte a semana no Registro e salve acima.</span>
          </div>
        ) : (
          <div className="routine-list">
            {rotinas.map((r) => {
              const diasAtivos = Object.entries(r.log).filter(([, exs]) => exs?.length > 0);
              const totalEx = diasAtivos.reduce((s, [, exs]) => s + exs.length, 0);
              const isChoosing = loadingId === r.id;
              return (
                <div className="routine-item" key={r.id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="routine-name">{r.nome}</div>
                      <div className="routine-meta">
                        {diasAtivos.length} dia{diasAtivos.length === 1 ? '' : 's'} · {totalEx} ex. ·{' '}
                        {new Date(r.criada).toLocaleDateString('pt-BR')}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                        {diasAtivos.map(([d]) => (
                          <span className="routine-day-pill" key={d}>
                            {DAYS_SHORT[Number(d)]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Excluir" onClick={() => handleExcluir(r.id)}>
                      ✕
                    </button>
                  </div>

                  {isChoosing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAplicar(r.id, 'replace')}>
                        🔄 Substituir semana inteira
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleAplicar(r.id, 'merge')}>
                        ➕ Adicionar por cima
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setLoadingId(null)}>
                        ← Voltar
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-primary btn-sm btn-full" onClick={() => setLoadingId(r.id)}>
                      Aplicar na Semana Atual →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
