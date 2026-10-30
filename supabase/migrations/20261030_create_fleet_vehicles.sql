-- ==============================================================================
-- Migration: Create fleet_vehicles table with strict Super Admin RLS Policies
-- Date: 2026-10-30
-- Description: Vehicle Fleet Inventory for Couriers & Drivers with Tax, KIR,
--              Service Due dates, WhatsApp Contact, and Fuel Barcodes.
-- ==============================================================================

-- 1. Create fleet_vehicles Table
create table if not exists public.fleet_vehicles (
    id uuid primary key default gen_random_uuid(),
    plate_number text not null,
    vehicle_type text not null check (vehicle_type in ('motor', 'mobil')),
    assigned_person_id text,
    assigned_person_name text,
    assigned_role text check (assigned_role in ('kurir', 'driver')),
    assigned_person_phone text,
    tax_due_date date not null,
    kir_due_date date,
    service_due_date date not null,
    service_details text,
    fuel_barcode_url text,
    fuel_barcode_code text,
    notes text,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint uq_fleet_vehicles_plate unique (plate_number)
);

-- 2. Performance Indexes
create index if not exists idx_fleet_vehicles_plate on public.fleet_vehicles (plate_number);
create index if not exists idx_fleet_vehicles_assigned_person on public.fleet_vehicles (assigned_person_id);
create index if not exists idx_fleet_vehicles_tax_due on public.fleet_vehicles (tax_due_date);
create index if not exists idx_fleet_vehicles_kir_due on public.fleet_vehicles (kir_due_date) where kir_due_date is not null;
create index if not exists idx_fleet_vehicles_service_due on public.fleet_vehicles (service_due_date);

-- 3. Automatic updated_at Trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fleet_vehicles_updated_at on public.fleet_vehicles;
create trigger trg_fleet_vehicles_updated_at
    before update on public.fleet_vehicles
    for each row
    execute function public.handle_updated_at();

-- 4. Enable and Force Row Level Security (RLS)
alter table public.fleet_vehicles enable row level security;
alter table public.fleet_vehicles force row level security;

-- 5. Helper Function to Check if Current User is Super Admin
-- Wrapped in security definer with cached auth check
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select coalesce(
        (select (auth.jwt()->>'role') = 'super_admin'),
        (select (auth.jwt()->'app_metadata'->>'role') = 'super_admin'),
        (select (auth.jwt()->'user_metadata'->>'role') = 'super_admin'),
        exists (
            select 1 from public.users
            where id = (select auth.uid())
            and role in ('super_admin', 'superadmin')
        ),
        false
    );
$$;

-- Revoke execute from public/anon, grant only to authenticated
revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated, service_role;

-- 6. Super Admin Only Policies (CRUD)
drop policy if exists "Super admins can select fleet vehicles" on public.fleet_vehicles;
create policy "Super admins can select fleet vehicles"
    on public.fleet_vehicles
    for select
    to authenticated
    using ((select public.is_super_admin()));

drop policy if exists "Super admins can insert fleet vehicles" on public.fleet_vehicles;
create policy "Super admins can insert fleet vehicles"
    on public.fleet_vehicles
    for insert
    to authenticated
    with check ((select public.is_super_admin()));

drop policy if exists "Super admins can update fleet vehicles" on public.fleet_vehicles;
create policy "Super admins can update fleet vehicles"
    on public.fleet_vehicles
    for update
    to authenticated
    using ((select public.is_super_admin()))
    with check ((select public.is_super_admin()));

drop policy if exists "Super admins can delete fleet vehicles" on public.fleet_vehicles;
create policy "Super admins can delete fleet vehicles"
    on public.fleet_vehicles
    for delete
    to authenticated
    using ((select public.is_super_admin()));
