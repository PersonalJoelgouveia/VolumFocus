// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../lib/firebase', () => ({ auth: {}, db: {}, storage: {}, firebaseApp: {} }));

import { useCardioTestStore } from '../../../store/useCardioTestStore';
import { CardioHistoryCard } from '../CardioHistoryCard';

afterEach(cleanup);

describe('CardioHistoryCard', () => {
  it('ao clicar num teste salvo mostra o resultado detalhado (zonas de FC) igual ao fim do teste', () => {
    const r = {
      id: 'a',
      data: '2026-11-24T10:00:00Z',
      inputs: { gender: 'M', age: 30, weight: 70, fcRest: 60, modality: 'esteira', protocol: 'cooper' },
      vo2: 29.2,
      fcMax: 188,
      fcRest: 60,
      fcr: 128,
      classification: { key: 'fraco', label: 'Fraco', cls: 'x' },
      zones: [{ key: 'z1', name: 'Z1 · Recuperação', desc: 'd', cls: 'z1', min: 0.5, max: 0.6, bpmMin: 124, bpmMax: 137 }],
      formulaUsed: 'Gellish',
    };
    useCardioTestStore.setState({ testes: [r as never] });
    render(<CardioHistoryCard />);
    expect(screen.queryByText('Z1 · Recuperação')).toBeNull();
    fireEvent.click(screen.getByTitle('Ver detalhes e zonas de FC'));
    expect(screen.getByText('Z1 · Recuperação')).toBeTruthy();
    expect(screen.getByText('124 – 137')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Ocultar detalhes'));
    expect(screen.queryByText('Z1 · Recuperação')).toBeNull();
  });
});
