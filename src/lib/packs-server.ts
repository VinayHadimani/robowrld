import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { PACKS, type PackState } from '@/lib/packs'
import { backendHealth, getSupabaseAdmin } from './supabase-server'

/**
 * Pack install state — now Supabase-first (the Task-3 promise: "swap
 * SQLite → Supabase and nothing else changes"). While the one-time SQL
 * migration is still pending, everything falls back to the local Prisma
 * store, so pack installs keep working either way. Membership definitions
 * stay in code; the DB only drives install state per session.
 */

export const SESSION_COOKIE = 'rp_session'

/** The pack every new account starts with. */
export const STARTER_PACK_ID = 'beginner-robot-pack'

/* ------------------------------------------------------------------ */
/* Supabase store (primary)                                            */
/* ------------------------------------------------------------------ */

let packsSeeded = false

async function ensurePacksSeeded(sb: SupabaseClient): Promise<void> {
  if (packsSeeded) return
  const { error: packsErr } = await sb
    .from('packs')
    .upsert(
      PACKS.map((p, i) => ({
        id: p.id,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        icon: p.icon,
        size_mb: p.sizeMb,
        price_label: p.priceLabel,
        level: p.level,
        featured: p.featured ?? false,
        sort_order: i,
      })),
      { onConflict: 'id' }
    )
  if (packsErr) throw packsErr
  const { error: membershipErr } = await sb
    .from('pack_components')
    .upsert(
      PACKS.flatMap((p) => p.componentIds.map((cid) => ({ pack_id: p.id, component_slug: cid }))),
      { onConflict: 'pack_id,component_slug' }
    )
  if (membershipErr) throw membershipErr
  packsSeeded = true
}

async function supabaseGetPackStates(sessionId: string): Promise<PackState[]> {
  const sb = getSupabaseAdmin()
  if (!sb) throw new Error('supabase not configured')
  await ensurePacksSeeded(sb)
  const { data, error } = await sb
    .from('installs')
    .select('pack_id, installed_at')
    .eq('session_id', sessionId)
  if (error) throw error
  const installedMap = new Map(
    (data ?? []).map((i: { pack_id: string; installed_at: string }) => [i.pack_id, i.installed_at])
  )
  return PACKS.map((p) => ({
    ...p,
    installed: installedMap.has(p.id),
    installedAt: installedMap.get(p.id),
  }))
}

async function supabaseInstallPack(sessionId: string, packId: string): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) throw new Error('supabase not configured')
  await ensurePacksSeeded(sb)
  const { error } = await sb
    .from('installs')
    .upsert({ session_id: sessionId, pack_id: packId }, { onConflict: 'session_id,pack_id' })
  if (error) throw error
}

async function supabaseUninstallPack(sessionId: string, packId: string): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) throw new Error('supabase not configured')
  const { error } = await sb
    .from('installs')
    .delete()
    .eq('session_id', sessionId)
    .eq('pack_id', packId)
  if (error) throw error
}

async function isSupabaseReady(): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const health = await backendHealth()
  return health.tablesReady
}

/* ------------------------------------------------------------------ */
/* Prisma store (fallback until the SQL migration runs)                */
/* ------------------------------------------------------------------ */

async function prismaEnsurePacksSeeded(): Promise<void> {
  for (const [i, p] of PACKS.entries()) {
    await db.pack.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        icon: p.icon,
        sizeMb: p.sizeMb,
        priceLabel: p.priceLabel,
        level: p.level,
        featured: p.featured ?? false,
        sortOrder: i,
      },
      update: {
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        icon: p.icon,
        sizeMb: p.sizeMb,
        priceLabel: p.priceLabel,
        level: p.level,
        featured: p.featured ?? false,
        sortOrder: i,
      },
    })
    for (const componentId of p.componentIds) {
      await db.packComponent.upsert({
        where: { packId_componentId: { packId: p.id, componentId } },
        create: { packId: p.id, componentId },
        update: {},
      })
    }
  }
}

async function prismaGetPackStates(sessionId: string): Promise<PackState[]> {
  await prismaEnsurePacksSeeded()
  const [packs, installs] = await Promise.all([
    db.pack.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.install.findMany({ where: { sessionId } }),
  ])
  const installedMap = new Map(installs.map((i) => [i.packId, i.installedAt.toISOString()]))
  return PACKS.map((p) => ({
    ...p,
    installed: installedMap.has(p.id),
    installedAt: installedMap.get(p.id),
  }))
}

/* ------------------------------------------------------------------ */
/* Public API (same signatures as before — routes unchanged)           */
/* ------------------------------------------------------------------ */

/** All packs + which of them this session has installed. */
export async function getPackStates(sessionId: string): Promise<PackState[]> {
  if (await isSupabaseReady()) {
    try {
      return await supabaseGetPackStates(sessionId)
    } catch (err) {
      console.error('[packs-server] supabase read failed, falling back to prisma:', err)
    }
  }
  return prismaGetPackStates(sessionId)
}

export async function installPack(sessionId: string, packId: string): Promise<void> {
  if (await isSupabaseReady()) {
    try {
      await supabaseInstallPack(sessionId, packId)
      return
    } catch (err) {
      console.error('[packs-server] supabase install failed, falling back to prisma:', err)
    }
  }
  await prismaEnsurePacksSeeded()
  await db.install.upsert({
    where: { sessionId_packId: { sessionId, packId } },
    create: { sessionId, packId },
    update: {},
  })
}

export async function uninstallPack(sessionId: string, packId: string): Promise<void> {
  if (await isSupabaseReady()) {
    try {
      await supabaseUninstallPack(sessionId, packId)
      return
    } catch (err) {
      console.error('[packs-server] supabase uninstall failed, falling back to prisma:', err)
    }
  }
  await db.install.deleteMany({ where: { sessionId, packId } })
}

/** Read or mint the anonymous session id (the future user account key). */
export function readSessionId(cookieValue?: string): { sessionId: string; isNew: boolean } {
  if (cookieValue && cookieValue.length > 8) return { sessionId: cookieValue, isNew: false }
  return { sessionId: randomUUID(), isNew: true }
}

export function sessionCookie(sessionId: string) {
  return {
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // one year — survives reloads
  }
}

/** Graceful fallback if every store is unavailable — the UI keeps working. */
export function fallbackPackStates(): PackState[] {
  return PACKS.map((p) => ({ ...p, installed: true }))
}
