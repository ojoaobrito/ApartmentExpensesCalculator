import { useEffect, useState } from 'react';
import type { AmortMode, ExtraPlan, LumpSum, RateType } from './lib/loan';
import { DEFAULTS, EURIBOR_SCENARIOS, LISTING } from './data/market';
import { STAMP_LOAN_PCT } from './lib/taxes';
import { DEFAULT_LIVING_COSTS, type LivingCost } from './data/livingCosts';

export interface Buyer {
  id: string;
  age: number;
  sharePct: number; // quota na compra
  youngEligible: boolean; // cumpre requisitos IMT Jovem (≤35, 1.ª habitação, não dependente)
}

export interface Inputs {
  // Imóvel
  price: number;
  valuation: number; // avaliação bancária (0 = igual ao preço)
  areaM2: number;
  listingUrl: string;
  vpt: number; // valor patrimonial tributário
  imiRatePct: number;
  imiExemption: boolean;
  imiExemptionYears: number;
  assignment: boolean; // compra por cedência de posição contratual
  assignmentClause: boolean; // CPCV com cláusula de livre cedência
  assignmentPremium: number; // valor pago ao cedente (prémio)
  condoMonthly: number;
  worksAndFurniture: number; // obras
  furnishing: number; // decoração inicial e recheio

  // Capitais próprios
  cash: number;
  investments: number;
  investmentsUsed: number;
  investmentsGainPct: number; // % do valor da carteira que é mais-valia
  emergencyReserve: number;
  downPayment: number; // usada no modo manual
  autoDownPayment: boolean; // entrada = todo o capital disponível

  // Compradores
  buyers: Buyer[];

  // Custos de aquisição
  deedAndRegistry: number; // antes do desconto jovem
  stampLoanPct: number; // Imposto do Selo sobre o crédito
  valuationFee: number;
  bankSetupFees: number;
  solicitorFee: number;

  // Crédito
  termYears: number;
  rateType: RateType;
  spread: number;
  fixedRate: number;
  mixedFixedYears: number;
  euriborTenor: 3 | 6 | 12;
  euriborScenario: string;
  customEuriborPath: number[];
  bankPreset: string;

  // Amortizações antecipadas
  amortMode: AmortMode;
  goalEnabled: boolean;
  targetYears: number;
  extraPlan: ExtraPlan;
  lumpSums: LumpSum[];
  feeVariablePct: number;
  feeFixedPct: number;
  feeVariableWaived: boolean;

  // Encargos mensais do crédito
  lifeInsurancePct: number;
  homeInsuranceAnnual: number;
  monthlyBankFee: number;

  // Rendimento
  netMonthlyIncome: number;
  otherDebtMonthly: number;

  // Despesas do dia a dia (opcional)
  livingCostsEnabled: boolean;
  livingCosts: LivingCost[];

  /** Usar a liquidez, investimentos e despesas da app de Finanças quando disponível */
  useFinanceData: boolean;

  // Imposto sobre mais-valias ao resgatar investimentos
  capitalGainsTaxPct: number;
}

export const defaultInputs = (): Inputs => ({
  price: 230_000,
  valuation: DEFAULTS.valuation,
  areaM2: LISTING.areaM2,
  listingUrl: LISTING.url,
  vpt: DEFAULTS.vpt,
  imiRatePct: DEFAULTS.imiRatePct,
  imiExemption: true,
  imiExemptionYears: 3,
  assignment: true,
  assignmentClause: false,
  assignmentPremium: 0,
  condoMonthly: DEFAULTS.condoMonthly,
  worksAndFurniture: 0,
  furnishing: DEFAULTS.furnishing,

  cash: 120_000,
  investments: 45_000,
  investmentsUsed: 0,
  investmentsGainPct: 10,
  emergencyReserve: 5_000,
  downPayment: 70_000,
  autoDownPayment: true,

  buyers: [{ id: 'b1', age: 28, sharePct: 100, youngEligible: true }],

  deedAndRegistry: DEFAULTS.deedAndRegistry,
  stampLoanPct: STAMP_LOAN_PCT,
  valuationFee: DEFAULTS.valuationFee,
  bankSetupFees: DEFAULTS.bankSetupFees,
  solicitorFee: 0,

  termYears: 40,
  rateType: 'variavel',
  spread: DEFAULTS.spread,
  fixedRate: DEFAULTS.fixedRate,
  mixedFixedYears: DEFAULTS.mixedFixedYears,
  euriborTenor: 12,
  euriborScenario: EURIBOR_SCENARIOS[0].id,
  customEuriborPath: [...EURIBOR_SCENARIOS[0].paths[12]],
  bankPreset: '',

  amortMode: 'prazo',
  goalEnabled: true,
  targetYears: 10,
  extraPlan: { enabled: true, amount: 10_000, everyMonths: 12, startMonth: 12, endMonth: 0 },
  lumpSums: [],
  feeVariablePct: 0.5,
  feeFixedPct: 2,
  feeVariableWaived: DEFAULTS.feeVariableWaived,

  lifeInsurancePct: DEFAULTS.lifeInsurancePct,
  homeInsuranceAnnual: DEFAULTS.homeInsuranceAnnual,
  monthlyBankFee: DEFAULTS.monthlyBankFee,

  netMonthlyIncome: 3_300,
  otherDebtMonthly: 0,

  livingCostsEnabled: false,
  livingCosts: DEFAULT_LIVING_COSTS.map((c) => ({ ...c })),
  useFinanceData: true,

  capitalGainsTaxPct: 28,
});

const KEY = 'casa-sim:inputs:v2';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível — a app funciona na mesma */
  }
}

/**
 * Atualiza valores gravados que ainda estão nos valores por defeito antigos
 * (para quem nunca os mudou passar a ver os novos).
 */
function migrate(p: Partial<Inputs>): Partial<Inputs> {
  const out = { ...p };
  if (out.emergencyReserve === 15_000) out.emergencyReserve = 5_000;
  if (out.netMonthlyIncome === 3_000) out.netMonthlyIncome = 3_300;
  return out;
}

/** Completa inputs gravados com versões antigas com os valores por defeito atuais */
export const withDefaults = (p: Partial<Inputs>): Inputs => ({ ...defaultInputs(), ...p });

export function useInputs() {
  const [inputs, setInputs] = useState<Inputs>(() => withDefaults(migrate(load<Partial<Inputs>>(KEY, {}))));
  useEffect(() => save(KEY, inputs), [inputs]);
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setInputs((s) => ({ ...s, [k]: v }));
  const patch = (p: Partial<Inputs>) => setInputs((s) => ({ ...s, ...p }));
  return { inputs, set, patch, reset: () => setInputs(defaultInputs()), replace: setInputs };
}
