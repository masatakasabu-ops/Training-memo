-- ルート図の保存先。Supabase の SQL Editor に貼り付けて1回だけ実行する

-- ルート図1件 = 1行。軌跡と地図の画像は Storage（maps バケット）に置く
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default '',
  race_date date,
  activity_id text,
  settings jsonb not null default '{}',   -- 合わせ点・区間・色の区切りなど
  notes jsonb not null default '{}',      -- レッグごとの反省
  summary jsonb not null default '{}',    -- 一覧に出す距離・時間・ロス合計
  has_map boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routes enable row level security;

drop policy if exists "own routes" on public.routes;
create policy "own routes" on public.routes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 地図の画像と軌跡。<ユーザーID>/<ルートID>/ の下に置き、自分のフォルダしか触れない
insert into storage.buckets (id, name, public)
values ('maps', 'maps', false)
on conflict (id) do nothing;

drop policy if exists "own map files" on storage.objects;
create policy "own map files" on storage.objects
  for all to authenticated
  using (bucket_id = 'maps' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'maps' and (storage.foldername(name))[1] = auth.uid()::text);
