'use client'

import type { PlayComponent } from '@/lib/playground'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export function ComponentList({
  components,
  loading,
  error,
  onOpen,
  onRetry,
}: {
  components: PlayComponent[] | null
  loading: boolean
  error: boolean
  onOpen: (slug: string) => void
  onRetry: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:py-14">
      {loading && (
        <div className="space-y-3" aria-label="Loading components">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {error && (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load the components.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && components && (
        <ul className="divide-y divide-border">
          {components.map((c) => (
            <li key={c.slug}>
              <button
                type="button"
                onClick={() => onOpen(c.slug)}
                className="group -mx-3 flex w-full items-baseline justify-between gap-4 rounded-lg px-3 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-lg font-normal group-hover:font-medium">{c.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{c.category}</span>
              </button>
            </li>
          ))}
          {components.length === 0 && (
            <li className="py-16 text-center text-sm text-muted-foreground">
              No components yet.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
