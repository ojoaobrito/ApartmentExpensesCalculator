/**
 * Verificação do Cloudflare Access: valida o JWT que o Access junta a cada
 * pedido (cabeçalho Cf-Access-Jwt-Assertion ou cookie CF_Authorization).
 * Sem ACCESS_TEAM_DOMAIN/ACCESS_AUD configurados, recusa tudo — os dados
 * nunca ficam expostos por esquecimento.
 */

export interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string; // ex.: https://minha-equipa.cloudflareaccess.com
  ACCESS_AUD?: string; // "Application Audience (AUD) Tag"
  DEV_BYPASS_AUTH?: string; // só em desenvolvimento local (.dev.vars)
}

export type AccessResult = { ok: true; email: string } | { ok: false; status: number; error: string };

interface Jwk extends JsonWebKey {
  kid: string;
}

let jwksCache: { url: string; keys: Jwk[]; at: number } | null = null;

async function getKeys(teamDomain: string, kid: string): Promise<Jwk[]> {
  const url = `${teamDomain.replace(/\/$/, '')}/cdn-cgi/access/certs`;
  // Usa a cache se for recente e tiver a chave pedida (senão houve rotação de chaves)
  if (jwksCache && jwksCache.url === url && Date.now() - jwksCache.at < 3600_000 && jwksCache.keys.some((k) => k.kid === kid)) return jwksCache.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { url, keys: body.keys, at: Date.now() };
  return body.keys;
}

const b64urlToBytes = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const b64urlToJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

function tokenFrom(request: Request): string | null {
  const header = request.headers.get('cf-access-jwt-assertion');
  if (header) return header;
  const cookie = request.headers.get('cookie') ?? '';
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m ? m[1] : null;
}

export async function verifyAccess(request: Request, env: AccessEnv): Promise<AccessResult> {
  if (env.DEV_BYPASS_AUTH === '1') return { ok: true, email: 'dev@localhost' };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { ok: false, status: 503, error: 'access_not_configured' };
  const token = tokenFrom(request);
  if (!token) return { ok: false, status: 401, error: 'missing_token' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, status: 401, error: 'bad_token' };
  try {
    const header = b64urlToJson(parts[0]) as { kid: string; alg: string };
    const payload = b64urlToJson(parts[1]) as { aud: string | string[]; exp: number; iss: string; email?: string; common_name?: string };
    if (header.alg !== 'RS256') return { ok: false, status: 401, error: 'bad_alg' };
    const jwk = (await getKeys(env.ACCESS_TEAM_DOMAIN, header.kid)).find((k) => k.kid === header.kid);
    if (!jwk) return { ok: false, status: 401, error: 'unknown_key' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return { ok: false, status: 401, error: 'bad_signature' };
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) return { ok: false, status: 401, error: 'bad_audience' };
    if (payload.exp * 1000 < Date.now()) return { ok: false, status: 401, error: 'expired' };
    if (payload.iss.replace(/\/$/, '') !== env.ACCESS_TEAM_DOMAIN.replace(/\/$/, '')) return { ok: false, status: 401, error: 'bad_issuer' };
    // Pessoas têm email; tokens de serviço (outras apps) têm common_name
    return { ok: true, email: payload.email ?? payload.common_name ?? 'service' };
  } catch {
    return { ok: false, status: 401, error: 'invalid_token' };
  }
}

/** Comparação em tempo constante (para a chave de sincronização) */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
