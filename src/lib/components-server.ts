import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  COMPONENTS,
  getComponent,
  type AiProfile,
  type CommerceInfo,
  type PhysicsProperties,
  type RoboticsComponent,
  type SpecRow,
} from './component-schema'
import {
  MODELS_BUCKET,
  backendHealth,
  getSupabaseAdmin,
  publicModelUrl,
  storagePathFromPublicUrl,
  type BackendHealth,
} from './supabase-server'

/**
 * The components data layer — the "swap SQLite → Supabase" promise kept.
 *
 * Reads layer themselves: Postgres rows when the tables exist, Storage
 * object listings when they don't (the bucket exists regardless), and the
 * built-in constants as the final fallback so the library never breaks.
 * Writes always land the FILE in Storage; the metadata row lands in
 * Postgres as soon as the migration has been run.
 */

/** Error carrying an HTTP status — API routes map it directly. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export interface CloudComponent {
  /** DB row uuid — or the Storage object path in storage-only mode. */
  id: string
  slug: string
  name: string
  category: string
  source: 'builtin' | 'user'
  status: string
  modelKind: 'procedural' | 'gltf' | 'stl'
  modelUrl: string | null
  fileName: string | null
  fileSize: number | null
  createdAt: string
  tagline: string
  description: string
  specs: SpecRow[]
  physics: PhysicsProperties | null
  commerce: CommerceInfo | null
  aiProfile: AiProfile | null
}

export interface ComponentsPayload {
  mode: BackendHealth['mode']
  status: BackendHealth
  components: CloudComponent[]
}

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

function builtinToComponent(c: RoboticsComponent): CloudComponent {
  return {
    id: c.id,
    slug: c.id,
    name: c.name,
    category: c.category,
    source: 'builtin',
    status: c.status,
    modelKind: c.model.kind === 'gltf' ? 'gltf' : 'procedural',
    modelUrl: c.model.kind === 'gltf' ? c.model.url : null,
    fileName: null,
    fileSize: null,
    createdAt: new Date(0).toISOString(),
    tagline: c.tagline,
    description: c.description,
    specs: c.specs,
    physics: c.physics,
    commerce: c.commerce,
    aiProfile: c.ai,
  }
}

const BUILTIN_COMPONENTS: CloudComponent[] = COMPONENTS.map(builtinToComponent)

interface ComponentRow {
  id: string
  slug: string
  name: string
  category: string
  status: string
  tagline: string | null
  description: string | null
  specs: SpecRow[] | null
  physics: PhysicsProperties | null
  commerce: CommerceInfo | null
  ai_profile: AiProfile | null
  model_kind: 'procedural' | 'gltf' | 'stl'
  model_url: string | null
  model_meta: { fileName?: string; fileSize?: number } | null
  source: 'builtin' | 'user'
  created_at: string
}

function rowToComponent(r: ComponentRow): CloudComponent {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    source: r.source,
    status: r.status,
    modelKind: r.model_kind,
    modelUrl: r.model_url,
    fileName: r.model_meta?.fileName ?? (r.model_url ? r.model_url.split('/').pop() ?? null : null),
    fileSize: r.model_meta?.fileSize ?? null,
    createdAt: r.created_at,
    tagline: r.tagline ?? '',
    description: r.description ?? '',
    specs: r.specs ?? [],
    physics: r.physics ?? null,
    commerce: r.commerce ?? null,
    aiProfile: r.ai_profile ?? null,
  }
}

interface StorageObject {
  name: string
  id?: string
  updated_at?: string
  created_at?: string
  metadata?: { size?: number; mimetype?: string }
}

function prettifySlugName(base: string): string {
  const stripped = base.replace(/-[0-9a-f]{8,}$/, '')
  return (
    stripped
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'Uploaded model'
  )
}

function storageObjectToComponent(o: StorageObject): CloudComponent {
  const ext = o.name.split('.').pop()?.toLowerCase()
  const kind: 'gltf' | 'stl' = ext === 'stl' ? 'stl' : 'gltf'
  const base = o.name.replace(/\.[^.]+$/, '')
  return {
    id: o.name, // storage-only mode: the object path IS the id
    slug: base,
    name: prettifySlugName(base),
    category: 'Uploads',
    source: 'user',
    status: 'available',
    modelKind: kind,
    modelUrl: publicModelUrl(o.name),
    fileName: o.name,
    fileSize: o.metadata?.size ?? null,
    createdAt: o.updated_at ?? o.created_at ?? new Date().toISOString(),
    tagline: 'Uploaded 3D model file',
    description: '',
    specs: [],
    physics: null,
    commerce: null,
    aiProfile: null,
  }
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'model'
  )
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

let seedAttempted = false

/**
 * Keep the built-in catalog rows in sync with the code. Runs as an UPSERT
 * keyed on slug, so it seeds an empty table AND retro-adds built-ins that
 * were introduced after the table first filled (e.g. the 9V battery) —
 * built-ins are protected from deletion, so re-upserting them is a no-op.
 */
async function ensureSeeded(sb: SupabaseClient): Promise<void> {
  if (seedAttempted) return
  const rows = COMPONENTS.map((c, i) => ({
    slug: c.id,
    name: c.name,
    category: c.category,
    status: c.status,
    tagline: c.tagline,
    description: c.description,
    specs: c.specs,
    physics: c.physics,
    commerce: c.commerce,
    ai_profile: c.ai,
    model_kind: 'procedural' as const,
    model_url: null,
    model_meta: null,
    source: 'builtin' as const,
    ports: c.connectionModel?.ports.length ?? 0,
    dof: c.connectionModel?.dof.length ?? 0,
    // Deterministic order: built-ins keep catalog order ahead of uploads.
    created_at: new Date(Date.UTC(2000, 0, 1 + i)).toISOString(),
  }))
  const { error } = await sb.from('components').upsert(rows, { onConflict: 'slug' })
  if (error) throw error
  seedAttempted = true
}

async function listStorageComponents(sb: SupabaseClient): Promise<CloudComponent[]> {
  const { data, error } = await sb.storage
    .from(MODELS_BUCKET)
    .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
  if (error || !data) return []
  return data
    .filter((o) => o.name && /\.(glb|gltf|stl)$/i.test(o.name))
    .map((o) => storageObjectToComponent(o as StorageObject))
}

export async function listComponents(force = false): Promise<ComponentsPayload> {
  const status = await backendHealth(force)
  const sb = getSupabaseAdmin()

  if (status.mode === 'database' && sb) {
    try {
      await ensureSeeded(sb)
      const { data, error } = await sb
        .from('components')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return { mode: 'database', status, components: (data ?? []).map((r: ComponentRow) => rowToComponent(r)) }
    } catch (err) {
      console.error('[components-server] database read failed, degrading to storage:', err)
      const fromStorage = await listStorageComponents(sb)
      // Report the layer we are actually serving, not the one we hoped for.
      const degradedStatus = { ...status, mode: 'storage' as const, tablesReady: false }
      return { mode: 'storage', status: degradedStatus, components: [...BUILTIN_COMPONENTS, ...fromStorage] }
    }
  }

  if (status.mode === 'storage' && sb) {
    const fromStorage = await listStorageComponents(sb)
    return { mode: 'storage', status, components: [...BUILTIN_COMPONENTS, ...fromStorage] }
  }

  return { mode: 'offline', status, components: BUILTIN_COMPONENTS }
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export interface UploadInput {
  fileName: string
  bytes: Buffer
  contentType: string
  name: string
  category: string
  description?: string
}

export interface UploadResult {
  component: CloudComponent
  /** false when the file landed in Storage but the metadata table is missing. */
  metadataSaved: boolean
  mode: BackendHealth['mode']
}

const MAX_BYTES = 50 * 1024 * 1024

export async function uploadModel(input: UploadInput): Promise<UploadResult> {
  const sb = getSupabaseAdmin()
  if (!sb) {
    throw new ApiError('Supabase is not configured on the server (missing service key).', 503)
  }

  const ext = input.fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!['glb', 'gltf', 'stl'].includes(ext)) {
    throw new ApiError('Unsupported format — upload .glb, .gltf or .stl files.', 400)
  }
  if (input.bytes.length === 0) throw new ApiError('The file is empty.', 400)
  if (input.bytes.length > MAX_BYTES) {
    throw new ApiError('File exceeds the 50 MB bucket limit.', 413)
  }
  if (!input.name.trim()) throw new ApiError('A component name is required.', 400)
  if (!input.category.trim()) throw new ApiError('A category is required.', 400)

  const slug = `${slugify(input.name)}-${randomUUID().slice(0, 8)}`
  const path = `${slug}.${ext}`

  const { error: upErr } = await sb.storage.from(MODELS_BUCKET).upload(path, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  })
  if (upErr) {
    const conflict = upErr.statusCode === '409' || /already exists/i.test(upErr.message)
    throw new ApiError(
      conflict ? 'A file with that name already exists — try again.' : `Storage upload failed: ${upErr.message}`,
      conflict ? 409 : 502
    )
  }

  const url = publicModelUrl(path)
  const health = await backendHealth()

  if (health.tablesReady) {
    const row = {
      slug,
      name: input.name.trim(),
      category: input.category.trim(),
      status: 'available',
      tagline: (input.description?.trim() || `Uploaded ${ext.toUpperCase()} model — cloud library entry`).slice(0, 180),
      description: input.description?.trim() ?? '',
      specs: [
        { label: 'Model file', value: `${input.fileName} (${formatBytes(input.bytes.length)})` },
        { label: 'Model format', value: ext === 'stl' ? 'STL (geometry only)' : 'glTF 2.0' },
      ],
      physics: null,
      commerce: null,
      ai_profile: {
        summary: `User-uploaded ${ext.toUpperCase()} 3D model: renderable geometry, metadata pending.`,
        capabilities: ['Renderable 3D geometry in the library and assembly scenes'],
        constraints: ['Not yet dimension-accurate or connected to the port/DOF contract'],
        bestFor: ['Visual reference, layout planning, future OpenSCAD → glTF pipeline'],
      },
      model_kind: ext === 'stl' ? 'stl' : 'gltf',
      model_url: url,
      model_meta: { fileName: input.fileName, fileSize: input.bytes.length, mime: input.contentType },
      source: 'user',
      ports: 0,
      dof: 0,
    }
    const { data, error } = await sb.from('components').insert(row).select().single()
    if (error) {
      // The file is already safely in Storage — a missing/unready metadata
      // table is a degradation, not a failure. Anything else is a real error.
      const tableMissing =
        error.code === 'PGRST205' || /could not find the table|schema cache/i.test(error.message ?? '')
      if (!tableMissing) {
        throw new ApiError(`Metadata insert failed: ${error.message}`, 502)
      }
      console.error('[components-server] metadata table missing, serving storage-only entry:', error.message)
    } else {
      return { component: rowToComponent(data as ComponentRow), metadataSaved: true, mode: 'database' }
    }
  }

  return {
    component: storageObjectToComponent({
      name: path,
      updated_at: new Date().toISOString(),
      metadata: { size: input.bytes.length, mimetype: input.contentType },
    }),
    metadataSaved: false,
    mode: 'storage',
  }
}

export async function deleteModel(id: string): Promise<{ deleted: true; mode: BackendHealth['mode'] }> {
  const sb = getSupabaseAdmin()
  if (!sb) throw new ApiError('Supabase is not configured on the server.', 503)

  const health = await backendHealth()

  if (health.mode === 'database') {
    const { data: row, error } = await sb
      .from('components')
      .select('id, source, model_url')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new ApiError(`Lookup failed: ${error.message}`, 502)
    if (!row) throw new ApiError('Component not found.', 404)
    if (row.source === 'builtin') {
      throw new ApiError('Built-in catalog components cannot be deleted.', 400)
    }
    if (row.model_url) {
      const path = storagePathFromPublicUrl(row.model_url)
      if (path) await sb.storage.from(MODELS_BUCKET).remove([path])
    }
    const { error: delErr } = await sb.from('components').delete().eq('id', id)
    if (delErr) throw new ApiError(`Delete failed: ${delErr.message}`, 502)
    return { deleted: true, mode: 'database' }
  }

  if (health.mode === 'storage') {
    const path = decodeURIComponent(id)
    const { error } = await sb.storage.from(MODELS_BUCKET).remove([path])
    if (error) throw new ApiError(`Delete failed: ${error.message}`, 502)
    return { deleted: true, mode: 'storage' }
  }

  throw new ApiError('Cloud backend unreachable.', 503)
}

/* ------------------------------------------------------------------ */
/* AI catalog (Pillar 2 artifact) — now sourced from the cloud layer    */
/* ------------------------------------------------------------------ */

export function catalogPayloadFrom(components: CloudComponent[]) {
  return {
    schema: 'robotics-platform.catalog/1.0',
    generatedAt: new Date().toISOString(),
    componentCount: components.length,
    components: components.map((c) => {
      // Built-ins keep their full connection-contract detail from code.
      const contract = getComponent(c.slug)?.connectionModel
      return {
        id: c.slug,
        name: c.name,
        category: c.category,
        status: c.status,
        tagline: c.tagline,
        mass_g: c.physics?.mass ?? null,
        dimensions_mm: c.physics?.dimensions ?? null,
        price_usd: c.commerce?.priceUsd ?? null,
        part_number: c.commerce?.partNumber ?? null,
        ports: contract?.ports.length ?? 0,
        dof:
          contract?.dof.map((d) => ({
            id: d.id,
            kind: d.kind,
            range_deg: d.range,
            axis: d.axis,
          })) ?? [],
        ai:
          c.aiProfile ?? {
            summary: c.tagline || 'User-uploaded component.',
            capabilities: [],
            constraints: [],
            bestFor: [],
          },
        key_specs: c.specs.slice(0, 4).map((s) => `${s.label}: ${s.value}`),
      }
    }),
  }
}

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
