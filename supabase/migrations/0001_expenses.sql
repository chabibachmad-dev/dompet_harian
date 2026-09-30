-- Tabel-tabel untuk "Dompet Harian" -- dibuat di Supabase project yang SAMA
-- dengan ringkasan_harian, jadi sengaja tidak menyentuh tabel `summaries`,
-- `push_subscriptions`, atau `chat_messages` yang sudah ada di sana.
--
-- Beda dengan ringkasan_harian (yang paknya kode akses tunggal + RLS
-- "zero policy" lewat Edge Function), di sini beneran pakai Supabase Auth per
-- pengguna (email/password atau Google), jadi RLS-nya dibatasi per user_id =
-- auth.uid() -- dan Vite/PWA-nya boleh langsung baca/tulis lewat
-- supabase-js pakai anon key, tanpa perlu Edge Function untuk CRUD biasa.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  category text not null,
  note text,
  -- Bukan file gambar yang disimpan di Supabase -- cuma link ke file yang
  -- sudah diupload ke Google Drive lewat Google Apps Script (lihat
  -- gas/Code.gs). File asli & thumbnail-nya ada sepenuhnya di Drive.
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.expenses.receipt_url is
  'Link file foto struk di Google Drive (hasil upload lewat Google Apps Script), bukan file yang disimpan di Supabase.';

create index if not exists expenses_user_date_idx
  on public.expenses (user_id, expense_date desc, created_at desc);

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
  for select using (auth.uid() = user_id);

create policy "expenses_insert_own" on public.expenses
  for insert with check (auth.uid() = user_id);

create policy "expenses_update_own" on public.expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses_delete_own" on public.expenses
  for delete using (auth.uid() = user_id);

-- Trigger kecil supaya updated_at ikut ter-update tiap kali baris diubah
-- (dipakai waktu edit pengeluaran).
create or replace function public.set_expenses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row
  execute function public.set_expenses_updated_at();

-- Kategori kustom per pengguna. Kategori BAWAAN (Makanan, Transport, dst)
-- sengaja tidak disimpan di sini -- itu daftar tetap yang hidup di kode
-- frontend (src/categories.js) supaya semua pengguna baru langsung punya
-- kategori dasar tanpa perlu seed data. Tabel ini cuma untuk kategori
-- TAMBAHAN yang dibuat sendiri oleh tiap pengguna.
create table if not exists public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.custom_categories enable row level security;

create policy "custom_categories_select_own" on public.custom_categories
  for select using (auth.uid() = user_id);

create policy "custom_categories_insert_own" on public.custom_categories
  for insert with check (auth.uid() = user_id);

create policy "custom_categories_delete_own" on public.custom_categories
  for delete using (auth.uid() = user_id);
