import { create } from 'zustand';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, db, doc, getDoc, onAuthStateChanged, signInWithGoogle, signOutUser } from '../lib/firebase';
import { useUIStore } from './useUIStore';

/** Sucessor de PT_EMAILS (index.html ~4247) — únicos e-mails com permissão
 *  de Personal Trainer. Alunos autenticam com qualquer conta Google já
 *  cadastrada (checada via Firestore em _checkAccess). */
export const PT_EMAILS = ['joelgouveia16@gmail.com', 'personaljoelgouveia@gmail.com'];

export interface AuthUser {
  email: string;
  name: string;
  picture: string | null;
}

export type GateStatus = 'loading' | 'login' | 'denied' | 'granted';

/**
 * Sucessor direto da distinção "Não logado / Personal / Aluno" usada em
 * ptSetModeFromEmail (index.html ~4261) — deriva sempre do e-mail
 * confirmado pelo Firebase Auth, nunca de um estado próprio/paralelo.
 * 'aluno' só é atingido com `status === 'granted'` (documento
 * `alunos/{email}` confirmado no Firestore); um Google logado mas não
 * cadastrado nem PT fica em 'nao-logado' aqui (equivalente a `status
 * === 'denied'` — ainda sem papel liberado no app).
 */
export type UserRole = 'nao-logado' | 'personal' | 'aluno';

interface AuthState {
  status: GateStatus;
  role: UserRole;
  user: AuthUser | null;
  /** true enquanto um popup de login/logout está em andamento (evita duplo clique). */
  busy: boolean;
  /** Mensagem de erro pontual da última tentativa de login/verificação, para exibir no gate. */
  errorMessage: string | null;

  /** Registra o listener onAuthStateChanged uma única vez — sucessor de vfGate.start()
   *  + vfAuth.init(). Chamado uma vez no topo do App. */
  init: () => void;
  /** Sucessor de vfAuth._requestSignIn('login') / vfGate.login(). */
  login: () => Promise<void>;
  /** Sucessor de vfAuth.logout(). */
  logout: () => Promise<void>;
  /** Sucessor de vfGate.tryAnotherAccount(): desloga e volta para a tela de login. */
  tryAnotherAccount: () => Promise<void>;
}

let listenerAttached = false;

function toAuthUser(fbUser: FirebaseUser): AuthUser {
  return {
    email: fbUser.email ?? '',
    name: fbUser.displayName || fbUser.email || 'Conta Google',
    picture: fbUser.photoURL,
  };
}

/**
 * Sucessor de vfGate + vfAuth (index.html ~7278-7845): valida se o e-mail
 * logado é o Personal Trainer (PT_EMAILS) ou um aluno já cadastrado
 * (documento `alunos/{email}` no Firestore) antes de liberar o app —
 * mesma checagem, mesma coleção, para o React e o legado convergirem.
 *
 * Escopo desta store: identidade + gate de acesso (quem pode entrar, e
 * como). A sincronização de backup/rotinas na nuvem (vfAuth._pullBackup/
 * _uploadBackup) é uma frente à parte, ainda não migrada.
 */
export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'loading',
  role: 'nao-logado',
  user: null,
  busy: false,
  errorMessage: null,

  init: () => {
    if (listenerAttached) return;
    listenerAttached = true;

    onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        useUIStore.getState().setPersonalMode(false);
        set({ status: 'login', role: 'nao-logado', user: null, errorMessage: null });
        return;
      }

      const emailLc = (fbUser.email ?? '').toLowerCase();
      const isPT = PT_EMAILS.includes(emailLc);
      let authorized = isPT;

      if (!authorized) {
        try {
          const snap = await getDoc(doc(db, 'alunos', emailLc));
          authorized = snap.exists();
        } catch (e) {
          // Falha ao consultar o Firestore (rede/permissão) — mantém o e-mail
          // já identificado pelo Firebase Auth, mas não libera o acesso;
          // evita travar em 'loading' e perder a mensagem de erro no gate.
          console.error('useAuthStore: falha ao verificar cadastro do aluno', e);
          set({
            status: 'login',
            role: 'nao-logado',
            errorMessage: 'Não foi possível verificar seu acesso. Tente novamente.',
          });
          return;
        }
      }

      const user = toAuthUser(fbUser);

      if (authorized) {
        useUIStore.getState().setPersonalMode(isPT);
        set({ status: 'granted', role: isPT ? 'personal' : 'aluno', user, errorMessage: null });
      } else {
        useUIStore.getState().setPersonalMode(false);
        set({ status: 'denied', role: 'nao-logado', user, errorMessage: null });
      }
    });
  },

  login: async () => {
    if (get().busy) return;
    set({ busy: true, errorMessage: null });
    try {
      await signInWithGoogle();
      // onAuthStateChanged acima cuida do resto (checagem + status).
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      console.error('useAuthStore: erro ao fazer login', e);
      set({
        errorMessage:
          code === 'auth/popup-closed-by-user'
            ? 'O login foi cancelado ou o popup foi bloqueado.'
            : 'Não foi possível conectar ao Google.',
      });
    } finally {
      set({ busy: false });
    }
  },

  logout: async () => {
    if (get().busy) return;
    set({ busy: true });
    try {
      await signOutUser();
    } catch (e) {
      console.error('useAuthStore: erro ao sair', e);
    } finally {
      set({ busy: false });
    }
  },

  tryAnotherAccount: async () => {
    await get().logout();
    set({ status: 'login', role: 'nao-logado', user: null, errorMessage: null });
  },
}));
