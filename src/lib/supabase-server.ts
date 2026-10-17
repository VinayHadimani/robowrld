import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase access.
 *
 * Layering strategy (why this file probes "health"):
 *   database → full metadata catalog in Postgres (components table)
 *   storage  → files in the `models` bucket, listed straight from Storage
 *   offline  → local constants only
 *
 * The service-role key can do everything EXCEPT run DDL — creating tables
 * is a dashboard/SQL-editor operation. So the bucket exists (created via
 * the Storage API) while the tables wait for a one-time SQL paste. The app
 * detects which layer is live and degrades gracefully instead of breaking.
 */

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

/** The public 3D-model file bucket (created via the Storage API). */
export const MODELS_BUCKET = 'models'

export type BackendMode = 'database' | 'storage' | 'offline'

export interface BackendHealth {
  mode: BackendMode
  configured: boolean
  /** public.components & friends exist and answer queries. */
  tablesReady: boolean
  /** the `models` bucket answers list calls. */
  storageReady: boolean
  projectRef: string
  url: string
  bucket: string
}

const globalForSupabase = globalThis as unknown as {
  __mechalibSupabaseAdmin?: SupabaseClient
}

/** Admin client (service role) — server-side ONLY, never ship to the browser. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null
  if (!globalForSupabase.__mechalibSupabaseAdmin) {
    globalForSupabase.__mechalibSupabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return globalForSupabase.__mechalibSupabaseAdmin
}

/** Public (unsigned) URL of a stored model file — what the 3D viewer fetches. */
export function publicModelUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${MODELS_BUCKET}/${path}`
}

/** Inverse of publicModelUrl — bucket-relative path, for deletes. */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${MODELS_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

/* ------------------------------------------------------------------ */
/* Health probe (cached briefly so requests don't pay the roundtrip)   */
/* ------------------------------------------------------------------ */

const HEALTH_TTL_MS = 10_000
let healthCache: (BackendHealth & { at: number }) | null = null

export async function backendHealth(force = false): Promise<BackendHealth> {
  const projectRef = SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0] ?? ''
  const base: BackendHealth = {
    mode: 'offline',
    configured: Boolean(SUPABASE_URL && SERVICE_ROLE_KEY),
    tablesReady: false,
    storageReady: false,
    projectRef,
    url: SUPABASE_URL,
    bucket: MODELS_BUCKET,
  }

  const sb = getSupabaseAdmin()
  if (!sb) return base

  if (!force && healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) {
    const { at: _at, ...cached } = healthCache
    return cached
  }

  // NOTE: plain GET (not head:true) — postgrest-js does not surface the 404
  // error body for HEAD requests, so a missing table would masquerade as
  // a healthy one. A GET on a missing table reliably yields PGRST205.
  const [tableProbe, storageProbe] = await Promise.all([
    sb.from('components').select('id').limit(1),
    sb.storage.from(MODELS_BUCKET).list('', { limit: 1 }),
  ])

  const health: BackendHealth = {
    ...base,
    tablesReady: !tableProbe.error,
    storageReady: !storageProbe.error,
    mode: !tableProbe.error ? 'database' : !storageProbe.error ? 'storage' : 'offline',
  }
  healthCache = { at: Date.now(), ...health }
  return health
}
