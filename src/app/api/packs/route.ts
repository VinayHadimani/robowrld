import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  SESSION_COOKIE,
  STARTER_PACK_ID,
  fallbackPackStates,
  getPackStates,
  installPack,
  readSessionId,
  sessionCookie,
  uninstallPack,
} from '@/lib/packs-server'

export const dynamic = 'force-dynamic'

/** GET — the pack catalog with this session's install states.
 *  New sessions start with the Beginner Robot Pack, like a new account. */
export async function GET() {
  const jar = await cookies()
  const { sessionId, isNew } = readSessionId(jar.get(SESSION_COOKIE)?.value)
  try {
    if (isNew) await installPack(sessionId, STARTER_PACK_ID)
    const packs = await getPackStates(sessionId)
    const res = NextResponse.json({ packs })
    if (isNew) res.cookies.set(sessionCookie(sessionId))
    return res
  } catch (err) {
    console.error('[api/packs] database unavailable, serving static catalog:', err)
    const res = NextResponse.json({ packs: fallbackPackStates(), degraded: true })
    if (isNew) res.cookies.set(sessionCookie(sessionId))
    return res
  }
}

/** POST — install or uninstall a pack for this session. */
export async function POST(req: NextRequest) {
  let body: { packId?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const packId = body.packId
  const action = body.action
  if (!packId || (action !== 'install' && action !== 'uninstall')) {
    return NextResponse.json(
      { error: 'Expected { packId: string, action: "install" | "uninstall" }' },
      { status: 400 }
    )
  }

  const jar = await cookies()
  const { sessionId, isNew } = readSessionId(jar.get(SESSION_COOKIE)?.value)

  try {
    if (action === 'install') await installPack(sessionId, packId)
    else await uninstallPack(sessionId, packId)
    const packs = await getPackStates(sessionId)
    const res = NextResponse.json({ packs, packId, action })
    if (isNew) res.cookies.set(sessionCookie(sessionId))
    return res
  } catch (err) {
    console.error('[api/packs] install/uninstall failed:', err)
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }
}
