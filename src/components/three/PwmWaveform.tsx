'use client'

/**
 * PwmWaveform — a tiny animated oscilloscope that renders the PWM signal a
 * real servo would receive for the current angle: a 50 Hz pulse train where
 * the pulse width maps 0–180° to 0.5–2.5 ms.
 *
 * The waveform scrolls in real time via requestAnimationFrame and is drawn by
 * mutating a single <path> element — no React re-renders per frame.
 */

import { useEffect, useRef } from 'react'

const W = 320
const H = 92
const Y_HIGH = 26
const Y_LOW = 64
const PERIOD = 20 // ms — 50 Hz
const WINDOW_MS = 62 // ~3 periods visible

export function PwmWaveform({ angle }: { angle: number }) {
  const pathRef = useRef<SVGPathElement>(null)
  const angleRef = useRef(angle)

  useEffect(() => {
    angleRef.current = angle
  }, [angle])

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()

    const draw = (now: number) => {
      const t = now - t0
      const pw = 0.5 + (angleRef.current / 180) * 2 // ms
      const start = t - WINDOW_MS
      let k = Math.floor(start / PERIOD)
      let d = ''
      let first = true

      for (; k * PERIOD < t + PERIOD; k++) {
        const p0 = k * PERIOD
        const xA = ((p0 - start) / WINDOW_MS) * W
        const xB = ((p0 + pw - start) / WINDOW_MS) * W
        const xC = ((p0 + PERIOD - start) / WINDOW_MS) * W
        d += `${first ? 'M' : 'L'} ${xA.toFixed(1)} ${Y_LOW} `
        d += `L ${xA.toFixed(1)} ${Y_HIGH} L ${xB.toFixed(1)} ${Y_HIGH} L ${xB.toFixed(1)} ${Y_LOW} `
        d += `L ${Math.min(xC, W).toFixed(1)} ${Y_LOW} `
        first = false
      }

      pathRef.current?.setAttribute('d', d)
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-950 p-2"
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[92px] w-full" aria-hidden="true">
        {/* faint reference lines */}
        <line x1={0} y1={Y_HIGH} x2={W} y2={Y_HIGH} stroke="#27272a" strokeWidth={1} strokeDasharray="3 5" />
        <line x1={0} y1={(Y_HIGH + Y_LOW) / 2} x2={W} y2={(Y_HIGH + Y_LOW) / 2} stroke="#27272a" strokeWidth={1} strokeDasharray="2 6" />
        <line x1={0} y1={Y_LOW} x2={W} y2={Y_LOW} stroke="#27272a" strokeWidth={1} strokeDasharray="3 5" />
        {/* live trace */}
        <path
          ref={pathRef}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.55))' }}
        />
      </svg>
    </div>
  )
}
