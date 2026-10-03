const eur0 = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num1 = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 });

export const eur = (v: number) => eur0.format(Math.round(v));
export const eurC = (v: number) => eur2.format(v);
export const pct = (v: number, digits = 2) =>
  `${v.toLocaleString('pt-PT', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
export const num = (v: number) => num1.format(v);

/** "12 anos e 3 meses" */
export function duration(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = y === 1 ? '1 ano' : `${y} anos`;
  if (m === 0) return ys;
  const ms = m === 1 ? '1 mês' : `${m} meses`;
  return y === 0 ? ms : `${ys} e ${ms}`;
}

/** Compact axis label: 120 k€ */
export const eurK = (v: number) =>
  Math.abs(v) >= 1000 ? `${num1.format(v / 1000)} k€` : `${Math.round(v)} €`;

export const pctFmt = (v: number) => pct(v, 2);
export const pctAxis = (v: number) => `${v.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}%`;
