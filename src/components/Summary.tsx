import type React from 'react';
import type { Inputs } from '../state';
import { EFFORT_LABEL, type Model } from '../model';
import { heroColors, METER_MAX, meterGradient } from '../lib/effortColor';
import { MONTHS_PT, MONTHS_PT_LONG } from '../data/livingCosts';
import { dateAfterDeed } from '../lib/otherCapital';
import { Gift } from 'lucide-react';

const monthLabel = (d: string) => {
  const [y, mo] = d.split('-').map(Number);
  return `${MONTHS_PT[mo - 1]} ${y}`;
};

/** Gradiente do cartão principal conforme o esforço (variáveis CSS) */
function heroStyle(m: Model) {
  const c = heroColors(m.effortStatus === 'none' ? null : m.effortTotal);
  return { '--hero-solid': c.solid, '--hero-ink': c.ink } as React.CSSProperties;
}
import { RULES } from '../data/market';
import { duration, eur, eurC, pct } from '../lib/format';
import { Alert } from './ui';

type KRow = { label: string; value: string; tone?: 'good' | 'bad' };

/** Discriminação de um cartão: uma linha por parcela, com marcador */
function KList({ rows }: { rows: (KRow | false)[] }) {
  return (
    <ul className="k-list">
      {rows.filter((r): r is KRow => !!r).map((r) => (
        <li key={r.label} className={r.tone}>
          <span>{r.label}</span>
          {r.value && <b>{r.value}</b>}
        </li>
      ))}
    </ul>
  );
}

export function Kpis({ m, i, noOther }: { m: Model; i: Inputs; noOther?: Model | null }) {
  const w = m.withExtras;
  // Quanto mais por mês sairia do salário sem os outros capitais (bónus)
  const bonusRelief = noOther && m.other.lumpSums.length ? noOther.monthlyTotal + noOther.extraMonthlyEquivalent - (m.monthlyTotal + m.extraMonthlyEquivalent) : null;
  const up = (...keys: string[]) => m.upfront.filter((c) => keys.includes(c.key)).reduce((t, c) => t + c.value, 0);
  const spareCash = m.cashLeft - i.emergencyReserve;
  const earlyMonths = i.termYears * 12 - w.payoffMonth;
  // O que sai no crédito além de capital, juros e seguros (comissões e respetivo selo)
  const loanOther = w.totalOutflow - m.principal - w.totalInterest - w.totalInsurance;
  return (
    <div className="kpis">
      <div className={`kpi hero status-${m.effortStatus}`} style={heroStyle(m)}>
        <div className="k-label">{m.extraMonthlyEquivalent > 0 ? 'Total por mês (casa + amortizações)' : 'Total da casa por mês'}</div>
        <div className="k-value">{eurC(m.monthlyTotal + m.extraMonthlyEquivalent)}</div>
        <div className="hero-status">
          <span className="hero-badge">{EFFORT_LABEL[m.effortStatus]}</span>
          {m.effortStatus !== 'none' && (
            <span>
              {pct(m.effortTotal, 0)} do rendimento ·{' '}
              {m.spareAfterLiving !== null
                ? m.spareAfterLiving >= 0
                  ? `sobram ${eur(m.spareAfterLiving)}/mês depois das despesas`
                  : `faltam ${eur(-m.spareAfterLiving)}/mês com as despesas`
                : m.monthlySpare >= 0
                  ? `sobram ${eur(m.monthlySpare)}/mês`
                  : `faltam ${eur(-m.monthlySpare)}/mês`}
            </span>
          )}
        </div>
        {m.effortStatus !== 'none' && (
          <div className="hero-meter" style={{ background: meterGradient() }} title="Esforço total: 0% → 120% do rendimento">
            <span style={{ left: `${(Math.min(m.effortTotal, METER_MAX) / METER_MAX) * 100}%` }} />
          </div>
        )}
        <div className="hero-rows">
          {m.monthly
            .filter((c) => c.value > 0 || c.key === 'imi')
            .map((c) => (
              <div key={c.key} className="hero-row">
                <span>{c.key === 'prestacao' ? `Prestação · TAN ${pct(m.firstTan)}` : c.key === 'imi' ? 'IMI' : c.label}</span>
                <b>{c.key === 'imi' && c.value === 0 ? `isento ${i.imiExemptionYears} anos` : eurC(c.value)}</b>
              </div>
            ))}
          {m.extraMonthlyEquivalent > 0 && (
            <div className="hero-row">
              <span>
                Amortizações do salário
                {m.params.extraPlan.enabled && m.params.extraPlan.amount > 0 && m.params.extraPlan.everyMonths > 1
                  ? ` (${eur(m.params.extraPlan.amount)}${{ 3: '/trim.', 6: '/sem.', 12: '/ano' }[m.params.extraPlan.everyMonths] ?? ''})`
                  : ''}
              </span>
              <b>{eurC(m.extraMonthlyEquivalent)}</b>
            </div>
          )}
          {m.other.lumpSums.map((l) => (
            <div key={l.id} className="hero-row aside">
              <span>
                <Gift size={12} strokeWidth={2.2} aria-hidden /> Bónus · {monthLabel(dateAfterDeed(i.deedDate, l.month))}
              </span>
              <b>{eur(l.amount)}</b>
            </div>
          ))}
        </div>
        {bonusRelief !== null && Math.abs(bonusRelief) >= 1 && (
          <div className="hero-note">
            Os bónus amortizam à parte, quando chegam, e não entram no valor por mês. {bonusRelief > 0 ? <>Sem eles, para o mesmo objetivo, seriam <b>{eurC(m.monthlyTotal + m.extraMonthlyEquivalent + bonusRelief)}</b>/mês (+{eur(bonusRelief)}).</> : null}
          </div>
        )}
      </div>
      <div className="kpi">
        <div className="k-label">Dinheiro na escritura</div>
        <div className="k-value">{eur(m.cashNeeded)}</div>
        <KList
          rows={[
            { label: 'Entrada', value: eur(m.downPayment) },
            { label: m.youngSavings > 0 ? 'Impostos (IMT Jovem)' : 'Impostos', value: eur(up('imt', 'imtCessao', 'isCompra', 'isCredito')) },
            { label: 'Escritura e registos', value: eur(up('escritura', 'solicitador')) },
            up('avaliacao', 'dossier') > 0 && { label: 'Banco', value: eur(up('avaliacao', 'dossier')) },
            up('obras', 'recheio') > 0 && { label: 'Obras e recheio', value: eur(up('obras', 'recheio')) },
          ]}
        />
      </div>
      <div className="kpi">
        <div className="k-label">Fica de reserva</div>
        <div className="k-value" style={m.cashLeft < 0 ? { color: 'var(--crit)' } : undefined}>
          {m.cashLeft >= 0 ? eur(m.cashLeft) : `−${eur(-m.cashLeft)}`}
        </div>
        <KList
          rows={[
            { label: 'Fundo de emergência', value: eur(Math.abs(spareCash) < 1 ? m.cashLeft : Math.max(0, Math.min(m.cashLeft, i.emergencyReserve))) },
            Math.abs(spareCash) >= 1 &&
              (spareCash > 0 ? { label: 'Livre', value: eur(spareCash) } : { label: 'Falta para o fundo', value: `−${eur(-spareCash)}`, tone: 'bad' }),
            m.investmentsLeft > 0 && { label: 'Investimentos (à parte)', value: eur(m.investmentsLeft) },
            m.other.kept > 0 && { label: 'Capitais futuros', value: eur(m.other.kept) },
          ]}
        />
      </div>
      <div className="kpi">
        <div className="k-label">Crédito liquidado em</div>
        <div className="k-value">{duration(w.payoffMonth)}</div>
        <KList
          rows={[
            i.goalEnabled && { label: 'Objetivo', value: `${i.targetYears} anos` },
            { label: 'Crédito', value: eur(m.principal) },
            { label: 'LTV', value: pct(m.ltv, 0) },
            { label: 'Contrato', value: `${i.termYears} anos` },
            earlyMonths >= 12 && { label: 'Antecipação', value: duration(earlyMonths), tone: 'good' },
          ]}
        />
      </div>
      <div className="kpi">
        <div className="k-label">Juros totais</div>
        <div className="k-value">{eur(w.totalInterest)}</div>
        <KList
          rows={
            m.interestSaved > 1
              ? [
                  { label: 'Sem amortizar', value: eur(m.noExtras.totalInterest) },
                  { label: 'Poupança', value: `−${eur(m.interestSaved)}`, tone: 'good' },
                  w.totalExtraFees > 0 && { label: 'Comissões', value: eur(w.totalExtraFees) },
                  { label: 'TAN inicial', value: pct(m.firstTan) },
                ]
              : [{ label: 'Sem amortizações antecipadas', value: '' }, { label: 'TAN inicial', value: pct(m.firstTan) }]
          }
        />
      </div>
      <div className="kpi">
        <div className="k-label">Custo total da compra</div>
        <div className="k-value">{eur(m.downPayment + m.upfrontTotal + w.totalOutflow)}</div>
        <KList
          rows={[
            { label: 'Entrada e custos', value: eur(m.downPayment + m.upfrontTotal) },
            { label: 'Capital', value: eur(m.principal) },
            { label: 'Juros', value: eur(w.totalInterest) },
            { label: 'Seguros', value: eur(w.totalInsurance) },
            loanOther >= 1 && { label: 'Comissões', value: eur(loanOther) },
            { label: 'TAEG', value: pct(m.taeg) },
          ]}
        />
      </div>
      <div className="kpi">
        <div className="k-label">Taxa de esforço</div>
        <div className="k-value">{i.netMonthlyIncome > 0 ? pct(m.dsti, 1) : '—'}</div>
        <KList
          rows={
            i.netMonthlyIncome > 0
              ? [
                  { label: 'Rendimento', value: `${eur(i.netMonthlyIncome)}/mês` },
                  { label: `Stress test +${m.stressPp.toFixed(1).replace('.', ',')} p.p.`, value: pct(m.dstiStress, 1), tone: m.dstiStress > RULES.dstiLimit ? 'bad' : undefined },
                  { label: 'Limite BdP', value: `${RULES.dstiLimit}%` },
                  m.extraMonthlyEquivalent > 0 && { label: 'Com amortizações', value: pct(m.effortTotal, 1) },
                ]
              : [{ label: 'Indica o rendimento', value: '' }]
          }
        />
      </div>
    </div>
  );
}

export function Alerts({ m }: { m: Model }) {
  if (!m.alerts.length)
    return (
      <div className="alerts">
        <Alert kind="ok">Tudo dentro das regras do Banco de Portugal e com o fundo de emergência intacto.</Alert>
      </div>
    );
  return (
    <div className="alerts">
      {m.alerts.map((a, idx) => (
        <Alert key={idx} kind={a.kind}>
          {a.text}
        </Alert>
      ))}
    </div>
  );
}

export function SummaryTab({ m, i }: { m: Model; i: Inputs }) {
  const w = m.withExtras;
  const plan = m.params.extraPlan;
  const freq = { 1: 'por mês', 3: 'por trimestre', 6: 'por semestre', 12: 'por ano' }[plan.everyMonths] ?? `a cada ${plan.everyMonths} meses`;

  return (
    <div className="grid2">
      <div className="card">
        <h2>Dinheiro no dia da escritura</h2>
        <div className="card-sub">Entrada + impostos + custos, e de onde vem o dinheiro.</div>
        <table className="kv">
          <tbody>
            <tr>
              <td>
                Entrada ({pct((m.downPayment / i.price) * 100, 1)} do preço · LTV {pct(m.ltv, 1)})
                {m.autoDownPayment && <span className="note">Automática: todo o capital disponível</span>}
              </td>
              <td>{eur(m.downPayment)}</td>
            </tr>
            {m.upfront.map((c) => (
              <tr key={c.key}>
                <td>
                  {c.label}
                  {c.note && <span className="note">{c.note}</span>}
                </td>
                <td>{eurC(c.value)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total necessário</td>
              <td>{eur(m.cashNeeded)}</td>
            </tr>
          </tbody>
        </table>
        <table className="kv" style={{ marginTop: 16 }}>
          <tbody>
            <tr>
              <td>Poupança disponível</td>
              <td>{eur(i.cash)}</td>
            </tr>
            {i.investmentsUsed > 0 && (
              <tr>
                <td>
                  Investimentos resgatados
                  <span className="note">Menos {eur(m.investmentsTax)} de imposto sobre mais-valias</span>
                </td>
                <td>{eur(i.investmentsUsed - m.investmentsTax)}</td>
              </tr>
            )}
            <tr className="total">
              <td>Liquidez depois da escritura</td>
              <td style={{ color: m.cashLeft < 0 ? 'var(--crit)' : undefined }}>{eur(m.cashLeft)}</td>
            </tr>
            <tr>
              <td>Investimentos que continuam aplicados</td>
              <td>{eur(m.investmentsLeft)}</td>
            </tr>
          </tbody>
        </table>
        {m.youngSavings > 0 && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            O IMT Jovem poupa-te <b>{eur(m.youngSavings)}</b> (IMT {eur(m.taxes.imtWithoutBenefit)} + IS {eur(m.taxes.stampWithoutBenefit)} + emolumentos).
          </p>
        )}
      </div>

      <div className="card">
        <h2>Encargos mensais</h2>
        <div className="card-sub">No primeiro mês. A prestação muda com as revisões da Euribor.</div>
        <table className="kv">
          <tbody>
            {m.monthly.map((c) => (
              <tr key={c.key}>
                <td>{c.label}</td>
                <td>{eurC(c.value)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total da casa por mês</td>
              <td>{eurC(m.monthlyTotal)}</td>
            </tr>
            {m.extraMonthlyEquivalent > 0 && (
              <tr>
                <td>
                  + Amortizações antecipadas (média mensal)
                  <span className="note">
                    {plan.enabled && plan.amount > 0 ? `${eur(plan.amount)} ${freq}` : ''}
                    {i.lumpSums.length ? ` + ${i.lumpSums.length} pontual(is)` : ''}
                  </span>
                </td>
                <td>{eurC(m.extraMonthlyEquivalent)}</td>
              </tr>
            )}
            {m.extraMonthlyEquivalent > 0 && (
              <tr className="total">
                <td>Esforço mensal total</td>
                <td>{eurC(m.monthlyTotal + m.extraMonthlyEquivalent)}</td>
              </tr>
            )}
          </tbody>
        </table>
        {i.netMonthlyIncome > 0 && (
          <>
            <div style={{ marginTop: 14 }} className="small muted">
              Taxa de esforço do crédito: <b style={{ color: 'var(--text)' }}>{pct(m.dsti, 1)}</b> ({pct(m.dstiStress, 1)} com stress test de +{m.stressPp.toFixed(2).replace('.', ',')} p.p., prestação {eurC(m.stressedPayment)})
              {m.extraMonthlyEquivalent > 0 && (
                <>
                  {' '}· com casa + amortizações voluntárias: <b style={{ color: 'var(--text)' }}>{pct(m.effortTotal, 1)}</b> do rendimento
                </>
              )}
            </div>
            <EffortBar mandatory={m.dstiStress} total={m.effortTotal} />
          </>
        )}
        {m.living && i.netMonthlyIncome > 0 && <BudgetTable m={m} i={i} />}
      </div>

      <div className="card">
        <h2>Para onde vai o dinheiro</h2>
        <div className="card-sub">Ao longo de toda a vida do crédito, com o teu plano.</div>
        <CostBreakdown
          items={[
            { label: 'Preço do imóvel', value: i.price, color: 'var(--s1)' },
            { label: 'Juros', value: w.totalInterest, color: 'var(--s2)' },
            { label: 'Impostos e custos iniciais', value: m.upfrontTotal - i.worksAndFurniture - i.furnishing, color: 'var(--s3)' },
            { label: 'Obras, decoração e recheio', value: i.worksAndFurniture + i.furnishing, color: 'var(--s7)' },
            { label: 'Seguros', value: w.totalInsurance, color: 'var(--s4)' },
            { label: 'Comissões (amortização e mensais)', value: w.totalExtraFees + w.totalBankFees, color: 'var(--s5)' },
          ]}
        />
      </div>
    </div>
  );
}

function EffortBar({ mandatory, total }: { mandatory: number; total: number }) {
  const max = 100;
  const color = mandatory > RULES.dstiLimit ? 'var(--crit)' : mandatory > RULES.dstiComfort ? 'var(--warn)' : 'var(--good)';
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="bar-track" style={{ position: 'relative' }}>
        <div title="Taxa de esforço com stress test" style={{ width: w(mandatory), background: color }} />
        <div
          title="Restantes encargos da casa e amortizações voluntárias"
          style={{ width: w(total - mandatory), background: 'repeating-linear-gradient(135deg, var(--accent) 0 3px, transparent 3px 6px)', opacity: 0.6 }}
        />
        <span style={{ position: 'absolute', left: w(RULES.dstiLimit), top: -3, bottom: -3, width: 2, background: 'var(--text)' }} />
      </div>
      <div className="small muted" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
        <span>
          <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: color, marginRight: 6 }} />
          Crédito com stress test
        </span>
        <span>
          <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'repeating-linear-gradient(135deg, var(--accent) 0 2px, transparent 2px 4px)', marginRight: 6 }} />
          Outros encargos + amortizações
        </span>
        <span>▏ limite BdP {RULES.dstiLimit}%</span>
      </div>
    </div>
  );
}

function CostBreakdown({ items }: { items: { label: string; value: number; color: string }[] }) {
  const shown = items.filter((x) => x.value > 0.5);
  const total = shown.reduce((a, x) => a + x.value, 0);
  return (
    <>
      <div className="bar-track" style={{ height: 22, borderRadius: 6 }}>
        {shown.map((x) => (
          <div key={x.label} title={`${x.label}: ${eur(x.value)}`} style={{ width: `${(x.value / total) * 100}%`, background: x.color }} />
        ))}
      </div>
      <table className="kv" style={{ marginTop: 12 }}>
        <tbody>
          {shown.map((x) => (
            <tr key={x.label}>
              <td>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: x.color, marginRight: 8 }} />
                {x.label}
              </td>
              <td>
                {eur(x.value)} <span className="muted small">({pct((x.value / total) * 100, 1)})</span>
              </td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td>{eur(total)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

/** Orçamento mensal completo: salário − casa − despesas do dia a dia − investimentos */
function BudgetTable({ m, i }: { m: Model; i: Inputs }) {
  const live = m.living!;
  const house = m.monthlyTotal + m.extraMonthlyEquivalent + i.otherDebtMonthly;
  const neg = (v: number) => (v < 0 ? { color: 'var(--crit)' } : undefined);
  return (
    <>
      <h3 style={{ fontSize: 14, margin: '18px 0 6px' }}>Orçamento do mês</h3>
      <table className="kv">
        <tbody>
          <tr>
            <td>Rendimento líquido</td>
            <td>{eurC(i.netMonthlyIncome)}</td>
          </tr>
          <tr>
            <td>
              − Casa{m.extraMonthlyEquivalent > 0 ? ' e amortizações' : ''}
              {i.otherDebtMonthly > 0 ? ' e outras dívidas' : ''}
            </td>
            <td>−{eurC(house)}</td>
          </tr>
          <tr>
            <td>
              − Despesas do dia a dia
              <span className="note">{live.byCategory.map((c) => `${c.category} ${eur(c.monthly)}`).join(' · ')}</span>
            </td>
            <td>−{eurC(live.expensesMonthly)}</td>
          </tr>
          <tr className="total">
            <td>Sobra antes de investir</td>
            <td style={neg(m.spareAfterLiving!)}>{eurC(m.spareAfterLiving!)}</td>
          </tr>
          {live.investMonthly > 0 && (
            <>
              <tr>
                <td>− Investimentos e poupança</td>
                <td>−{eurC(live.investMonthly)}</td>
              </tr>
              <tr className="total">
                <td>Sobra no fim do mês</td>
                <td style={neg(m.spareAfterAll!)}>{eurC(m.spareAfterAll!)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
      {live.peak && (
        <p className="small muted" style={{ marginBottom: 0 }}>
          As despesas anuais contam como média mensal. Em {MONTHS_PT_LONG[live.peak.month - 1]} pagas mais {eur(live.peak.amount)} ({live.peak.names.join(', ')}).
        </p>
      )}
    </>
  );
}
