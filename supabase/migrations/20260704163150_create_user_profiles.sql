-- Create the user_profiles table
create table public.user_profiles (
    id uuid references auth.users (id) not null primary key,
    name text,
    email text,
    is_approved boolean default false not null,
    profile text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.user_profiles enable row level security;

-- Policy to allow users to read only their own profile
create policy "Users can view own profile." on public.user_profiles
    for select using (auth.uid() = id);

-- Trigger function to create a user_profile after a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.user_profiles (id, email, name, profile)
    values (
        new.id,
        new.email,
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'profile'
    );
    return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on insert into auth.users
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
