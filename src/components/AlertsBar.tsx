import { useEffect, useRef, useState } from 'react';
import { ChevronRight, CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';
import type { Model, ModelAlert } from '../model';
import { Alert } from './ui';

const ORDER: ModelAlert['kind'][] = ['crit', 'warn', 'info', 'ok'];
const GROUPS: Record<string, { title: string; one: string; many: string }> = {
  crit: { title: 'Críticos', one: 'crítico', many: 'críticos' },
  warn: { title: 'Avisos', one: 'aviso', many: 'avisos' },
  info: { title: 'Notas', one: 'nota', many: 'notas' },
  ok: { title: 'Tudo bem', one: 'ok', many: 'ok' },
};
const ICON = { crit: CircleX, warn: TriangleAlert, info: Info, ok: CircleCheck };

/**
 * Avisos e notas numa só linha compacta: contagem por tipo e o mais importante.
 * Clicar abre uma janela com todos, agrupados.
 */
export function AlertsBar({ m }: { m: Model }) {
  const [open, setOpen] = useState(false);
  const alerts = [...m.alerts].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  if (!alerts.length)
    return (
      <div className="alerts">
        <Alert kind="ok">Tudo dentro das regras do Banco de Portugal e com o fundo de emergência intacto.</Alert>
      </div>
    );
  const top = alerts[0];
  const counts = ORDER.map((k) => ({ k, n: alerts.filter((a) => a.kind === k).length })).filter((c) => c.n > 0);
  const TopIcon = ICON[top.kind];
  return (
    <>
      <button type="button" className={`alerts-bar ${top.kind}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="a-icon" aria-hidden>
          <TopIcon size={18} strokeWidth={2.2} />
        </span>
        <span className="alerts-counts">
          {counts.map((c) => (
            <span key={c.k} className={`alerts-count ${c.k}`}>
              {c.n} {c.n === 1 ? GROUPS[c.k].one : GROUPS[c.k].many}
            </span>
          ))}
        </span>
        <span className="alerts-top">{top.text}</span>
        <span className="alerts-more">
          Ver {alerts.length === 1 ? '' : 'todos'}
          <ChevronRight size={15} strokeWidth={2.2} aria-hidden />
        </span>
      </button>
      {open && <AlertsModal alerts={alerts} onClose={() => setOpen(false)} />}
    </>
  );
}

function AlertsModal({ alerts, onClose }: { alerts: ModelAlert[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 160);
  };
  return (
    <dialog
      ref={ref}
      className={`modal${closing ? ' closing' : ''}`}
      aria-labelledby="alerts-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id="alerts-title">Avisos e notas</h2>
          <div className="muted small">O que a simulação encontrou com os valores atuais, do mais importante para o menos.</div>
        </div>
        <button type="button" className="btn ghost modal-close" aria-label="Fechar" onClick={close}>
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="modal-body">
        {ORDER.map((k) => {
          const list = alerts.filter((a) => a.kind === k);
          if (!list.length) return null;
          return (
            <section key={k} className="alerts-group">
              <h3 className="alerts-group-title">{GROUPS[k].title}</h3>
              {list.map((a, idx) => (
                <Alert key={idx} kind={a.kind}>
                  {a.text}
                </Alert>
              ))}
            </section>
          );
        })}
      </div>
      <div className="modal-foot">
        <span className="muted small">Mudam sozinhos quando mexes nos parâmetros.</span>
        <button type="button" className="btn" onClick={close}>
          Fechar
        </button>
      </div>
    </dialog>
  );
}
