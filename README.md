# RoboWrld — 3D Robotics Component Playground

A minimal 3D robotics sandbox: browse a library of robot components, inspect a virtual version of each machine, drop them into a playground, wire them together and make them run.

Built with **Next.js 16 + React Three Fiber**, backed by **Supabase** (Postgres + Storage).

## What it does

- **Component library** — a plain list of component names (servo motor, 9V battery, motors, uploaded models…). Click one to open its detail page.
- **Detail view** — an interactive 3D model of the real machine plus a short description and a few key specs, and one button: **Add to Playground**.
- **Playground** — the building surface. Add any component, drag it around the floor, and assemble your robot.
- **Permission-based connections** — drag a component near another and the app asks before connecting anything. A pulsing ring shows what you're hovering: green = connectable, red = not (batteries power components, they don't chain onto each other). Release, confirm the dialog, and the two are wired together with red/black power cables.
- **Power gating** — components **never run on their own**. Servos only sweep, motors only spin, LEDs only light when a wire path leads back to a **9V battery** (directly or through a chain). Press Run with nothing connected and everything stays perfectly still.
- **Persistence** — your playground layout and connections persist in the browser (localStorage); the component catalog persists in Supabase.

## Quick start

```bash
git clone https://github.com/VinayHadimani/robowrld.git
cd robowrld
bun install          # or npm install
cp .env.example .env # then fill in your Supabase keys (see below)
bun run dev          # or npm run dev → http://localhost:3000
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` → `.env` (or `.env.local`) and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — Dashboard → Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Dashboard → Project Settings → API → service_role secret (**server-side only**)
3. Run the one-time schema SQL: open the Supabase **SQL Editor**, paste the contents of [`scripts/supabase-schema.sql`](scripts/supabase-schema.sql), and execute it. This creates the `components`, `packs`, `pack_components` and `installs` tables plus public-read RLS policies.
4. Create a public `models` storage bucket (50 MB file limit) — or let `scripts/supabase-init-remote.sh` do it (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in your environment).

The app self-detects its backend mode and degrades gracefully:

| Mode | When | Behavior |
|------|------|----------|
| `database` | Tables exist | Full catalog in Postgres, built-ins auto-seed, uploads save metadata |
| `storage` | Bucket reachable, tables missing | Bucket listing + built-in constants; SQL is surfaced in-app |
| `offline` | No credentials | Built-in constants only |

## Tech stack

- **Next.js 16** (App Router, API routes) + React 19 + TypeScript
- **React Three Fiber + drei + three.js** — all 3D models (servo, 9V battery, uploaded GLB/GLTF/STL)
- **Supabase** — Postgres catalog, Storage for 3D model files
- **Prisma / SQLite** — local fallback store for packs
- **Tailwind CSS 4 + shadcn/ui** — UI

## Project structure

```
src/
  app/
    page.tsx                    # 3 views: list | component detail | playground
    api/components/             # GET list, POST upload (multipart → Supabase Storage), DELETE
    api/catalog/                # machine-readable catalog JSON
    api/packs/                  # pack install/uninstall (session cookie)
  components/
    simple/                     # ComponentList, ComponentView, Playground, PlaygroundStage
    three/                      # ServoMotor, Battery9V, GltfModel (GLB/GLTF/STL), stages
  lib/
    component-schema.ts         # single source of truth: specs, physics, commerce, AI profiles
    components-server.ts        # server layer: upload/list/delete, seeding, mode detection
    playground.ts               # playground types, connectability rules, power-graph helpers
    supabase-server.ts          # admin client + health probe
scripts/
  supabase-schema.sql           # one-time migration: tables + RLS + built-in seeds
  supabase-probe.sh             # backend capability probe (env-var credentials)
  supabase-init-remote.sh       # creates the 'models' bucket (env-var credentials)
  *.png                         # verification screenshots from the build sessions
```

## API overview

| Route | Purpose |
|-------|---------|
| `GET /api/components` | Catalog + backend mode (`?refresh=1` busts cache) |
| `POST /api/components/upload` | Multipart GLB/GLTF/STL (≤50 MB) → Storage + metadata |
| `DELETE /api/components/[id]` | Remove an upload (built-ins protected) |
| `GET /api/catalog` | AI-ready JSON catalog (robotics-platform.catalog/1.0) |
| `GET/POST /api/packs` | Component packs, per-session installs |

## Core mechanics

- **Connectability** (`areConnectable`): every pair is connectable except battery ↔ battery.
- **Power graph** (`poweredIds`): undirected reachability from any 9V battery across parent/child links — a component runs iff it's in a group that contains a battery.
- **Connection flow**: proximity ring → release → preview snap → permission dialog → confirm wires + power flows / decline pushes the piece back out.

## Notes

- The `service_role` key bypasses RLS — keep it server-side only, and rotate it if it ever leaks.
- Free-tier Supabase projects pause after ~7 idle days (Dashboard → Restore); the app degrades gracefully meanwhile.
