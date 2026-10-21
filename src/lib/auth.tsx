import { createContext, createSignal, onCleanup, useContext, type Accessor, type ParentComponent } from 'solid-js';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { t, type I18nKey } from './i18n';

interface AuthState {
  user: Accessor<User | null>;
  ready: Accessor<boolean>;
}

const AuthContext = createContext<AuthState>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [ready, setReady] = createSignal(false);

  const unsubscribe = onAuthStateChanged(auth, (next) => {
    setUser(next);
    setReady(true);
  });
  onCleanup(unsubscribe);

  return <AuthContext.Provider value={{ user, ready }}>{props.children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

const AUTH_ERRORS: Record<string, I18nKey> = {
  'auth/invalid-credential': 'auth.err.invalid',
  'auth/wrong-password': 'auth.err.invalid',
  'auth/user-not-found': 'auth.err.invalid',
  'auth/invalid-email': 'auth.err.email',
  'auth/email-already-in-use': 'auth.err.exists',
  'auth/weak-password': 'auth.err.weak',
  'auth/too-many-requests': 'auth.err.tooMany',
  'auth/network-request-failed': 'auth.err.network',
  'auth/operation-not-allowed': 'auth.err.disabled',
};

export function authErrorText(error: unknown): string {
  const code = (error as { code?: string }).code;
  const key = code ? AUTH_ERRORS[code] : undefined;
  return key ? t(key) : (error as Error).message;
}
