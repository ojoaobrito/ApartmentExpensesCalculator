/**
 * Cloudflare Pages Function — /api/prefs
 * Preferências de quem usa a app (p.ex. a ordem das secções), guardadas no KV
 * por pessoa, para sobreviverem a limpezas do browser e passarem entre dispositivos.
 *
 *   GET           → preferências gravadas ({} se não houver)
 *   PUT {prefs}   → grava
 */
import { verifyAccess, type AccessEnv } from '../lib/access';
import { isOwner, type OwnerEnv } from '../lib/owner';

interface KV {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}
interface Env extends AccessEnv, OwnerEnv {
  SCENARIOS: KV;
}
interface Prefs {
  sectionOrder?: string[];
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function parse(x: unknown): Prefs | null {
  const p = x as Prefs;
  if (typeof p !== 'object' || p === null) return null;
  const o = p.sectionOrder;
  if (o !== undefined && (!Array.isArray(o) || o.length > 40 || o.some((s) => typeof s !== 'string' || s.length > 40))) return null;
  return { sectionOrder: o };
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const auth = await verifyAccess(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  // O dono partilha as preferências entre os seus emails
  const key = isOwner(auth.email, env) ? 'prefs' : `prefs:${auth.email.trim().toLowerCase()}`;
  if (request.method === 'GET') return json(((await env.SCENARIOS.get(key, 'json')) as Prefs | null) ?? {});
  if (request.method === 'PUT') {
    const p = parse(await request.json().catch(() => null));
    if (!p) return json({ error: 'preferências inválidas' }, 400);
    await env.SCENARIOS.put(key, JSON.stringify(p));
    return json(p);
  }
  return json({ error: 'método não suportado' }, 405);
};
