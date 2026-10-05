/**
 * Despesas do dia a dia importadas da folha "Finanças" (abas "Distribuição
 * salarial" e "Despesas anuais periódicas"), a 4 de outubro de 2026.
 * A renda fica de fora: deixa de existir com a compra.
 */

export type CostFrequency = 'mensal' | 'anual';

export interface LivingCost {
  id: string;
  name: string;
  category: string;
  amount: number; // € por ocorrência (positivo)
  frequency: CostFrequency;
  month?: number; // 1–12, mês de cobrança das anuais
  investment?: boolean; // poupança/investimento (não é consumo)
  enabled: boolean;
}

export const LIVING_COSTS_IMPORTED_AT = '4/out/2026';

const m = (id: string, name: string, category: string, amount: number, investment = false): LivingCost => ({
  id,
  name,
  category,
  amount,
  frequency: 'mensal',
  investment,
  enabled: true,
});
const a = (id: string, name: string, category: string, amount: number, month: number): LivingCost => ({
  id,
  name,
  category,
  amount,
  frequency: 'anual',
  month,
  enabled: true,
});

export const DEFAULT_LIVING_COSTS: LivingCost[] = [
  // Distribuição salarial — gerais
  m('ginasio', 'Ginásio', 'Saúde', 27.4),
  m('advancecare', 'Seguro AdvanceCare', 'Saúde', 10.6),
  m('viaverde', 'Via Verde Mobilidade Leve', 'Carro', 1.35),
  m('icloud', 'iCloud', 'Software', 9.99),
  m('combustivel', 'Combustível (gasolina simples)', 'Carro', 60),
  m('cabeleireira', 'Cabeleireira', 'Outro', 20),
  m('claude', 'Claude Max (5x)', 'Software', 108),
  m('adobe', 'Plano Lightroom & Photoshop', 'Software', 19.99),
  m('spotify', 'Spotify', 'Software', 2.83),
  // Distribuição salarial — casa (sem a renda)
  m('compras', 'Compras mensais (1 vez por semana)', 'Casa', 250),
  m('luz', 'Luz', 'Casa', 50),
  m('gas', 'Gás', 'Casa', 20),
  m('agua', 'Água', 'Casa', 20),
  m('internet', 'Internet Vodafone (500 Mbps)', 'Casa', 27),
  // Distribuição salarial — investimentos e poupanças
  m('vwce', 'ETF VWCE Trade Republic', 'Investimento', 200, true),
  m('qdve', 'ETF QDVE Trade Republic', 'Investimento', 200, true),
  m('vuaa', 'ETF VUAA Trade Republic', 'Investimento', 200, true),
  // Despesas anuais periódicas
  a('seguro-ginasio', 'Seguro ginásio', 'Saúde', 7, 10),
  a('iuc', 'IUC', 'Carro', 111.46, 4),
  a('seguro-carro', 'Seguro carro (Mudum)', 'Carro', 200.61, 1),
  a('benfica', 'Quotas Benfica', 'Outro', 100, 1),
];

/** Lista de exemplo para quem não é o dono da app (valores típicos, para ajustar) */
export const EXAMPLE_LIVING_COSTS: LivingCost[] = [
  m('ex-supermercado', 'Supermercado', 'Casa', 200),
  m('ex-luz-gas', 'Luz e gás', 'Casa', 55),
  m('ex-agua', 'Água', 'Casa', 18),
  m('ex-internet', 'Internet e telemóvel', 'Casa', 35),
  m('ex-transportes', 'Transportes / combustível', 'Carro', 70),
  m('ex-saude', 'Saúde e farmácia', 'Saúde', 20),
  m('ex-lazer', 'Lazer e restaurantes', 'Outro', 80),
  m('ex-subscricoes', 'Subscrições', 'Software', 15),
  m('ex-poupanca', 'Poupança mensal', 'Investimento', 100, true),
  a('ex-seguro-carro', 'Seguro do carro', 'Carro', 180, 1),
  a('ex-iuc', 'IUC', 'Carro', 60, 4),
];

export const MONTHS_PT = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
export const MONTHS_PT_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Média mensal de uma despesa (as anuais divididas por 12) */
export const monthlyEquivalent = (c: LivingCost) => (c.frequency === 'mensal' ? c.amount : c.amount / 12);

export interface LivingSummary {
  expensesMonthly: number; // consumo (sem investimentos), média mensal
  investMonthly: number;
  annualTotal: number; // soma das despesas anuais ativas
  byCategory: { category: string; monthly: number }[];
  /** Mês em que as despesas anuais pesam mais */
  peak: { month: number; amount: number; names: string[] } | null;
}

export function summarizeLivingCosts(items: LivingCost[]): LivingSummary {
  const active = items.filter((c) => c.enabled && c.amount > 0);
  const expenses = active.filter((c) => !c.investment);
  const cats = new Map<string, number>();
  for (const c of expenses) cats.set(c.category, (cats.get(c.category) ?? 0) + monthlyEquivalent(c));
  const annual = expenses.filter((c) => c.frequency === 'anual');
  const perMonth = new Map<number, { amount: number; names: string[] }>();
  for (const c of annual) {
    const k = c.month ?? 1;
    const e = perMonth.get(k) ?? { amount: 0, names: [] };
    e.amount += c.amount;
    e.names.push(c.name);
    perMonth.set(k, e);
  }
  const peakEntry = [...perMonth.entries()].sort((x, y) => y[1].amount - x[1].amount)[0];
  return {
    expensesMonthly: expenses.reduce((s, c) => s + monthlyEquivalent(c), 0),
    investMonthly: active.filter((c) => c.investment).reduce((s, c) => s + monthlyEquivalent(c), 0),
    annualTotal: annual.reduce((s, c) => s + c.amount, 0),
    byCategory: [...cats.entries()].map(([category, monthly]) => ({ category, monthly })).sort((x, y) => y.monthly - x.monthly),
    peak: peakEntry ? { month: peakEntry[0], amount: peakEntry[1].amount, names: peakEntry[1].names } : null,
  };
}
