import type { Inputs } from '../state';
import { X } from 'lucide-react';
import type { Model } from '../model';
import { DEFAULT_LIVING_COSTS, EXAMPLE_LIVING_COSTS, LIVING_COSTS_IMPORTED_AT, MONTHS_PT, type LivingCost } from '../data/livingCosts';
import { eur } from '../lib/format';
import { Check, InlineNumber, Section } from './ui';
import { IconCart } from './icons';
import { Skeleton } from './Skeleton';

interface Props {
  inputs: Inputs;
  set: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  model: Model;
  keywords: string;
  synced?: boolean;
  /** Despesas ainda a chegar da app de Finanças */
  loading?: boolean;
  /** Dono da app (lista importada da folha dele); os outros veem uma lista de exemplo */
  owner?: boolean;
}

/** "mensal" ou "anual-<mês>" num só seletor, para caber numa linha */
const freqValue = (c: LivingCost) => (c.frequency === 'mensal' ? 'mensal' : `anual-${c.month ?? 1}`);

export function LivingCostsSection({ inputs: i, set, model: m, keywords, synced, loading, owner = true }: Props) {
  const items = i.livingCosts;
  const update = (id: string, p: Partial<LivingCost>) => set('livingCosts', items.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const remove = (id: string) => set('livingCosts', items.filter((c) => c.id !== id));
  const add = () =>
    set('livingCosts', [...items, { id: crypto.randomUUID(), name: 'Nova despesa', category: 'Outro', amount: 0, frequency: 'mensal', enabled: true }]);

  // Agrupa por categoria, investimentos no fim
  const groups = new Map<string, LivingCost[]>();
  for (const c of [...items].sort((a, b) => Number(!!a.investment) - Number(!!b.investment))) {
    const g = groups.get(c.category) ?? [];
    g.push(c);
    groups.set(c.category, g);
  }
  const live = m.living;

  return (
    <Section
      icon={<IconCart />}
      title="Despesas do dia a dia"
      keywords={keywords}
      loading={loading && i.livingCostsEnabled}
      badge={<span className="pill">{i.livingCostsEnabled && live ? `${eur(live.expensesMonthly)}/mês` : 'Opcional · desligado'}</span>}
    >
      <Check checked={i.livingCostsEnabled} onChange={(v) => set('livingCostsEnabled', v)}>
        <b>Incluir na simulação</b>: mostra quanto sobra mesmo do salário depois da casa e de tudo o resto
      </Check>
      {synced ? (
        <span className="hint">Vêm da app de Finanças (sem as que acabam com a compra, como a renda) e atualizam sozinhas. Os valores anuais contam como 1/12 por mês.</span>
      ) : !owner ? (
        <span className="hint">Lista de exemplo com valores típicos: ajusta, desliga ou acrescenta as tuas despesas. Os valores anuais contam como 1/12 por mês.</span>
      ) : (
        <span className="hint">Lista importada a {LIVING_COSTS_IMPORTED_AT} (sem a renda). Os valores anuais contam como 1/12 por mês.</span>
      )}

      {i.livingCostsEnabled && loading && (
        <div className="living-skel" aria-busy="true" aria-label="A carregar as despesas da app de Finanças">
          <Skeleton h={52} r={10} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <div key={k} className="skel-kv">
              <Skeleton w={['46%', '38%', '52%', '30%', '44%', '36%'][k]} h={10} />
              <Skeleton w={56} h={10} />
            </div>
          ))}
        </div>
      )}
      {i.livingCostsEnabled && !loading && (
        <>
          {live && (
            <div className="living-totals">
              <div>
                <span className="muted small">Despesas</span>
                <b>{eur(live.expensesMonthly)}/mês</b>
              </div>
              <div>
                <span className="muted small">Investimentos</span>
                <b>{eur(live.investMonthly)}/mês</b>
              </div>
              <div>
                <span className="muted small">Sobra no fim do mês</span>
                <b className={m.spareAfterAll !== null && m.spareAfterAll < 0 ? 'effort-impossible' : 'effort-ok'}>{m.spareAfterAll !== null ? eur(m.spareAfterAll) : '—'}</b>
              </div>
            </div>
          )}

          <div className="living-list">
            {[...groups.entries()].map(([cat, list]) => {
              const subtotal = list.filter((c) => c.enabled).reduce((s, c) => s + (c.frequency === 'mensal' ? c.amount : c.amount / 12), 0);
              return (
                <div key={cat} className="living-group">
                  <div className="living-group-head">
                    <span>{cat}</span>
                    <span>{eur(subtotal)}/mês</span>
                  </div>
                  {list.map((c) => (
                    <div key={c.id} className={`living-row${c.enabled ? '' : ' off'}`}>
                      <input type="checkbox" checked={c.enabled} disabled={synced} onChange={(e) => update(c.id, { enabled: e.target.checked })} aria-label={`Incluir ${c.name}`} />
                      <input className="living-name" value={c.name} readOnly={synced} onChange={(e) => update(c.id, { name: e.target.value })} aria-label="Nome da despesa" />
                      {synced ? (
                        <span className="living-fixed">{eur(c.amount)}</span>
                      ) : (
                        <InlineNumber label={`Valor de ${c.name}`} value={c.amount} onChange={(v) => update(c.id, { amount: v })} suffix="€" step={5} min={0} />
                      )}
                      <select
                        disabled={synced}
                        className="living-freq"
                        value={freqValue(c)}
                        aria-label={`Frequência de ${c.name}`}
                        onChange={(e) => {
                          const v = e.target.value;
                          update(c.id, v === 'mensal' ? { frequency: 'mensal', month: undefined } : { frequency: 'anual', month: Number(v.split('-')[1]) });
                        }}
                      >
                        <option value="mensal">/mês</option>
                        {MONTHS_PT.map((mo, k) => (
                          <option key={mo} value={`anual-${k + 1}`}>
                            /ano ({mo})
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn small ghost" disabled={synced} style={synced ? { visibility: 'hidden' } : undefined} onClick={() => remove(c.id)} aria-label={`Remover ${c.name}`} title="Remover">
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {!synced && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn small" onClick={add}>
              + Adicionar despesa
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                if (confirm(`Repor as despesas com ${owner ? 'a lista importada' : 'a lista de exemplo'}? As tuas alterações nesta lista perdem-se.`))
                  set('livingCosts', (owner ? DEFAULT_LIVING_COSTS : EXAMPLE_LIVING_COSTS).map((c) => ({ ...c })));
              }}
            >
              {owner ? 'Repor lista importada' : 'Repor lista de exemplo'}
            </button>
          </div>}
        </>
      )}
    </Section>
  );
}
