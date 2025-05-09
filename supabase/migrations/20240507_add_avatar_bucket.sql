-- Create avatar bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatar', 'avatar', true)
on conflict do nothing;

-- Create policies for avatar bucket
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'avatar' );

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatar' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatar' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatar' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
