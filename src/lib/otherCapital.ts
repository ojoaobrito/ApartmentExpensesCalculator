import type { LumpSum } from './loan';

/**
 * Outros capitais: dinheiro que entra fora do salário (bónus, prémios, ações
 * da empresa, heranças…), numa data. Conforme a data e o destino:
 *  - até à escritura e "amortizar": entra no capital disponível (vai para a entrada);
 *  - depois da escritura e "amortizar": amortização pontual nesse mês do crédito;
 *  - "guardar": fica de parte (aparece na reserva futura, não mexe no crédito).
 */
export interface OtherCapital {
  id: string;
  name: string;
  date: string; // AAAA-MM
  gross: number; // valor bruto
  form: 'dinheiro' | 'acoes';
  taxPct: number; // IRS + Segurança Social estimados, % do bruto
  use: 'amortizar' | 'guardar';
}

/** Meses entre a escritura e a data (mesmo mês = 0) */
export function monthsAfterDeed(deedDate: string, date: string): number {
  const [dy, dm] = deedDate.split('-').map(Number);
  const [y, m] = date.split('-').map(Number);
  return (y - dy) * 12 + (m - dm);
}

export const netOf = (c: OtherCapital) => Math.max(0, c.gross * (1 - c.taxPct / 100));

export interface OtherCapitalSummary {
  /** Líquido que chega até à escritura e vai para a compra */
  atDeed: number;
  /** Amortizações pontuais geradas (mês do crédito) */
  lumpSums: LumpSum[];
  /** Líquido guardado (não mexe no crédito) */
  kept: number;
  gross: number;
  net: number;
}

export function summarizeOtherCapital(items: OtherCapital[], deedDate: string): OtherCapitalSummary {
  const out: OtherCapitalSummary = { atDeed: 0, lumpSums: [], kept: 0, gross: 0, net: 0 };
  for (const c of items) {
    const net = netOf(c);
    out.gross += c.gross;
    out.net += net;
    if (c.use === 'guardar') out.kept += net;
    else {
      const after = monthsAfterDeed(deedDate, c.date);
      if (after <= 0) out.atDeed += net;
      // O mês 1 do crédito é o mês a seguir à escritura
      else out.lumpSums.push({ id: `oc-${c.id}`, month: after, amount: net });
    }
  }
  return out;
}

/** Data (AAAA-MM) n meses depois da escritura */
export function dateAfterDeed(deedDate: string, months: number): string {
  const [y, m] = deedDate.split('-').map(Number);
  const t = y * 12 + (m - 1) + months;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
