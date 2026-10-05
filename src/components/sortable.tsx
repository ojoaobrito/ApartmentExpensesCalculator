import { createContext, useContext, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

/** Pega de arrasto de cada secção (fornecida pela lista ordenável) */
const HandleContext = createContext<{ onPointerDown: (e: RPointerEvent) => void; onKeyDown: (e: KeyboardEvent) => void; label: string } | null>(null);

/** Pega ⋮⋮ no cabeçalho de uma secção: arrastar para reordenar; ↑/↓ com o teclado */
export function DragHandle() {
  const h = useContext(HandleContext);
  if (!h) return null;
  return (
    <span
      className="drag-handle"
      role="button"
      tabIndex={0}
      aria-label={`Mover ${h.label} (arrasta, ou usa as setas ↑/↓)`}
      title="Arrasta para reordenar"
      onPointerDown={h.onPointerDown}
      onKeyDown={h.onKeyDown}
      // Não abre/fecha a secção
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <GripVertical size={14} strokeWidth={2} />
    </span>
  );
}

const EDGE = 48; // px junto à borda do painel em que faz scroll sozinho

/**
 * Lista reordenável por arrasto (rato e toque). As outras secções deslizam
 * para o lugar (FLIP); `onCommit` é chamado no fim do arrasto com a nova ordem.
 */
export function SortableList({ order, items, labels, onCommit }: { order: string[]; items: Record<string, ReactNode>; labels: Record<string, string>; onCommit: (order: string[]) => void }) {
  const [live, setLive] = useState(order);
  const [prevOrder, setPrevOrder] = useState(order);
  // A ordem vinda de fora (p.ex. carregada do servidor) substitui a local
  if (order !== prevOrder) {
    setPrevOrder(order);
    setLive(order);
  }
  const refs = useRef(new Map<string, HTMLDivElement>());
  const before = useRef<Map<string, number> | null>(null);
  const drag = useRef<{ id: string; startY: number; startTop: number; startScroll: number; y: number; scroller: HTMLElement | null } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const snapshot = () => {
    const m = new Map<string, number>();
    for (const [id, el] of refs.current) m.set(id, el.offsetTop);
    before.current = m;
  };

  /** Põe a secção arrastada debaixo do ponteiro (a partir da posição no layout) */
  const place = () => {
    const d = drag.current;
    if (!d) return;
    const el = refs.current.get(d.id);
    if (!el) return;
    const scroll = (d.scroller?.scrollTop ?? 0) - d.startScroll;
    el.style.transform = `translateY(${d.startTop + (d.y - d.startY) + scroll - el.offsetTop}px)`;
  };

  // Depois de mudar a ordem: anima as outras secções do sítio antigo para o novo
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = null;
    place();
    if (!prev) return;
    for (const [id, el] of refs.current) {
      if (id === drag.current?.id) continue;
      const dy = (prev.get(id) ?? el.offsetTop) - el.offsetTop;
      if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    }
  }, [live]);

  const move = (id: string, to: number, list = live) => {
    const from = list.indexOf(id);
    if (from === to || to < 0 || to >= list.length) return list;
    const next = [...list];
    next.splice(from, 1);
    next.splice(to, 0, id);
    snapshot();
    setLive(next);
    return next;
  };

  const start = (id: string) => (e: RPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = refs.current.get(id);
    if (!el) return;
    const scroller = el.closest<HTMLElement>('.inputs');
    drag.current = { id, startY: e.clientY, startTop: el.offsetTop, startScroll: scroller?.scrollTop ?? 0, y: e.clientY, scroller };
    let current = live;
    setDragging(id);
    document.body.classList.add('sorting');
    let raf = 0;

    const check = () => {
      const d = drag.current;
      if (!d) return;
      const me = refs.current.get(id)!;
      const r = me.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const k = current.indexOf(id);
      const prev = refs.current.get(current[k - 1]);
      const next = refs.current.get(current[k + 1]);
      if (prev) {
        const p = prev.getBoundingClientRect();
        if (mid < p.top + p.height / 2) current = move(id, k - 1, current);
      }
      if (next && current.indexOf(id) === k) {
        const n = next.getBoundingClientRect();
        if (mid > n.top + n.height / 2) current = move(id, k + 1, current);
      }
    };
    // Scroll automático junto às bordas do painel
    const tick = () => {
      const d = drag.current;
      if (!d) return;
      const box = (d.scroller ?? document.documentElement).getBoundingClientRect();
      const top = d.scroller ? box.top : 0;
      const bottom = d.scroller ? box.bottom : window.innerHeight;
      const speed = d.y < top + EDGE ? -(top + EDGE - d.y) / 3 : d.y > bottom - EDGE ? (d.y - (bottom - EDGE)) / 3 : 0;
      if (speed) {
        if (d.scroller) d.scroller.scrollTop += speed;
        else window.scrollBy(0, speed);
        place();
        check();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMove = (ev: PointerEvent) => {
      if (!drag.current) return;
      drag.current.y = ev.clientY;
      place();
      check();
    };
    const onUp = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('sorting');
      const me = refs.current.get(id);
      if (me) {
        const from = me.style.transform;
        me.style.transform = '';
        if (from) me.animate([{ transform: from }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
      }
      drag.current = null;
      setDragging(null);
      if (current.join() !== order.join()) onCommit(current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const keys = (id: string) => (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const next = move(id, live.indexOf(id) + (e.key === 'ArrowUp' ? -1 : 1));
    if (next !== live) onCommit(next);
    // Mantém o foco na pega depois de mover
    requestAnimationFrame(() => refs.current.get(id)?.querySelector<HTMLElement>('.drag-handle')?.focus());
  };

  return (
    <>
      {live.map((id) => (
        <div
          key={id}
          className={`sort-slot${dragging === id ? ' is-dragging' : ''}`}
          ref={(el) => {
            if (el) refs.current.set(id, el);
            else refs.current.delete(id);
          }}
        >
          <HandleContext.Provider value={{ onPointerDown: start(id), onKeyDown: keys(id), label: labels[id] ?? id }}>{items[id]}</HandleContext.Provider>
        </div>
      ))}
    </>
  );
}
