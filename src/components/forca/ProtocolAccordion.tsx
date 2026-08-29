/** Sucessor do accordion #str-accordion (index.html ~2879-2919) — <details> nativo, mesmo texto. */
export function ProtocolAccordion() {
  return (
    <details className="str-protocol-details">
      <summary className="str-protocol-summary">📋 Diretrizes do Teste de 1RM (Predição por Múltiplas Fórmulas)</summary>
      <div className="str-protocol-content">
        <p className="str-protocol-intro">
          Este protocolo estima sua força máxima com segurança clínica, sem expor suas articulações a uma carga extrema de
          repetição única. Siga os critérios científicos abaixo para validar o teste:
        </p>
        <div className="str-protocol-grid">
          <div>
            <div className="str-protocol-section-title">Critérios Científicos</div>
            <ul className="str-protocol-list">
              <li>
                <strong>Zona Alvo (3 a 10 Repetições):</strong> Ajuste a carga para falhar estritamente nessa faixa. Mais de
                10 repetições comprometem a precisão matemática da equação.
              </li>
              <li>
                <strong>Técnica Padronizada:</strong> O movimento deve manter amplitude completa do início ao fim.
                Compensações posturais invalidam o teste.
              </li>
              <li>
                <strong>Ponto de Falha:</strong> Interrompa na falha concêntrica voluntária — quando for impossível
                completar a subida sem auxílio.
              </li>
            </ul>
          </div>
          <div>
            <div className="str-protocol-section-title">Passo a Passo Clínico-Esportivo</div>
            <ul className="str-protocol-list">
              <li>
                <span className="str-protocol-step">01.</span> <strong>Ativação:</strong> 5 min de mobilidade geral e
                cárdio leve.
              </li>
              <li>
                <span className="str-protocol-step">02.</span> <strong>Aclimatamento:</strong> 8 reps com ~50% da carga
                estimada + 2 min de pausa.
              </li>
              <li>
                <span className="str-protocol-step">03.</span> <strong>Ajuste:</strong> 4 reps com ~70% da carga estimada
                + 2 min de pausa.
              </li>
              <li>
                <span className="str-protocol-step">04.</span> <strong>Validação:</strong> Execute a série com a carga de
                teste até a falha. Registre o peso (W) e as repetições (R).
              </li>
            </ul>
          </div>
        </div>
      </div>
    </details>
  );
}
