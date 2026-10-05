import { describe, expect, it } from 'vitest';
import { defaultInputs, guestInputs } from './state';
import { compute } from './model';
import { isOwner } from '../functions/lib/owner';

describe('dono vs convidado', () => {
  it('reconhece o dono pelos emails configurados (sem distinguir maiúsculas)', () => {
    const env = { OWNER_EMAILS: 'a@x.pt, B@y.com' };
    expect(isOwner('a@x.pt', env)).toBe(true);
    expect(isOwner('b@Y.com', env)).toBe(true);
    expect(isOwner('amigo@z.pt', env)).toBe(false);
    expect(isOwner('a@x.pt', {})).toBe(false);
  });

  it('o convidado começa sem nada pessoal e com valores mais baixos', () => {
    const g = guestInputs();
    const o = defaultInputs();
    expect(g.listingUrl).toBe('');
    expect(g.useFinanceData).toBe(false);
    expect(g.price).toBeLessThan(o.price);
    expect(g.cash + g.investments).toBeLessThan(o.cash + o.investments);
    expect(g.netMonthlyIncome).toBeLessThan(o.netMonthlyIncome);
    expect(g.livingCosts.some((c) => o.livingCosts.some((x) => x.id === c.id))).toBe(false);
  });

  it('os valores do convidado dão uma simulação válida', () => {
    const m = compute(guestInputs());
    expect(m.ltv).toBeLessThanOrEqual(90);
    expect(m.cashLeft).toBeGreaterThanOrEqual(0);
    expect(m.effortStatus).not.toBe('impossible');
  });
});
