import { describe, expect, it } from 'vitest';
import { decideAccess } from '../accessPolicy';

describe('decideAccess', () => {
  it('Personal e aluno adulto liberados', () => {
    expect(decideAccess({ isPT: true, alunoDocExists: false })).toEqual({ role: 'personal', guardianPending: false });
    expect(decideAccess({ isPT: false, alunoDocExists: true })).toEqual({ role: 'aluno', guardianPending: false });
  });
  it('aluno menor sem autorização vigente fica pendente; com autorização, libera', () => {
    expect(decideAccess({ isPT: false, alunoDocExists: true, menor: true, consentimentoOk: false }).guardianPending).toBe(true);
    expect(decideAccess({ isPT: false, alunoDocExists: true, menor: true }).guardianPending).toBe(true);
    expect(decideAccess({ isPT: false, alunoDocExists: true, menor: true, consentimentoOk: true }).guardianPending).toBe(false);
  });
  it('responsável vinculado só recebe o papel de responsável (nunca personal/aluno)', () => {
    expect(decideAccess({ isPT: false, alunoDocExists: false, responsavelVinculado: true }).role).toBe('responsavel');
  });
  it('conta desconhecida: sem papel', () => {
    expect(decideAccess({ isPT: false, alunoDocExists: false }).role).toBeNull();
  });
  it('responsável vinculado não vira Personal nem aluno por campos do cliente', () => {
    const r = decideAccess({ isPT: false, alunoDocExists: false, responsavelVinculado: true, menor: false, consentimentoOk: true });
    expect(r.role).toBe('responsavel');
  });
});
