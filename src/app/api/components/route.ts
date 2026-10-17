import { NextRequest, NextResponse } from 'next/server'
import { listComponents } from '@/lib/components-server'

export const dynamic = 'force-dynamic'

/**
 * GET — the cloud component catalog.
 *
 * Response: { mode: 'database' | 'storage' | 'offline', status, components }
 *   database → Postgres rows (self-seeded with the 7 built-ins on first read)
 *   storage  → models bucket listing + built-in constants (SQL migration pending)
 *   offline  → built-in constants (cloud unreachable)
 *
 * ?refresh=1 busts the backend-health cache — used by the Studio's
 * "I've run the SQL" re-check button.
 */
export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === '1'
  try {
    const payload = await listComponents(force)
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[api/components] listing failed:', err)
    return NextResponse.json({ error: 'Component listing failed.' }, { status: 500 })
  }
}
