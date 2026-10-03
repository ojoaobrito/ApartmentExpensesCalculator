/** Animações partilhadas (respeitam "reduzir movimento" do sistema) */

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
const running = new WeakMap<HTMLDetailsElement, Animation>();

/**
 * Abre/fecha um <details> animando a altura e a opacidade do conteúdo.
 * Usa a Web Animations API (funciona em todos os browsers, incl. Firefox).
 */
export function animateDetails(d: HTMLDetailsElement, open: boolean) {
  const body = d.querySelector<HTMLElement>(':scope > .section-body');
  if (!body || prefersReducedMotion()) {
    d.open = open;
    return;
  }
  if (open === d.open && !running.has(d)) return;
  // Parte da altura atual (pode estar a meio de outra animação)
  const from = running.has(d) ? body.getBoundingClientRect().height : open ? 0 : body.scrollHeight;
  running.get(d)?.cancel();
  if (open) d.open = true;
  const to = open ? body.scrollHeight : 0;
  // O espaçamento de baixo também anima, senão a secção salta no fim
  const pad = getComputedStyle(body).paddingBottom;
  d.classList.toggle('is-closing', !open);
  const anim = body.animate(
    [
      { height: `${from}px`, paddingBottom: open ? '0px' : pad, opacity: open ? 0 : 1, overflow: 'hidden', boxSizing: 'border-box' },
      { height: `${to}px`, paddingBottom: open ? pad : '0px', opacity: open ? 1 : 0, overflow: 'hidden', boxSizing: 'border-box' },
    ],
    { duration: Math.min(320, 160 + Math.abs(to - from) * 0.25), easing: EASE },
  );
  running.set(d, anim);
  anim.onfinish = () => {
    running.delete(d);
    d.classList.remove('is-closing');
    if (!open) d.open = false;
  };
  anim.oncancel = () => d.classList.remove('is-closing');
}
