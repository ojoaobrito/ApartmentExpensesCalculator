/**
 * Cloudflare Pages Function — /api/scenarios
 * Guarda os cenários no Workers KV (binding SCENARIOS), uma lista por pessoa:
 * o dono (OWNER_EMAILS) usa a chave "scenarios"; qualquer outra pessoa
 * autorizada pelo Cloudflare Access tem a sua ("scenarios:<email>").
 * Se a variável APP_TOKEN estiver definida, exige `Authorization: Bearer <APP_TOKEN>`.
 *
 *   GET            → lista de cenários
 *   PUT  {cenário} → cria ou atualiza (por id)
 *   DELETE ?id=…   → apaga
 */

import { verifyAccess, type AccessEnv } from '../lib/access';
import { isOwner, type OwnerEnv } from '../lib/owner';

interface KV {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}
interface Env extends AccessEnv, OwnerEnv {
  SCENARIOS: KV;
  APP_TOKEN?: string;
}
interface Scenario {
  id: string;
  name: string;
  savedAt: string;
  inputs: Record<string, unknown>;
}

const MAX_BYTES = 2_000_000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function authorized(request: Request, env: Env) {
  if (!env.APP_TOKEN) return true;
  return request.headers.get('authorization') === `Bearer ${env.APP_TOKEN}`;
}

function isScenario(x: unknown): x is Scenario {
  const s = x as Scenario;
  return (
    typeof s === 'object' && s !== null &&
    typeof s.id === 'string' && s.id.length > 0 && s.id.length <= 100 &&
    typeof s.name === 'string' && s.name.length <= 200 &&
    typeof s.savedAt === 'string' &&
    typeof s.inputs === 'object' && s.inputs !== null
  );
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);
  const auth = await verifyAccess(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status === 401 ? 403 : auth.status);
  const KEY = isOwner(auth.email, env) ? 'scenarios' : `scenarios:${auth.email.trim().toLowerCase()}`;

  const list = ((await env.SCENARIOS.get(KEY, 'json')) as Scenario[] | null) ?? [];

  switch (request.method) {
    case 'GET':
      return json(list);

    case 'PUT': {
      const body: unknown = await request.json().catch(() => null);
      if (!isScenario(body)) return json({ error: 'cenário inválido' }, 400);
      const next = list.some((s) => s.id === body.id) ? list.map((s) => (s.id === body.id ? body : s)) : [...list, body];
      const raw = JSON.stringify(next);
      if (raw.length > MAX_BYTES) return json({ error: 'demasiados dados' }, 413);
      await env.SCENARIOS.put(KEY, raw);
      return json(body);
    }

    case 'DELETE': {
      const id = new URL(request.url).searchParams.get('id');
      if (!id) return json({ error: 'id em falta' }, 400);
      await env.SCENARIOS.put(KEY, JSON.stringify(list.filter((s) => s.id !== id)));
      return new Response(null, { status: 204 });
    }

    default:
      return json({ error: 'método não suportado' }, 405);
  }
};
