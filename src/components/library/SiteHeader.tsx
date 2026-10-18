'use client'

import { Box, Bot, CloudUpload, LayoutGrid } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/library/ThemeToggle'

export type AppView = 'library' | 'servo-motor' | 'assembly-lab' | 'studio'

export function SiteHeader({
  view,
  onNavigate,
}: {
  view: AppView
  onNavigate: (view: AppView) => void
}) {
  const navItems = [
    { id: 'library' as const, label: 'Library', icon: LayoutGrid },
    { id: 'assembly-lab' as const, label: 'Assembly Lab', icon: Bot },
    { id: 'studio' as const, label: 'Model Studio', icon: CloudUpload },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <button
            className="flex items-center gap-2.5"
            onClick={() => onNavigate('library')}
            aria-label="Go to library"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
              <Box className="h-4.5 w-4.5" strokeWidth={2.2} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">MechaLib</span>
          </button>
          <Badge variant="outline" className="hidden text-[10px] font-medium text-muted-foreground sm:inline-flex">
            beta
          </Badge>
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {navItems.map((item) => {
            const active = view === item.id || (item.id === 'library' && view === 'servo-motor')
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden gap-1.5 font-medium md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Assembly-ready
          </Badge>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
