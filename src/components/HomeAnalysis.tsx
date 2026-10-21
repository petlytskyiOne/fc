import { createMemo, For } from 'solid-js';
import { A } from '@solidjs/router';
import { activityBuckets, formatDuration, streaks, totals } from '../lib/analytics';
import { formatDate, t, type I18nKey } from '../lib/i18n';
import { daily, statusCounts } from '../lib/store';

// Аналіз дня — права панель головної (як «Аналіз дня» у myDay):
// сьогоднішні цифри, відповіді, стан карток колоди, останні 7 днів унизу.

const GRADES = [0, 1, 2, 3] as const;
const STATES = [
  { key: 'new', label: 'stats.stNew', color: 'var(--st0)' },
  { key: 'learning', label: 'stats.stLearning', color: 'var(--st1)' },
  { key: 'review', label: 'stats.stReview', color: 'var(--st2)' },
  { key: 'mastered', label: 'stats.stMastered', color: 'var(--st3)' },
] as const;

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export default function HomeAnalysis() {
  const now = new Date();
  const today = createMemo(() => totals(daily, 'day', now));
  const week = createMemo(() => activityBuckets(daily, 'week', now));
  const weekMax = createMemo(() => Math.max(1, ...week().map((b) => b.value)));
  const streak = createMemo(() => streaks(daily, now));
  const states = createMemo(() => statusCounts());
  const stateTotal = () => Object.values(states()).reduce((a, b) => a + b, 0);
  const accuracy = () => pct(today().g[2] + today().g[3], today().reviews);

  return (
    <aside class="analysis">
      <header class="analysis-head">
        <h2>{t('home.analysis')}</h2>
        <span class="muted small">{formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </header>

      <section class="analysis-block">
        <h3 class="analysis-title">{t('home.todayBlock')}</h3>
        <div class="analysis-figures">
          <div>
            <strong>{today().reviews}</strong>
            <span>{t('stats.reviews')}</span>
          </div>
          <div>
            <strong>{today().reviews ? `${accuracy()}%` : '—'}</strong>
            <span>{t('stats.accuracy')}</span>
          </div>
          <div>
            <strong>{today().newCards}</strong>
            <span>{t('stats.newCards')}</span>
          </div>
          <div>
            <strong>{formatDuration(today().ms)}</strong>
            <span>{t('stats.time')}</span>
          </div>
        </div>
      </section>

      <section class="analysis-block">
        <h3 class="analysis-title">{t('home.answersToday')}</h3>
        <div class="analysis-bars">
          <For each={GRADES}>
            {(g) => (
              <div class="analysis-bar">
                <span class="analysis-label">
                  <i style={{ background: `var(--g${g})` }} />
                  {t(`grade.${g}` as I18nKey)}
                </span>
                <span class="analysis-value">{today().g[g]}</span>
                <div class="analysis-track">
                  <span style={{ width: `${pct(today().g[g], today().reviews)}%`, background: `var(--g${g})` }} />
                </div>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="analysis-block">
        <h3 class="analysis-title">{t('stats.cardState')}</h3>
        <div class="analysis-bars">
          <For each={STATES}>
            {(s) => (
              <div class="analysis-bar">
                <span class="analysis-label">
                  <i style={{ background: s.color }} />
                  {t(s.label)}
                </span>
                <span class="analysis-value">{states()[s.key]}</span>
                <div class="analysis-track">
                  <span style={{ width: `${pct(states()[s.key], stateTotal())}%`, background: s.color }} />
                </div>
              </div>
            )}
          </For>
        </div>
      </section>

      {/* тиждень — у самому низу панелі */}
      <section class="analysis-block analysis-week-block">
        <div class="analysis-week-head">
          <h3 class="analysis-title">{t('stats.growthWeek')}</h3>
          <span class="analysis-value">{t('home.streak', { n: streak().current })}</span>
        </div>
        <div class="analysis-week">
          <For each={week()}>
            {(b) => (
              <div class="analysis-day" classList={{ today: b.current }} title={`${b.title}: ${b.value}`}>
                <div class="analysis-day-bar">
                  <span style={{ height: `${(b.value / weekMax()) * 100}%` }} />
                </div>
                <span class="analysis-day-name">{b.label}</span>
                <span class="analysis-day-n">{b.value}</span>
              </div>
            )}
          </For>
        </div>
        <A href="/stats" class="link small">
          {t('home.statsLink')}
        </A>
      </section>
    </aside>
  );
}
