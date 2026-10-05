import { useEffect, useState } from 'react';
import type { AmortMode, ExtraPlan, LumpSum, RateType } from './lib/loan';
import type { OtherCapital } from './lib/otherCapital';
import { DEFAULTS, EURIBOR_SCENARIOS, LISTING } from './data/market';
import { STAMP_LOAN_PCT } from './lib/taxes';
import { DEFAULT_LIVING_COSTS, EXAMPLE_LIVING_COSTS, type LivingCost } from './data/livingCosts';

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
  furnishing: number; // recheio e obras

  // Capitais próprios
  cash: number;
  investments: number;
  investmentsUsed: number;
  investmentsGainPct: number; // % do valor da carteira que é mais-valia
  emergencyReserve: number;
  downPayment: number; // usada no modo manual
  autoDownPayment: boolean; // entrada = todo o capital disponível

  // Outros capitais (bónus, ações, prémios…) e data prevista da escritura
  deedDate: string; // AAAA-MM
  otherCapital: OtherCapital[];

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

/** Bónus de retenção da Motorola: 90 000 € brutos, metade em 2027 e metade em 2028, cada metade 50% dinheiro e 50% ações */
export const ownerOtherCapital = (): OtherCapital[] => [
  { id: 'moto-2027-cash', name: 'Bónus Motorola 2027 (dinheiro)', date: '2027-06', gross: 22_500, form: 'dinheiro', taxPct: 50, use: 'amortizar' },
  { id: 'moto-2027-rsu', name: 'Bónus Motorola 2027 (ações)', date: '2027-06', gross: 22_500, form: 'acoes', taxPct: 45, use: 'guardar' },
  { id: 'moto-2028-cash', name: 'Bónus Motorola 2028 (dinheiro)', date: '2028-06', gross: 22_500, form: 'dinheiro', taxPct: 50, use: 'amortizar' },
  { id: 'moto-2028-rsu', name: 'Bónus Motorola 2028 (ações)', date: '2028-06', gross: 22_500, form: 'acoes', taxPct: 45, use: 'guardar' },
];

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

  deedDate: '2026-12',
  otherCapital: ownerOtherCapital(),

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

  livingCostsEnabled: true,
  livingCosts: DEFAULT_LIVING_COSTS.map((c) => ({ ...c })),
  useFinanceData: true,

  capitalGainsTaxPct: 28,
});

/**
 * Valores iniciais para quem não é o dono: um caso típico, sem nada pessoal
 * (sem o anúncio, sem a app de Finanças, capital e salário mais baixos).
 */
export const guestInputs = (): Inputs => ({
  ...defaultInputs(),
  price: 150_000,
  valuation: 150_000,
  areaM2: 80,
  listingUrl: '',
  vpt: 70_000,
  assignment: false,
  condoMonthly: 30,
  furnishing: 4_000,

  cash: 40_000,
  investments: 0,
  investmentsUsed: 0,
  emergencyReserve: 3_000,
  downPayment: 20_000,
  otherCapital: [],

  buyers: [{ id: 'b1', age: 30, sharePct: 100, youngEligible: true }],

  goalEnabled: false,
  targetYears: 20,
  extraPlan: { enabled: false, amount: 2_000, everyMonths: 12, startMonth: 12, endMonth: 0 },

  netMonthlyIncome: 1_700,

  livingCostsEnabled: false,
  livingCosts: EXAMPLE_LIVING_COSTS.map((c) => ({ ...c })),
  useFinanceData: false,
});

export type ProfileKind = 'owner' | 'guest';
export const defaultsFor = (kind: ProfileKind) => (kind === 'owner' ? defaultInputs() : guestInputs());

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
/** Marca uma migração como feita; devolve true se já tinha sido feita antes */
function once(id: string) {
  const k = `casa-sim:migrated:${id}`;
  try {
    if (localStorage.getItem(k)) return true;
    localStorage.setItem(k, '1');
  } catch {
    /* sem armazenamento: aplica sempre (não há nada gravado de qualquer forma) */
  }
  return false;
}

// Avaliado uma vez ao carregar a app (o React pode chamar o estado inicial duas vezes)
const LIVING_ON_DONE = once('living-on');
const FURNISHING_10K_DONE = once('furnishing-10k');

function migrate(p: Partial<Inputs>): Partial<Inputs> {
  const out = { ...p };
  if (out.emergencyReserve === 15_000) out.emergencyReserve = 5_000;
  if (out.netMonthlyIncome === 3_000) out.netMonthlyIncome = 3_300;
  // Despesas do dia a dia passaram a vir ligadas para o dono (uma vez só; quem
  // usa a app de Finanças é o dono, os convidados começam sem ela)
  if (!LIVING_ON_DONE && out.useFinanceData) out.livingCostsEnabled = true;
  // Recheio e obras do dono passou a 10 000 € (uma vez só)
  if (!FURNISHING_10K_DONE && out.useFinanceData) out.furnishing = 10_000;
  return out;
}

/** Completa inputs gravados com versões antigas com os valores por defeito atuais */
export const withDefaults = (p: Partial<Inputs>, kind: ProfileKind = 'owner'): Inputs => ({ ...defaultsFor(kind), otherCapital: [], ...p });

/**
 * Inputs da simulação, gravados neste browser. Num browser novo, começa com os
 * valores de exemplo e, quando se sabe quem é (kind), passa aos valores
 * iniciais dessa pessoa.
 */
export function useInputs(kind: ProfileKind | null) {
  const [fresh, setFresh] = useState(() => load<Partial<Inputs> | null>(KEY, null) === null);
  // Inputs gravados antes de existir "Outros capitais": o dono recebe o bónus por defeito
  const [fillOther, setFillOther] = useState(() => load<Partial<Inputs> | null>(KEY, null)?.otherCapital === undefined);
  const [inputs, setInputs] = useState<Inputs>(() => {
    const stored = load<Partial<Inputs> | null>(KEY, null);
    return stored ? withDefaults(migrate(stored)) : guestInputs();
  });
  // Primeira visita: aplica os valores iniciais certos assim que se sabe quem é
  if (fresh && kind) {
    setFresh(false);
    setFillOther(false);
    setInputs(defaultsFor(kind));
  } else if (fillOther && kind) {
    setFillOther(false);
    if (kind === 'owner') setInputs((s) => ({ ...s, otherCapital: ownerOtherCapital() }));
  }
  // Só grava depois de escolhidos os valores iniciais (senão um recarregamento rápido ficava com os de exemplo)
  useEffect(() => {
    if (!fresh) save(KEY, inputs);
  }, [inputs, fresh]);
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setInputs((s) => ({ ...s, [k]: v }));
  const patch = (p: Partial<Inputs>) => setInputs((s) => ({ ...s, ...p }));
  return {
    inputs,
    /** Ainda à espera de saber quem é para mostrar os valores iniciais */
    awaitingProfile: fresh,
    set,
    patch,
    reset: () => setInputs(defaultsFor(kind ?? 'guest')),
    replace: setInputs,
  };
}
