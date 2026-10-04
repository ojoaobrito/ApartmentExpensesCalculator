import type { CSSProperties, ReactNode } from 'react';

/**
 * Esqueletos de carregamento (iguais no simulador e na app de Finanças):
 * blocos cinzentos com brilho a passar que ocupam o lugar do conteúdo enquanto
 * os dados chegam, para a página não "saltar" quando aparecem.
 */
export function Skeleton({ w = '100%', h = 12, r = 6, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="skel" aria-hidden style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Várias linhas de texto (a última mais curta) */
export function SkeletonLines({ n = 2, h = 10, gap = 8, last = '60%' }: { n?: number; h?: number; gap?: number; last?: string }) {
  return (
    <span className="skel-lines" aria-hidden style={{ gap }}>
      {Array.from({ length: n }, (_, k) => (
        <Skeleton key={k} h={h} w={k === n - 1 && n > 1 ? last : '100%'} />
      ))}
    </span>
  );
}

/** Zona em carregamento: anuncia o estado aos leitores de ecrã e esconde os blocos */
export function Loading({ label, children, className, style }: { label: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`skel-zone${className ? ` ${className}` : ''}`} role="status" aria-busy="true" aria-label={label} style={style}>
      {children}
    </div>
  );
}
