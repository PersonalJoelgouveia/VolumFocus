import { describe, expect, it } from 'vitest';
import {
  DIAS_VALIDADE_MAX,
  estadoDoShare,
  expiraEmDias,
  gerarShareId,
  montarLink,
  parseRelatorioHash,
  shareIdValido,
} from '../relatorioShare';
import { montarRelatorio, tituloDoPdf } from '../../utils/relatorioAvaliacao';
import type { PhysicalAssessment } from '../../types/assessment';

const ID = 'AbCdEfGhIjKlMnOpQrStUv';

function av(id: string, date: string, peso: number, gordura?: number): PhysicalAssessment {
  return {
    id,
    alunoId: 'x',
    date,
    protocol: 'bioimpedance',
    anthropometry: { peso, altura: 170, imc: 24 },
    circumferences: [{ id: 'c', nome: 'Cintura', valor: 80 - peso / 100, unidade: 'cm', lado: 'none' }],
    skinfolds: {} as never,
    results: gordura != null ? { percentualGordura: gordura, percentualMassaLegra: 100 - gordura } : {},
    createdAt: date,
    updatedAt: date,
    notes: 'texto livre sensível',
    questionnaire: { triagemSaude: { dor: true } },
  };
}

describe('relatorioShare (puro)', () => {
  it('gera ids aleatórios de 22 chars base64url', () => {
    if (!globalThis.crypto?.getRandomValues) return;
    const a = gerarShareId();
    expect(shareIdValido(a)).toBe(true);
    expect(gerarShareId()).not.toBe(a);
  });

  it('hash: só aceita #/relatorio/<id válido> (adulterado = null, sem consulta)', () => {
    expect(parseRelatorioHash(`#/relatorio/${ID}`)).toBe(ID);
    expect(parseRelatorioHash('#/relatorio/curto')).toBeNull();
    expect(parseRelatorioHash(`#/relatorio/${ID}/extra`)).toBeNull();
    expect(parseRelatorioHash(`#/relatorio/${ID}?email=a@b.com`)).toBeNull();
    expect(parseRelatorioHash('#/relatorio/joel@x.com')).toBeNull();
    expect(parseRelatorioHash('')).toBeNull();
  });

  it('link contém só o id (sem e-mail, ownerUUID ou query) e troca hash anterior', () => {
    const l = montarLink('https://x.github.io/VolumFocus/?a=1#/antigo', ID);
    expect(l.endsWith(`#/relatorio/${ID}`)).toBe(true);
    expect(l).not.toContain('#/antigo');
  });

  it('estado: ativo, expirado, revogado (revogado tem precedência; sem data = expirado)', () => {
    const agora = new Date('2026-10-15T12:00:00Z');
    const futuro = new Date('2026-10-20T00:00:00Z');
    const passado = new Date('2026-10-10T00:00:00Z');
    expect(estadoDoShare({ revogadoEm: null, expiraEm: futuro }, agora)).toBe('ativo');
    expect(estadoDoShare({ revogadoEm: null, expiraEm: passado }, agora)).toBe('expirado');
    expect(estadoDoShare({ revogadoEm: passado, expiraEm: futuro }, agora)).toBe('revogado');
    expect(estadoDoShare({ revogadoEm: null, expiraEm: null }, agora)).toBe('expirado');
    expect(estadoDoShare({ revogadoEm: null, expiraEm: futuro }, futuro)).toBe('expirado');
  });

  it('validade nunca passa de 30 dias (Rules recusam acima)', () => {
    const agora = new Date('2026-10-15T00:00:00Z');
    expect(expiraEmDias(999, agora).getTime() - agora.getTime()).toBeLessThan(DIAS_VALIDADE_MAX * 86_400_000);
    expect(expiraEmDias(0, agora).getTime() - agora.getTime()).toBe(86_400_000);
  });

  it('relatório: compara com a anterior, só histórico até a escolhida, sem notas/triagem', () => {
    const todas = [av('c', '2026-03-01', 76, 18), av('a', '2026-01-01', 80, 22), av('b', '2026-02-01', 78, 20)];
    const r = montarRelatorio(todas, 'b')!;
    expect(r.anterior?.id).toBe('a');
    expect(r.historico.map((h) => h.id)).toEqual(['a', 'b']);
    const peso = r.metricas.find((m) => m.key === 'peso')!;
    expect(peso.difAnterior).toBe(-2);
    expect(r.composicao).toEqual({ magra: 80, gordura: 20 });
    expect(JSON.stringify(r.metricas) + JSON.stringify(r.circunferencias)).not.toContain('sensível');
    expect(montarRelatorio(todas, 'zzz')).toBeNull();
    expect(montarRelatorio(todas, 'a')!.anterior).toBeNull();
  });

  it('nome do PDF não contém nome do aluno', () => {
    expect(tituloDoPdf('2026-03-01T10:00:00')).toBe('Relatorio-avaliacao-2026-03-01');
  });
});
