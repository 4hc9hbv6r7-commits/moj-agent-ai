-- Threat Intel Agent — pełny schemat Supabase (Lekcje 5-7)
-- Wklej ten skrypt w Supabase Dashboard -> SQL Editor -> Run
--
-- Ten skrypt startuje "od zera": usuwa istniejące tabele/funkcję/polityki
-- i tworzy je na nowo z kolumną user_id + Row Level Security od samego początku.
-- (Kopia starych danych — jeśli były — jest w lokalnym folderze /backups projektu.)

create extension if not exists vector;

-- 0. Wyczyść istniejący stan (bezpieczne przy ponownym uruchomieniu)
drop function if exists match_documents(vector, double precision, integer);
drop table if exists messages cascade;
drop table if exists conversations cascade;
drop table if exists documents cascade;
drop table if exists user_profiles cascade;
drop table if exists reports cascade;
drop table if exists consultations cascade;
drop table if exists briefings cascade;
drop table if exists webhook_events cascade;

-- 1. Tabele

create table conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  title text,
  user_id uuid not null references auth.users(id) on delete cascade
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  conversation_id uuid references conversations(id) on delete cascade,
  role text,
  content text
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  name text,
  preferences jsonb default '{}'::jsonb
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text,
  content text,
  embedding vector(768),
  metadata jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete cascade
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  topic text not null,
  content text not null,
  user_id uuid not null references auth.users(id) on delete cascade
);

create table consultations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  scheduled_at timestamptz not null unique,
  message text
);

-- Wywoływana przez cron (bez sesji użytkownika), więc user_id jest opcjonalny.
create table briefings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  content text not null,
  date date not null,
  user_id uuid references auth.users(id) on delete cascade
);

-- Wywoływana przez zewnętrzny webhook (bez sesji użytkownika).
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  type text not null,
  data jsonb not null,
  analysis text not null
);

-- 2. Row Level Security — każdy user widzi/edytuje TYLKO swoje wiersze

alter table conversations enable row level security;
alter table messages enable row level security;
alter table documents enable row level security;
alter table user_profiles enable row level security;
alter table reports enable row level security;
alter table consultations enable row level security;
alter table briefings enable row level security;
alter table webhook_events enable row level security;

create policy "conversations_owner" on conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "messages_owner" on messages
  for all using (
    exists (select 1 from conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  );

create policy "documents_owner" on documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_profiles_owner" on user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "reports_owner" on reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every logged-in user can SEE all booked slots (needed to check availability),
-- but can only create bookings under their own user_id.
create policy "consultations_read_all" on consultations
  for select using (auth.uid() is not null);

create policy "consultations_insert_own" on consultations
  for insert with check (auth.uid() = user_id);

-- Endpoint cron (/api/cron/morning) nie ma sesji użytkownika — wstawia
-- przez anon key, więc zapis/odczyt musi być otwarty (dane nieprywatne: pogoda/kursy).
create policy "briefings_insert_public" on briefings
  for insert with check (true);

create policy "briefings_select_public" on briefings
  for select using (true);

-- Endpoint webhooka (/api/webhook) nie ma sesji użytkownika — te same zasady co briefings.
create policy "webhook_events_insert_public" on webhook_events
  for insert with check (true);

create policy "webhook_events_select_public" on webhook_events
  for select using (true);

-- 3. match_documents (RAG) — wyszukiwanie semantyczne tylko we własnych dokumentach

create function match_documents(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (id uuid, title text, content text, metadata jsonb, similarity float)
language plpgsql stable
as $$
begin
  return query
  select
    documents.id,
    documents.title,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.user_id = auth.uid()
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
