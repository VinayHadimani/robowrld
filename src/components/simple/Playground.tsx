'use client'

import * as React from 'react'
import { useCallback, useMemo, useRef } from 'react'
import type * as THREE from 'three'
import { Pause, Play, Plus, PlugZap, Trash2, Unlink } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  isPowerSource,
  poweredIds as computePoweredIds,
  type Attach,
  type ConnectRequest,
  type Move,
  type PlayComponent,
  type PlayInstance,
} from '@/lib/playground'
import type { LiveCandidate, StageActions, WireAnchors } from './PlaygroundStage'

const PlaygroundStage = dynamic(() => import('./PlaygroundStage'), { ssr: false })

/**
 * Playground — where people add components and build their robot.
 * Toolbar (add / run / clear) + the 3D canvas + a small panel for the
 * selected component.
 *
 * Power rule: a component only runs while it is attached — directly or
 * through a chain of attached components — to a power source (a 9V
 * battery). Free-standing components stay still no matter what.
 *
 * Connection rule: nothing snaps together on its own. Bring a component
 * near another one and the app ASKS FOR PERMISSION — "Connect" wires
 * them, "Don't connect" leaves them apart.
 */
export function Playground({
  components,
  instances,
  onAdd,
  onRemove,
  onDropCommit,
  onAttach,
  onDetach,
  onClear,
}: {
  components: PlayComponent[] | null
  instances: PlayInstance[]
  onAdd: (component: PlayComponent) => void
  onRemove: (id: string) => void
  onDropCommit: (moves: Move[], attach: Attach | null) => void
  /** Wire two components together after the user grants permission. */
  onAttach: (childId: string, parentId: string) => void
  onDetach: (id: string) => void
  onClear: () => void
}) {
  const [running, setRunning] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const groups = useRef<Map<string, THREE.Group>>(new Map())
  const anchors = useRef<Map<string, WireAnchors>>(new Map())
  // The connection waiting for the user's answer, plus the live proximity
  // target (for the toolbar hint) and the bridge into the canvas.
  const [request, setRequest] = React.useState<ConnectRequest | null>(null)
  const [candidate, setCandidate] = React.useState<LiveCandidate | null>(null)
  const stageActions = useRef<StageActions>({})
  // Radix dismisses the dialog after an answer button too — this flag tells
  // that late dismissal apart from a real "no" (Esc / overlay / cancel).
  const answered = useRef(false)

  const powered = useMemo(() => computePoweredIds(instances), [instances])

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  const commit = useCallback(
    (moves: Move[], attach: Attach | null) => onDropCommit(moves, attach),
    [onDropCommit]
  )

  // A component was dropped near a connectable one — ask for permission.
  const handleConnectRequest = useCallback((childId: string, parentId: string) => {
    answered.current = false
    setRequest({ childId, parentId })
  }, [])

  const handleCandidateChange = useCallback((c: LiveCandidate | null) => {
    setCandidate(c)
  }, [])

  const confirmConnect = useCallback(() => {
    answered.current = true
    const req = request
    setRequest(null)
    if (req) onAttach(req.childId, req.parentId)
  }, [request, onAttach])

  const declineConnect = useCallback(() => {
    if (answered.current) return // already answered via a button
    answered.current = true
    const req = request
    setRequest(null)
    if (req) stageActions.current.separate?.(req.childId, req.parentId)
  }, [request])

  const selected = instances.find((i) => i.id === selectedId) ?? null
  const selectedPowered = selected ? powered.has(selected.id) : false
  const requestChild = request ? instances.find((i) => i.id === request.childId) : null
  const requestParent = request ? instances.find((i) => i.id === request.parentId) : null
  const candidateInst = candidate ? instances.find((i) => i.id === candidate.id) : null

  return (
    <div className="flex h-[calc(100dvh-3rem)] w-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={!components || components.length === 0}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            {(components ?? []).map((c) => (
              <DropdownMenuItem key={c.slug} onClick={() => onAdd(c)}>
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant={running ? 'secondary' : 'default'}
          onClick={() => setRunning((r) => !r)}
          disabled={instances.length === 0}
        >
          {running ? (
            <>
              <Pause className="mr-1 h-4 w-4" aria-hidden />
              Stop
            </>
          ) : (
            <>
              <Play className="mr-1 h-4 w-4" aria-hidden />
              Run
            </>
          )}
        </Button>

        {instances.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm('Remove everything from the playground?')) onClear()
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" aria-hidden />
            Clear
          </Button>
        )}

        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
          {candidateInst && candidate
            ? candidate.connectable
              ? `Release to ask about connecting to ${candidateInst.name}`
              : `${candidateInst.name} can't connect — batteries power components, not each other`
            : "Bring components close and you'll be asked before they connect · only battery-powered components run"}
        </span>
      </div>

      {/* Canvas */}
      <div className="relative min-h-0 flex-1">
        <PlaygroundStage
          instances={instances}
          running={running}
          poweredIds={powered}
          selectedId={selectedId}
          groups={groups}
          anchors={anchors}
          onSelect={handleSelect}
          onDropCommit={commit}
          onConnectRequest={handleConnectRequest}
          onCandidateChange={handleCandidateChange}
          actionsRef={stageActions}
        />

        {instances.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-lg bg-background/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm">
              Nothing here yet — add a 9V battery and connect components to it to make them run.
            </p>
          </div>
        )}

        {selected && (
          <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-lg border bg-background/95 px-4 py-2 shadow-sm">
            <span className="text-sm font-medium">{selected.name}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                isPowerSource(selected.kind)
                  ? 'bg-emerald-100 text-emerald-800'
                  : selectedPowered
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {isPowerSource(selected.kind) ? (
                <>
                  <PlugZap className="h-3 w-3" aria-hidden />
                  Power source
                </>
              ) : selectedPowered ? (
                <>
                  <PlugZap className="h-3 w-3" aria-hidden />
                  Powered
                </>
              ) : (
                'No power'
              )}
            </span>
            {selected.parentId && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Detach ${selected.name}`}
                onClick={() => {
                  onDetach(selected.id)
                  setSelectedId(null)
                }}
              >
                <Unlink className="h-4 w-4" aria-hidden />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${selected.name}`}
              onClick={() => {
                onRemove(selected.id)
                setSelectedId(null)
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {/* Permission to connect — asked whenever a component is brought
          near another connectable one. */}
      <AlertDialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open) declineConnect()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Connect {requestChild?.name ?? 'this component'} to {requestParent?.name ?? 'that one'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be wired together so power can flow between them — only components
              connected to a battery run. Nothing is connected until you allow it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={declineConnect}>Don't connect</AlertDialogCancel>
            <AlertDialogAction onClick={confirmConnect}>Connect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
