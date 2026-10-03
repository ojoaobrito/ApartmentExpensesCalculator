import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import { eur, eurK } from '../lib/format';

const axisProps = {
  tick: { fill: 'var(--text-3)', fontSize: 11 },
  axisLine: { stroke: 'var(--grid)' },
  tickLine: false,
} as const;

interface Series {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

function Legend({ series, kind }: { series: Series[]; kind: 'line' | 'box' }) {
  if (series.length < 2) return null;
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.key}>
          <i className={kind === 'line' ? 'line' : ''} style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

interface TipProps {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; value?: unknown }[];
  label?: unknown;
  series: Series[];
  title: (label: number) => string;
  fmt: (v: number) => string;
  total?: boolean;
}

function ChartTooltip({ active, payload, label, series, title, fmt, total }: TipProps) {
    if (!active || !payload?.length || typeof label !== 'number') return null;
    const vals = new Map(payload.map((p) => [String(p.dataKey), Number(p.value)]));
    const sum = series.reduce((a, s) => a + (vals.get(s.key) ?? 0), 0);
    return (
      <div className="tt">
        <div className="tt-title">{title(label)}</div>
        {series.map((s) =>
          vals.has(s.key) ? (
            <div className="tt-row" key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
              <b>{fmt(vals.get(s.key)!)}</b>
            </div>
          ) : null,
        )}
        {total && (
          <div className="tt-row" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
            Total
            <b>{fmt(sum)}</b>
          </div>
        )}
      </div>
    );
}

/** Ticks de 5 em 5 anos (ou anuais em séries curtas) */
function yearTicks(data: Record<string, number>[], xKey: string) {
  const xs = data.map((d) => d[xKey]);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const step = max - min <= 12 ? 1 : max - min <= 25 ? 2 : 5;
  const out: number[] = [];
  for (let x = Math.ceil(min / step) * step; x <= max; x += step) out.push(x);
  return out;
}

export function ChartCard(props: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <h2>{props.title}</h2>
      {props.sub && <div className="card-sub">{props.sub}</div>}
      {props.children}
    </div>
  );
}

export function LinesChart(props: {
  data: Record<string, number>[];
  xKey: string;
  series: Series[];
  xTitle?: (x: number) => string;
  yFmt?: (v: number) => string;
  tooltipFmt?: (v: number) => string;
  height?: number;
  step?: boolean;
  refY?: number;
}) {
  const { data, xKey, series, height = 260 } = props;
  const title = props.xTitle ?? ((x: number) => `Ano ${x}`);
  const fmt = props.tooltipFmt ?? eur;
  return (
    <>
      <Legend series={series} kind="line" />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} type="number" domain={['dataMin', 'dataMax']} ticks={yearTicks(data, xKey)} allowDecimals={false} />
          <YAxis {...axisProps} width={58} tickFormatter={props.yFmt ?? eurK} />
          {props.refY !== undefined && <ReferenceLine y={props.refY} stroke="var(--text-3)" strokeDasharray="3 3" />}
          <Tooltip content={(p) => <ChartTooltip {...p} series={series} title={title} fmt={fmt} />} cursor={{ stroke: 'var(--text-3)', strokeDasharray: '3 3' }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type={props.step ? 'stepAfter' : 'monotone'}
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

export function StackedBars(props: {
  data: Record<string, number>[];
  xKey: string;
  series: Series[];
  height?: number;
  xTitle?: (x: number) => string;
}) {
  const { data, xKey, series, height = 280 } = props;
  const title = props.xTitle ?? ((x: number) => `Ano ${x}`);
  return (
    <>
      <Legend series={series} kind="box" />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axisProps} width={58} tickFormatter={eurK} />
          <Tooltip content={(p) => <ChartTooltip {...p} series={series} title={title} fmt={eur} total />} cursor={{ fill: 'var(--surface-2)' }} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="a"
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth={1}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
