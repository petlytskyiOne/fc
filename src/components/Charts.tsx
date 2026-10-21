// Легкі SVG-графіки без сторонніх бібліотек: стовпці, лінії росту, стовпчик-частки, теплова карта.
// Специфікація позначок: стовпці ≤ 24px із заокругленим кінцем, лінії 2px, точки r=4 з кільцем,
// сітка — тонкі суцільні лінії, підписи — кольором тексту, а не серії.
import { createMemo, createSignal, For, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { niceMax, type Bucket, type GrowthPoint, type HeatCell } from '../lib/analytics';
import { formatNumber, t } from '../lib/i18n';

/**
 * Статистика «в одне вікно» на комп'ютері: графіки з fill беруть висоту з панелі.
 * Той самий запит — у styles.css (.page.fit у статистиці), там .viz.fill отримує висоту від сітки.
 */
export const FIT_QUERY = '(min-width: 1280px) and (min-height: 700px)';

const [fitScreen, setFitScreen] = createSignal(false);
if (typeof window !== 'undefined') {
  const mq = window.matchMedia(FIT_QUERY);
  setFitScreen(mq.matches);
  mq.addEventListener('change', (e) => setFitScreen(e.matches));
}

function useSize(): [(el: HTMLElement) => void, () => number, () => number] {
  const [width, setWidth] = createSignal(0);
  const [height, setHeight] = createSignal(0);
  let observer: ResizeObserver | undefined;
  const ref = (el: HTMLElement) => {
    onMount(() => {
      setWidth(el.clientWidth);
      setHeight(el.clientHeight);
      observer = new ResizeObserver(([entry]) => {
        setWidth(entry.contentRect.width);
        setHeight(entry.contentRect.height);
      });
      observer.observe(el);
    });
  };
  onCleanup(() => observer?.disconnect());
  return [ref, width, height];
}

/** Висота графіка: задана, або висота панелі в режимі «одне вікно», або типова */
const chartHeight = (props: { height?: number; fill?: boolean }, measured: number, fallback: number) =>
  props.height ?? (props.fill && fitScreen() && measured > 60 ? measured : fallback);

const fmt = formatNumber;

/** Шлях стовпця: заокруглений верх 4px, прямий біля базової лінії */
function columnPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function Tooltip(props: { x: number; y: number; width: number; children: JSX.Element }) {
  const left = () => Math.min(Math.max(props.x, 70), Math.max(70, props.width - 70));
  return (
    <div class="viz-tooltip" style={{ left: `${left()}px`, top: `${props.y}px` }} role="status">
      {props.children}
    </div>
  );
}

const PAD = { top: 12, right: 8, bottom: 24, left: 32 };

export function ColumnChart(props: { buckets: Bucket[]; unit: string; height?: number; fill?: boolean }) {
  const [ref, width, boxHeight] = useSize();
  const [active, setActive] = createSignal<number | null>(null);
  const height = () => chartHeight(props, boxHeight(), 180);

  const geo = createMemo(() => {
    const w = Math.max(width() - PAD.left - PAD.right, 10);
    const h = height() - PAD.top - PAD.bottom;
    const max = niceMax(Math.max(...props.buckets.map((b) => b.value), 0));
    const band = w / props.buckets.length;
    const barW = Math.min(24, band * 0.7);
    const labelEvery = Math.ceil(props.buckets.length / Math.max(2, Math.floor(w / 36)));
    return { w, h, max, band, barW, labelEvery };
  });

  const y = (v: number) => PAD.top + geo().h - (v / geo().max) * geo().h;

  return (
    <div class="viz" classList={{ fill: props.fill }} ref={ref} onPointerLeave={() => setActive(null)}>
      <Show when={width() > 0}>
        <svg width={width()} height={height()} role="img" aria-label={t('chart.columnAria', { unit: props.unit })}>
          <For each={[0, 0.5, 1]}>
            {(f) => (
              <>
                <line class="viz-grid" x1={PAD.left} x2={PAD.left + geo().w} y1={y(geo().max * f)} y2={y(geo().max * f)} />
                <text class="viz-tick" x={PAD.left - 6} y={y(geo().max * f)} text-anchor="end" dominant-baseline="middle">
                  {fmt(geo().max * f)}
                </text>
              </>
            )}
          </For>
          <For each={props.buckets}>
            {(b, i) => {
              const cx = () => PAD.left + geo().band * i() + geo().band / 2;
              return (
                <g>
                  <path
                    class="viz-bar"
                    classList={{ dim: active() !== null && active() !== i() }}
                    d={columnPath(cx() - geo().barW / 2, y(b.value), geo().barW, PAD.top + geo().h - y(b.value))}
                  />
                  <Show when={i() % geo().labelEvery === 0 || b.current}>
                    <text
                      class="viz-tick"
                      classList={{ strong: b.current }}
                      x={cx()}
                      y={height() - 6}
                      text-anchor="middle"
                    >
                      {b.label}
                    </text>
                  </Show>
                  <rect
                    class="viz-hit"
                    x={cx() - geo().band / 2}
                    y={PAD.top}
                    width={geo().band}
                    height={geo().h}
                    onPointerEnter={() => setActive(i())}
                    onClick={() => setActive(i())}
                  />
                </g>
              );
            }}
          </For>
        </svg>
        <Show when={active() !== null}>
          {(() => {
            const b = props.buckets[active()!];
            return (
              <Tooltip x={PAD.left + geo().band * active()! + geo().band / 2} y={y(b.value) - 8} width={width()}>
                <span class="viz-tooltip-title">{b.title}</span>
                <strong>
                  {fmt(b.value)} {props.unit}
                </strong>
              </Tooltip>
            );
          })()}
        </Show>
      </Show>
    </div>
  );
}

export function GrowthChart(props: { points: GrowthPoint[]; total: number; height?: number; fill?: boolean }) {
  const [ref, width, boxHeight] = useSize();
  const [active, setActive] = createSignal<number | null>(null);
  const height = () => chartHeight(props, boxHeight(), 200);
  const right = 64; // місце під підписи на кінцях ліній

  const geo = createMemo(() => {
    const w = Math.max(width() - PAD.left - right, 10);
    const h = height() - PAD.top - PAD.bottom;
    const max = niceMax(Math.max(props.total, 1));
    const step = props.points.length > 1 ? w / (props.points.length - 1) : w;
    const labelEvery = Math.ceil(props.points.length / Math.max(2, Math.floor(w / 40)));
    return { w, h, max, step, labelEvery };
  });
  const x = (i: number) => PAD.left + geo().step * i;
  const y = (v: number) => PAD.top + geo().h - (v / geo().max) * geo().h;

  const line = (key: 'learned' | 'mastered') =>
    props.points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key])}`).join(' ');
  const area = (key: 'learned' | 'mastered') =>
    `${line(key)} L${x(props.points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const last = () => props.points[props.points.length - 1];

  return (
    <div class="viz" classList={{ fill: props.fill }} ref={ref} onPointerLeave={() => setActive(null)}>
      <Show when={width() > 0 && props.points.length > 0}>
        <svg width={width()} height={height()} role="img" aria-label={t('chart.lineAria')}>
          <For each={[0, 0.5, 1]}>
            {(f) => (
              <>
                <line class="viz-grid" x1={PAD.left} x2={PAD.left + geo().w} y1={y(geo().max * f)} y2={y(geo().max * f)} />
                <text class="viz-tick" x={PAD.left - 6} y={y(geo().max * f)} text-anchor="end" dominant-baseline="middle">
                  {fmt(geo().max * f)}
                </text>
              </>
            )}
          </For>
          <line class="viz-total" x1={PAD.left} x2={PAD.left + geo().w} y1={y(props.total)} y2={y(props.total)} />
          <text class="viz-tick" x={PAD.left + geo().w} y={y(props.total) - 5} text-anchor="end">
            {t('chart.total', { n: props.total })}
          </text>

          <path class="viz-area s1" d={area('learned')} />
          <path class="viz-line s1" d={line('learned')} />
          <path class="viz-line s2" d={line('mastered')} />

          <For each={props.points}>
            {(p, i) => (
              <Show when={i() % geo().labelEvery === 0 || i() === props.points.length - 1}>
                <text class="viz-tick" x={x(i())} y={height() - 6} text-anchor="middle">
                  {p.label}
                </text>
              </Show>
            )}
          </For>

          {/* Кінцеві точки з прямими підписами */}
          <circle class="viz-dot s1" cx={x(props.points.length - 1)} cy={y(last().learned)} r="4" />
          <circle class="viz-dot s2" cx={x(props.points.length - 1)} cy={y(last().mastered)} r="4" />
          <text class="viz-end" x={x(props.points.length - 1) + 8} y={y(last().learned)} dominant-baseline="middle">
            {last().learned}
          </text>
          <Show when={Math.abs(y(last().learned) - y(last().mastered)) > 12}>
            <text class="viz-end" x={x(props.points.length - 1) + 8} y={y(last().mastered)} dominant-baseline="middle">
              {last().mastered}
            </text>
          </Show>

          <Show when={active() !== null}>
            <line class="viz-crosshair" x1={x(active()!)} x2={x(active()!)} y1={PAD.top} y2={PAD.top + geo().h} />
            <circle class="viz-dot s1" cx={x(active()!)} cy={y(props.points[active()!].learned)} r="4" />
            <circle class="viz-dot s2" cx={x(active()!)} cy={y(props.points[active()!].mastered)} r="4" />
          </Show>

          <For each={props.points}>
            {(_, i) => (
              <rect
                class="viz-hit"
                x={x(i()) - geo().step / 2}
                y={PAD.top}
                width={Math.max(geo().step, 8)}
                height={geo().h}
                onPointerEnter={() => setActive(i())}
                onClick={() => setActive(i())}
              />
            )}
          </For>
        </svg>
        <Show when={active() !== null}>
          {(() => {
            const p = props.points[active()!];
            return (
              <Tooltip x={x(active()!)} y={y(p.learned) - 8} width={width()}>
                <span class="viz-tooltip-title">{p.title}</span>
                <span class="viz-tooltip-row">
                  <i class="key s1" /> {t('stats.learnedSeries')} <strong>{p.learned}</strong>
                </span>
                <span class="viz-tooltip-row">
                  <i class="key s2" /> {t('stats.masteredSeries')} <strong>{p.mastered}</strong>
                </span>
              </Tooltip>
            );
          })()}
        </Show>
      </Show>
    </div>
  );
}

export interface Segment {
  label: string;
  value: number;
  cls: string;
}

/** Один горизонтальний стовпчик із частками + легенда з числами (підписи видимі завжди) */
export function StackedBar(props: { segments: Segment[] }) {
  const total = () => props.segments.reduce((s, x) => s + x.value, 0);
  const pct = (v: number) => (total() ? Math.round((v / total()) * 100) : 0);
  return (
    <div class="stacked">
      <div class="stacked-bar" role="img" aria-label={props.segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        <Show when={total() > 0} fallback={<div class="stacked-empty" />}>
          <For each={props.segments.filter((s) => s.value > 0)}>
            {(s) => <div class={`stacked-seg ${s.cls}`} style={{ flex: s.value }} title={`${s.label}: ${s.value}`} />}
          </For>
        </Show>
      </div>
      <ul class="legend">
        <For each={props.segments}>
          {(s) => (
            <li>
              <i class={`key ${s.cls}`} />
              <span>{s.label}</span>
              <strong>{s.value}</strong>
              <span class="muted">{pct(s.value)}%</span>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

const heatLevel = (v: number, max: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / Math.max(max, 1)) * 4)));

export function Heatmap(props: { weeks: HeatCell[][]; months: { col: number; label: string }[] }) {
  const [active, setActive] = createSignal<HeatCell | null>(null);
  const max = createMemo(() => Math.max(...props.weeks.flat().map((c) => c.value), 1));
  return (
    <div class="heatmap-wrap">
      <div class="heatmap-scroll">
        <div class="heatmap-months" style={{ 'grid-template-columns': `repeat(${props.weeks.length}, 13px)` }}>
          <For each={props.months}>
            {(m) => <span style={{ 'grid-column': `${m.col + 1} / span 4` }}>{m.label}</span>}
          </For>
        </div>
        <div class="heatmap" style={{ 'grid-template-columns': `repeat(${props.weeks.length}, 13px)` }}>
          <For each={props.weeks}>
            {(week) => (
              <div class="heatmap-col">
                <For each={week}>
                  {(cell) => (
                    <button
                      class={`heat l${heatLevel(cell.value, max())}`}
                      classList={{ future: cell.future, active: active()?.key === cell.key }}
                      disabled={cell.future}
                      aria-label={t('chart.heatDay', { date: cell.title, n: cell.value })}
                      onPointerEnter={() => setActive(cell)}
                      onClick={() => setActive(cell)}
                    />
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
      <div class="heatmap-foot">
        <span class="muted small">
          <Show when={active()} fallback={t('chart.heatHint')}>
            {t('chart.heatDay', { date: active()!.title, n: active()!.value })}
          </Show>
        </span>
        <span class="heat-scale muted small">
          {t('chart.less')} <i class="heat l0" /> <i class="heat l1" /> <i class="heat l2" /> <i class="heat l3" /> <i class="heat l4" /> {t('chart.more')}
        </span>
      </div>
    </div>
  );
}

/** Табличне представлення для доступності (те саме, що на графіку) */
export function DataTable(props: { caption: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <details class="data-table">
      <summary>{t('chart.table')}</summary>
      <table>
        <caption class="sr-only">{props.caption}</caption>
        <thead>
          <tr>
            <For each={props.headers}>{(h) => <th scope="col">{h}</th>}</For>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(r) => (
              <tr>
                <For each={r}>{(c) => <td>{c}</td>}</For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </details>
  );
}
