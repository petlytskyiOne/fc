import { createSignal, Show } from 'solid-js';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { authErrorText } from '../lib/auth';
import { t } from '../lib/i18n';
import { Logo } from '../components/Icons';
import LangSwitch from '../components/LangSwitch';

type Mode = 'signin' | 'signup' | 'reset';

export default function Login() {
  const [mode, setMode] = createSignal<Mode>('signin');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [info, setInfo] = createSignal<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode() === 'signin') {
        await signInWithEmailAndPassword(auth, email(), password());
      } else if (mode() === 'signup') {
        await createUserWithEmailAndPassword(auth, email(), password());
      } else {
        await sendPasswordResetEmail(auth, email());
        setInfo(t('auth.resetSent'));
      }
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  const submitLabel = () =>
    busy()
      ? t('common.wait')
      : mode() === 'signin'
        ? t('auth.signinBtn')
        : mode() === 'signup'
          ? t('auth.signupBtn')
          : t('auth.resetBtn');

  return (
    <main class="auth">
      <LangSwitch class="auth-lang" />
      <div class="auth-card">
        <div class="brand">
          <Logo size={56} />
          <div>
            <h1>Cards</h1>
            <p class="muted">{t('app.tagline')}</p>
          </div>
        </div>

        <Show when={mode() !== 'reset'}>
          <div class="tabs" role="tablist">
            <button
              role="tab"
              classList={{ active: mode() === 'signin' }}
              aria-selected={mode() === 'signin'}
              onClick={() => switchMode('signin')}
            >
              {t('auth.signin')}
            </button>
            <button
              role="tab"
              classList={{ active: mode() === 'signup' }}
              aria-selected={mode() === 'signup'}
              onClick={() => switchMode('signup')}
            >
              {t('auth.signup')}
            </button>
          </div>
        </Show>

        <form onSubmit={submit} class="form">
          <label>
            {t('auth.email')}
            <input
              type="email"
              autocomplete="email"
              required
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </label>
          <Show when={mode() !== 'reset'}>
            <label>
              {t('auth.password')}
              <input
                type="password"
                autocomplete={mode() === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
              />
            </label>
          </Show>

          <Show when={error()}>
            <p class="alert error">{error()}</p>
          </Show>
          <Show when={info()}>
            <p class="alert info">{info()}</p>
          </Show>

          <button type="submit" class="btn primary block" disabled={busy()}>
            {submitLabel()}
          </button>
        </form>

        <Show
          when={mode() === 'reset'}
          fallback={
            <button class="link" onClick={() => switchMode('reset')}>
              {t('auth.forgot')}
            </button>
          }
        >
          <button class="link" onClick={() => switchMode('signin')}>
            {t('auth.backToSignin')}
          </button>
        </Show>
      </div>
    </main>
  );
}
