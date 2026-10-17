/**
 * The one-time Supabase migration, as an in-app string.
 *
 * The service-role API key cannot run DDL (table creation is a dashboard /
 * personal-access-token operation), so the Model Studio shows this SQL with
 * a copy button whenever it detects that the database tables are missing.
 * The bucket (`models`) IS created automatically via the Storage API —
 * file upload/listing works even before this SQL runs.
 *
 * Keep in sync with scripts/supabase-schema.sql.
 */

export const SUPABASE_SCHEMA_SQL = `-- MechaLib x Supabase — platform schema v1 (run once in the SQL Editor)

create table if not exists public.components (
    id           uuid primary key default gen_random_uuid(),
    slug         text not null unique,
    name         text not null,
    category     text not null,
    status       text not null default 'available',
    tagline      text not null default '',
    description  text not null default '',
    specs        jsonb not null default '[]'::jsonb,
    physics      jsonb,
    commerce     jsonb,
    ai_profile   jsonb,
    model_kind   text not null default 'gltf'
                 check (model_kind in ('procedural', 'gltf', 'stl')),
    model_url    text,
    model_meta   jsonb,
    source       text not null default 'user'
                 check (source in ('builtin', 'user')),
    ports        int  not null default 0,
    dof          int  not null default 0,
    created_at   timestamptz not null default now()
);

create index if not exists components_category_idx on public.components (category);
create index if not exists components_source_idx   on public.components (source);

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

alter table public.components      enable row level security;
alter table public.packs           enable row level security;
alter table public.pack_components enable row level security;
alter table public.installs        enable row level security;

drop policy if exists components_public_read      on public.components;
drop policy if exists packs_public_read           on public.packs;
drop policy if exists pack_components_public_read on public.pack_components;
create policy components_public_read      on public.components     for select using (true);
create policy packs_public_read           on public.packs          for select using (true);
create policy pack_components_public_read on public.pack_components for select using (true);`
