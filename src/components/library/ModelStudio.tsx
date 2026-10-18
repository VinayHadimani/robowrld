'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Boxes,
  Check,
  CloudUpload,
  Copy,
  Database,
  Eye,
  FileBox,
  Loader2,
  Package,
  PenTool,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
  WifiOff,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useToast } from '@/hooks/use-toast'
import { SUPABASE_SCHEMA_SQL } from '@/lib/migration-sql'
import type { CloudComponent } from '@/lib/components-server'
import type { ModelStats } from '@/components/three/GltfModel'

const ModelStage = dynamic(() => import('@/components/three/ModelStage'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading 3D…</div>
  ),
})

/* ------------------------------------------------------------------ */
/* Types & helpers                                                     */
/* ------------------------------------------------------------------ */

type BackendMode = 'database' | 'storage' | 'offline'

interface ComponentsResponse {
  mode: BackendMode
  status: {
    mode: BackendMode
    configured: boolean
    tablesReady: boolean
    storageReady: boolean
    projectRef: string
    url: string
    bucket: string
  }
  components: CloudComponent[]
}

const STUDIO_BG =
  'radial-gradient(ellipse at 50% 32%, #ffffff 0%, #f0f2f6 55%, #e2e5ea 100%)'

const CATEGORY_OPTIONS = ['Actuators', 'Sensors', 'Power', 'Controller', 'Custom…']

function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (d.getFullYear() <= 1971) return 'Built-in'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function prettifyFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '')
  const words = base.split(/[-_]+/).filter(Boolean)
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function kindLabel(c: CloudComponent): string {
  if (c.modelKind === 'procedural') return 'Procedural'
  const ext = c.fileName?.split('.').pop()?.toLowerCase()
  return (ext === 'stl' ? 'stl' : ext === 'gltf' ? 'gltf' : 'glb').toUpperCase()
}

function viewerKind(c: CloudComponent): 'gltf' | 'stl' {
  return c.modelKind === 'stl' ? 'stl' : 'gltf'
}

/* ------------------------------------------------------------------ */
/* The view                                                            */
/* ------------------------------------------------------------------ */

export function ModelStudio({
  onBack,
  onOpenServo,
}: {
  onBack: () => void
  onOpenServo: () => void
}) {
  const { toast } = useToast()

  const [data, setData] = useState<ComponentsResponse | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statsFor, setStatsFor] = useState<{ id: string; stats: ModelStats } | null>(null)
  const [wireframe, setWireframe] = useState(false)
  const [turntable, setTurntable] = useState(true)
  const [viewKey, setViewKey] = useState(0)

  // upload form
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('Actuators')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [checking, setChecking] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ---- catalog load ---- */
  const refresh = useCallback(async (selectId?: string): Promise<ComponentsResponse | null> => {
    try {
      const res = await fetch('/api/components')
      if (!res.ok) throw new Error('catalog request failed')
      const d: ComponentsResponse = await res.json()
      setData(d)
      setLoadFailed(false)
      if (selectId) setSelectedId(selectId)
      return d
    } catch {
      setLoadFailed(true)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    refresh().then((d) => {
      if (!cancelled && d) {
        const firstUpload = d.components.find((c) => c.source === 'user')
        if (firstUpload) setSelectedId(firstUpload.id)
      }
    })
    return () => {
      cancelled = true
    }
  }, [refresh])

  /* ---- derived ---- */
  const mode = data?.mode ?? null
  const uploads = useMemo(
    () =>
      (data?.components ?? [])
        .filter((c) => c.source === 'user')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data]
  )
  const builtins = useMemo(() => (data?.components ?? []).filter((c) => c.source === 'builtin'), [data])
  const selected = useMemo(
    () => data?.components.find((c) => c.id === selectedId) ?? null,
    [data, selectedId]
  )
  const selectedStats = selected && statsFor?.id === selected.id ? statsFor.stats : null

  /* ---- model stats channel (stable per selection) ---- */
  const handleStats = useCallback(
    (s: ModelStats) => {
      if (selectedId) setStatsFor({ id: selectedId, stats: s })
    },
    [selectedId]
  )

  /* ---- file picking ---- */
  const pickFile = useCallback(
    (f: File | null | undefined) => {
      if (!f) return
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!['glb', 'gltf', 'stl'].includes(ext)) {
        toast({
          title: 'Unsupported file type',
          description: 'Upload a .glb, .gltf or .stl model file (≤ 50 MB).',
        })
        return
      }
      setFile(f)
      if (!name.trim()) setName(prettifyFileName(f.name))
    },
    [name, toast]
  )

  /* ---- upload (XHR for real progress) ---- */
  const uploadFlow = useCallback(() => {
    if (!file || uploading) return
    if (!name.trim()) {
      toast({ title: 'Name the component', description: 'Give the model a name before uploading.' })
      return
    }
    const effectiveCategory = category === 'Custom…' ? customCategory.trim() : category
    if (!effectiveCategory) {
      toast({ title: 'Pick a category', description: 'Choose or name a category for the component.' })
      return
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('category', effectiveCategory)
    fd.append('description', description.trim())

    const xhr = new XMLHttpRequest()
    setUploading(true)
    setUploadProgress(0)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
      }
    }
    xhr.onload = () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const d: { component: CloudComponent; metadataSaved: boolean } = JSON.parse(xhr.responseText)
          setFile(null)
          setName('')
          setDescription('')
          setUploadProgress(0)
          if (fileInputRef.current) fileInputRef.current.value = ''
          refresh(d.component.id)
          toast({
            title: `${d.component.name} uploaded`,
            description: d.metadataSaved
              ? 'File stored in the models bucket; metadata saved to the components table.'
              : 'File stored in the models bucket. Run the one-time SQL migration below to activate the metadata layer.',
          })
        } catch {
          toast({ title: 'Upload finished', description: 'The response could not be parsed — refresh the list.' })
        }
      } else {
        let msg = 'The cloud storage service rejected the upload.'
        try {
          msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg
        } catch {}
        toast({ title: 'Upload failed', description: msg })
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      toast({ title: 'Upload failed', description: 'Network error while contacting the upload API.' })
    }
    xhr.open('POST', '/api/components/upload')
    xhr.send(fd)
  }, [file, uploading, name, category, customCategory, description, refresh, toast])

  /* ---- delete ---- */
  const deleteFlow = useCallback(
    async (c: CloudComponent) => {
      try {
        const res = await fetch(`/api/components/${encodeURIComponent(c.id)}`, { method: 'DELETE' })
        if (!res.ok) {
          const e = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(e.error ?? 'delete failed')
        }
        if (selectedId === c.id) setSelectedId(null)
        await refresh()
        toast({ title: `${c.name} deleted`, description: 'Removed from the cloud library and storage bucket.' })
      } catch (err) {
        toast({
          title: 'Delete failed',
          description: err instanceof Error ? err.message : 'The cloud service is unavailable.',
        })
      }
    },
    [selectedId, refresh, toast]
  )

  /* ---- clipboard ---- */
  const copyText = useCallback(
    async (text: string, what: string) => {
      try {
        await navigator.clipboard.writeText(text)
        toast({ title: `${what} copied to clipboard` })
      } catch {
        toast({ title: 'Copy failed', description: 'The browser blocked clipboard access.' })
      }
    },
    [toast]
  )

  /* ---- migration re-check ---- */
  const recheckMigration = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/components?refresh=1')
      const d: ComponentsResponse = await res.json()
      setData(d)
      if (d.mode === 'database') {
        toast({
          title: 'Database layer is live',
          description: 'The components table answered — built-ins seeded, metadata saving enabled.',
        })
      } else {
        toast({
          title: 'Tables still pending',
          description: 'The components table did not answer yet. Check the SQL ran without errors, then re-check.',
        })
      }
    } catch {
      toast({ title: 'Re-check failed', description: 'Could not reach the components API.' })
    } finally {
      setChecking(false)
    }
  }, [toast])

  /* ---- builtin navigation ---- */
  const openBuiltin = useCallback(
    (c: CloudComponent) => {
      if (c.slug === 'servo-motor') {
        onOpenServo()
        return
      }
      toast({
        title: `${c.name} opens here once modeled`,
        description: 'Its spec sheet, physics and AI profile are live — the procedural 3D model is in the queue.',
      })
    },
    [onOpenServo, toast]
  )

  const uploadDisabled =
    !file || uploading || !name.trim() || (category === 'Custom…' && !customCategory.trim())

  /* ================================================================ */
  /* Render                                                            */
  /* ================================================================ */

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit gap-1.5 text-muted-foreground"
          onClick={onBack}
          aria-label="Back to the library"
        >
          <ArrowLeft className="h-4 w-4" />
          Library
        </Button>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Model Studio<span className="text-amber-500">.</span>
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          The library&rsquo;s built-in components were born as code. This studio is the other
          on-ramp: export a model from OpenSCAD or CAD, upload the file, and it joins the same
          cloud library — stored in your Supabase project, rendered live in the browser, and
          listed in the machine-readable catalog the AI generation layer reads. Files live in the{' '}
          <span className="font-medium text-foreground">models</span> bucket; metadata lives in the{' '}
          <span className="font-medium text-foreground">components</span> table.
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge className="gap-1 border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <CloudUpload className="h-3 w-3" />
            GLB · glTF · STL · ≤ 50 MB
          </Badge>
          <Badge variant="secondary" className="gap-1 font-medium">
            <Box className="h-3 w-3" />
            Auto-fit WebGL viewer
          </Badge>
          {mode === 'database' && (
            <Badge className="gap-1 border-emerald-200 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <Database className="h-3 w-3" />
              Supabase database + storage
            </Badge>
          )}
          {mode === 'storage' && (
            <Badge variant="outline" className="gap-1 font-medium text-amber-600 dark:text-amber-400">
              <TriangleAlert className="h-3 w-3" />
              Storage live · metadata pending
            </Badge>
          )}
        </div>
      </div>

      {/* Connection status + migration panel */}
      <section className="mt-8" aria-label="Cloud connection status">
        {mode === null ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Probing the Supabase backend…
            </CardContent>
          </Card>
        ) : mode === 'database' ? (
          <Card className="border-emerald-200 dark:border-emerald-900">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Database className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    Database + Storage live
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Catalog rows and model files persist in{' '}
                    <span className="font-mono">{data?.status.projectRef}</span>.supabase.co — uploads save full
                    metadata and join the AI catalog automatically.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="font-mono text-[10px]">
                  bucket: {data?.status.bucket}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Postgres + RLS
                </Badge>
              </div>
            </CardContent>
          </Card>
        ) : mode === 'storage' ? (
          <Card className="border-amber-300 dark:border-amber-800">
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Storage live · metadata layer pending</p>
                    <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                      Files upload, list, render and delete right now. The service key cannot create
                      tables — paste this one-time SQL in the Supabase SQL Editor (Dashboard → SQL
                      Editor → New query) to activate the <span className="font-mono">components</span> +{' '}
                      <span className="font-mono">packs</span> tables. The app detects it instantly.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 font-medium"
                  onClick={recheckMigration}
                  disabled={checking}
                >
                  {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  I&rsquo;ve run it — re-check
                </Button>
              </div>
              <Collapsible>
                <CollapsibleTrigger className="text-xs font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400">
                  Show the migration SQL
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 rounded-lg border bg-muted/40">
                    <pre className="scroll-slim max-h-56 overflow-auto p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {SUPABASE_SCHEMA_SQL}
                    </pre>
                    <div className="flex items-center justify-between border-t px-3 py-2">
                      <span className="text-[11px] text-muted-foreground">
                        Also saved at <span className="font-mono">scripts/supabase-schema.sql</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1.5 text-xs font-medium"
                        onClick={() => copyText(SUPABASE_SCHEMA_SQL, 'Migration SQL')}
                      >
                        <Copy className="h-3 w-3" />
                        Copy SQL
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <WifiOff className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Cloud unreachable — local catalog</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The built-in component list below still renders; uploads will fail until the
                  backend answers. Retry in a moment.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {loadFailed && (
          <p className="mt-2 text-xs text-muted-foreground">
            The components API request failed — showing the last known catalog.
          </p>
        )}
      </section>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Boxes} label="Cloud components" value={String(data?.components.length ?? '—')} />
        <StatTile icon={CloudUpload} label="Your models" value={String(uploads.length)} />
        <StatTile icon={Package} label="Built-in catalog" value={String(builtins.length)} />
        <StatTile
          icon={Database}
          label="Backend mode"
          value={mode === 'database' ? 'Database' : mode === 'storage' ? 'Storage' : mode === null ? '…' : 'Offline'}
        />
      </div>

      {/* Main grid */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {/* Upload card */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  <CloudUpload className="h-4.5 w-4.5 text-amber-500" />
                  Upload a 3D model
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  The file goes to the <span className="font-mono">models</span> bucket; name and
                  category become its catalog metadata.
                </p>
              </div>

              {/* Dropzone */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Choose a model file to upload"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                  pickFile(e.dataTransfer.files?.[0])
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
                  dragActive
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40'
                    : 'border-border hover:border-amber-300 hover:bg-muted/40 dark:hover:border-amber-700'
                }`}
              >
                {file ? (
                  <>
                    <FileBox className="h-7 w-7 text-amber-500" />
                    <p className="max-w-full truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · click to replace</p>
                  </>
                ) : (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <CloudUpload className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">Drop a model here or click to browse</p>
                    <p className="text-xs text-muted-foreground">.glb · .gltf · .stl — up to 50 MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".glb,.gltf,.stl"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                  aria-hidden="true"
                />
              </div>

              {file && (
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{file.name}</span>
                    <span className="mx-1.5">·</span>
                    {formatBytes(file.size)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-500"
                    aria-label="Remove the selected file"
                    onClick={() => {
                      setFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    <span aria-hidden="true" className="text-sm leading-none">×</span>
                  </Button>
                </div>
              )}

              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="model-name" className="text-xs font-medium">
                    Component name
                  </Label>
                  <Input
                    id="model-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. N20 Micro Gear Motor"
                    maxLength={60}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full" aria-label="Component category">
                      <SelectValue placeholder="Pick a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {category === 'Custom…' && (
                    <Input
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Custom category name"
                      maxLength={30}
                      className="mt-1"
                      aria-label="Custom category name"
                    />
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="model-notes" className="text-xs font-medium">
                    Notes <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="model-notes"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Voltage, torque, mounting holes — anything the future spec sheet should remember."
                    rows={2}
                    maxLength={300}
                  />
                </div>
              </div>

              {uploading && (
                <div className="space-y-1.5" aria-live="polite">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Uploading… {uploadProgress}%
                  </p>
                </div>
              )}

              <Button
                className="w-full gap-1.5 font-medium"
                disabled={uploadDisabled}
                onClick={uploadFlow}
                aria-label="Upload the model to the cloud library"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading… {uploadProgress}%
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-4 w-4" />
                    Upload to cloud
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Cloud library card */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <Boxes className="h-4.5 w-4.5 text-amber-500" />
                    Cloud library
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {uploads.length} uploaded · {builtins.length} built-in
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label="Refresh the cloud library"
                  title="Refresh"
                  onClick={() => refresh()}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="scroll-slim flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto pr-1">
                {uploads.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No uploads yet — the first model you add appears here and in the 3D viewer.
                  </p>
                )}
                {uploads.map((c) => {
                  const active = selectedId === c.id
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Preview ${c.name}`}
                      onClick={() => setSelectedId(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedId(c.id)
                      }}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        active
                          ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'
                          : 'border-border hover:border-foreground/25 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <FileBox className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">{c.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {kindLabel(c)} · {formatBytes(c.fileSize)} · {formatDate(c.createdAt)}
                          {c.category !== 'Uploads' ? ` · ${c.category}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {active && <Eye className="mr-0.5 h-3.5 w-3.5 text-amber-500" />}
                        {c.modelUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={`Copy the public URL of ${c.name}`}
                            title="Copy public URL"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyText(c.modelUrl ?? '', 'Public URL')
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-500"
                          aria-label={`Delete ${c.name}`}
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteFlow(c)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}

                <p className="mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Built-in catalog
                </p>
                {builtins.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${c.name}`}
                    onClick={() => openBuiltin(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openBuiltin(c)
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight text-muted-foreground">
                        {c.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                        Procedural · {c.category}
                        {c.physics ? ` · ${c.physics.mass} g` : ''}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — the viewer */}
        <Card className="overflow-hidden">
          <CardContent className="flex h-full flex-col p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-sm font-semibold tracking-tight">
                  {selected ? selected.name : '3D viewer'}
                </h2>
                {selected && (
                  <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                    {kindLabel(selected)}
                  </Badge>
                )}
                {selected?.source === 'user' && (
                  <Badge variant="outline" className="shrink-0 gap-1 text-[10px] font-medium text-muted-foreground">
                    <CloudUpload className="h-2.5 w-2.5" />
                    Cloud upload
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Switch checked={turntable} onCheckedChange={setTurntable} aria-label="Toggle turntable rotation" />
                  Turntable
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Switch checked={wireframe} onCheckedChange={setWireframe} aria-label="Toggle wireframe view" />
                  Wireframe
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  aria-label="Reset the camera"
                  title="Reset view"
                  onClick={() => setViewKey((k) => k + 1)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {selected && selected.modelUrl ? (
              <div className="relative h-[380px] w-full md:h-[460px]" style={{ background: STUDIO_BG }}>
                <ModelStage
                  url={selected.modelUrl}
                  kind={viewerKind(selected)}
                  wireframe={wireframe}
                  autoRotate={turntable}
                  resetSignal={viewKey}
                  onStats={handleStats}
                />
                <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-amber-700 shadow-sm backdrop-blur dark:border-amber-800 dark:bg-zinc-900/90 dark:text-amber-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                  </span>
                  Live · WebGL
                </span>
              </div>
            ) : (
              <div className="flex h-[380px] w-full flex-col items-center justify-center gap-3 border-b bg-muted/20 md:h-[460px]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <Box className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Nothing selected</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Pick a model from the cloud library — or upload one — and it renders here,
                    auto-fitted to the frame.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 px-4 py-3">
              {selected && selected.modelUrl ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Box className="h-3 w-3" />
                      {selectedStats
                        ? `${selectedStats.triangles.toLocaleString()} triangles · ${selectedStats.vertices.toLocaleString()} vertices · ${selectedStats.meshes} ${selectedStats.meshes === 1 ? 'mesh' : 'meshes'}`
                        : 'Inspecting geometry…'}
                    </span>
                    <span>{formatBytes(selected.fileSize)}</span>
                    <span>{formatDate(selected.createdAt)}</span>
                    {selected.category !== 'Uploads' && <span>{selected.category}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="scroll-slim min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded border bg-muted/30 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
                      {selected.modelUrl}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5 text-xs font-medium"
                      onClick={() => copyText(selected.modelUrl ?? '', 'Public URL')}
                    >
                      <Copy className="h-3 w-3" />
                      Copy URL
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Mesh stats, file size and the public storage URL appear here when a model is
                  selected.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline explainer */}
      <div className="mt-8">
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
            {[
              {
                icon: PenTool,
                title: '1 · Design it',
                body: 'OpenSCAD, Fusion 360, FreeCAD, Blender — any tool that exports mesh geometry.',
              },
              {
                icon: FileBox,
                title: '2 · Export',
                body: 'Self-contained .glb keeps materials; .stl is the OpenSCAD native. Both upload fine.',
              },
              {
                icon: CloudUpload,
                title: '3 · Upload',
                body: 'The file joins your cloud library and the AI-readable catalog — the same pipeline the built-ins will use for OpenSCAD ports.',
              },
            ].map((step, i) => (
              <div key={step.title} className="flex flex-1 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <step.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
                {i < 2 && <ArrowRight className="ml-auto hidden h-4 w-4 shrink-0 text-muted-foreground/40 sm:block" />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small stat tile                                                     */
/* ------------------------------------------------------------------ */

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Box
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
