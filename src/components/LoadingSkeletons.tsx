import { Loading, Skeleton } from './Skeleton';

const ROW_W = ['55%', '40%', '62%', '35%', '48%', '58%', '44%'];

/** Cartões do topo enquanto chegam os valores da app de Finanças (mesma grelha que os Kpis) */
export function KpisSkeleton() {
  return (
    <Loading label="A carregar os valores da app de Finanças" className="kpis">
      <div className="kpi hero skel-hero">
        <Skeleton w={170} h={11} />
        <Skeleton w={200} h={34} r={8} style={{ margin: '8px 0 10px' }} />
        <Skeleton w={240} h={18} r={999} />
        <Skeleton h={8} r={999} style={{ margin: '14px 0 12px' }} />
        <div className="hero-rows">
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <div key={k} className="hero-row">
              <Skeleton w={ROW_W[k]} h={10} style={{ margin: '6px 0' }} />
              <Skeleton w={64} h={10} style={{ margin: '6px 0' }} />
            </div>
          ))}
        </div>
      </div>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <div key={k} className="kpi">
          <Skeleton w={110} h={10} style={{ marginTop: 2 }} />
          <Skeleton w={['55%', '50%', '62%', '48%', '52%', '40%'][k]} h={22} r={6} style={{ margin: '7px 0 7px' }} />
          {[0, 1, 2, 3, 4].map((r) => (
            <div key={r} className="skel-kv" style={{ padding: '4px 0', border: 0 }}>
              <Skeleton w={ROW_W[(k + r) % ROW_W.length]} h={9} />
              <Skeleton w={52} h={9} />
            </div>
          ))}
        </div>
      ))}
    </Loading>
  );
}

/** Uma linha de alerta */
export function AlertsSkeleton() {
  return (
    <div className="alerts" aria-hidden>
      <Skeleton h={44} r={10} />
      <Skeleton h={44} r={10} />
    </div>
  );
}

/** Conteúdo dos separadores que dependem dos valores (resumo, gráficos, plano) */
export function PanelSkeleton() {
  return (
    <Loading label="A carregar" className="grid2">
      {[6, 7, 5].map((rows, c) => (
        <div key={c} className="card">
          <Skeleton w={['58%', '42%', '50%'][c]} h={16} />
          <Skeleton w="76%" h={10} style={{ margin: '10px 0 18px' }} />
          {Array.from({ length: rows }, (_, k) => (
            <div key={k} className="skel-kv">
              <Skeleton w={ROW_W[(k + c) % ROW_W.length]} h={10} />
              <Skeleton w={70} h={10} />
            </div>
          ))}
        </div>
      ))}
    </Loading>
  );
}
