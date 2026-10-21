import { createEffect, For, Match, on, onCleanup, onMount, Show, Switch, type ParentComponent } from 'solid-js';
import { A, HashRouter, Route, useLocation } from '@solidjs/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CardsIcon, LibraryIcon, Logo, ProfileIcon, StatsIcon, StudyIcon } from './components/Icons';
import { TopbarSlotTarget } from './components/TopbarSlot';
import { useAuth } from './lib/auth';
import { t, type I18nKey } from './lib/i18n';
import { firebaseConfigured } from './lib/firebase';
import { cardsSource, clearSession, loading, pendingCount, startSession, syncError } from './lib/store';
import Login from './pages/Login';
import Home from './pages/Home';
import Study from './pages/Study';
import Browse from './pages/Browse';
import Stats from './pages/Stats';
import Profile from './pages/Profile';
import Export from './pages/Export';
import Decks from './pages/Decks';
import ImportExport from './pages/ImportExport';
import Trash from './pages/Trash';

const NAV = [
  // Головна — це «Вчити»: розділи й повторення; саме навчання відкривається з розділу й лишається під цим пунктом
  { href: '/', label: 'nav.study' as I18nKey, icon: StudyIcon, match: (p: string) => p === '/' || p === '/study' },
  { href: '/browse', label: 'nav.cards' as I18nKey, icon: CardsIcon, match: (p: string) => p === '/browse' },
  { href: '/decks', label: 'nav.library' as I18nKey, icon: LibraryIcon, match: (p: string) => p.startsWith('/decks') },
  { href: '/stats', label: 'nav.stats' as I18nKey, icon: StatsIcon, match: (p: string) => p === '/stats' },
  { href: '/profile', label: 'nav.profile' as I18nKey, icon: ProfileIcon, match: (p: string) => p === '/profile' },
];

const Layout: ParentComponent = (props) => {
  const location = useLocation();
  // Під час навчання меню ховається на телефоні, щоб не відволікати від картки
  const focusMode = () => location.pathname === '/study';

  return (
    <div class="shell" classList={{ focus: focusMode() }}>
      <nav class="nav" aria-label={t('nav.aria')}>
        <A href="/" class="nav-brand">
          <Logo size={32} />
          <span>Cards</span>
        </A>
        <For each={NAV}>
          {(item) => (
            <A
              href={item.href}
              class="nav-item"
              classList={{ active: item.match(location.pathname) }}
              aria-current={item.match(location.pathname) ? 'page' : undefined}
            >
              <item.icon />
              <span>{t(item.label)}</span>
            </A>
          )}
        </For>
      </nav>

      <div class="content">
        <header class="topbar">
          <A href="/" class="topbar-brand">
            <Logo size={26} />
            <span>Cards</span>
          </A>
          <div class="row align">
            <Show when={pendingCount() > 0}>
              <span class="pill" title={t('sync.pending')}>
                ⟳ {pendingCount()}
              </span>
            </Show>
            <TopbarSlotTarget />
          </div>
        </header>
        <Show when={syncError()}>
          <p class="banner">
            {syncError()}
            <Show when={cardsSource() === 'bundled'}> {t('sync.bundled')}</Show>
          </p>
        </Show>
        {props.children}
      </div>
    </div>
  );
};

function SetupNeeded() {
  return (
    <main class="auth">
      <div class="auth-card">
        <h1>{t('setup.title')}</h1>
        <p>{t('setup.text')}</p>
      </div>
    </main>
  );
}

export default function App() {
  const { user, ready } = useAuth();

  createEffect(
    on(
      () => user()?.uid,
      (uid) => {
        if (uid) startSession(uid);
        else clearSession();
      },
    ),
  );

  onMount(() => {
    if (!Capacitor.isNativePlatform()) return;
    // Апаратна кнопка «Назад»: крок назад у застосунку, на головній — вихід
    const handle = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && location.hash !== '#/' && location.hash !== '') history.back();
      else void CapacitorApp.exitApp();
    });
    onCleanup(() => void handle.then((h) => h.remove()));
  });

  return (
    <Switch>
      <Match when={!firebaseConfigured}>
        <SetupNeeded />
      </Match>
      <Match when={!ready()}>
        <div class="splash">
          <Logo size={72} />
        </div>
      </Match>
      <Match when={!user()}>
        <Login />
      </Match>
      <Match when={loading() && !cardsSource()}>
        <div class="splash">
          <Logo size={72} />
        </div>
      </Match>
      <Match when={true}>
        <HashRouter root={Layout}>
          <Route path="/" component={Home} />
          <Route path="/study" component={Study} />
          <Route path="/browse" component={Browse} />
          <Route path="/stats" component={Stats} />
          <Route path="/profile" component={Profile} />
          <Route path="/export" component={Export} />
          <Route path="/decks" component={Decks} />
          <Route path="/decks/io" component={ImportExport} />
          <Route path="/decks/trash" component={Trash} />
          <Route path="*" component={Home} />
        </HashRouter>
      </Match>
    </Switch>
  );
}
