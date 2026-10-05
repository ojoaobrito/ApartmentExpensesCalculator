import { X } from 'lucide-react';
import type { Inputs } from '../state';
import type { Model } from '../model';
import { monthsAfterDeed, netOf, type OtherCapital } from '../lib/otherCapital';
import { MONTHS_PT } from '../data/livingCosts';
import { eur } from '../lib/format';
import { InlineNumber, Section } from './ui';
import { IconGift } from './icons';

interface Props {
  inputs: Inputs;
  set: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  model: Model;
  keywords: string;
}

const YEARS = Array.from({ length: 12 }, (_, k) => 2025 + k);

/** Mês + ano em dois seletores (o input type="month" não funciona em todos os browsers) */
function MonthYear({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [y, m] = value.split('-').map(Number);
  const out = (yy: number, mm: number) => onChange(`${yy}-${String(mm).padStart(2, '0')}`);
  return (
    <span className="month-year">
      <select value={m} onChange={(e) => out(y, Number(e.target.value))} aria-label={`${label}: mês`}>
        {MONTHS_PT.map((mo, k) => (
          <option key={mo} value={k + 1}>
            {mo}
          </option>
        ))}
      </select>
      <select value={y} onChange={(e) => out(Number(e.target.value), m)} aria-label={`${label}: ano`}>
        {YEARS.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </select>
    </span>
  );
}

export function OtherCapitalSection({ inputs: i, set, model: m, keywords }: Props) {
  const items = i.otherCapital;
  const o = m.other;
  const update = (id: string, p: Partial<OtherCapital>) => set('otherCapital', items.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const add = () =>
    set('otherCapital', [
      ...items,
      { id: crypto.randomUUID(), name: 'Novo capital', date: i.deedDate, gross: 10_000, form: 'dinheiro', taxPct: 0, use: 'amortizar' },
    ]);
  const toLoan = o.lumpSums.reduce((t, l) => t + l.amount, 0);

  return (
    <Section icon={<IconGift />} title="Outros capitais" keywords={keywords} badge={<span className="pill">{items.length ? `${eur(o.net)} líquidos` : 'Nenhum'}</span>}>
      <span className="hint">Bónus, prémios, ações da empresa, heranças… Até à escritura entram na compra; depois, amortizam o crédito nesse mês ou ficam guardados.</span>
      <label className="field">
        <span className="field-label">Escritura prevista</span>
        <MonthYear value={i.deedDate} onChange={(v) => set('deedDate', v)} label="Escritura prevista" />
        <span className="hint">Serve para saber em que mês do crédito chega cada valor.</span>
      </label>

      {items.length > 0 && (
        <div className="oc-list">
          {items.map((c) => {
            const after = monthsAfterDeed(i.deedDate, c.date);
            const where =
              c.use === 'guardar' ? 'fica guardado' : after <= 0 ? 'entra na compra' : `amortiza no mês ${after} do crédito`;
            return (
              <div key={c.id} className="oc-item">
                <div className="oc-top">
                  <input className="living-name oc-name" value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} aria-label="Nome" />
                  <button type="button" className="btn small ghost" onClick={() => set('otherCapital', items.filter((x) => x.id !== c.id))} aria-label={`Remover ${c.name}`} title="Remover">
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
                <div className="oc-grid">
                  <label>
                    <span>Data</span>
                    <MonthYear value={c.date} onChange={(v) => update(c.id, { date: v })} label={c.name} />
                  </label>
                  <label>
                    <span>Bruto</span>
                    <InlineNumber label={`Bruto de ${c.name}`} value={c.gross} onChange={(v) => update(c.id, { gross: v })} suffix="€" step={500} min={0} />
                  </label>
                  <label>
                    <span>Impostos</span>
                    <InlineNumber label={`Impostos de ${c.name}`} value={c.taxPct} onChange={(v) => update(c.id, { taxPct: v })} suffix="%" step={1} min={0} max={100} />
                  </label>
                  <label>
                    <span>Forma</span>
                    <select className="oc-select" value={c.form} onChange={(e) => update(c.id, { form: e.target.value as OtherCapital['form'] })}>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="acoes">Ações</option>
                    </select>
                  </label>
                  <label>
                    <span>Destino</span>
                    <select className="oc-select" value={c.use} onChange={(e) => update(c.id, { use: e.target.value as OtherCapital['use'] })}>
                      <option value="amortizar">{after <= 0 ? 'Usar na compra' : 'Amortizar'}</option>
                      <option value="guardar">Guardar</option>
                    </select>
                  </label>
                </div>
                <div className="oc-foot">
                  Líquido <b>{eur(netOf(c))}</b> · {where}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="living-totals">
          <div>
            <span className="muted small">Na compra</span>
            <b>{eur(o.atDeed)}</b>
          </div>
          <div>
            <span className="muted small">Amortiza o crédito</span>
            <b>{eur(toLoan)}</b>
          </div>
          <div>
            <span className="muted small">Fica guardado</span>
            <b>{eur(o.kept)}</b>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn small" onClick={add}>
          + Adicionar capital
        </button>
      </div>
      <span className="hint">
        Impostos estimados: bónus em dinheiro pagam IRS à taxa marginal e Segurança Social (11%); ações atribuídas pela empresa pagam IRS como salário. Se tiveres IRS Jovem, a taxa real pode ser bem mais baixa.
      </span>
    </Section>
  );
}
