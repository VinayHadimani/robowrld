import { NextRequest, NextResponse } from 'next/server'
import { ApiError, deleteModel } from '@/lib/components-server'

export const dynamic = 'force-dynamic'

/**
 * DELETE — remove an uploaded model.
 *
 * In database mode `id` is the component row uuid (built-ins are protected);
 * in storage-only mode `id` is the URL-encoded object path. Either way the
 * Storage object is deleted alongside the metadata row.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'Missing component id.' }, { status: 400 })
  }
  try {
    const result = await deleteModel(decodeURIComponent(id))
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/components/delete] failed:', err)
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 })
  }
}
