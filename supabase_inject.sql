-- 1. Create public profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create projects metadata
create table public.projects (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  node_count integer default 0 not null,
  conn_count integer default 0 not null,
  layer_stats jsonb default '{}'::jsonb not null
);

-- 3. Create project canvas coordinate data
create table public.project_data (
  project_id text references public.projects(id) on delete cascade primary key,
  nodes jsonb default '[]'::jsonb not null,
  connections jsonb default '[]'::jsonb not null,
  canvas_state jsonb default '{"panX": 50, "panY": 80, "scale": 0.85}'::jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_data enable row level security;

-- 5. Setup profiles security policies
create policy "Allow profile reads" on public.profiles for select using (true);
create policy "Allow user profiles modification" on public.profiles for all using (auth.uid() = id);

-- 6. Setup projects security policies
create policy "Users manage own projects" on public.projects for all using (auth.uid() = user_id);

-- 7. Setup project_data security policies
create policy "Users manage own project data" on public.project_data for all using (
  exists (
    select 1 from public.projects 
    where public.projects.id = public.project_data.project_id 
    and public.projects.user_id = auth.uid()
  )
);
