import { create } from 'zustand';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, db, doc, getDoc, onAuthStateChanged, signInWithGoogle, signOutUser } from '../lib/firebase';
import { useUIStore } from './useUIStore';
import { useNotificationStore } from './useNotificationStore';
import { useSyncStore } from './useSyncStore';
import { useConfirmStore } from './useConfirmStore';
import { LOCAL_STORAGE_KEYS } from '../lib/backupRepository';

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
/** Sucessor em memória de LS_PENDING_ACTION (index.html ~7282, ~7309-7349):
 *  marcado por login() antes de abrir o popup, lido dentro do
 *  onAuthStateChanged assim que o acesso é confirmado — só então dispara
 *  o push-ou-pull. Garante que a sincronização só roda após um login
 *  explícito (nunca numa reconexão silenciosa de sessão já existente). */
let pendingSyncOnGrant = false;

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
 * como). A sincronização de backup em si (o payload, upload/download,
 * dirty-tracking) vive em useSyncStore — aqui só decide QUANDO disparar
 * (logo após um login explícito bem-sucedido).
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
        pendingSyncOnGrant = false;
        useUIStore.getState().setPersonalMode(false);
        useUIStore.getState().setAlunoMode(false);
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
          pendingSyncOnGrant = false;
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
        useUIStore.getState().setAlunoMode(!isPT);
        set({ status: 'granted', role: isPT ? 'personal' : 'aluno', user, errorMessage: null });
        // Carrega as notificações de "treino concluído" só pro Personal —
        // sucessor de ntfInit() (index.html ~10502), que também roda uma
        // vez ao carregar a página.
        if (isPT) useNotificationStore.getState().fetchAll();
        // Sucessor da decisão push-ou-pull de _requestSignIn() — só roda
        // logo após um login explícito (ver pendingSyncOnGrant acima).
        if (pendingSyncOnGrant) {
          pendingSyncOnGrant = false;
          useSyncStore.getState().syncAfterLogin();
        }
      } else {
        pendingSyncOnGrant = false;
        useUIStore.getState().setPersonalMode(false);
        useUIStore.getState().setAlunoMode(false);
        set({ status: 'denied', role: 'nao-logado', user, errorMessage: null });
      }
    });
  },

  login: async () => {
    if (get().busy) return;
    set({ busy: true, errorMessage: null });
    pendingSyncOnGrant = true;
    try {
      await signInWithGoogle();
      // onAuthStateChanged acima cuida do resto (checagem + status + sync).
    } catch (e: unknown) {
      pendingSyncOnGrant = false;
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

    const ok = await useConfirmStore
      .getState()
      .ask('Sair da conta e apagar os dados salvos neste dispositivo?', { confirmLabel: 'Sair e Apagar', danger: true });
    if (!ok) return;

    set({ busy: true });

    // Proteção contra perda de dados: scheduleAutoSync() tem debounce de
    // alguns segundos, então uma edição feita agora mesmo pode ainda não
    // ter chegado à nuvem. Sem isso, apagar os dados locais abaixo antes
    // do upload pendente terminar destrói a alteração pra sempre —
    // sucessor direto do fix documentado em vfAuth.logout() (index.html
    // ~7535-7552, bug: "meus clientes são excluídos no logout").
    if (auth.currentUser && useSyncStore.getState().dirty) {
      try {
        useUIStore.getState().showToast('☁️ Enviando últimas alterações antes de sair…');
        const pushed = await useSyncStore.getState().pushNow();
        if (!pushed) throw new Error('push falhou');
      } catch (e) {
        console.error('useAuthStore: falha ao sincronizar antes do logout', e);
        const proceedAnyway = await useConfirmStore.getState().ask(
          '⚠️ Não foi possível confirmar que suas últimas alterações foram salvas na nuvem. Sair mesmo assim e apagar os dados deste dispositivo?',
          { confirmLabel: 'Sair Mesmo Assim', danger: true }
        );
        if (!proceedAnyway) {
          set({ busy: false });
          return;
        }
      }
    }

    try {
      await signOutUser();
    } catch (e) {
      console.error('useAuthStore: erro ao sair', e);
    }

    LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    useUIStore.getState().showToast('👋 Sessão encerrada. Limpando dados deste dispositivo…');
    setTimeout(() => window.location.reload(), 600);
  },

  tryAnotherAccount: async () => {
    await get().logout();
    set({ status: 'login', role: 'nao-logado', user: null, errorMessage: null });
  },
}));
