import { describe, expect, it } from 'vitest';
import { pmt, nper, simulate, solveExtraForTarget, estimateTAEG, translateEuriborPath, type LoanParams } from './loan';

const base: LoanParams = {
  principal: 100_000,
  termMonths: 360,
  rateType: 'fixa',
  spread: 1,
  fixedRate: 3,
  mixedFixedYears: 2,
  euriborTenor: 12,
  euriborPath: [2],
  amortMode: 'prazo',
  extraPlan: { enabled: false, amount: 0, everyMonths: 12, startMonth: 12, endMonth: 0 },
  lumpSums: [],
  feeVariablePct: 0.5,
  feeFixedPct: 2,
  feeVariableWaived: false,
  stampDutyInterestPct: 0,
  stampDutyFeesPct: 0,
  monthlyBankFee: 0,
  lifeInsurancePct: 0,
  homeInsuranceAnnual: 0,
};

describe('loan engine', () => {
  it('pmt matches the textbook value', () => {
    expect(pmt(0.03 / 12, 360, 100_000)).toBeCloseTo(421.6, 1);
    expect(nper(0.03 / 12, 421.61, 100_000)).toBe(360);
  });

  it('fixed loan amortizes fully in the term', () => {
    const r = simulate(base);
    expect(r.payoffMonth).toBe(360);
    expect(r.totalPrincipal).toBeCloseTo(100_000, 2);
    expect(r.totalInterest).toBeCloseTo(421.6 * 360 - 100_000, -2);
  });

  it('variable loan = euribor + spread', () => {
    const r = simulate({ ...base, rateType: 'variavel' });
    expect(r.rows[0].tan).toBeCloseTo(3);
    expect(r.payoffMonth).toBe(360);
  });

  it('variable rate revises at each tenor (Euribor interpolada ao longo do ano)', () => {
    const r = simulate({ ...base, rateType: 'variavel', euriborTenor: 6, euriborPath: [2, 3] });
    expect(r.rows[5].tan).toBeCloseTo(3); // meses 1–6: valor do ano 1
    expect(r.rows[11].tan).toBeCloseTo(1 + 2 + 0.5 / 12, 6); // revisão no mês 7
    expect(r.rows[12].tan).toBeCloseTo(1 + 2 + 6.5 / 12, 6); // revisão no mês 13
    expect(r.rows[12].payment).toBeGreaterThan(r.rows[11].payment);
  });

  it('mixed loan switches after fixed period', () => {
    const r = simulate({ ...base, rateType: 'mista', fixedRate: 2.5, mixedFixedYears: 2, euriborPath: [2, 2, 2.5] });
    expect(r.rows[23].tan).toBeCloseTo(2.5);
    expect(r.rows[24].tan).toBeCloseTo(1 + 2 + 0.5 * (18.5 / 12 - 1), 6); // mês 25
  });

  it('com a Euribor a subir, a 3M acompanha mais cedo e paga mais juros que a 12M', () => {
    const rising = [2, 3, 4, 4];
    const m3 = simulate({ ...base, rateType: 'variavel', euriborTenor: 3, euriborPath: rising });
    const m12 = simulate({ ...base, rateType: 'variavel', euriborTenor: 12, euriborPath: rising });
    expect(m3.rows[15].tan).toBeGreaterThan(m12.rows[15].tan);
    expect(m3.totalInterest).toBeGreaterThan(m12.totalInterest);
  });

  it('translateEuriborPath mantém a forma da trajetória', () => {
    expect(translateEuriborPath([3.5, 3.6], 3.323, 2.598)).toEqual([2.775, 2.875]);
  });

  it('early repayment reducing term shortens payoff, reducing installment keeps term', () => {
    const lump = [{ id: 'a', month: 12, amount: 20_000 }];
    const prazo = simulate({ ...base, rateType: 'variavel', lumpSums: lump });
    const prest = simulate({ ...base, rateType: 'variavel', lumpSums: lump, amortMode: 'prestacao' });
    expect(prazo.payoffMonth).toBeLessThan(360);
    expect(Math.abs(prazo.rows[12].payment - prazo.rows[0].payment)).toBeLessThan(2);
    expect(prest.payoffMonth).toBe(360);
    expect(prest.rows[12].payment).toBeLessThan(prest.rows[0].payment);
    expect(prazo.totalExtraFees).toBeCloseTo(100); // 0.5% de 20k
  });

  it('solver hits the target payoff', () => {
    const p = { ...base, rateType: 'variavel' as const, extraPlan: { ...base.extraPlan, enabled: true } };
    const amount = solveExtraForTarget(p, 120)!;
    expect(amount).toBeGreaterThan(0);
    const r = simulate({ ...p, extraPlan: { ...p.extraPlan, amount } });
    expect(r.payoffMonth).toBeLessThanOrEqual(120);
    const r2 = simulate({ ...p, extraPlan: { ...p.extraPlan, amount: amount - 200 } });
    expect(r2.payoffMonth).toBeGreaterThan(120);
  });

  it('TAEG equals TAN without costs and is higher with costs', () => {
    const r = simulate(base);
    expect(estimateTAEG(r, 100_000, 0)).toBeCloseTo(3.04, 1); // (1+0.0025)^12-1
    expect(estimateTAEG(r, 100_000, 2000)).toBeGreaterThan(3.1);
  });
});
