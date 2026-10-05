import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTION_ORDER, normalizeOrder } from './sectionOrder';

describe('ordem das secções', () => {
  it('sem nada gravado usa a ordem por defeito', () => {
    expect(normalizeOrder(null)).toEqual(DEFAULT_SECTION_ORDER);
  });
  it('ignora ids desconhecidos e repetidos e acrescenta secções novas no sítio por defeito', () => {
    const saved = ['seguros', 'imovel', 'xpto', 'imovel', 'capitais', 'credito', 'custos', 'amortizacoes', 'rendimento', 'despesas'];
    const o = normalizeOrder(saved);
    expect(o).toHaveLength(DEFAULT_SECTION_ORDER.length);
    expect(o.slice(0, 2)).toEqual(['seguros', 'imovel']);
    // "outros" é nova: entra logo a seguir a "capitais"
    expect(o[o.indexOf('capitais') + 1]).toBe('outros');
  });
});
