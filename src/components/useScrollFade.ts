import { useEffect, type RefObject } from 'react';

/**
 * Marca um contentor com scroll com data-fade-top / data-fade-bottom quando há
 * conteúdo escondido desse lado; o CSS usa isso para esbater as bordas.
 */
export function useScrollFade(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop > 1;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      el.toggleAttribute('data-fade-top', top);
      el.toggleAttribute('data-fade-bottom', bottom);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // O conteúdo muda de altura (separadores, secções abertas, alertas…)
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    const mo = new MutationObserver(() => {
      Array.from(el.children).forEach((c) => ro.observe(c));
      update();
    });
    mo.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref]);
}
