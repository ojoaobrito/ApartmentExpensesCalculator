import { useContext, type ReactNode } from 'react';
import { ChevronRight, CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import { NumberInput } from './NumberInput';
import { animateDetails } from './motion';
import { SearchContext } from './search';
import { Skeleton } from './Skeleton';
import { DragHandle } from './sortable';

interface NumberFieldProps {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: ReactNode;
  source?: string; // id da fonte (ver data/market.ts)
  disabled?: boolean;
  /** Valor ainda a chegar (mostra um esqueleto no lugar do campo) */
  loading?: boolean;
}

/** Campo numérico compacto, para usar dentro de listas */
export function InlineNumber(props: { value: number; onChange: (v: number) => void; suffix: string; step?: number; min?: number; max?: number; label: string }) {
  return <NumberInput {...props} className="inline-number" />;
}

export function NumberField(props: NumberFieldProps) {
  const { label, value, onChange, suffix, step = 1, min, max, hint, source, disabled, loading } = props;

  return (
    <label className="field">
      <span className="field-label">
        {label}
        {source && <SourceLink id={source} />}
      </span>
      {loading ? <Skeleton h={36} r={8} /> : <NumberInput value={value} onChange={onChange} step={step} min={min} max={max} suffix={suffix} disabled={disabled} />}
      {hint && (loading ? <Skeleton w="80%" h={9} style={{ marginTop: 4 }} /> : <span className="hint">{hint}</span>)}
    </label>
  );
}

export function SelectField<T extends string | number>(props: {
  label: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: ReactNode;
  source?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {props.label}
        {props.source && <SourceLink id={props.source} />}
      </span>
      <span className="input-wrap">
        <select
          value={String(props.value)}
          onChange={(e) => {
            const opt = props.options.find((o) => String(o.value) === e.target.value);
            if (opt) props.onChange(opt.value);
          }}
        >
          {props.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
      {props.hint && <span className="hint">{props.hint}</span>}
    </label>
  );
}

export function Segmented<T extends string | number>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup">
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === props.value}
          className={o.value === props.value ? 'on' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Check(props: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.children}</span>
    </label>
  );
}

export function Section(props: { icon: ReactNode; title: string; keywords?: string; badge?: ReactNode; open?: boolean; loading?: boolean; children: ReactNode }) {
  const query = useContext(SearchContext).trim();
  return (
    // Ao pesquisar, todas abrem (o painel esconde as que não correspondem); ao limpar voltam ao estado inicial
    <details key={query ? 'search' : 'normal'} className="section" open={query ? true : props.open} data-keywords={`${props.title} ${props.keywords ?? ''}`}>
      <summary
        onClick={(e) => {
          // Abre/fecha com animação em vez do salto nativo
          e.preventDefault();
          const d = e.currentTarget.parentElement as HTMLDetailsElement;
          animateDetails(d, !d.open || d.classList.contains('is-closing'));
        }}
      >
        <DragHandle />
        <span className="sec-icon" aria-hidden>
          {props.icon}
        </span>
        <span className="sec-head">
          <span className="sec-title">{props.title}</span>
          {/* A linha do selo existe sempre, para todas as secções terem a mesma altura */}
          <span className="badge">{props.loading ? <Skeleton w={78} h={19} r={999} /> : props.badge}</span>
        </span>
        <span className="chev" aria-hidden>
          <ChevronRight size={16} strokeWidth={2.2} />
        </span>
      </summary>
      <div className="section-body">{props.children}</div>
    </details>
  );
}

export function SourceLink({ id }: { id: string }) {
  return (
    <a className="src" href={`#fonte-${id}`} title="Ver fonte" aria-label="Ver fonte" onClick={(e) => e.stopPropagation()}>
      <Info size={13} strokeWidth={2} />
    </a>
  );
}

export function Alert(props: { kind: 'warn' | 'crit' | 'ok' | 'info'; children: ReactNode }) {
  const Icon = { warn: TriangleAlert, crit: CircleX, ok: CircleCheck, info: Info }[props.kind];
  return (
    <div className={`alert ${props.kind}`} role={props.kind === 'crit' ? 'alert' : undefined}>
      <span className="a-icon" aria-hidden>
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <div>{props.children}</div>
    </div>
  );
}
