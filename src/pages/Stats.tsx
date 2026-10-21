import { createMemo, createSignal, For, Show } from 'solid-js';
import { A, useSearchParams } from '@solidjs/router';
import { ColumnChart, DataTable, GrowthChart, Heatmap, StackedBar } from '../components/Charts';
import {
  activityBuckets,
  formatDuration,
  growthSeries,
  heatmap,
  periodLabel,
  prevLabel,
  sectionTotals,
  streaks,
  totals,
  type Period,
} from '../lib/analytics';
import { sectionBadge, t } from '../lib/i18n';
import { cardStatus } from '../lib/srs';
import { activeDeck, cardLabel, cards, daily, progress, sectionName, sections, sectionStatKey, statusCounts } from '../lib/store';

const PERIODS: Period[] = ['day', 'week', 'month', 'year'];

function Delta(props: { now: number; prev: number; label: string; unit?: string }) {
  const diff = () => props.now - props.prev;
  return (
    <Show when={props.now > 0 || props.prev > 0}>
      <span class="delta" classList={{ up: diff() > 0, down: diff() < 0 }}>
        {diff() > 0 ? '▲' : diff() < 0 ? '▼' : '='} {diff() > 0 ? '+' : ''}
        {diff()}
        {props.unit ?? ''} <span class="muted">{t('stats.vs', { label: props.label })}</span>
      </span>
    </Show>
  );
}

export default function Stats() {
  const [params] = useSearchParams();
  const initial = PERIODS.find((p) => p === params.period) ?? 'week';
  const [period, setPeriod] = createSignal<Period>(initial);
  const now = () => new Date();

  const current = createMemo(() => totals(daily, period(), now()));
  const previous = createMemo(() => totals(daily, period(), now(), 1));
  const accuracy = (x: { reviews: number; g: number[] }) =>
    x.reviews ? Math.round(((x.g[2] + x.g[3]) / x.reviews) * 100) : 0;

  const counts = createMemo(() => statusCounts());
  const learnedPct = () => (cards().length ? Math.round(((counts().review + counts().mastered) / cards().length) * 100) : 0);
  const streak = createMemo(() => streaks(daily, now()));
  const buckets = createMemo(() => activityBuckets(daily, period(), now()));
  const growth = createMemo(() => growthSeries(daily, period(), now(), activeDeck().id, activeDeck().builtin));
  const heat = createMemo(() => heatmap(daily, now()));
  const bySection = createMemo(() => sectionTotals(daily, period(), now()));
  const showHeat = () => period() === 'year' || period() === 'month';

  const hardest = createMemo(() =>
    cards()
      .map((c) => ({ card: c, p: progress[c.id] }))
      .filter((x) => x.p && x.p.lapses > 0)
      .sort((a, b) => b.p.lapses - a.p.lapses || a.p.ease - b.p.ease)
      .slice(0, 5),
  );

  const growthGain = () => {
    const g = growth();
    return g.length ? g[g.length - 1].learned - g[0].learned : 0;
  };

  const activitySubtitle = () =>
    period() === 'day' ? t('stats.activityByHour') : period() === 'year' ? t('stats.activityByMonth') : t('stats.activityByDay');
  const growthSubtitle = () =>
    period() === 'day' ? t('stats.growthWeek') : period() === 'year' ? t('stats.growthMonthEnd') : t('stats.growthDayEnd');

  return (
    <main class="page stats fit">
      <header class="page-head">
        <h1>{t('stats.title')}</h1>
        <div class="segmented" role="tablist" aria-label={t('stats.period')}>
          <For each={PERIODS}>
            {(p) => (
              <button role="tab" aria-selected={period() === p} classList={{ active: period() === p }} onClick={() => setPeriod(p)}>
                {periodLabel(p)}
              </button>
            )}
          </For>
        </div>
      </header>

      {/* На комп'ютері — панель в одне вікно (сітка в styles.css), на телефоні — блоки один під одним */}
      <div class="stats-grid" classList={{ 'no-heat': !showHeat() }}>
        <section class="panel hero-panel">
          <div>
            <span class="muted small">{t('stats.learnedTitle')}</span>
            <div class="hero-figure">{learnedPct()}%</div>
            <span class="muted small">
              {t('stats.learnedOf', {
                learned: counts().review + counts().mastered,
                total: cards().length,
                mastered: counts().mastered,
              })}
            </span>
          </div>
          <div class="streak">
            <span class="streak-flame" aria-hidden="true">
              🔥
            </span>
            <div>
              <strong>{streak().current}</strong> <span class="muted small">{t('stats.streakDays')}</span>
              <div class="muted small">{t('stats.record', { n: streak().best })}</div>
            </div>
          </div>
        </section>

        <section class="tiles">
          <div class="tile">
            <span class="tile-label">{t('stats.reviews')}</span>
            <span class="tile-value">{current().reviews}</span>
            <Delta now={current().reviews} prev={previous().reviews} label={prevLabel(period())} />
          </div>
          <div class="tile">
            <span class="tile-label">{t('stats.accuracy')}</span>
            <span class="tile-value">{accuracy(current())}%</span>
            <Delta now={accuracy(current())} prev={accuracy(previous())} label={prevLabel(period())} unit={t('stats.pp')} />
          </div>
          <div class="tile">
            <span class="tile-label">{t('stats.newCards')}</span>
            <span class="tile-value">{current().newCards}</span>
            <Delta now={current().newCards} prev={previous().newCards} label={prevLabel(period())} />
          </div>
          <div class="tile">
            <span class="tile-label">{t('stats.time')}</span>
            <span class="tile-value">{formatDuration(current().ms)}</span>
            <span class="muted small">
              {period() === 'day' ? t('stats.todayLower') : t('stats.activeDays', { n: current().activeDays })}
            </span>
          </div>
        </section>

        <section class="panel stats-activity">
          <h2>{t('stats.activity')}</h2>
          <p class="muted small">{activitySubtitle()}</p>
          <ColumnChart buckets={buckets()} unit={t('stats.unitReviews')} fill />
          <DataTable
            caption={t('stats.activity')}
            headers={[t('stats.colPeriod'), t('stats.reviews')]}
            rows={buckets().map((b) => [b.title, b.value])}
          />
        </section>

        <section class="panel stats-growth">
          <div class="panel-head">
            <div>
              <h2>{t('stats.growth')}</h2>
              <p class="muted small">
                {growthSubtitle()}
                {growthGain() > 0 ? t('stats.growthGain', { n: growthGain() }) : ''}
              </p>
            </div>
            <ul class="legend inline">
              <li>
                <i class="key s1" /> {t('stats.learnedSeries')}
              </li>
              <li>
                <i class="key s2" /> {t('stats.masteredSeries')}
              </li>
            </ul>
          </div>
          <GrowthChart points={growth()} total={cards().length} fill />
          <DataTable
            caption={t('stats.growth')}
            headers={[t('stats.colDate'), t('stats.learnedSeries'), t('stats.masteredSeries')]}
            rows={growth().map((p) => [p.title, p.learned, p.mastered])}
          />
          <p class="muted small footnote">{t('stats.footnote')}</p>
        </section>

        <div class="two-col stats-bars">
          <section class="panel">
            <h2>{t('stats.answers')}</h2>
            <StackedBar
              segments={[
                { label: t('grade.0'), value: current().g[0], cls: 'g0' },
                { label: t('grade.1'), value: current().g[1], cls: 'g1' },
                { label: t('grade.2'), value: current().g[2], cls: 'g2' },
                { label: t('grade.3'), value: current().g[3], cls: 'g3' },
              ]}
            />
          </section>

          <section class="panel">
            <h2>{t('stats.cardState')}</h2>
            <StackedBar
              segments={[
                { label: t('stats.stNew'), value: counts().new, cls: 'st0' },
                { label: t('stats.stLearning'), value: counts().learning, cls: 'st1' },
                { label: t('stats.stReview'), value: counts().review, cls: 'st2' },
                { label: t('stats.stMastered'), value: counts().mastered, cls: 'st3' },
              ]}
            />
          </section>
        </div>

        <Show when={showHeat()}>
          <section class="panel stats-heat">
            <h2>{t('stats.calendar')}</h2>
            <p class="muted small">{t('stats.calendarHint')}</p>
            <Heatmap weeks={heat().weeks} months={heat().months} />
          </section>
        </Show>

        <div class="stats-side">
          <section class="panel">
            <h2>{t('stats.sections')}</h2>
            <ul class="section-stats">
              <For each={sections()}>
                {(s) => {
                  const learned = () =>
                    s.cards.filter((c) => ['review', 'mastered'].includes(cardStatus(progress[c.id]))).length;
                  const inPeriod = () => bySection()[sectionStatKey(s.code)];
                  return (
                    <li>
                      <div class="section-stats-head">
                        <span class="badge">{sectionBadge(s.code)}</span>
                        <span class="section-stats-title">{sectionName(s.code, s.title)}</span>
                        <strong>
                          {learned()}/{s.cards.length}
                        </strong>
                      </div>
                      <div
                        class="meter thin"
                        role="img"
                        aria-label={t('stats.sectionAria', { learned: learned(), total: s.cards.length })}
                      >
                        <div class="meter-fill strong" style={{ width: `${(learned() / s.cards.length) * 100}%` }} />
                      </div>
                      <span class="muted small">
                        <Show when={inPeriod()?.n} fallback={t('stats.sectionNone')}>
                          {t('stats.sectionPeriod', {
                            n: inPeriod()!.n,
                            pct: Math.round((inPeriod()!.ok / inPeriod()!.n) * 100),
                          })}
                        </Show>
                      </span>
                    </li>
                  );
                }}
              </For>
            </ul>
          </section>

          <Show when={hardest().length > 0}>
            <section class="panel">
              <h2>{t('stats.hardest')}</h2>
              <p class="muted small">{t('stats.hardestHint')}</p>
              <ol class="hardest">
                <For each={hardest()}>
                  {(x) => (
                    <li>
                      <A href={`/browse?q=${encodeURIComponent(x.card.id)}`}>
                        <span class="badge">{cardLabel(x.card)}</span>
                        <span class="hardest-q">{x.card.question}</span>
                        <span class="muted small">×{x.p.lapses}</span>
                      </A>
                    </li>
                  )}
                </For>
              </ol>
            </section>
          </Show>
        </div>
      </div>
    </main>
  );
}
