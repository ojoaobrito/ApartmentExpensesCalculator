import { useEffect, useRef, useState } from 'react';

/**
 * Campo numérico partilhado, ao estilo do Figma:
 *  - escrever livremente (aceita vírgula), setas ↑/↓ (Shift = ×10);
 *  - arrastar o ícone ↔ para a esquerda/direita para descer/subir o valor
 *    (1 passo a cada 4 px; Shift = ×10, Alt/Option = ÷10); junto às bordas da janela
 *    o valor continua a mudar sozinho. Esc cancela.
 */

const PX_PER_STEP = 4;
/** Distância à borda da janela a partir da qual o valor avança sozinho */
const EDGE_PX = 28;
const SCRUB_SVG =
  '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M5 4.5 1.5 8 5 11.5M11 4.5 14.5 8 11 11.5M2 8h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  /** Rótulo acessível (quando não há <label> à volta) */
  label?: string;
  className?: string;
}

export function NumberInput({ value, onChange, step = 1, min, max, suffix, disabled, label, className }: NumberInputProps) {
  // Texto escrito pelo utilizador (permite "0," ou campo vazio enquanto se escreve).
  // Só existe depois de escrever: se o valor mudar por fora, o campo mostra-o.
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  // Termina um arrasto em curso (também chamado se o componente desaparecer)
  const stopDrag = useRef<(() => void) | null>(null);

  const clamp = (v: number) => {
    let x = round(v);
    if (min !== undefined) x = Math.max(min, x);
    if (max !== undefined) x = Math.min(max, x);
    return x;
  };
  const commitText = (s: string) => {
    const n = parseFloat(s.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(n)) onChange(clamp(n));
  };

  useEffect(() => () => stopDrag.current?.(), []);

  /**
   * Arrasto ao estilo Figma, sem bloquear o cursor (o Pointer Lock faz o browser
   * mostrar um aviso). Para não ficar limitado pelas margens: perto da borda da
   * janela (ou fora dela) o valor continua a mudar sozinho nessa direção, mais
   * depressa quanto mais encostado. A captura do ponteiro mantém os eventos a
   * chegar mesmo com o cursor fora da janela.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault(); // não foca o campo nem seleciona texto
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);
    const base = value;
    let acc = 0; // deslocamento acumulado, em px "efetivos"
    let lastX = e.clientX;
    let x = e.clientX;
    let shift = e.shiftKey;
    let alt = e.altKey;
    let pending: number | null = null;
    let lastT = performance.now();
    let raf = 0;
    let edge: 'left' | 'right' | null = null;

    const mult = () => (shift ? 10 : alt ? 0.1 : 1);
    const apply = () => {
      const next = clamp(base + Math.trunc(acc / PX_PER_STEP) * step);
      if (next !== pending) {
        pending = next;
        onChange(next);
      }
    };
    const setEdge = (next: typeof edge) => {
      if (next === edge) return;
      document.body.classList.toggle('scrub-edge-left', next === 'left');
      document.body.classList.toggle('scrub-edge-right', next === 'right');
      edge = next;
    };

    // Ciclo por frame: aplica o valor e, junto às bordas, avança automaticamente
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      const w = window.innerWidth;
      const depth = x < EDGE_PX ? EDGE_PX - x : x > w - EDGE_PX ? x - (w - EDGE_PX) : 0;
      if (depth > 0) {
        const dir = x < EDGE_PX ? -1 : 1;
        // 8 a ~40 passos por segundo, conforme a profundidade (e fora da janela)
        const stepsPerSec = Math.min(40, 8 + depth * 0.8);
        acc += dir * stepsPerSec * PX_PER_STEP * dt * mult();
        setEdge(dir < 0 ? 'left' : 'right');
      } else setEdge(null);
      apply();
      raf = requestAnimationFrame(tick);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      shift = ev.shiftKey;
      alt = ev.altKey;
      acc += (ev.clientX - lastX) * mult();
      lastX = ev.clientX;
      x = ev.clientX;
    };

    const finish = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
      document.removeEventListener('keydown', onKey);
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      apply();
      setEdge(null);
      document.body.classList.remove('scrubbing');
      setScrubbing(false);
      stopDrag.current = null;
    };
    // Esc cancela e repõe o valor inicial
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      acc = 0;
      finish();
      onChange(base);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
    document.addEventListener('keydown', onKey);
    stopDrag.current = finish;
    setDraft(null);
    setScrubbing(true);
    document.body.classList.add('scrubbing');
    raf = requestAnimationFrame(tick);
  };

  const text = draft ?? (focused ? fmtInput(value) : fmtDisplay(value));

  return (
    <span className={`input-wrap${className ? ` ${className}` : ''}${scrubbing ? ' is-scrubbing' : ''}`} style={disabled ? { opacity: 0.6 } : undefined}>
      <span
        className="scrub"
        aria-hidden
        title={disabled ? undefined : 'Arrasta para os lados para mudar o valor (Shift ×10, Alt ÷10)'}
        onPointerDown={onPointerDown}
        onClick={(e) => e.preventDefault()}
      >
        <span dangerouslySetInnerHTML={{ __html: SCRUB_SVG }} />
      </span>
      <input
        inputMode="decimal"
        aria-label={label}
        value={text}
        disabled={disabled}
        onFocus={(e) => {
          // Mostra o número sem separadores e seleciona tudo (depois do re-render,
          // senão a troca de texto desfaz a seleção e o que se escreve é acrescentado)
          const el = e.currentTarget;
          setFocused(true);
          requestAnimationFrame(() => {
            if (document.activeElement === el) el.select();
          });
        }}
        onBlur={() => {
          if (draft !== null) commitText(draft);
          setDraft(null);
          setFocused(false);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          commitText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = clamp(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
            onChange(next);
            setDraft(null);
          }
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </span>
  );
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const fmtInput = (v: number) => String(round(v)).replace('.', ',');
const display = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 6 });
const fmtDisplay = (v: number) => display.format(round(v));
