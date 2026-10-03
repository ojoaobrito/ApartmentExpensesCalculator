import { createContext } from 'react';

/** Texto da caixa de pesquisa do painel de parâmetros */
export const SearchContext = createContext('');

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Todas as palavras da pesquisa aparecem no título ou nas palavras-chave */
export function matchesSearch(query: string, text: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const hay = normalize(text);
  return words.every((w) => hay.includes(w));
}

/** Texto pesquisável de um campo: rótulo + opções das listas (sem as dicas) */
function fieldText(el: Element): string {
  const label = el.querySelector('.field-label')?.textContent ?? el.textContent ?? '';
  const options = [...el.querySelectorAll('option')].map((o) => o.textContent).join(' ');
  return `${label} ${options}`;
}

/**
 * Filtra as secções do painel e destaca os campos encontrados.
 * Devolve o nº de secções visíveis e o primeiro campo destacado.
 */
export function applySearch(root: HTMLElement, query: string): { visible: number; firstHit: HTMLElement | null } {
  root.querySelectorAll('.search-hit').forEach((el) => el.classList.remove('search-hit'));
  const sections = [...root.querySelectorAll<HTMLDetailsElement>('details.section')];
  const q = query.trim();
  if (!q) {
    sections.forEach((s) => (s.hidden = false));
    return { visible: sections.length, firstHit: null };
  }
  let visible = 0;
  let firstHit: HTMLElement | null = null;
  for (const sec of sections) {
    const fields = [...sec.querySelectorAll<HTMLElement>('.section-body .field, .section-body .check, .section-body .seg')].filter(
      (el) => !el.parentElement?.closest('.field'),
    );
    const hits = fields.filter((el) => matchesSearch(q, fieldText(el)));
    const head = sec.dataset.keywords ?? '';
    const show = hits.length > 0 || matchesSearch(q, head);
    sec.hidden = !show;
    if (!show) continue;
    visible++;
    hits.forEach((el) => el.classList.add('search-hit'));
    firstHit ??= hits[0] ?? null;
  }
  return { visible, firstHit };
}
