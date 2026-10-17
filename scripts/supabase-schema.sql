-- ═══════════════════════════════════════════════════════════════════════
-- MechaLib × Supabase — platform schema v1
--
-- Run ONCE in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste this file → Run.
--
-- What it creates:
--   components       → the catalog (specs/physics/commerce/AI as JSONB)
--   packs            → the pack catalog
--   pack_components  → pack ↔ component membership
--   installs         → per-session pack installs (the future user-account key)
--   + RLS            → public read of the catalog, service-key-only writes
--
-- The 'models' storage bucket is already created (via the Storage API).
-- The app seeds the 7 built-in components automatically the first time it
-- reads an empty components table. Safe to re-run (idempotent).
--
-- NOTE: keep in sync with src/lib/migration-sql.ts (the in-app copy shown
--       in the Model Studio migration panel).
-- ═══════════════════════════════════════════════════════════════════════

-- 1 ─ Components ──────────────────────────────────────────────────────────
create table if not exists public.components (
    id           uuid primary key default gen_random_uuid(),
    slug         text not null unique,
    name         text not null,
    category     text not null,
    status       text not null default 'available',
    tagline      text not null default '',
    description  text not null default '',
    specs        jsonb not null default '[]'::jsonb,   -- [{label, value}]
    physics      jsonb,                                -- mass, dimensions, materials…
    commerce     jsonb,                                -- manufacturer, priceUsd, vendors…
    ai_profile   jsonb,                                -- summary, capabilities, constraints…
    model_kind   text not null default 'gltf'
                 check (model_kind in ('procedural', 'gltf', 'stl')),
    model_url    text,                                 -- public Storage URL when kind ≠ procedural
    model_meta   jsonb,                                -- {fileName, fileSize, mime} for uploads
    source       text not null default 'user'
                 check (source in ('builtin', 'user')),
    ports        int  not null default 0,              -- connection-contract port count
    dof          int  not null default 0,              -- degrees-of-freedom count
    created_at   timestamptz not null default now()
);

create index if not exists components_category_idx on public.components (category);
create index if not exists components_source_idx   on public.components (source);

-- 2 ─ Packs ───────────────────────────────────────────────────────────────
create table if not exists public.packs (
    id          text primary key,
    name        text not null,
    tagline     text not null default '',
    description text not null default '',
    icon        text not null default 'bot',
    size_mb     numeric not null default 0,
    price_label text not null default 'Free · Beta',
    level       text not null default 'Beginner',
    featured    boolean not null default false,
    sort_order  int not null default 0
);

create table if not exists public.pack_components (
    pack_id         text not null references public.packs (id) on delete cascade,
    component_slug  text not null,
    primary key (pack_id, component_slug)
);

create table if not exists public.installs (
    id           uuid primary key default gen_random_uuid(),
    session_id   text not null,
    pack_id      text not null references public.packs (id) on delete cascade,
    installed_at timestamptz not null default now(),
    unique (session_id, pack_id)
);

create index if not exists installs_session_idx on public.installs (session_id);

-- 3 ─ Row Level Security ──────────────────────────────────────────────────
-- Public can READ the catalog (an anon key works for reads); only the app
-- server (service role, which bypasses RLS) can write. installs get no anon
-- policy at all — session state stays server-side only.
alter table public.components     enable row level security;
alter table public.packs           enable row level security;
alter table public.pack_components enable row level security;
alter table public.installs        enable row level security;

drop policy if exists components_public_read       on public.components;
drop policy if exists packs_public_read            on public.packs;
drop policy if exists pack_components_public_read  on public.pack_components;
create policy components_public_read      on public.components     for select using (true);
create policy packs_public_read           on public.packs          for select using (true);
create policy pack_components_public_read on public.pack_components for select using (true);
