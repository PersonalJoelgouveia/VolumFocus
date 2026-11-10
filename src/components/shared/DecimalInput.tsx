import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { decimalToInputText, parseDecimal, sanitizeDecimalInput } from '../../utils/decimalInput';

interface DecimalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  /** Valor numérico no estado do pai. */
  value: number;
  /** Recebe o número já convertido (ponto ou vírgula). Campo vazio/inválido → `emptyValue`. */
  onValueChange: (n: number) => void;
  /** Valor emitido quando o campo está vazio ou só tem o separador. Padrão: 0. */
  emptyValue?: number;
  /** Máximo de casas decimais aceitas. Padrão: 2 (ex.: 20.75). */
  maxDecimals?: number;
}

/**
 * Input de peso/carga com número no estado do pai, mas texto livre enquanto digita.
 * Mantém o rascunho local ("12," / "12.") para não ser sobrescrito pelo valor numérico,
 * e só ressincroniza quando o pai muda o valor por outro caminho.
 */
export function DecimalInput({ value, onValueChange, emptyValue = 0, maxDecimals = 2, ...rest }: DecimalInputProps) {
  const [text, setText] = useState(() => decimalToInputText(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(decimalToInputText(value));
    }
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const clean = sanitizeDecimalInput(e.target.value, maxDecimals);
        const n = parseDecimal(clean) ?? emptyValue;
        setText(clean);
        lastEmitted.current = n;
        onValueChange(n);
      }}
      onBlur={(e) => {
        setText(decimalToInputText(parseDecimal(text)));
        rest.onBlur?.(e);
      }}
    />
  );
}
