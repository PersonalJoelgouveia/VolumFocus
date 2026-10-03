import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Nome da área, para a mensagem ("Avaliação Física", "o app"). */
  area?: string;
  /** Se informado, mostra "Fechar" (e reinicia a área) em vez de "Recarregar". */
  onClose?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Impede que uma exceção de renderização (ex.: documento do Firestore com formato
 * inesperado) desmonte o app inteiro: o erro fica contido na área e o usuário
 * recebe uma saída. Não registra o conteúdo dos dados — só o erro técnico.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary: falha ao renderizar', this.props.area ?? 'app', error, info.componentStack);
  }

  private sair = () => {
    if (this.props.onClose) {
      this.setState({ hasError: false });
      this.props.onClose();
    } else {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    const area = this.props.area ?? 'o app';
    return (
      <div className="modal-backdrop" role="alert">
        <div className="cli-detail-panel" style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2>Algo deu errado</h2>
          <p>
            Não foi possível exibir {area}. Os dados podem estar em um formato inesperado. Nenhum dado foi alterado.
          </p>
          <button className="btn btn-primary" onClick={this.sair}>
            {this.props.onClose ? 'Fechar' : 'Recarregar'}
          </button>
        </div>
      </div>
    );
  }
}
