import type { Inputs } from './state';
import { EURIBOR, EURIBOR_SCENARIOS, LOCAL_MARKET, RULES, YOUNG_REGISTRY_DISCOUNT } from './data/market';

const EURIBOR_NOW = { 3: EURIBOR.m3, 6: EURIBOR.m6, 12: EURIBOR.m12 } as const;
import { estimateTAEG, pmt, simulate, solveExtraForTarget, type LoanParams } from './lib/loan';
import { acquisitionTaxes, imtAssignment } from './lib/taxes';
import { eur as fmt, eurC, pct } from './lib/format';
import { summarizeLivingCosts } from './data/livingCosts';
import { summarizeOtherCapital } from './lib/otherCapital';

export type AlertKind = 'warn' | 'crit' | 'ok' | 'info';
export interface ModelAlert {
  kind: AlertKind;
  text: string;
}

export function euriborPath(inp: Inputs): number[] {
  if (inp.euriborScenario === 'custom') return inp.customEuriborPath;
  const s = EURIBOR_SCENARIOS.find((x) => x.id === inp.euriborScenario) ?? EURIBOR_SCENARIOS[0];
  return s.paths[inp.euriborTenor];
}

export function loanParams(inp: Inputs, principal: number): LoanParams {
  return {
    principal,
    termMonths: inp.termYears * 12,
    rateType: inp.rateType,
    spread: inp.spread,
    fixedRate: inp.fixedRate,
    mixedFixedYears: inp.mixedFixedYears,
    euriborTenor: inp.euriborTenor,
    euriborPath: euriborPath(inp),
    amortMode: inp.amortMode,
    extraPlan: inp.extraPlan,
    // Pontuais manuais + as que vêm dos outros capitais (bónus depois da escritura)
    lumpSums: [...inp.lumpSums, ...summarizeOtherCapital(inp.otherCapital ?? [], inp.deedDate).lumpSums],
    feeVariablePct: inp.feeVariablePct,
    feeFixedPct: inp.feeFixedPct,
    feeVariableWaived: inp.feeVariableWaived,
    stampDutyInterestPct: 0, // juros de crédito à habitação isentos de IS
    stampDutyFeesPct: 4,
    monthlyBankFee: inp.monthlyBankFee,
    lifeInsurancePct: inp.lifeInsurancePct,
    homeInsuranceAnnual: inp.homeInsuranceAnnual,
  };
}

/**
 * Entrada automática: usa todo o capital disponível (depois de impostos, custos,
 * obras, recheio e fundo de emergência). O Imposto do Selo do crédito depende do
 * montante financiado, por isso converge em poucas iterações.
 */
export function compute(inp: Inputs) {
  if (!inp.autoDownPayment) return computeWith(inp);
  let dp = Math.min(inp.price, Math.max(0, inp.downPayment));
  for (let k = 0; k < 4; k++) {
    const next = Math.min(inp.price, Math.floor(cashFigures({ ...inp, downPayment: dp }).availableForDownPayment));
    if (Math.abs(next - dp) < 1) break;
    dp = next;
  }
  return computeWith({ ...inp, downPayment: dp });
}

/** Custos iniciais e liquidez (rápido, sem simular o crédito) */
function cashFigures(inp: Inputs) {
  const principal = Math.max(0, inp.price - inp.downPayment);
  // O banco financia sobre o menor entre preço e avaliação
  const valuation = inp.valuation > 0 ? inp.valuation : inp.price;
  const ltvBase = Math.min(inp.price, valuation);
  const ltv = ltvBase > 0 ? (principal / ltvBase) * 100 : 0;
  const maxLoan = (ltvBase * RULES.maxLtvHpp) / 100;
  const minDownPayment = Math.max(0, inp.price - maxLoan);
  const pricePerM2 = inp.areaM2 > 0 ? inp.price / inp.areaM2 : 0;
  const valuationPerM2 = inp.areaM2 > 0 ? valuation / inp.areaM2 : 0;

  // ---------- custos de aquisição ----------
  const taxBase = Math.max(inp.price, inp.vpt);
  const taxes = acquisitionTaxes(taxBase, inp.buyers);
  const stampLoan = principal > 0 ? (principal * inp.stampLoanPct) / 100 : 0;
  const registryDiscount = Math.min(inp.deedAndRegistry, YOUNG_REGISTRY_DISCOUNT * taxes.youngShare);
  const deed = principal > 0 ? inp.deedAndRegistry - registryDiscount : Math.max(0, inp.deedAndRegistry - 325);
  // Comissões bancárias pagam Imposto do Selo de 4%
  const valuationCost = principal > 0 ? inp.valuationFee * 1.04 : 0;
  const setupCost = principal > 0 ? inp.bankSetupFees * 1.04 : 0;
  const bankUpfront = valuationCost + setupCost;

  const assignmentImt = inp.assignment && inp.assignmentClause ? imtAssignment(inp.assignmentPremium, inp.price) : 0;
  const upfront = [
    { key: 'imt', label: 'IMT', value: taxes.imt, note: taxes.youngShare > 0 ? 'Com IMT Jovem' : undefined },
    { key: 'imtCessao', label: 'IMT sobre a cessão', value: assignmentImt, note: 'Cláusula de livre cedência — sem isenção jovem' },
    { key: 'isCompra', label: 'Imposto do Selo — compra (0,8%)', value: taxes.stamp },
    { key: 'isCredito', label: `Imposto do Selo — crédito (${pct(inp.stampLoanPct, 1)})`, value: stampLoan },
    { key: 'escritura', label: 'Escritura e registos', value: deed, note: registryDiscount > 0 ? 'Desconto emolumentos jovem' : undefined },
    { key: 'avaliacao', label: 'Avaliação bancária (c/ IS 4%)', value: valuationCost },
    { key: 'dossier', label: 'Dossier e formalização (c/ IS 4%)', value: setupCost },
    { key: 'solicitador', label: 'Solicitador / advogado', value: inp.solicitorFee },
    { key: 'obras', label: 'Obras', value: inp.worksAndFurniture },
    { key: 'recheio', label: 'Recheio e obras', value: inp.furnishing },
  ].filter((c) => c.value > 0 || ['imt', 'isCompra'].includes(c.key));
  const upfrontTotal = upfront.reduce((a, c) => a + c.value, 0);
  const youngSavings =
    taxes.imtWithoutBenefit - taxes.imt + (taxes.stampWithoutBenefit - taxes.stamp) + registryDiscount;

  // ---------- capitais próprios ----------
  const investmentsTax = (inp.investmentsUsed * (inp.investmentsGainPct / 100) * inp.capitalGainsTaxPct) / 100;
  // Outros capitais que chegam até à escritura (líquidos) também contam
  const otherAtDeed = summarizeOtherCapital(inp.otherCapital ?? [], inp.deedDate).atDeed;
  const available = inp.cash + inp.investmentsUsed - investmentsTax + otherAtDeed;
  const cashNeeded = inp.downPayment + upfrontTotal;
  const cashLeft = available - cashNeeded;
  // Capital que pode ir para a entrada depois de impostos, custos, obras, recheio e fundo de emergência
  const availableForDownPayment = Math.max(0, available - upfrontTotal - inp.emergencyReserve);
  const investmentsLeft = inp.investments - inp.investmentsUsed;
  return {
    principal, valuation, ltv, maxLoan, minDownPayment, pricePerM2, valuationPerM2,
    taxes, stampLoan, bankUpfront, assignmentImt, upfront, upfrontTotal, youngSavings, registryDiscount,
    investmentsTax, available, cashNeeded, cashLeft, availableForDownPayment, investmentsLeft, otherAtDeed,
  };
}

function computeWith(inp: Inputs) {
  const {
    principal, valuation, ltv, maxLoan, minDownPayment, pricePerM2, valuationPerM2,
    taxes, stampLoan, bankUpfront, assignmentImt, upfront, upfrontTotal, youngSavings, registryDiscount,
    investmentsTax, available, cashNeeded, cashLeft, availableForDownPayment, investmentsLeft, otherAtDeed,
  } = cashFigures(inp);
  const other = summarizeOtherCapital(inp.otherCapital ?? [], inp.deedDate);

  // ---------- crédito ----------
  const baseParams = loanParams(inp, principal);
  let solvedExtra: number | null = null;
  let params = baseParams;
  if (inp.goalEnabled && principal > 0) {
    solvedExtra = solveExtraForTarget(baseParams, inp.targetYears * 12);
    if (solvedExtra !== null)
      params = { ...baseParams, extraPlan: { ...baseParams.extraPlan, enabled: true, amount: solvedExtra } };
  }
  const withExtras = simulate(params);
  const noExtras = simulate(params, { withExtras: false });
  const loanUpfrontCosts = stampLoan + bankUpfront;
  const taeg = principal > 0 ? estimateTAEG(noExtras, principal, loanUpfrontCosts) : 0;
  const first = withExtras.rows[0];
  const firstTan = first?.tan ?? 0;

  // ---------- encargos mensais ----------
  const imiAnnual = (inp.vpt * inp.imiRatePct) / 100;
  const monthly = [
    { key: 'prestacao', label: 'Prestação (capital + juros)', value: first?.payment ?? 0 },
    { key: 'vida', label: 'Seguro de vida', value: first?.lifeInsurance ?? 0 },
    { key: 'multirriscos', label: 'Seguro multirriscos', value: inp.homeInsuranceAnnual / 12 },
    { key: 'comissao', label: 'Comissões bancárias', value: inp.monthlyBankFee },
    { key: 'condominio', label: 'Condomínio', value: inp.condoMonthly },
    {
      key: 'imi',
      label: inp.imiExemption ? `IMI (isento ${inp.imiExemptionYears} anos; depois ${eurC(imiAnnual / 12)}/mês)` : 'IMI',
      value: inp.imiExemption ? 0 : imiAnnual / 12,
    },
  ];
  const monthlyTotal = monthly.reduce((a, c) => a + c.value, 0);
  const plan = params.extraPlan;
  const extraMonthlyEquivalent =
    (plan.enabled ? plan.amount / Math.max(1, plan.everyMonths) : 0) +
    inp.lumpSums.reduce((a, l) => a + l.amount, 0) / Math.max(1, withExtras.payoffMonth);

  // ---------- taxa de esforço / stress test ----------
  // Stress test BdP: choque sobre o indexante atual + spread (variável ou fase variável da mista);
  // na mista conta o maior entre a prestação do período fixo e a prestação com choque.
  const oldest = Math.max(...inp.buyers.map((b) => b.age));
  const stressPp =
    inp.rateType === 'fixa'
      ? 0
      : RULES.stressPpForTerm(inp.termYears) + (oldest + inp.termYears > 70 ? RULES.stressPpAfter70 : 0);
  const variableTanNow = Math.max(0, EURIBOR_NOW[inp.euriborTenor] + inp.spread);
  const stressedPayment =
    principal <= 0
      ? 0
      : inp.rateType === 'fixa'
        ? (first?.payment ?? 0)
        : Math.max(
            inp.rateType === 'mista' ? (first?.payment ?? 0) : 0,
            pmt((variableTanNow + stressPp) / 1200, inp.termYears * 12, principal),
          );
  const dsti = inp.netMonthlyIncome > 0 ? ((first?.payment ?? 0) + inp.otherDebtMonthly) / inp.netMonthlyIncome * 100 : 0;
  const dstiStress = inp.netMonthlyIncome > 0 ? (stressedPayment + inp.otherDebtMonthly) / inp.netMonthlyIncome * 100 : 0;
  const effortTotal =
    inp.netMonthlyIncome > 0 ? (monthlyTotal + extraMonthlyEquivalent + inp.otherDebtMonthly) / inp.netMonthlyIncome * 100 : 0;
  // Quanto sobra por mês depois da casa, das amortizações e de outras dívidas
  const monthlySpare = inp.netMonthlyIncome - (monthlyTotal + extraMonthlyEquivalent + inp.otherDebtMonthly);

  // Despesas do dia a dia (opcional): o que sobra mesmo do salário depois de tudo
  const living = inp.livingCostsEnabled ? summarizeLivingCosts(inp.livingCosts) : null;
  const spareAfterLiving = living ? monthlySpare - living.expensesMonthly : null; // antes de investir
  const spareAfterAll = living && spareAfterLiving !== null ? spareAfterLiving - living.investMonthly : null;
  let effortStatus: EffortStatus = inp.netMonthlyIncome <= 0 ? 'none' : effortStatusFor(effortTotal);
  // Se o salário não chega para casa + despesas do dia a dia, não é viável
  if (effortStatus !== 'none' && spareAfterLiving !== null && spareAfterLiving < 0) effortStatus = 'impossible';

  const maxTermYears = RULES.maxTermForAge(oldest);

  // ---------- alertas ----------
  const alerts: ModelAlert[] = [];
  if (valuation < inp.price)
    alerts.push({ kind: 'warn', text: `Avaliação (${fmt(valuation)}) abaixo do preço: o banco calcula o LTV sobre a avaliação, por isso a entrada mínima sobe para ${fmt(minDownPayment)} e a diferença de ${fmt(inp.price - valuation)} sai sempre do teu bolso.` });
  if (pricePerM2 > 0 && pricePerM2 > LOCAL_MARKET.medianValuationPerM2 * 1.5)
    alerts.push({
      kind: 'warn',
      text: `Preço de ${fmt(pricePerM2)}/m² — ${Math.round((pricePerM2 / LOCAL_MARKET.medianValuationPerM2 - 1) * 100)}% acima da avaliação bancária mediana em ${LOCAL_MARKET.area} (${fmt(LOCAL_MARKET.medianValuationPerM2)}/m², ${LOCAL_MARKET.asOf}). Conta com uma avaliação abaixo do preço.`,
    });
  if (ltv > RULES.maxLtvHpp)
    alerts.push({ kind: 'crit', text: `LTV de ${ltv.toFixed(1)}% acima do limite de ${RULES.maxLtvHpp}% do Banco de Portugal (empréstimo máximo ${fmt(maxLoan)}) — exceto com garantia pública jovem.` });
  else if (ltv > 80)
    alerts.push({ kind: 'warn', text: `LTV de ${ltv.toFixed(1)}%: acima de 80% os bancos tendem a aplicar spreads mais altos.` });
  if (cashLeft < 0)
    alerts.push({ kind: 'crit', text: `Faltam ${fmt(-cashLeft)} de liquidez para pagar a entrada e os custos iniciais. Reduz a entrada ou usa parte dos investimentos.` });
  else if (cashLeft < inp.emergencyReserve)
    alerts.push({ kind: 'warn', text: `Depois da escritura ficas com ${fmt(cashLeft)} em liquidez, abaixo do fundo de emergência que definiste (${fmt(inp.emergencyReserve)}).` });
  if (inp.termYears > maxTermYears)
    alerts.push({ kind: 'crit', text: `Prazo de ${inp.termYears} anos acima do máximo recomendado pelo Banco de Portugal para quem tem ${oldest} anos (${maxTermYears} anos).` });
  if (oldest + inp.termYears > RULES.maxAgeAtEnd)
    alerts.push({ kind: 'warn', text: `O crédito terminaria aos ${oldest + inp.termYears} anos; a maioria dos bancos exige que termine até aos ${RULES.maxAgeAtEnd}.` });
  if (living && spareAfterLiving !== null && spareAfterLiving < 0 && monthlySpare >= 0)
    alerts.push({
      kind: 'crit',
      text: `Com as despesas do dia a dia (${fmt(living.expensesMonthly)}/mês) o salário não chega: faltam ${fmt(-spareAfterLiving)}/mês${extraMonthlyEquivalent > 0 ? '. Alarga o prazo do objetivo de liquidação ou reduz as amortizações.' : '.'}`,
    });
  else if (living && spareAfterAll !== null && spareAfterAll < 0 && spareAfterLiving !== null && spareAfterLiving >= 0)
    alerts.push({
      kind: 'warn',
      text: `Depois da casa e das despesas do dia a dia sobram ${fmt(spareAfterLiving)}/mês — não chega para os ${fmt(living.investMonthly)}/mês de investimentos que tens planeados.`,
    });
  if (effortStatus === 'impossible' && monthlySpare < 0)
    alerts.push({
      kind: 'crit',
      text: `O plano custa ${fmt(monthlyTotal + extraMonthlyEquivalent + inp.otherDebtMonthly)}/mês (casa${extraMonthlyEquivalent > 0 ? ` + ${fmt(extraMonthlyEquivalent)} de amortizações` : ''}) e o rendimento é ${fmt(inp.netMonthlyIncome)}: faltam ${fmt(-monthlySpare)}/mês. ${extraMonthlyEquivalent > 0 ? 'Alarga o prazo do objetivo de liquidação ou reduz as amortizações.' : 'Este crédito não cabe no rendimento.'}`,
    });
  else if (effortStatus === 'hard')
    alerts.push({
      kind: 'warn',
      text: `Casa${extraMonthlyEquivalent > 0 ? ' e amortizações' : ''} levam ${effortTotal.toFixed(0)}% do rendimento: sobram ${fmt(monthlySpare)}/mês para tudo o resto (comida, transportes, poupança…).`,
    });
  if (inp.netMonthlyIncome > 0) {
    if (dstiStress > RULES.dstiLimit)
      alerts.push({ kind: 'crit', text: `Taxa de esforço com stress test de ${dstiStress.toFixed(1)}% — acima do limite de ${RULES.dstiLimit}% do Banco de Portugal. O banco pode recusar.` });
    else if (dstiStress > RULES.dstiComfort)
      alerts.push({ kind: 'warn', text: `Taxa de esforço com stress test de ${dstiStress.toFixed(1)}% — aceitável para o BdP mas acima dos ${RULES.dstiComfort}% considerados confortáveis.` });
  }
  if (inp.assignment)
    alerts.push({
      kind: 'info',
      text: inp.assignmentClause
        ? `Cedência com cláusula de livre cedência: pagas IMT sobre o valor pago ao cedente antes da cessão (${fmt(assignmentImt)}), sem isenção jovem. Pode ser parcialmente recuperável na escritura — confirma com um solicitador.`
        : 'Cedência de posição contratual: confirma no contrato-promessa se há cláusula de livre cedência (se houver, pagas IMT sobre o prémio ao cedente) e pede prova de que o cedente tratou do IMT dele. Escritura só com licença de utilização.',
    });
  if (inp.goalEnabled && solvedExtra === null)
    alerts.push({ kind: 'crit', text: `Não é possível liquidar o crédito em ${inp.targetYears} anos com esta frequência e início das amortizações.` });
  if (inp.rateType !== 'variavel' && (params.extraPlan.enabled || inp.lumpSums.length))
    alerts.push({ kind: 'info', text: `Em taxa ${inp.rateType === 'fixa' ? 'fixa' : 'mista (período fixo)'} a comissão de amortização antecipada é ${pct(inp.feeFixedPct, 1)} — na variável é ${pct(inp.feeVariablePct, 1)}.` });

  return {
    downPayment: inp.downPayment,
    autoDownPayment: inp.autoDownPayment,
    principal,
    ltv,
    valuation,
    maxLoan,
    minDownPayment,
    pricePerM2,
    valuationPerM2,
    taxes,
    stampLoan,
    registryDiscount,
    upfront,
    upfrontTotal,
    youngSavings,
    assignmentImt,
    available,
    investmentsTax,
    cashNeeded,
    cashLeft,
    availableForDownPayment,
    investmentsLeft,
    otherAtDeed,
    other,
    params,
    solvedExtra,
    withExtras,
    noExtras,
    taeg,
    firstTan,
    monthly,
    monthlyTotal,
    imiAnnual,
    extraMonthlyEquivalent,
    stressPp,
    stressedPayment,
    dsti,
    dstiStress,
    effortTotal,
    effortStatus,
    monthlySpare,
    living,
    spareAfterLiving,
    spareAfterAll,
    maxTermYears,
    oldest,
    interestSaved: noExtras.totalInterest - withExtras.totalInterest,
    alerts,
  };
}

export type Model = ReturnType<typeof computeWith>;

export type EffortStatus = 'none' | 'ok' | 'tight' | 'hard' | 'impossible';

/** Esforço total (casa + amortizações + dívidas) em % do rendimento líquido */
export function effortStatusFor(pctOfIncome: number): EffortStatus {
  if (pctOfIncome > 100) return 'impossible';
  if (pctOfIncome > 50) return 'hard';
  if (pctOfIncome > RULES.dstiComfort) return 'tight';
  return 'ok';
}

export const EFFORT_LABEL: Record<EffortStatus, string> = {
  none: 'Sem rendimento indicado',
  ok: 'Confortável',
  tight: 'Apertado',
  hard: 'Muito apertado',
  impossible: 'Impossível com este rendimento',
};
