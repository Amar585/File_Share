-- Create tables with proper RLS policies
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone,
  username text unique,
  
  constraint username_length check (char_length(username) >= 3)
);

create table public.files (
  id uuid default uuid_generate_v4() primary key not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  size bigint not null,
  type text not null,
  path text not null,
  user_id uuid references auth.users on delete cascade not null,
  shared boolean default false
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.files enable row level security;

-- Create policies
create policy "Users can view own profile"
  on public.profiles for select
  using ( auth.uid() = id );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

create policy "Users can view own files"
  on public.files for select
  using ( auth.uid() = user_id OR shared = true );

create policy "Users can insert own files"
  on public.files for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own files"
  on public.files for update
  using ( auth.uid() = user_id );

create policy "Users can delete own files"
  on public.files for delete
  using ( auth.uid() = user_id );

-- Create function to handle new user creation
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

-- Create trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Set up storage
insert into storage.buckets (id, name)
values ('files', 'files')
on conflict do nothing;

create policy "Users can view own files in storage"
  on storage.objects for select
  using ( auth.uid() = owner );

create policy "Users can upload own files to storage"
  on storage.objects for insert
  with check ( auth.uid() = owner );

create policy "Users can update own files in storage"
  on storage.objects for update
  using ( auth.uid() = owner );

create policy "Users can delete own files in storage"
  on storage.objects for delete
  using ( auth.uid() = owner );
