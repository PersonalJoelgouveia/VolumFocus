import { describe, expect, it } from 'vitest';
import { mapAuthError } from '../authErrors';
import { decideAccess } from '../accessPolicy';

describe('mapAuthError', () => {
  it('cancelar o popup é aviso informativo, não erro', () => {
    for (const c of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
      expect(mapAuthError(c).kind).toBe('info');
    }
  });
  it('popup bloqueado, rede e domínio têm mensagens próprias', () => {
    expect(mapAuthError('auth/popup-blocked').message).toMatch(/bloqueou/);
    expect(mapAuthError('auth/network-request-failed').message).toMatch(/conexão/);
    expect(mapAuthError('auth/unauthorized-domain').kind).toBe('error');
  });
  it('código desconhecido ou ausente cai no erro genérico', () => {
    expect(mapAuthError('auth/xyz').kind).toBe('error');
    expect(mapAuthError(undefined).message).toMatch(/Não foi possível conectar/);
  });
});

describe('decideAccess', () => {
  it('Personal da lista fixa', () => {
    expect(decideAccess({ isPT: true, alunoDocExists: false })).toEqual({ role: 'personal', guardianPending: false });
  });
  it('aluno só se o cadastro existir', () => {
    expect(decideAccess({ isPT: false, alunoDocExists: true }).role).toBe('aluno');
    expect(decideAccess({ isPT: false, alunoDocExists: false }).role).toBeNull();
  });
  it('nenhuma entrada do cliente concede Personal ou aluno por si só', () => {
    const d = decideAccess({ isPT: false, alunoDocExists: false, role: 'personal', ownerUUID: 'x' } as never);
    expect(d.role).toBeNull();
  });
});
