import { useState } from 'react';
import { type LoanResult, yearly } from '../lib/loan';
import { eurC, pct } from '../lib/format';
import { Segmented } from './ui';

function toCSV(result: LoanResult) {
  const head = [
    'Mes', 'Ano', 'TAN %', 'Capital inicio', 'Prestacao', 'Juros', 'Capital amortizado',
    'Amortizacao antecipada', 'Comissao amortizacao', 'IS juros', 'Seguro vida', 'Multirriscos',
    'Comissao mensal', 'Capital em divida', 'Total desembolsado',
  ];
  const lines = result.rows.map((r) =>
    [r.month, r.year, r.tan, r.openingBalance, r.payment, r.interest, r.principal, r.extra, r.extraFee,
      r.stampInterest, r.lifeInsurance, r.homeInsurance, r.bankFee, r.closingBalance, r.outflow]
      .map((v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v))
      .join(';'),
  );
  return [head.join(';'), ...lines].join('\n');
}

export function ScheduleTable({ result }: { result: LoanResult }) {
  const [view, setView] = useState<'anual' | 'mensal'>('anual');
  const download = () => {
    const blob = new Blob(['﻿' + toCSV(result)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plano-credito-habitacao.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const years = yearly(result.rows);
  const extras = (r: { stampInterest: number; lifeInsurance: number; homeInsurance: number; bankFee: number }) =>
    r.stampInterest + r.lifeInsurance + r.homeInsurance + r.bankFee;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ flex: 1 }}>Plano de pagamentos</h2>
        <div style={{ width: 200 }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'anual', label: 'Por ano' },
              { value: 'mensal', label: 'Por mês' },
            ]}
          />
        </div>
        <button className="btn" onClick={download}>
          Exportar CSV
        </button>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{view === 'anual' ? 'Ano' : 'Mês'}</th>
              <th>TAN</th>
              <th>Prestações</th>
              <th>Juros</th>
              <th>Capital</th>
              <th>Amort. antecipada</th>
              <th>Comissões amort.</th>
              <th>Seguros, IS e comissões</th>
              <th>Total pago</th>
              <th>Em dívida</th>
            </tr>
          </thead>
          <tbody>
            {view === 'anual'
              ? years.map((y) => (
                  <tr key={y.year}>
                    <td>{y.year}</td>
                    <td>{pct(y.tanAvg)}</td>
                    <td>{eurC(y.payment)}</td>
                    <td>{eurC(y.interest)}</td>
                    <td>{eurC(y.principal)}</td>
                    <td className={y.extra ? '' : 'muted'}>{eurC(y.extra)}</td>
                    <td className={y.extraFee ? '' : 'muted'}>{eurC(y.extraFee)}</td>
                    <td>{eurC(extras(y))}</td>
                    <td>{eurC(y.outflow)}</td>
                    <td>{eurC(y.closingBalance)}</td>
                  </tr>
                ))
              : result.rows.map((r) => (
                  <tr key={r.month}>
                    <td>
                      {r.month} <span className="muted small">(ano {r.year})</span>
                    </td>
                    <td>{pct(r.tan)}</td>
                    <td>{eurC(r.payment)}</td>
                    <td>{eurC(r.interest)}</td>
                    <td>{eurC(r.principal)}</td>
                    <td className={r.extra ? '' : 'muted'}>{eurC(r.extra)}</td>
                    <td className={r.extraFee ? '' : 'muted'}>{eurC(r.extraFee)}</td>
                    <td>{eurC(extras(r))}</td>
                    <td>{eurC(r.outflow)}</td>
                    <td>{eurC(r.closingBalance)}</td>
                  </tr>
                ))}
            <tr className="total">
              <td>Total</td>
              <td />
              <td>{eurC(result.totalInterest + result.totalPrincipal)}</td>
              <td>{eurC(result.totalInterest)}</td>
              <td>{eurC(result.totalPrincipal)}</td>
              <td>{eurC(result.totalExtra)}</td>
              <td>{eurC(result.totalExtraFees)}</td>
              <td>{eurC(result.totalStampInterest + result.totalInsurance + result.totalBankFees)}</td>
              <td>{eurC(result.totalOutflow)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
