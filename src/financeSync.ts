import { useEffect, useState } from 'react';
import type { Inputs } from './state';
import type { LivingCost } from './data/livingCosts';

/** Resumo enviado pela app de Finanças (FinanceHub, GET /api/sync) */
export interface FinanceSummary {
  version: number;
  updatedAt: string;
  netSalary: number;
  gainsTaxPct: number;
  liquid: number;
  invested: number;
  taxableGains: number;
  taxableGainsPctOfInvested: number;
  netWorth: number;
  accounts: { id: string; name: string; kind: 'liquidez' | 'investimento'; value: number; gains: number | null; taxable: boolean }[];
  recurring: { id: string; name: string; category: string; amount: number; frequency: 'mensal' | 'anual'; month: number | null; investment: boolean }[];
}

export const FINANCE_APP_URL = 'https://finance-hub-71f.pages.dev';

export type FinanceSync =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: FinanceSummary }
  | { status: 'unavailable'; data: null; reason: string };

/** Vai buscar o resumo da app de Finanças (via /api/finance do próprio simulador) */
export function useFinanceSync(): FinanceSync {
  const [sync, setSync] = useState<FinanceSync>({ status: 'loading', data: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/finance', { headers: { accept: 'application/json' } });
        const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
        if (!isJson) throw new Error('no_api');
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (alive) setSync({ status: 'ready', data: body as FinanceSummary });
      } catch (e) {
        if (alive) setSync({ status: 'unavailable', data: null, reason: (e as Error).message });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return sync;
}

/** Substitui capitais próprios e despesas pelos valores da app de Finanças */
export function applyFinance(inp: Inputs, f: FinanceSummary): Inputs {
  const livingCosts: LivingCost[] = f.recurring.map((r) => ({
    id: `fh-${r.id}`,
    name: r.name,
    category: r.category,
    amount: r.amount,
    frequency: r.frequency,
    month: r.month ?? undefined,
    investment: r.investment,
    enabled: true,
  }));
  return {
    ...inp,
    cash: f.liquid,
    investments: f.invested,
    investmentsUsed: Math.min(inp.investmentsUsed, f.invested),
    investmentsGainPct: f.taxableGainsPctOfInvested,
    capitalGainsTaxPct: f.gainsTaxPct,
    livingCosts,
  };
}
