import { describe, expect, it } from 'vitest';
import { compute } from './model';
import { defaultInputs } from './state';

describe('model with defaults', () => {
  it('liquida no objetivo e calcula custos iniciais com IMT Jovem (entrada manual)', () => {
    const m = compute({ ...defaultInputs(), autoDownPayment: false });
    expect(m.principal).toBe(160_000);
    expect(m.ltv).toBeCloseTo(80, 5); // sobre a avaliação de 200 k€
    expect(m.minDownPayment).toBe(50_000);
    expect(m.withExtras.payoffMonth).toBeLessThanOrEqual(120);
    expect(m.taxes.imt).toBe(0);
    expect(m.stampLoan).toBeCloseTo(960, 2); // 0,6% de 160 k€
    expect(m.taeg).toBeGreaterThan(m.firstTan);
  });

  it('sem benefício jovem paga IMT e IS da tabela 2026', () => {
    const i = defaultInputs();
    const m = compute({ ...i, buyers: [{ ...i.buyers[0], age: 40 }] });
    expect(m.taxes.imt).toBeCloseTo(5_642.04, 2);
    expect(m.taxes.stamp).toBeCloseTo(1_840, 2);
    expect(m.maxTermYears).toBe(35);
    expect(m.alerts.some((a) => a.kind === 'crit')).toBe(true); // prazo 40 > 35
  });
});

describe('cedência de posição contratual', () => {
  it('cobra IMT sobre o prémio quando há cláusula de livre cedência', () => {
    const i = defaultInputs();
    const m = compute({ ...i, assignmentClause: true, assignmentPremium: 20_000 });
    expect(m.assignmentImt).toBeCloseTo(1_400, 2); // 7% (escalão de 230 k€)
    expect(m.upfront.some((u) => u.key === 'imtCessao')).toBe(true);
  });
});

describe('decoração e recheio', () => {
  it('com entrada manual, sai da liquidez e do capital disponível para a entrada', () => {
    const i = { ...defaultInputs(), autoDownPayment: false };
    const sem = compute({ ...i, furnishing: 0 });
    const com = compute({ ...i, furnishing: 10_000 });
    expect(sem.cashLeft - com.cashLeft).toBeCloseTo(10_000, 6);
    expect(sem.availableForDownPayment - com.availableForDownPayment).toBeCloseTo(10_000, 6);
    expect(com.upfront.some((u) => u.key === 'recheio')).toBe(true);
  });
});

describe('entrada automática', () => {
  it('usa todo o capital disponível e mantém o fundo de emergência', () => {
    const i = defaultInputs();
    const m = compute(i);
    expect(m.autoDownPayment).toBe(true);
    expect(m.cashLeft).toBeGreaterThanOrEqual(i.emergencyReserve - 1);
    expect(m.cashLeft).toBeLessThan(i.emergencyReserve + 2);
  });

  it('resgatar investimentos aumenta a entrada e baixa o crédito', () => {
    const i = defaultInputs();
    const a = compute({ ...i, investmentsUsed: 0 });
    const b = compute({ ...i, investmentsUsed: 20_000 });
    expect(b.downPayment).toBeGreaterThan(a.downPayment + 19_000);
    expect(b.principal).toBeLessThan(a.principal);
    expect(b.withExtras.firstPayment).toBeLessThan(a.withExtras.firstPayment);
  });

  it('o recheio reduz a entrada', () => {
    const i = defaultInputs();
    const sem = compute({ ...i, furnishing: 0 });
    const com = compute({ ...i, furnishing: 10_000 });
    expect(sem.downPayment - com.downPayment).toBeGreaterThan(9_900);
  });

  it('nunca passa do preço', () => {
    const m = compute({ ...defaultInputs(), cash: 1_000_000 });
    expect(m.downPayment).toBe(230_000);
    expect(m.principal).toBe(0);
  });
});

describe('custos da compra editáveis', () => {
  it('a taxa do Imposto do Selo do crédito e as comissões entram nos custos', () => {
    const i = { ...defaultInputs(), autoDownPayment: false };
    const base = compute(i);
    const m = compute({ ...i, stampLoanPct: 0.5, valuationFee: 0, bankSetupFees: 100, solicitorFee: 500 });
    expect(m.stampLoan).toBeCloseTo(800, 2); // 0,5% de 160 k€
    expect(m.upfront.find((c) => c.key === 'avaliacao')).toBeUndefined();
    expect(m.upfront.find((c) => c.key === 'dossier')?.value).toBeCloseTo(104, 6);
    expect(m.upfrontTotal - base.upfrontTotal).toBeCloseTo(800 - 960 + 104 - 748.8 + 500, 2);
  });
});

describe('esforço total', () => {
  it('classifica pelo peso da casa + amortizações no rendimento e avisa quando não cabe', () => {
    const i = defaultInputs();
    const total = (m: ReturnType<typeof compute>) => m.monthlyTotal + m.extraMonthlyEquivalent;
    const m = compute({ ...i, targetYears: 3 });
    expect(m.effortStatus).toBe('impossible');
    expect(m.monthlySpare).toBeCloseTo(i.netMonthlyIncome - total(m), 6);
    expect(m.alerts.some((a) => a.kind === 'crit' && a.text.includes('faltam'))).toBe(true);
    expect(compute({ ...i, netMonthlyIncome: 10_000 }).effortStatus).toBe('ok');
    expect(compute({ ...i, netMonthlyIncome: 0 }).effortStatus).toBe('none');
  });
});
