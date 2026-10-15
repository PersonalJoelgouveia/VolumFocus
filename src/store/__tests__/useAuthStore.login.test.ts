import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ signIn: vi.fn(), signOutFn: vi.fn() }));
vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  doc: vi.fn(),
  getDoc: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithGoogle: h.signIn,
  signOutUser: h.signOutFn,
}));
vi.mock('../../lib/ownerRepository', () => ({ ensureOwnerUUID: vi.fn() }));
vi.mock('../../lib/alunosOwnership', () => ({ reivindicarAlunosLegados: vi.fn() }));
const wipe = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../lib/localDataLifecycle', () => ({ garantirDonoLocal: vi.fn(), wipeLocalData: wipe }));

import { useAuthStore } from '../useAuthStore';

describe('useAuthStore.login / tryAnotherAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ busy: false, errorMessage: null, errorKind: 'error' });
  });

  it('cancelamento do popup vira aviso informativo e libera o botão', async () => {
    h.signIn.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    await useAuthStore.getState().login();
    const s = useAuthStore.getState();
    expect(s.errorKind).toBe('info');
    expect(s.errorMessage).toMatch(/cancelado/);
    expect(s.busy).toBe(false);
  });

  it('popup bloqueado vira erro com mensagem própria', async () => {
    h.signIn.mockRejectedValueOnce({ code: 'auth/popup-blocked' });
    await useAuthStore.getState().login();
    expect(useAuthStore.getState().errorKind).toBe('error');
    expect(useAuthStore.getState().errorMessage).toMatch(/bloqueou/);
  });

  it('login bem-sucedido não deixa erro e não gera aviso', async () => {
    h.signIn.mockResolvedValueOnce({});
    await useAuthStore.getState().login();
    expect(useAuthStore.getState().errorMessage).toBeNull();
    expect(useAuthStore.getState().busy).toBe(false);
  });

  it('duplo clique é ignorado enquanto busy', async () => {
    useAuthStore.setState({ busy: true });
    await useAuthStore.getState().login();
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it('trocar de conta: se o signOut falhar, NÃO apaga dados locais e mostra erro', async () => {
    h.signOutFn.mockRejectedValueOnce(new Error('rede'));
    await useAuthStore.getState().tryAnotherAccount();
    expect(wipe).not.toHaveBeenCalled();
    expect(useAuthStore.getState().busy).toBe(false);
    expect(useAuthStore.getState().errorMessage).toMatch(/sair/i);
  });
});
