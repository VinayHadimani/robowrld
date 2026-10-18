# RoboWrld — 3D Robotics Component Playground

A minimal 3D robotics sandbox: browse a library of robot components, inspect a virtual version of each machine, drop them into a playground, wire them together and make them run.

Built with **Next.js 16 + React Three Fiber**, backed by **Supabase** (Postgres + Storage).

## What it does

- **Component library** — nine exact-replica components (servo motor, 9V battery, Arduino Uno, DC gear motor, stepper, ultrasonic sensor, IR sensor, speed controller, LiPo pack, plus uploaded models). Click one to open its detail page.
- **Ultra-real replicas** — every built-in part is a datasheet-exact procedural model with its real anatomy: the MG996R's black-PBT/brushed-aluminium case sandwich and printed TowerPro sticker; the PP3's vinyl wrap with printed "9V" label and real 12.7 mm-spaced brass snap terminals; the Uno R3's full silkscreen (ARDUINO UNO wordmark, every pin label drawn from the same coordinates as the 3D headers), USB-B, barrel jack, DIP-28 ATmega with legs, crystal, tact button and LEDs; the HC-SR04's perforated-mesh transducer cans; the LiPo's printed wrap + yellow XT60; phillips screws, gold header pins and Dupont plugs everywhere the real parts have them.
- **Detail view** — an interactive 3D model of the real machine plus a short description and a few key specs, and one button: **Add to Playground**.
- **Playground** — the building surface. Add any component, drag it around the floor, and assemble your robot.
- **Real-life connections** — parts only connect if their real connectors and voltages match, and the app explains why when they don't. A 9V battery snaps onto a motor's power leads (6–12 V) and the Arduino's VIN jack (7–12 V); a servo's 3-pin lead (4.8–7.2 V) plugs into the Arduino's 5 V header or an ESC's BEC — never straight onto the 9V snap. A LiPo's XT60 (11.1 V) feeds ESCs, controllers and motors. Sensors take 5 V logic — controllers and BECs only. A stepper **never** wires straight to any battery: it needs a chopper driver board (A4988/DRV8825) the library doesn't stock yet, exactly like real life. Two power sources can't power each other; two consumers can't power each other either.
- **Permission-based connections** — drag a component near another and the app asks before wiring anything. A pulsing ring shows what you're hovering: green = compatible, red = not (with the reason in the toolbar — e.g. "a stepper never wires straight to a battery or ESC — it needs a current-controlled driver board…"). Release, confirm the dialog, and the two are wired between their actual connectors.
- **Visible wiring** — every connection renders as a real cable between the mated ports: a red + black pair from the battery's brass +/− snap terminals (or the LiPo's XT60) to each consumer (fanning out side by side when one source feeds several things), and an orange/red/brown 3-wire ribbon from the Arduino's header or the ESC's BEC to servos and sensors.
- **Power gating** — components **never run on their own**. Nothing animates unless a valid wire path leads back to a power source: battery → DC gear motor (shaft spins), battery → Arduino → servo (sweeps), LiPo → ESC → motor. Cut any link and everything downstream freezes. LEDs light the way real ones do (the Uno's ON LED, the ESC's BEC LED, the IR sensor's power LED).
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

- **Electrical ports** (`ELEC_PORTS` in `src/lib/playground.ts`): every component kind declares real ports — the 9V battery's snap terminals (out, 9 V), the Arduino's VIN jack (in, 7–12 V) + 5 V pin header (out), a servo's 3-pin signal lead (in, 4.8–7.2 V), generic power leads on uploaded models (in, 3–12 V).
- **Real-life mating** (`connectBetween`): a connection exists iff one side provides power at a voltage the other accepts. Battery → motor ✓, battery → Arduino ✓, Arduino → servo ✓, battery → servo ✗ (over-voltage), source ↔ source ✗, consumer ↔ consumer ✗ — each refusal carries a human-readable reason.
- **Power graph** (`poweredIds`): directed voltage-checked propagation from the batteries through the parent/provider chain (the Arduino passes its VIN power through as 5 V on its header) — a component runs iff it has a valid path to a battery.
- **Connection flow**: proximity ring (green/red + reason) → release → preview snap → permission dialog naming the actual ports → confirm wires the real connectors + power flows / decline pushes the piece back out.
- **Persistence**: the playground (positions, links, mated ports) survives reloads; old saves are migrated to the new rules — impossible links are dropped, reversed links re-oriented so the provider is the parent.

## Notes

- The `service_role` key bypasses RLS — keep it server-side only, and rotate it if it ever leaks.
- Free-tier Supabase projects pause after ~7 idle days (Dashboard → Restore); the app degrades gracefully meanwhile.
