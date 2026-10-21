import { createMemo, For } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import HomeAnalysis from '../components/HomeAnalysis';
import { useAuth } from '../lib/auth';
import { cardStatus, isDue } from '../lib/srs';
import { streaks, totals } from '../lib/analytics';
import { countOf, t } from '../lib/i18n';
import { activeDeck, daily, progress, sectionName, sections } from '../lib/store';
import type { Card } from '../types';

function stats(list: Card[]) {
  const now = Date.now();
  let fresh = 0;
  let due = 0;
  let learned = 0;
  for (const card of list) {
    const p = progress[card.id];
    const status = cardStatus(p);
    if (status === 'new') fresh++;
    else if (isDue(p, now)) due++;
    if (status === 'review' || status === 'mastered') learned++;
  }
  return { total: list.length, fresh, due, learned, studied: list.length - fresh };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return t('home.night');
  if (h < 12) return t('home.morning');
  if (h < 18) return t('home.day');
  return t('home.evening');
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const all = createMemo(() => stats(sections().flatMap((s) => s.cards)));
  const today = createMemo(() => totals(daily, 'day', new Date()));
  const streak = createMemo(() => streaks(daily, new Date()));
  const toStudy = () => all().due + all().fresh;
  const name = () => user()?.email?.split('@')[0] ?? '';
  // Число виводиться окремо великим шрифтом, у підписі лишається тільки слово «картки» в потрібній формі
  const caption = () => t('home.waiting', { cards: countOf(toStudy(), 'cards').replace(/^\d+\s/, '') });

  return (
    <main class="page wide fit">
      {/* Над усім — назва колоди; під нею ліворуч розділи, праворуч повторення й аналіз
          (як «Мій день» у myDay). Бічна колонка стоїть першою, щоб на телефоні повторення було вгорі */}
      <div class="home-layout">
        <div class="home-side">
          <section class="hero">
            <p class="hero-greeting">
              {greeting()}, {name()}
            </p>
            <div class="hero-main">
              <div>
                <div class="hero-number">{toStudy()}</div>
                <div class="hero-caption">{caption()}</div>
              </div>
              <div class="hero-ring" style={{ '--pct': `${all().total ? (all().learned / all().total) * 100 : 0}` }}>
                <span>
                  {all().total ? Math.round((all().learned / all().total) * 100) : 0}%
                  <small>{t('home.learned')}</small>
                </span>
              </div>
            </div>
            <div class="hero-chips">
              <span class="chip-glass">{t('home.streak', { n: streak().current })}</span>
              <span class="chip-glass">{t('home.today', { n: today().reviews })}</span>
              <span class="chip-glass">{t('home.new', { n: all().fresh })}</span>
            </div>
            <button class="btn hero-btn block" disabled={toStudy() === 0} onClick={() => navigate('/study?section=all&mode=due')}>
              {toStudy() === 0 ? t('home.allDone') : t('home.start')}
            </button>
          </section>

          <HomeAnalysis />
        </div>

        {/* Назва активної колоди; вибір колоди — у розділі «Бібліотека» */}
        <div class="deck-head">
          <div class="deck-head-title">
            <span class="section-heading">{t('home.sectionsCount', { n: sections().length })}</span>
            <h2>{activeDeck().title}</h2>
          </div>
          <A href="/stats" class="link small">
            {t('home.statsLink')}
          </A>
        </div>

        <div class="home-main">
          <div class="sections">
            <For each={sections()}>
              {(section) => {
                const s = createMemo(() => stats(section.cards));
                return (
                  <article class="section-card">
                    <header>
                      <span class="section-icon">{section.code === '0' ? '★' : section.code}</span>
                      <span class="section-score">
                        {s().learned}/{s().total}
                      </span>
                    </header>
                    <div class="section-card-title">
                      <h3>{sectionName(section.code, section.title)}</h3>
                      <p class="muted small">
                        {t('home.sectionMeta', {
                          cards: countOf(s().total, 'cards'),
                          learned: s().learned,
                          due: s().due + s().fresh,
                        })}
                      </p>
                    </div>
                    <div class="meter thin">
                      <div class="meter-fill" style={{ width: `${(s().studied / s().total) * 100}%` }} />
                      <div class="meter-fill strong" style={{ width: `${(s().learned / s().total) * 100}%` }} />
                    </div>
                    <div class="section-actions">
                      <button
                        class="btn primary block"
                        disabled={s().due + s().fresh === 0}
                        onClick={() => navigate(`/study?section=${section.code}&mode=due`)}
                      >
                        {t('home.learn', { n: s().due + s().fresh })}
                      </button>
                      <div class="section-links">
                        <button class="link small" onClick={() => navigate(`/study?section=${section.code}&mode=all`)}>
                          {t('home.shuffle')}
                        </button>
                        <A class="link small" href={`/browse?section=${section.code}`}>
                          {t('home.browse')}
                        </A>
                      </div>
                    </div>
                  </article>
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </main>
  );
}
