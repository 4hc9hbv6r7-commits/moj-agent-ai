-- Warsztat 1: Supabase setup — tabele dla agenta (Lekcja 5)
-- Wklej ten skrypt w Supabase Dashboard -> SQL Editor -> Run

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text,
  updated_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  conversation_id uuid,
  role text,
  content text
);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text,
  preferences jsonb default '{}'::jsonb
);

-- RLS celowo wyłączone na tym etapie (włączymy w Lekcji 7)
alter table conversations disable row level security;
alter table messages disable row level security;
alter table user_profiles disable row level security;
