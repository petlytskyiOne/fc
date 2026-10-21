import { createSignal, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { signOut } from 'firebase/auth';
import LangSwitch from '../components/LangSwitch';
import { useAuth } from '../lib/auth';
import { auth } from '../lib/firebase';
import { formatDate, t } from '../lib/i18n';
import { cards, cardsSource, pendingCount, resetProgress } from '../lib/store';

export default function Profile() {
  const { user } = useAuth();
  const [resetting, setResetting] = createSignal(false);

  const onReset = async () => {
    if (!confirm(t('profile.resetConfirm'))) return;
    setResetting(true);
    const error = await resetProgress(user()!.uid);
    setResetting(false);
    if (error) alert(t('profile.resetFailed', { msg: error }));
  };

  const initial = () => (user()?.email ?? '?').charAt(0).toUpperCase();
  const created = () => {
    const raw = user()?.metadata.creationTime;
    return raw ? formatDate(new Date(raw), { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  };

  return (
    <main class="page">
      <header class="page-head">
        <h1>{t('profile.title')}</h1>
      </header>

      <section class="panel profile">
        <span class="avatar" aria-hidden="true">
          {initial()}
        </span>
        <div>
          <strong>{user()?.email}</strong>
          <div class="muted small">{t('profile.created', { date: created() })}</div>
        </div>
      </section>

      {/* Усі налаштування й дії — одним вікном; бібліотека колод — окремим пунктом меню */}
      <section class="panel list">
        <div class="list-row align">
          <span>{t('lang.label')}</span>
          <LangSwitch />
        </div>
        <div class="list-row">
          <span>{t('profile.cards')}</span>
          <span class="muted">{cards().length}</span>
        </div>
        <div class="list-row">
          <span>{t('profile.dataState')}</span>
          <span class="muted">{cardsSource() ? t(`source.${cardsSource()!}`) : '—'}</span>
        </div>
        <div class="list-row">
          <span>{t('profile.pending')}</span>
          <span class="muted">{pendingCount()}</span>
        </div>
        <A class="list-row action" href="/export">
          <span>{t('export.title')}</span>
          <span aria-hidden="true">↓</span>
        </A>
        <button class="list-row action" onClick={() => void signOut(auth)}>
          <span>{t('profile.signout')}</span>
          <span aria-hidden="true">→</span>
        </button>
        <button class="list-row action danger" disabled={resetting()} onClick={onReset}>
          <span>{resetting() ? t('profile.resetting') : t('profile.reset')}</span>
        </button>
      </section>

      <Show when={pendingCount() > 0}>
        <p class="muted small">{t('profile.pendingNote')}</p>
      </Show>
      <p class="muted small center">{t('profile.footer')}</p>
    </main>
  );
}
