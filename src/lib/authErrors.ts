/** Traduz códigos de erro do Firebase Auth em avisos para o usuário. Cancelar o popup NÃO é falha. */
export type AuthNoticeKind = 'info' | 'error';

export interface AuthNotice {
  kind: AuthNoticeKind;
  message: string;
}

export function mapAuthError(code?: string): AuthNotice {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return { kind: 'info', message: 'Login cancelado. Quando quiser, toque em "Entrar com Google".' };
    case 'auth/popup-blocked':
      return { kind: 'error', message: 'O navegador bloqueou a janela de login. Libere pop-ups para este site e tente de novo.' };
    case 'auth/network-request-failed':
      return { kind: 'error', message: 'Sem conexão com a internet. Verifique sua rede e tente de novo.' };
    case 'auth/too-many-requests':
      return { kind: 'error', message: 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.' };
    case 'auth/user-disabled':
      return { kind: 'error', message: 'Esta conta foi desativada. Fale com o seu Personal.' };
    case 'auth/unauthorized-domain':
      return { kind: 'error', message: 'Este endereço do app não está autorizado para login. Avise o administrador.' };
    case 'auth/operation-not-allowed':
      return { kind: 'error', message: 'O login com Google não está habilitado no momento.' };
    case 'auth/account-exists-with-different-credential':
      return { kind: 'error', message: 'Já existe uma conta com este e-mail por outro método de login.' };
    default:
      return { kind: 'error', message: 'Não foi possível conectar ao Google. Tente novamente.' };
  }
}
