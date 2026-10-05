import { useEffect, useState } from 'react';

/**
 * Quem está a usar a app (via /api/me, com o email do Cloudflare Access).
 *  - dono: valores próprios e ligação à app de Finanças;
 *  - convidado (qualquer outra pessoa autorizada): valores de exemplo e
 *    cenários só seus.
 * Sem API (desenvolvimento local) conta como dono.
 */
export type Profile = { status: 'loading' } | { status: 'ready'; owner: boolean; email: string | null };

export function useProfile(): Profile {
  const [profile, setProfile] = useState<Profile>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    (async () => {
      let next: Profile;
      try {
        const res = await fetch('/api/me', { headers: { accept: 'application/json' } });
        const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
        if (!isJson) next = { status: 'ready', owner: true, email: null };
        else {
          const body = (await res.json()) as { email?: string; owner?: boolean };
          next = { status: 'ready', owner: res.ok && body.owner === true, email: body.email ?? null };
        }
      } catch {
        next = { status: 'ready', owner: false, email: null };
      }
      if (alive) setProfile(next);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return profile;
}
