/**
 * Simulação mês a mês de um crédito à habitação português (sistema francês:
 * prestação constante entre revisões de taxa), com amortizações antecipadas.
 */

export type RateType = 'variavel' | 'fixa' | 'mista';
export type AmortMode = 'prazo' | 'prestacao';

export interface LumpSum {
  id: string;
  month: number; // mês do contrato (1 = primeiro mês)
  amount: number;
}

export interface ExtraPlan {
  enabled: boolean;
  amount: number; // valor de cada amortização
  everyMonths: number; // 1 = mensal, 12 = anual
  startMonth: number;
  endMonth: number; // 0 = até ao fim
}

export interface LoanParams {
  principal: number;
  termMonths: number;
  rateType: RateType;
  spread: number; // p.p.
  fixedRate: number; // TAN % (taxa fixa, ou período fixo da mista)
  mixedFixedYears: number;
  euriborTenor: 3 | 6 | 12;
  euriborPath: number[]; // Euribor (%) por ano do contrato; o último valor mantém-se
  amortMode: AmortMode;
  extraPlan: ExtraPlan;
  lumpSums: LumpSum[];
  feeVariablePct: number; // comissão amortização antecipada em taxa variável (%)
  feeFixedPct: number; // ... em taxa fixa (ou período fixo da mista)
  feeVariableWaived: boolean; // suspensão legal da comissão em taxa variável
  stampDutyInterestPct: number; // Imposto do Selo sobre juros (%)
  stampDutyFeesPct: number; // Imposto do Selo sobre comissões (%)
  monthlyBankFee: number; // comissão de processamento da prestação (€/mês)
  lifeInsurancePct: number; // seguro de vida, % anual sobre o capital em dívida
  homeInsuranceAnnual: number; // multirriscos (€/ano)
}

export interface MonthRow {
  month: number;
  year: number;
  tan: number; // %
  openingBalance: number;
  payment: number; // prestação (juros + capital)
  interest: number;
  principal: number;
  extra: number; // amortização antecipada efetuada
  extraFee: number; // comissão + IS sobre comissão
  stampInterest: number;
  lifeInsurance: number;
  homeInsurance: number;
  bankFee: number;
  closingBalance: number;
  /** Tudo o que sai do bolso neste mês por causa do crédito */
  outflow: number;
}

export interface LoanResult {
  rows: MonthRow[];
  payoffMonth: number;
  firstPayment: number;
  maxPayment: number;
  totalInterest: number;
  totalPrincipal: number;
  totalExtra: number;
  totalExtraFees: number;
  totalStampInterest: number;
  totalInsurance: number;
  totalBankFees: number;
  totalOutflow: number;
}

/** Prestação de um empréstimo (sistema francês). r = taxa mensal. */
export function pmt(r: number, n: number, pv: number): number {
  if (n <= 0) return pv;
  if (Math.abs(r) < 1e-12) return pv / n;
  return (pv * r) / (1 - Math.pow(1 + r, -n));
}

/** Nº de prestações necessárias para pagar pv com prestação p. */
export function nper(r: number, p: number, pv: number): number {
  if (pv <= 0) return 0;
  if (Math.abs(r) < 1e-12) return Math.ceil(pv / p - 1e-9);
  const x = 1 - (pv * r) / p;
  if (x <= 0) return Infinity;
  return Math.ceil(-Math.log(x) / Math.log(1 + r) - 1e-9);
}

/**
 * Euribor no mês m do contrato. path[k] é o valor médio do ano k+1, colocado a
 * meio desse ano (mês 12k + 6,5); entre pontos interpola linearmente, antes do
 * primeiro e depois do último mantém o valor. Assim a Euribor evolui ao longo
 * do ano e um indexante de 3 meses acompanha as mudanças mais cedo que o de 12.
 */
export function euriborAtMonth(path: number[], month: number): number {
  if (path.length === 0) return 0;
  const pos = (month - 6.5) / 12; // posição em "anos" relativa aos pontos
  if (pos <= 0) return path[0];
  if (pos >= path.length - 1) return path[path.length - 1];
  const k = Math.floor(pos);
  const f = pos - k;
  return path[k] + (path[k + 1] - path[k]) * f;
}

/** Converte uma trajetória de um indexante para outro mantendo a forma (diferença entre valores atuais) */
export function translateEuriborPath(path: number[], fromSpot: number, toSpot: number): number[] {
  return path.map((v) => Math.round((v - fromSpot + toSpot) * 1000) / 1000);
}

/** TAN (%) a aplicar no mês m, tendo em conta revisões periódicas do indexante. */
function makeRateFn(p: LoanParams) {
  const fixedMonths = p.rateType === 'mista' ? p.mixedFixedYears * 12 : 0;
  return (m: number): { tan: number; isFixed: boolean; revise: boolean } => {
    if (p.rateType === 'fixa') return { tan: p.fixedRate, isFixed: true, revise: m === 1 };
    if (p.rateType === 'mista' && m <= fixedMonths) return { tan: p.fixedRate, isFixed: true, revise: m === 1 };
    // variável (ou mista após o período fixo): revisão a cada `tenor` meses
    const start = fixedMonths + 1;
    const sinceStart = m - start;
    const revise = sinceStart % p.euriborTenor === 0;
    const revisionMonth = m - (sinceStart % p.euriborTenor);
    // Taxa negativa não é paga ao cliente — TAN mínima de 0%
    const tan = Math.max(0, euriborAtMonth(p.euriborPath, revisionMonth) + p.spread);
    return { tan, isFixed: false, revise };
  };
}

function scheduledExtra(p: LoanParams, m: number): number {
  let extra = 0;
  const e = p.extraPlan;
  if (e.enabled && e.amount > 0 && m >= e.startMonth && (e.endMonth <= 0 || m <= e.endMonth)) {
    if ((m - e.startMonth) % Math.max(1, e.everyMonths) === 0) extra += e.amount;
  }
  for (const l of p.lumpSums) if (l.month === m && l.amount > 0) extra += l.amount;
  return extra;
}

export function simulate(p: LoanParams, opts: { withExtras?: boolean } = {}): LoanResult {
  const withExtras = opts.withExtras ?? true;
  const rateFn = makeRateFn(p);
  const rows: MonthRow[] = [];
  let balance = p.principal;
  let remaining = p.termMonths;
  let payment = 0;
  let currentTan = NaN;
  const maxMonths = p.termMonths + 600; // salvaguarda

  for (let m = 1; balance > 0.005 && m <= maxMonths; m++) {
    const { tan, isFixed, revise } = rateFn(m);
    const r = tan / 100 / 12;
    if (revise || tan !== currentTan || payment === 0) {
      payment = pmt(r, Math.max(1, remaining), balance);
      currentTan = tan;
    }
    const opening = balance;
    const interest = opening * r;
    let principal = payment - interest;
    if (principal > opening || remaining <= 1) principal = opening;
    const paid = interest + principal;
    balance = opening - principal;
    remaining -= 1;

    const stampInterest = (interest * p.stampDutyInterestPct) / 100;
    const lifeInsurance = (opening * p.lifeInsurancePct) / 100 / 12;
    const homeInsurance = p.homeInsuranceAnnual / 12;
    const bankFee = p.monthlyBankFee;

    let extra = 0;
    let extraFee = 0;
    if (withExtras && balance > 0.005) {
      extra = Math.min(balance, scheduledExtra(p, m));
      if (extra > 0) {
        const feePct = isFixed ? p.feeFixedPct : p.feeVariableWaived ? 0 : p.feeVariablePct;
        const fee = (extra * feePct) / 100;
        extraFee = fee * (1 + p.stampDutyFeesPct / 100);
        balance -= extra;
        if (balance > 0.005) {
          if (p.amortMode === 'prazo') {
            remaining = Math.max(1, nper(r, payment, balance));
          } else {
            payment = pmt(r, Math.max(1, remaining), balance);
          }
        }
      }
    }
    if (balance < 0.005) balance = 0;

    rows.push({
      month: m,
      year: Math.ceil(m / 12),
      tan,
      openingBalance: opening,
      payment: paid,
      interest,
      principal,
      extra,
      extraFee,
      stampInterest,
      lifeInsurance,
      homeInsurance,
      bankFee,
      closingBalance: balance,
      outflow: paid + extra + extraFee + stampInterest + lifeInsurance + homeInsurance + bankFee,
    });
  }

  const sum = (f: (r: MonthRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    rows,
    payoffMonth: rows.length,
    firstPayment: rows[0]?.payment ?? 0,
    maxPayment: rows.reduce((a, r) => Math.max(a, r.payment), 0),
    totalInterest: sum((r) => r.interest),
    totalPrincipal: sum((r) => r.principal),
    totalExtra: sum((r) => r.extra),
    totalExtraFees: sum((r) => r.extraFee),
    totalStampInterest: sum((r) => r.stampInterest),
    totalInsurance: sum((r) => r.lifeInsurance + r.homeInsurance),
    totalBankFees: sum((r) => r.bankFee),
    totalOutflow: sum((r) => r.outflow),
  };
}

/**
 * Encontra o valor de cada amortização periódica necessário para liquidar o
 * crédito em `targetMonths` (pesquisa binária — o prazo é monótono no valor).
 */
export function solveExtraForTarget(p: LoanParams, targetMonths: number): number | null {
  const base = { ...p, extraPlan: { ...p.extraPlan, enabled: true } };
  const payoff = (amount: number) =>
    simulate({ ...base, extraPlan: { ...base.extraPlan, amount } }).payoffMonth;
  if (payoff(0) <= targetMonths) return 0;
  let lo = 0;
  let hi = p.principal;
  if (payoff(hi) > targetMonths) return null;
  for (let i = 0; i < 40 && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2;
    if (payoff(mid) <= targetMonths) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 10) * 10;
}

/** TIR mensal de uma série de fluxos (bisseção + Newton seria overkill aqui). */
export function irrMonthly(flows: number[]): number {
  const npv = (r: number) => flows.reduce((a, f, i) => a + f / Math.pow(1 + r, i), 0);
  let lo = -0.99;
  let hi = 1;
  let fLo = npv(lo);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * TAEG estimada: TIR anualizada dos fluxos do crédito sem amortizações
 * antecipadas, incluindo encargos iniciais do crédito e encargos mensais
 * obrigatórios (seguros, comissões, Imposto do Selo).
 */
export function estimateTAEG(base: LoanResult, principal: number, upfrontLoanCosts: number): number {
  const flows = [principal - upfrontLoanCosts, ...base.rows.map((r) => -(r.outflow - r.extra - r.extraFee))];
  const r = irrMonthly(flows);
  return (Math.pow(1 + r, 12) - 1) * 100;
}

/** Agrega linhas mensais por ano do contrato. */
export function yearly(rows: MonthRow[]) {
  const out: (Omit<MonthRow, 'month' | 'tan' | 'openingBalance'> & { tanAvg: number; openingBalance: number })[] = [];
  for (const r of rows) {
    let y = out[r.year - 1];
    if (!y) {
      y = out[r.year - 1] = {
        year: r.year,
        tanAvg: 0,
        openingBalance: r.openingBalance,
        payment: 0,
        interest: 0,
        principal: 0,
        extra: 0,
        extraFee: 0,
        stampInterest: 0,
        lifeInsurance: 0,
        homeInsurance: 0,
        bankFee: 0,
        closingBalance: 0,
        outflow: 0,
      };
    }
    y.payment += r.payment;
    y.interest += r.interest;
    y.principal += r.principal;
    y.extra += r.extra;
    y.extraFee += r.extraFee;
    y.stampInterest += r.stampInterest;
    y.lifeInsurance += r.lifeInsurance;
    y.homeInsurance += r.homeInsurance;
    y.bankFee += r.bankFee;
    y.outflow += r.outflow;
    y.closingBalance = r.closingBalance;
    y.tanAvg += r.tan;
  }
  for (const y of out) {
    const n = rows.filter((r) => r.year === y.year).length;
    y.tanAvg /= n;
  }
  return out;
}
