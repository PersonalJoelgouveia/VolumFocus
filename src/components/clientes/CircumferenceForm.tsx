import {
  criarCircunferenciaPersonalizada,
  validarCircunferencias,
  type CircumferenceEntry,
  type CircumferenceSide,
} from '../../utils/circumference';
import './CircumferenceForm.css';

interface CircumferenceFormProps {
  /** Lista completa (padrão + personalizadas) — componente é totalmente controlado. */
  value: CircumferenceEntry[];
  onChange: (entries: CircumferenceEntry[]) => void;
  /** Quem usa decide quando revelar erros (ex.: só após tentar salvar o formulário pai). */
  mostrarErros?: boolean;
}

/**
 * Formulário reutilizável de circunferências corporais. Sem lógica de
 * domínio própria: modelo, validação e conversão pro formato de histórico
 * moram em utils/circumference.ts. Este componente só orquestra inputs
 * controlados — pode ser embutido em qualquer fluxo (protocolo de
 * Avaliação Física hoje, outro contexto amanhã).
 */
export function CircumferenceForm({ value, onChange, mostrarErros = false }: CircumferenceFormProps) {
  const erros = validarCircunferencias(value);

  function erroDoCampo(id: string) {
    return mostrarErros ? erros.find((e) => e.id === id)?.message : undefined;
  }

  function atualizar(id: string, patch: Partial<CircumferenceEntry>) {
    onChange(value.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function adicionarPersonalizada() {
    onChange([...value, criarCircunferenciaPersonalizada()]);
  }

  function removerPersonalizada(id: string) {
    onChange(value.filter((e) => e.id !== id));
  }

  return (
    <div className="cf-wrapper">
      <div className="cf-grid" role="group" aria-label="Circunferências corporais">
        {value.map((entry) => {
          const erro = erroDoCampo(entry.id);
          const inputId = `cf-valor-${entry.id}`;
          const erroId = `cf-erro-${entry.id}`;
          return (
            <div key={entry.id} className={`cf-row${erro ? ' cf-row--erro' : ''}`}>
              {entry.personalizada ? (
                <div className="cf-custom-header">
                  <input
                    type="text"
                    className="cf-custom-name"
                    value={entry.nome}
                    onChange={(e) => atualizar(entry.id, { nome: e.target.value })}
                    placeholder="Nome da medida"
                    aria-label="Nome da medida personalizada"
                  />
                  <select
                    className="cf-side-select"
                    value={entry.lado}
                    onChange={(e) => atualizar(entry.id, { lado: e.target.value as CircumferenceSide })}
                    aria-label={`Lado da medida ${entry.nome || 'personalizada'}`}
                  >
                    <option value="none">Sem lado</option>
                    <option value="direito">Direito</option>
                    <option value="esquerdo">Esquerdo</option>
                  </select>
                  <button
                    type="button"
                    className="cf-remove-btn"
                    onClick={() => removerPersonalizada(entry.id)}
                    aria-label={`Remover medida ${entry.nome || 'personalizada'}`}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label htmlFor={inputId} className="cf-label">
                  {entry.nome}
                </label>
              )}

              <div className="cf-value-row">
                <input
                  id={inputId}
                  type="number"
                  inputMode="decimal"
                  step={0.1}
                  min={0}
                  value={entry.valor ?? ''}
                  onChange={(e) =>
                    atualizar(entry.id, { valor: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                  placeholder="0.0"
                  aria-label={entry.personalizada ? `Valor de ${entry.nome || 'medida personalizada'}` : undefined}
                  aria-invalid={!!erro}
                  aria-describedby={erro ? erroId : undefined}
                />
                <span className="cf-unit" aria-hidden="true">
                  {entry.unidade}
                </span>
              </div>

              {erro && (
                <div id={erroId} className="cf-error" role="alert">
                  {erro}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn-ghost cf-add-btn" onClick={adicionarPersonalizada}>
        + Adicionar medida personalizada
      </button>
    </div>
  );
}
