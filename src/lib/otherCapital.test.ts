import { describe, expect, it } from 'vitest';
import { monthsAfterDeed, summarizeOtherCapital, type OtherCapital } from './otherCapital';
import { defaultInputs } from '../state';
import { compute } from '../model';

const item = (p: Partial<OtherCapital>): OtherCapital => ({ id: 'x', name: 'x', date: '2027-06', gross: 10_000, form: 'dinheiro', taxPct: 50, use: 'amortizar', ...p });

describe('outros capitais', () => {
  it('conta os meses a partir da escritura', () => {
    expect(monthsAfterDeed('2026-12', '2027-06')).toBe(6);
    expect(monthsAfterDeed('2026-12', '2026-12')).toBe(0);
    expect(monthsAfterDeed('2026-12', '2026-10')).toBe(-2);
  });

  it('antes da escritura entra na compra, depois amortiza, "guardar" fica de parte', () => {
    const s = summarizeOtherCapital(
      [item({ id: 'a', date: '2026-11' }), item({ id: 'b', date: '2027-06' }), item({ id: 'c', use: 'guardar', taxPct: 40 })],
      '2026-12',
    );
    expect(s.atDeed).toBe(5_000);
    expect(s.lumpSums).toEqual([{ id: 'oc-b', month: 6, amount: 5_000 }]);
    expect(s.kept).toBe(6_000);
    expect(s.net).toBe(16_000);
  });

  it('o bónus a amortizar reduz juros e o que é preciso amortizar por mês para o objetivo', () => {
    const base = { ...defaultInputs(), otherCapital: [] };
    const sem = compute(base);
    const com = compute(defaultInputs());
    expect(com.withExtras.totalInterest).toBeLessThan(sem.withExtras.totalInterest);
    expect(com.extraMonthlyEquivalent).toBeLessThan(sem.extraMonthlyEquivalent);
  });

  it('um capital antes da escritura aumenta o capital disponível', () => {
    const base = { ...defaultInputs(), otherCapital: [] };
    const com = { ...base, otherCapital: [item({ date: '2026-10', gross: 20_000, taxPct: 0 })] };
    expect(compute(com).available - compute(base).available).toBeCloseTo(20_000, 6);
  });
});
