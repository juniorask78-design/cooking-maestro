-- Cooking Maestro : schéma Supabase (comptes + sauvegarde cloud).
-- À exécuter dans l'éditeur SQL du projet Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Chef',
  created_at timestamptz not null default now()
);

create table if not exists public.saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.saves enable row level security;

-- Chacun ne lit et n'écrit que ses propres données.
create policy "profil: lecture perso" on public.profiles for select using (auth.uid() = id);
create policy "profil: écriture perso" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "sauvegarde: lecture perso" on public.saves for select using (auth.uid() = user_id);
create policy "sauvegarde: écriture perso" on public.saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
