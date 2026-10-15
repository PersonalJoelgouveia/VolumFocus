import { describe, expect, it } from 'vitest';
import {
  TEXTOS_CONSENTIMENTO,
  aindaMenorPorMaioridade,
  consentimentoObrigatorioOk,
  estadoVigente,
  faixaEtaria,
  isMenor,
  maioridadeIso,
  sha256Hex,
  type EstadoConsentimento,
} from '../consentimento';

const HOJE = new Date(2026, 9, 14); // 14/10/2026

describe('faixa etária', () => {
  it('classifica criança, adolescente e adulto nos limites', () => {
    expect(faixaEtaria('2014-10-15', HOJE)).toBe('crianca'); // 11 anos (faz 12 amanhã)
    expect(faixaEtaria('2014-10-14', HOJE)).toBe('adolescente'); // faz 12 hoje
    expect(faixaEtaria('2008-10-15', HOJE)).toBe('adolescente'); // 17 (faz 18 amanhã)
    expect(faixaEtaria('2008-10-14', HOJE)).toBe('adulto'); // faz 18 hoje
  });
  it('data inválida/futura/ausente => null e não é menor', () => {
    for (const d of [undefined, '', '2026-02-30', 'abc', '2030-01-01']) {
      expect(faixaEtaria(d, HOJE)).toBeNull();
      expect(isMenor(d, HOJE)).toBe(false);
    }
  });
});

describe('maioridadeIso', () => {
  it('soma 18 anos', () => expect(maioridadeIso('2010-05-20')).toBe('2028-05-20'));
  it('29/02 vira 01/03 quando o ano da maioridade não é bissexto', () => {
    expect(maioridadeIso('2012-02-29')).toBe('2030-03-01');
    expect(maioridadeIso('2004-02-29')).toBe('2022-03-01');
  });
  it('inválida => null', () => expect(maioridadeIso('2010-13-40')).toBeNull());
  it('aindaMenorPorMaioridade: futuro=menor, passado=adulto, lixo=menor (fail-closed), ausente=adulto', () => {
    expect(aindaMenorPorMaioridade('2028-05-20', HOJE)).toBe(true);
    expect(aindaMenorPorMaioridade('2020-05-20', HOJE)).toBe(false);
    expect(aindaMenorPorMaioridade('lixo', HOJE)).toBe(true);
    expect(aindaMenorPorMaioridade(undefined, HOJE)).toBe(false);
  });
});

describe('autorização vigente', () => {
  const ok = (f: 'tratamento_dados' | 'atendimento' | 'uso_imagem', over: Partial<EstadoConsentimento> = {}): EstadoConsentimento => ({
    finalidade: f,
    decisao: 'aceito',
    versaoTexto: TEXTOS_CONSENTIMENTO[f].versao,
    responsavelEmail: 'mae@gmail.com',
    ...over,
  });
  it('exige as duas obrigatórias, mesma versão e o mesmo responsável vinculado', () => {
    const base = { tratamento_dados: ok('tratamento_dados'), atendimento: ok('atendimento') };
    expect(consentimentoObrigatorioOk(base, 'mae@gmail.com')).toBe(true);
    expect(consentimentoObrigatorioOk(base, 'outro@gmail.com')).toBe(false); // responsável trocado
    expect(consentimentoObrigatorioOk({ ...base, atendimento: null }, 'mae@gmail.com')).toBe(false);
    expect(consentimentoObrigatorioOk({ ...base, atendimento: ok('atendimento', { decisao: 'revogado' }) }, 'mae@gmail.com')).toBe(false);
    expect(consentimentoObrigatorioOk({ ...base, atendimento: ok('atendimento', { versaoTexto: '0.0' }) }, 'mae@gmail.com')).toBe(false);
  });
  it('uso_imagem sozinho não libera o app', () => {
    expect(consentimentoObrigatorioOk({ uso_imagem: ok('uso_imagem') }, 'mae@gmail.com')).toBe(false);
    expect(estadoVigente(ok('uso_imagem'), null)).toBe(false);
  });
});

describe('hash do texto', () => {
  it('SHA-256 hex determinístico de 64 caracteres', async () => {
    const h = await sha256Hex('abc');
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

import { idAceiteAvaliacao, montarEvento, TEXTO_AVALIACAO_ONLINE, textoParaHash } from '../consentimento';

describe('evento (evidência)', () => {
  const base = {
    alunoEmail: 'Menor@X.com',
    ownerUUID: '123e4567-e89b-42d3-a456-426614174000',
    autorUid: 'uid1',
    autorPapel: 'responsavel' as const,
    tipo: 'consentimento_responsavel' as const,
    finalidade: 'atendimento' as const,
    decisao: 'aceito' as const,
    versaoTexto: '0.1',
    textoHash: 'a'.repeat(64),
    provedor: 'google.com',
    authTime: 1760000000,
  };
  it('normaliza e-mails e remove opcionais vazios (as Rules usam hasOnly)', () => {
    const e = montarEvento({ ...base, responsavelEmail: 'Mae@X.com', avaliacaoId: '', substituiEventoId: undefined });
    expect(e.alunoEmail).toBe('menor@x.com');
    expect(e.responsavelEmail).toBe('mae@x.com');
    expect('avaliacaoId' in e).toBe(false);
    expect('substituiEventoId' in e).toBe(false);
  });
  it('NÃO carrega IP, user-agent nem documentos', () => {
    const chaves = Object.keys(montarEvento(base));
    for (const proibida of ['ip', 'userAgent', 'cpf', 'documento']) expect(chaves).not.toContain(proibida);
  });
  it('id do aceite da avaliação é determinístico e o hash muda com o texto', async () => {
    expect(idAceiteAvaliacao('abc')).toBe('aceite_abc');
    const h1 = await sha256Hex(textoParaHash(TEXTO_AVALIACAO_ONLINE));
    const h2 = await sha256Hex(textoParaHash({ ...TEXTO_AVALIACAO_ONLINE, texto: TEXTO_AVALIACAO_ONLINE.texto + '.' }));
    expect(h1).not.toBe(h2);
  });
});
