import { useEffect, useState } from 'react';

/** Ordem por defeito das secções do painel */
export const DEFAULT_SECTION_ORDER = ['imovel', 'capitais', 'outros', 'rendimento', 'despesas', 'credito', 'amortizacoes', 'custos', 'seguros'];

const KEY = 'casa-sim:section-order';

/** Mantém só ids conhecidos e acrescenta as secções novas na posição por defeito */
export function normalizeOrder(saved: unknown): string[] {
  if (!Array.isArray(saved)) return DEFAULT_SECTION_ORDER;
  const known = saved.filter((id): id is string => typeof id === 'string' && DEFAULT_SECTION_ORDER.includes(id));
  const out = [...new Set(known)];
  DEFAULT_SECTION_ORDER.forEach((id, k) => {
    if (out.includes(id)) return;
    // Insere depois da secção que a antecede por defeito
    const prev = DEFAULT_SECTION_ORDER.slice(0, k).reverse().find((p) => out.includes(p));
    out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, id);
  });
  return out;
}

function readLocal() {
  try {
    return normalizeOrder(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return DEFAULT_SECTION_ORDER;
  }
}
function writeLocal(order: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* sem armazenamento */
  }
}

/**
 * Ordem das secções: guardada neste browser e na conta (/api/prefs, no KV),
 * por isso sobrevive a limpezas do browser e acompanha a pessoa entre dispositivos.
 */
export function useSectionOrder() {
  const [order, setOrder] = useState<string[]>(readLocal);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/prefs', { headers: { accept: 'application/json' } });
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return;
        const p = (await res.json()) as { sectionOrder?: string[] };
        if (alive && p.sectionOrder) {
          const o = normalizeOrder(p.sectionOrder);
          writeLocal(o);
          setOrder(o);
        }
      } catch {
        /* sem API: fica a do browser */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const save = (next: string[]) => {
    setOrder(next);
    writeLocal(next);
    void fetch('/api/prefs', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sectionOrder: next }) }).catch(() => {});
  };
  const reset = () => save(DEFAULT_SECTION_ORDER);
  return { order, save, reset };
}
