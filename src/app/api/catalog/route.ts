import { NextResponse } from 'next/server'
import { catalogPayloadFrom, listComponents } from '@/lib/components-server'

export const dynamic = 'force-dynamic'

/**
 * GET — the machine-readable component catalog.
 *
 * This is the artifact the AI generation layer (Pillar 2) consumes: every
 * component's capabilities, constraints, ports, DOF, physics and cost as
 * structured JSON. An LLM deciding "which servo should this robot use?"
 * reads this, not the website. Now served from the cloud layer (Postgres
 * rows when migrated, bucket listing + constants otherwise) — so uploaded
 * user models join the AI-selectable catalog automatically.
 */
export async function GET() {
  const { components } = await listComponents()
  return NextResponse.json(catalogPayloadFrom(components))
}
