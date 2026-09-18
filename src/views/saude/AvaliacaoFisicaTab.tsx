import { useUIStore } from '../../store/useUIStore';
import { MinhaAvaliacaoFisicaView } from '../MinhaAvaliacaoFisicaView';

/**
 * Aba "Avaliação Física" do hub Saúde. Zero lógica nova: reusa
 * `MinhaAvaliacaoFisicaView` (que já resolve o aluno logado e monta
 * `AvaliacaoFisicaModal` em `readOnly`) exatamente como o antigo botão 📋
 * da Topbar fazia — só muda onde ela é renderizada.
 *
 * `AvaliacaoFisicaModal`/`PhysicalAssessmentDashboard`/`CompareAssessmentsModal`
 * continuam com seu próprio `.modal-backdrop`/`.cli-detail-panel` interno
 * (usado também pela tela do Personal em Clientes, que continua modal de
 * propósito). Aqui o wrapper `.sh-af-embed` (ver SaudeView.css) sobrescreve
 * só a apresentação — posição estática, sem overlay escuro, ocupando 100%
 * da largura — pra virar conteúdo do workspace central em vez de modal,
 * sem tocar em nenhum desses componentes compartilhados.
 *
 * `onVoltar` é passado como `onClose`: o "×" do topo da Avaliação Física
 * (equivalente ao antigo fechar do modal) agora volta pra aba Visão Geral
 * do hub, em vez de fechar um modal que deixou de existir aqui.
 */
export function AvaliacaoFisicaTab({ onVoltar }: { onVoltar: () => void }) {
  const isAlunoMode = useUIStore((s) => s.isAlunoMode);
  const setActiveView = useUIStore((s) => s.setActiveView);

  if (!isAlunoMode) {
    return (
      <div className="sh-redirect-card">
        <div className="sh-redirect-ico" aria-hidden="true">📋</div>
        <div className="sh-redirect-txt">
          A Avaliação Física é individual por aluno — acesse pelo perfil dele na tela Clientes.
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setActiveView('clientes')}>
          Ir para Clientes
        </button>
      </div>
    );
  }

  return (
    <div className="sh-af-embed">
      <MinhaAvaliacaoFisicaView onClose={onVoltar} />
    </div>
  );
}
