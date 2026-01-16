-- Supabase Schema for Vibe PM
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  avatar_color text default '#d4a574',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Teams/Workspaces table
create table public.teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Team members junction table
create table public.team_members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(team_id, user_id)
);

-- Labels table
create table public.labels (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  name text not null,
  color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Kanban columns table
create table public.kanban_columns (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  title text not null,
  position integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Kanban cards table
create table public.kanban_cards (
  id uuid default uuid_generate_v4() primary key,
  column_id uuid references public.kanban_columns(id) on delete cascade not null,
  title text not null,
  description text,
  priority text default 'none' check (priority in ('high', 'medium', 'low', 'none')),
  assignee_id uuid references public.profiles(id) on delete set null,
  position integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Card labels junction table
create table public.card_labels (
  card_id uuid references public.kanban_cards(id) on delete cascade not null,
  label_id uuid references public.labels(id) on delete cascade not null,
  primary key (card_id, label_id)
);

-- Todos table
create table public.todos (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  text text not null,
  completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notes table
create table public.notes (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade unique not null,
  content text default '',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.labels enable row level security;
alter table public.kanban_columns enable row level security;
alter table public.kanban_cards enable row level security;
alter table public.card_labels enable row level security;
alter table public.todos enable row level security;
alter table public.notes enable row level security;

-- Profiles policies
create policy "Users can view all profiles" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Teams policies
create policy "Users can view teams they belong to" on public.teams
  for select using (
    id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Users can create teams" on public.teams
  for insert with check (auth.uid() = owner_id);

create policy "Team owners can update their teams" on public.teams
  for update using (owner_id = auth.uid());

create policy "Team owners can delete their teams" on public.teams
  for delete using (owner_id = auth.uid());

-- Team members policies
create policy "Users can view team members of their teams" on public.team_members
  for select using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Team owners can manage members" on public.team_members
  for all using (
    team_id in (select id from public.teams where owner_id = auth.uid())
  );

create policy "Users can add themselves to teams" on public.team_members
  for insert with check (user_id = auth.uid());

-- Labels policies
create policy "Users can view labels of their teams" on public.labels
  for select using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Team members can manage labels" on public.labels
  for all using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

-- Kanban columns policies
create policy "Users can view columns of their teams" on public.kanban_columns
  for select using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Team members can manage columns" on public.kanban_columns
  for all using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

-- Kanban cards policies
create policy "Users can view cards of their teams" on public.kanban_cards
  for select using (
    column_id in (
      select id from public.kanban_columns where team_id in (
        select team_id from public.team_members where user_id = auth.uid()
      )
    )
  );

create policy "Team members can manage cards" on public.kanban_cards
  for all using (
    column_id in (
      select id from public.kanban_columns where team_id in (
        select team_id from public.team_members where user_id = auth.uid()
      )
    )
  );

-- Card labels policies
create policy "Users can view card labels" on public.card_labels
  for select using (
    card_id in (
      select id from public.kanban_cards where column_id in (
        select id from public.kanban_columns where team_id in (
          select team_id from public.team_members where user_id = auth.uid()
        )
      )
    )
  );

create policy "Team members can manage card labels" on public.card_labels
  for all using (
    card_id in (
      select id from public.kanban_cards where column_id in (
        select id from public.kanban_columns where team_id in (
          select team_id from public.team_members where user_id = auth.uid()
        )
      )
    )
  );

-- Todos policies
create policy "Users can view todos of their teams" on public.todos
  for select using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Team members can manage todos" on public.todos
  for all using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

-- Notes policies
create policy "Users can view notes of their teams" on public.notes
  for select using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Team members can manage notes" on public.notes
  for all using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    '#d4a574'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to create default columns when team is created
create or replace function public.handle_new_team()
returns trigger as $$
begin
  -- Add owner as team member
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  -- Create default columns
  insert into public.kanban_columns (team_id, title, position) values
    (new.id, 'Todo', 0),
    (new.id, 'In Progress', 1),
    (new.id, 'Review', 2),
    (new.id, 'Complete', 3);

  -- Create default labels
  insert into public.labels (team_id, name, color) values
    (new.id, 'Bug', '#f87171'),
    (new.id, 'Feature', '#60a5fa'),
    (new.id, 'Design', '#c084fc'),
    (new.id, 'Docs', '#4ade80'),
    (new.id, 'Refactor', '#fbbf24');

  -- Create empty notes
  insert into public.notes (team_id, content)
  values (new.id, '');

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to set up team defaults
create trigger on_team_created
  after insert on public.teams
  for each row execute procedure public.handle_new_team();
