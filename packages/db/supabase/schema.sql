create extension if not exists "uuid-ossp";

create type public.project_status as enum ('draft', 'modeling', 'review', 'approved', 'archived');
create type public.member_role as enum ('owner', 'engineer', 'reviewer', 'viewer');

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_approved boolean not null default false,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'engineer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  purpose text not null,
  valuation_date date not null,
  status public.project_status not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subject_properties (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  address text not null,
  city text not null,
  state text not null,
  property_type text not null,
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comparable_imports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  storage_path text,
  row_count integer not null default 0,
  raw_columns text[] not null default '{}',
  imported_by uuid not null references auth.users(id),
  imported_at timestamptz not null default now()
);

create table public.dataset_snapshots (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_import_id uuid references public.comparable_imports(id),
  comparables jsonb not null,
  variables jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.model_runs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  dataset_snapshot_id uuid references public.dataset_snapshots(id),
  rule_pack jsonb not null,
  candidates jsonb not null,
  selected_candidate_id text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.report_snapshots (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  model_run_id uuid not null references public.model_runs(id),
  candidate_model_id text not null,
  approved_by uuid not null references auth.users(id),
  payload jsonb not null,
  html text not null,
  created_at timestamptz not null default now()
);

create index on public.organization_memberships(user_id);
create index on public.projects(organization_id);
create index on public.subject_properties(project_id);
create index on public.comparable_imports(project_id);
create index on public.dataset_snapshots(project_id);
create index on public.model_runs(project_id);
create index on public.report_snapshots(project_id);

alter table public.user_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.subject_properties enable row level security;
alter table public.comparable_imports enable row level security;
alter table public.dataset_snapshots enable row level security;
alter table public.model_runs enable row level security;
alter table public.report_snapshots enable row level security;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = org_id
      and memberships.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_project(project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects projects
    where projects.id = project_id
      and public.is_org_member(projects.organization_id)
  );
$$;

create policy "members can read organizations"
on public.organizations for select
using (public.is_org_member(id));

create policy "members can read memberships"
on public.organization_memberships for select
using (public.is_org_member(organization_id));

create policy "owners can manage memberships"
on public.organization_memberships for all
using (
  exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = organization_memberships.organization_id
      and memberships.user_id = auth.uid()
      and memberships.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = organization_memberships.organization_id
      and memberships.user_id = auth.uid()
      and memberships.role = 'owner'
  )
);

create policy "members can read projects"
on public.projects for select
using (public.is_org_member(organization_id));

create policy "engineers can manage projects"
on public.projects for all
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "members can read subject properties"
on public.subject_properties for select
using (public.can_access_project(project_id));

create policy "members can write subject properties"
on public.subject_properties for all
using (public.can_access_project(project_id))
with check (public.can_access_project(project_id));

create policy "members can read comparable imports"
on public.comparable_imports for select
using (public.can_access_project(project_id));

create policy "members can write comparable imports"
on public.comparable_imports for all
using (public.can_access_project(project_id))
with check (public.can_access_project(project_id));

create policy "members can read dataset snapshots"
on public.dataset_snapshots for select
using (public.can_access_project(project_id));

create policy "members can write dataset snapshots"
on public.dataset_snapshots for insert
with check (public.can_access_project(project_id));

create policy "members can read model runs"
on public.model_runs for select
using (public.can_access_project(project_id));

create policy "members can write model runs"
on public.model_runs for insert
with check (public.can_access_project(project_id));

create policy "members can read report snapshots"
on public.report_snapshots for select
using (public.can_access_project(project_id));

create policy "members can create report snapshots"
on public.report_snapshots for insert
with check (public.can_access_project(project_id));

-- trigger to create a profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, is_approved, role)
  values (new.id, new.email, false, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- User profiles RLS
create policy "users can read own profile"
on public.user_profiles for select
using (auth.uid() = id);

-- Note: The admin check is omitted to prevent infinite recursion.
-- Supabase Dashboard uses the postgres/service_role which bypasses RLS naturally.
-- If UI admin tools are added later, we should check admin status via auth.users metadata or a separate security definer function.
