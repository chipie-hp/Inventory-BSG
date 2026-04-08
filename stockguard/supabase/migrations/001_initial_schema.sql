-- ============================================================
--  StockGuard — Complete Database Schema
--  Supabase / PostgreSQL
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('admin', 'manager', 'store_manager', 'clerk', 'requester');
create type movement_type as enum ('receipt', 'issue', 'adjustment', 'transfer', 'return');
create type adjustment_type as enum ('physical_count', 'spoilage', 'damage', 'theft', 'transfer', 'supplier_return', 'other');
create type requisition_status as enum ('draft', 'pending', 'approved', 'issued', 'rejected', 'cancelled');
create type alert_status as enum ('open', 'under_review', 'escalated', 'resolved', 'dismissed');
create type alert_severity as enum ('low', 'medium', 'high', 'critical');
create type grn_status as enum ('draft', 'submitted', 'verified', 'posted');
create type item_condition as enum ('good', 'damaged', 'partial');

-- ============================================================
-- STORES
-- ============================================================
create table stores (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  code        text not null unique,          -- e.g. 'A1', 'JTI', 'A10'
  location    text,
  zone        text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed the three stores
insert into stores (name, code, location, zone) values
  ('Alliance 1',  'A1',  'Zone A Premises', 'Zone A'),
  ('JTI',         'JTI', 'Zone B Premises', 'Zone B'),
  ('Area 10',     'A10', 'Zone C Premises', 'Zone C');

-- ============================================================
-- PROFILES  (extends Supabase auth.users)
-- ============================================================
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  role         user_role not null default 'clerk',
  is_active    boolean not null default true,
  is_flagged   boolean not null default false,
  flagged_reason text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- USER ↔ STORE ACCESS
-- ============================================================
create table user_store_access (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  store_id   uuid not null references stores(id) on delete cascade,
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  unique (user_id, store_id)
);

-- ============================================================
-- ITEM CATEGORIES
-- ============================================================
create table item_categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

insert into item_categories (name) values
  ('Dry Goods'), ('Fresh Produce'), ('Alcohol & Spirits'),
  ('Soft Drinks & Mixers'), ('Linen & Towels'),
  ('Cleaning Supplies'), ('Laundry Supplies'), ('Other');

-- ============================================================
-- ITEMS  (master item list)
-- ============================================================
create table items (
  id              uuid primary key default uuid_generate_v4(),
  code            text unique,                      -- e.g. ITM-001
  name            text not null,
  description     text,
  category_id     uuid references item_categories(id),
  unit_of_measure text not null default 'units',    -- kg, bottles, pcs, etc.
  reorder_point   numeric(12,2) not null default 0,
  is_active       boolean not null default true,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-generate item codes
create sequence item_code_seq start 1;
create or replace function generate_item_code()
returns trigger language plpgsql as $$
begin
  if new.code is null then
    new.code := 'ITM-' || lpad(nextval('item_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;
create trigger set_item_code before insert on items
  for each row execute function generate_item_code();

-- ============================================================
-- ITEM ↔ STORE  (which items exist in which stores, with levels)
-- ============================================================
create table store_items (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references stores(id) on delete cascade,
  item_id         uuid not null references items(id) on delete cascade,
  min_level       numeric(12,2) not null default 0,
  max_level       numeric(12,2) not null default 9999,
  current_qty     numeric(12,2) not null default 0,
  avg_unit_cost   numeric(12,4) not null default 0,  -- weighted average cost
  last_counted_at timestamptz,
  last_counted_by uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (store_id, item_id)
);

-- Computed column: stock_value
create or replace function store_item_value(si store_items)
returns numeric language sql stable as $$
  select si.current_qty * si.avg_unit_cost;
$$;

-- ============================================================
-- SUPPLIERS
-- ============================================================
create table suppliers (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  contact    text,
  phone      text,
  email      text,
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- GOODS RECEIVED NOTES  (GRN)
-- ============================================================
create table grns (
  id              uuid primary key default uuid_generate_v4(),
  grn_number      text unique not null,
  store_id        uuid not null references stores(id),
  supplier_id     uuid references suppliers(id),
  supplier_name   text,                   -- fallback if supplier not in system
  invoice_number  text,
  delivery_date   date not null default current_date,
  status          grn_status not null default 'draft',
  notes           text,
  total_value     numeric(12,2) generated always as (0) stored,  -- updated via trigger
  received_by     uuid not null references profiles(id),
  verified_by     uuid references profiles(id),
  verified_at     timestamptz,
  posted_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-generate GRN numbers
create sequence grn_seq start 1;
create or replace function generate_grn_number()
returns trigger language plpgsql as $$
begin
  new.grn_number := 'GRN-' || lpad(nextval('grn_seq')::text, 4, '0');
  return new;
end;
$$;
create trigger set_grn_number before insert on grns
  for each row execute function generate_grn_number();

-- ============================================================
-- GRN LINE ITEMS
-- ============================================================
create table grn_lines (
  id              uuid primary key default uuid_generate_v4(),
  grn_id          uuid not null references grns(id) on delete cascade,
  item_id         uuid not null references items(id),
  qty_ordered     numeric(12,2) not null default 0,
  qty_received    numeric(12,2) not null default 0,
  unit_cost       numeric(12,4) not null default 0,
  total_cost      numeric(12,2) generated always as (qty_received * unit_cost) stored,
  condition       item_condition not null default 'good',
  condition_notes text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- REQUISITIONS
-- ============================================================
create table requisitions (
  id              uuid primary key default uuid_generate_v4(),
  req_number      text unique not null,
  store_id        uuid not null references stores(id),
  department      text not null,
  purpose         text,
  status          requisition_status not null default 'pending',
  requested_by    uuid not null references profiles(id),
  approved_by     uuid references profiles(id),
  approved_at     timestamptz,
  issued_by       uuid references profiles(id),
  issued_at       timestamptz,
  rejected_by     uuid references profiles(id),
  rejected_at     timestamptz,
  rejection_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-generate REQ numbers
create sequence req_seq start 1;
create or replace function generate_req_number()
returns trigger language plpgsql as $$
begin
  new.req_number := 'REQ-' || lpad(nextval('req_seq')::text, 4, '0');
  return new;
end;
$$;
create trigger set_req_number before insert on requisitions
  for each row execute function generate_req_number();

-- ============================================================
-- REQUISITION LINE ITEMS
-- ============================================================
create table requisition_lines (
  id          uuid primary key default uuid_generate_v4(),
  req_id      uuid not null references requisitions(id) on delete cascade,
  item_id     uuid not null references items(id),
  qty_requested numeric(12,2) not null,
  qty_issued    numeric(12,2),
  unit_cost     numeric(12,4),
  notes         text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- STOCK MOVEMENTS  (append-only audit log)
-- ============================================================
create table stock_movements (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references stores(id),
  item_id         uuid not null references items(id),
  movement_type   movement_type not null,
  qty_in          numeric(12,2) not null default 0,
  qty_out         numeric(12,2) not null default 0,
  qty_before      numeric(12,2) not null,
  qty_after       numeric(12,2) not null,
  unit_cost       numeric(12,4),
  reference_type  text,   -- 'grn', 'requisition', 'adjustment', 'transfer'
  reference_id    uuid,
  reference_number text,
  notes           text,
  performed_by    uuid not null references profiles(id),
  created_at      timestamptz not null default now()
);
-- This table is never updated, only inserted — enforced by RLS

-- ============================================================
-- STOCK ADJUSTMENTS
-- ============================================================
create table stock_adjustments (
  id               uuid primary key default uuid_generate_v4(),
  adj_number       text unique not null,
  store_id         uuid not null references stores(id),
  item_id          uuid not null references items(id),
  adjustment_type  adjustment_type not null,
  qty_before       numeric(12,2) not null,
  qty_adjusted     numeric(12,2) not null,   -- positive = add, negative = remove
  qty_after        numeric(12,2) not null,
  reason           text not null,
  evidence_notes   text,
  status           text not null default 'pending', -- pending, approved, rejected
  requested_by     uuid not null references profiles(id),
  approved_by      uuid references profiles(id),
  approved_at      timestamptz,
  rejected_reason  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create sequence adj_seq start 1;
create or replace function generate_adj_number()
returns trigger language plpgsql as $$
begin
  new.adj_number := 'ADJ-' || lpad(nextval('adj_seq')::text, 4, '0');
  return new;
end;
$$;
create trigger set_adj_number before insert on stock_adjustments
  for each row execute function generate_adj_number();

-- ============================================================
-- PHYSICAL COUNTS
-- ============================================================
create table physical_counts (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references stores(id),
  item_id         uuid not null references items(id),
  system_qty      numeric(12,2) not null,
  counted_qty     numeric(12,2) not null,
  variance        numeric(12,2) generated always as (counted_qty - system_qty) stored,
  counted_by      uuid not null references profiles(id),
  count_date      timestamptz not null default now(),
  notes           text,
  alert_raised    boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- THEFT / DISCREPANCY ALERTS
-- ============================================================
create table alerts (
  id              uuid primary key default uuid_generate_v4(),
  store_id        uuid not null references stores(id),
  item_id         uuid not null references items(id),
  severity        alert_severity not null default 'medium',
  status          alert_status not null default 'open',
  title           text not null,
  description     text,
  variance_qty    numeric(12,2),
  variance_value  numeric(12,2),
  physical_count_id uuid references physical_counts(id),
  is_repeat       boolean not null default false,   -- flagged multiple weeks
  repeat_count    int not null default 1,
  staff_on_duty   text[],                          -- array of staff names/ids
  last_issued_by  uuid references profiles(id),
  investigation_notes text,
  action_taken    text,
  raised_by       uuid references profiles(id),    -- null = auto-raised
  resolved_by     uuid references profiles(id),
  resolved_at     timestamptz,
  escalated_to    uuid references profiles(id),
  escalated_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- INTER-STORE TRANSFERS
-- ============================================================
create table transfers (
  id              uuid primary key default uuid_generate_v4(),
  transfer_number text unique not null,
  from_store_id   uuid not null references stores(id),
  to_store_id     uuid not null references stores(id),
  item_id         uuid not null references items(id),
  qty             numeric(12,2) not null,
  unit_cost       numeric(12,4),
  reason          text,
  status          text not null default 'pending',  -- pending, approved, completed, cancelled
  requested_by    uuid not null references profiles(id),
  approved_by     uuid references profiles(id),
  completed_by    uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create sequence tr_seq start 1;
create or replace function generate_transfer_number()
returns trigger language plpgsql as $$
begin
  new.transfer_number := 'TR-' || lpad(nextval('tr_seq')::text, 4, '0');
  return new;
end;
$$;
create trigger set_transfer_number before insert on transfers
  for each row execute function generate_transfer_number();

-- ============================================================
-- TRIGGERS — auto-update updated_at
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger upd_stores before update on stores for each row execute function set_updated_at();
create trigger upd_profiles before update on profiles for each row execute function set_updated_at();
create trigger upd_items before update on items for each row execute function set_updated_at();
create trigger upd_store_items before update on store_items for each row execute function set_updated_at();
create trigger upd_grns before update on grns for each row execute function set_updated_at();
create trigger upd_requisitions before update on requisitions for each row execute function set_updated_at();
create trigger upd_adjustments before update on stock_adjustments for each row execute function set_updated_at();
create trigger upd_alerts before update on alerts for each row execute function set_updated_at();
create trigger upd_transfers before update on transfers for each row execute function set_updated_at();

-- ============================================================
-- FUNCTION: post a GRN and update stock
-- ============================================================
create or replace function post_grn(p_grn_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  r grn_lines%rowtype;
  v_store_id uuid;
  v_qty_before numeric;
  v_new_qty numeric;
  v_new_cost numeric;
begin
  select store_id into v_store_id from grns where id = p_grn_id;

  for r in select * from grn_lines where grn_id = p_grn_id loop
    -- get current stock
    select current_qty, avg_unit_cost
      into v_qty_before, v_new_cost
      from store_items
      where store_id = v_store_id and item_id = r.item_id;

    if not found then
      insert into store_items (store_id, item_id, current_qty, avg_unit_cost)
        values (v_store_id, r.item_id, r.qty_received, r.unit_cost);
      v_qty_before := 0;
      v_new_qty := r.qty_received;
      v_new_cost := r.unit_cost;
    else
      -- weighted average cost
      v_new_qty := v_qty_before + r.qty_received;
      v_new_cost := case when v_new_qty > 0
        then ((v_qty_before * v_new_cost) + (r.qty_received * r.unit_cost)) / v_new_qty
        else r.unit_cost end;
      update store_items
        set current_qty = v_new_qty, avg_unit_cost = v_new_cost
        where store_id = v_store_id and item_id = r.item_id;
    end if;

    -- movement log
    insert into stock_movements (store_id, item_id, movement_type, qty_in, qty_before, qty_after, unit_cost, reference_type, reference_id, performed_by)
      values (v_store_id, r.item_id, 'receipt', r.qty_received, v_qty_before, v_new_qty, r.unit_cost, 'grn', p_grn_id, p_user_id);
  end loop;

  update grns set status = 'posted', posted_at = now() where id = p_grn_id;
end;
$$;

-- ============================================================
-- FUNCTION: issue a requisition and update stock
-- ============================================================
create or replace function post_requisition(p_req_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  r requisition_lines%rowtype;
  v_store_id uuid;
  v_qty_before numeric;
  v_qty_after numeric;
  v_unit_cost numeric;
begin
  select store_id into v_store_id from requisitions where id = p_req_id;

  for r in select * from requisition_lines where req_id = p_req_id loop
    select current_qty, avg_unit_cost
      into v_qty_before, v_unit_cost
      from store_items
      where store_id = v_store_id and item_id = r.item_id;

    if v_qty_before < r.qty_requested then
      raise exception 'Insufficient stock for item %', r.item_id;
    end if;

    v_qty_after := v_qty_before - r.qty_requested;

    update store_items
      set current_qty = v_qty_after
      where store_id = v_store_id and item_id = r.item_id;

    update requisition_lines
      set qty_issued = r.qty_requested, unit_cost = v_unit_cost
      where id = r.id;

    insert into stock_movements (store_id, item_id, movement_type, qty_out, qty_before, qty_after, unit_cost, reference_type, reference_id, performed_by)
      values (v_store_id, r.item_id, 'issue', r.qty_requested, v_qty_before, v_qty_after, v_unit_cost, 'requisition', p_req_id, p_user_id);
  end loop;

  update requisitions
    set status = 'issued', issued_by = p_user_id, issued_at = now()
    where id = p_req_id;
end;
$$;

-- ============================================================
-- FUNCTION: apply approved adjustment
-- ============================================================
create or replace function post_adjustment(p_adj_id uuid, p_approver_id uuid)
returns void language plpgsql security definer as $$
declare
  v_adj stock_adjustments%rowtype;
begin
  select * into v_adj from stock_adjustments where id = p_adj_id;

  update store_items
    set current_qty = v_adj.qty_after
    where store_id = v_adj.store_id and item_id = v_adj.item_id;

  insert into stock_movements (store_id, item_id, movement_type, qty_in, qty_out, qty_before, qty_after, reference_type, reference_id, notes, performed_by)
    values (
      v_adj.store_id, v_adj.item_id, 'adjustment',
      case when v_adj.qty_adjusted > 0 then v_adj.qty_adjusted else 0 end,
      case when v_adj.qty_adjusted < 0 then abs(v_adj.qty_adjusted) else 0 end,
      v_adj.qty_before, v_adj.qty_after,
      'adjustment', p_adj_id, v_adj.reason, p_approver_id
    );

  update stock_adjustments
    set status = 'approved', approved_by = p_approver_id, approved_at = now()
    where id = p_adj_id;

  -- raise theft alert if type is theft or large negative
  if v_adj.adjustment_type = 'theft' or
     (v_adj.qty_adjusted < 0 and abs(v_adj.qty_adjusted) > v_adj.qty_before * 0.1) then
    insert into alerts (store_id, item_id, severity, title, description, variance_qty, raised_by)
      values (v_adj.store_id, v_adj.item_id,
        case when v_adj.adjustment_type = 'theft' then 'high'::alert_severity else 'medium'::alert_severity end,
        'Stock variance detected',
        'Adjustment of ' || v_adj.qty_adjusted || ' units. Reason: ' || v_adj.reason,
        v_adj.qty_adjusted, p_approver_id);
  end if;
end;
$$;

-- ============================================================
-- FUNCTION: physical count → auto-raise alert on variance
-- ============================================================
create or replace function process_physical_count(
  p_store_id uuid, p_item_id uuid, p_counted_qty numeric,
  p_counter_id uuid, p_notes text default null
)
returns uuid language plpgsql security definer as $$
declare
  v_system_qty numeric;
  v_variance numeric;
  v_count_id uuid;
  v_item_name text;
  v_existing_alerts int;
begin
  select current_qty into v_system_qty from store_items
    where store_id = p_store_id and item_id = p_item_id;

  v_variance := p_counted_qty - v_system_qty;

  insert into physical_counts (store_id, item_id, system_qty, counted_qty, counted_by, notes)
    values (p_store_id, p_item_id, v_system_qty, p_counted_qty, p_counter_id, p_notes)
    returning id into v_count_id;

  -- raise alert if variance exists
  if v_variance != 0 then
    select name into v_item_name from items where id = p_item_id;
    select count(*) into v_existing_alerts from alerts
      where store_id = p_store_id and item_id = p_item_id and status in ('open','under_review','escalated');

    insert into alerts (
      store_id, item_id, severity, title, description,
      variance_qty, physical_count_id, is_repeat, repeat_count, raised_by
    ) values (
      p_store_id, p_item_id,
      case when abs(v_variance) / nullif(v_system_qty, 0) > 0.2 then 'high'
           when abs(v_variance) / nullif(v_system_qty, 0) > 0.05 then 'medium'
           else 'low' end,
      v_item_name || ' — variance detected',
      'System: ' || v_system_qty || ', Counted: ' || p_counted_qty || ', Variance: ' || v_variance,
      v_variance, v_count_id,
      v_existing_alerts > 0, v_existing_alerts + 1,
      p_counter_id
    );

    update physical_counts set alert_raised = true where id = v_count_id;
  end if;

  return v_count_id;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table stores enable row level security;
alter table profiles enable row level security;
alter table user_store_access enable row level security;
alter table items enable row level security;
alter table item_categories enable row level security;
alter table store_items enable row level security;
alter table grns enable row level security;
alter table grn_lines enable row level security;
alter table requisitions enable row level security;
alter table requisition_lines enable row level security;
alter table stock_movements enable row level security;
alter table stock_adjustments enable row level security;
alter table physical_counts enable row level security;
alter table alerts enable row level security;
alter table transfers enable row level security;
alter table suppliers enable row level security;

-- Helper function: get current user's role
create or replace function auth_role()
returns user_role language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

-- Helper function: can user access store?
create or replace function can_access_store(p_store_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('admin','manager')
    union
    select 1 from user_store_access where user_id = auth.uid() and store_id = p_store_id
  );
$$;

-- Stores: everyone who is authenticated can read stores they have access to
create policy "stores_select" on stores for select using (
  auth.uid() is not null and (
    auth_role() in ('admin','manager') or
    exists (select 1 from user_store_access where user_id = auth.uid() and store_id = stores.id)
  )
);
create policy "stores_all_admin" on stores for all using (auth_role() = 'admin');

-- Profiles: users can read their own; admins read all
create policy "profiles_own" on profiles for select using (id = auth.uid());
create policy "profiles_admin" on profiles for all using (auth_role() = 'admin');
create policy "profiles_insert_self" on profiles for insert with check (id = auth.uid());

-- Store items: visible to users with store access
create policy "store_items_select" on store_items for select using (can_access_store(store_id));
create policy "store_items_mutate" on store_items for all using (
  auth_role() in ('admin','manager','store_manager') and can_access_store(store_id)
);

-- GRNs
create policy "grns_select" on grns for select using (can_access_store(store_id));
create policy "grns_insert" on grns for insert with check (
  auth_role() in ('admin','manager','store_manager') and can_access_store(store_id)
);
create policy "grns_update" on grns for update using (
  auth_role() in ('admin','manager','store_manager') and can_access_store(store_id)
);

-- GRN Lines
create policy "grn_lines_select" on grn_lines for select using (
  exists (select 1 from grns where id = grn_lines.grn_id and can_access_store(store_id))
);
create policy "grn_lines_insert" on grn_lines for insert with check (
  exists (select 1 from grns where id = grn_lines.grn_id and can_access_store(store_id))
);

-- Requisitions
create policy "req_select" on requisitions for select using (
  can_access_store(store_id) or requested_by = auth.uid()
);
create policy "req_insert" on requisitions for insert with check (can_access_store(store_id));
create policy "req_update" on requisitions for update using (
  can_access_store(store_id) and auth_role() in ('admin','manager','store_manager')
);

-- Stock movements (read-only for all, insert by system functions)
create policy "movements_select" on stock_movements for select using (can_access_store(store_id));
create policy "movements_insert" on stock_movements for insert with check (
  auth_role() in ('admin','manager','store_manager')
);

-- Adjustments
create policy "adj_select" on stock_adjustments for select using (can_access_store(store_id));
create policy "adj_insert" on stock_adjustments for insert with check (can_access_store(store_id));
create policy "adj_update" on stock_adjustments for update using (
  auth_role() in ('admin','manager','store_manager') and can_access_store(store_id)
);

-- Alerts
create policy "alerts_select" on alerts for select using (can_access_store(store_id));
create policy "alerts_update" on alerts for update using (
  auth_role() in ('admin','manager') or can_access_store(store_id)
);

-- Physical counts
create policy "counts_select" on physical_counts for select using (can_access_store(store_id));
create policy "counts_insert" on physical_counts for insert with check (can_access_store(store_id));

-- Items & Categories: authenticated users read; admin/manager write
create policy "items_select" on items for select using (auth.uid() is not null);
create policy "items_mutate" on items for all using (auth_role() in ('admin','manager'));
create policy "cats_select" on item_categories for select using (auth.uid() is not null);

-- Suppliers
create policy "suppliers_select" on suppliers for select using (auth.uid() is not null);
create policy "suppliers_mutate" on suppliers for all using (auth_role() in ('admin','manager','store_manager'));

-- User store access: admins manage
create policy "usa_select" on user_store_access for select using (
  user_id = auth.uid() or auth_role() in ('admin','manager')
);
create policy "usa_mutate" on user_store_access for all using (auth_role() = 'admin');

-- Transfers
create policy "tr_select" on transfers for select using (
  can_access_store(from_store_id) or can_access_store(to_store_id)
);
create policy "tr_insert" on transfers for insert with check (can_access_store(from_store_id));
create policy "tr_update" on transfers for update using (auth_role() in ('admin','manager'));

-- ============================================================
-- VIEWS
-- ============================================================

-- Stock overview per store
create or replace view v_store_stock as
select
  si.id,
  s.id as store_id, s.name as store_name, s.code as store_code, s.zone,
  i.id as item_id, i.code as item_code, i.name as item_name, i.unit_of_measure,
  c.name as category,
  si.current_qty, si.min_level, si.max_level, si.avg_unit_cost,
  round(si.current_qty * si.avg_unit_cost, 2) as stock_value,
  case
    when si.current_qty <= 0 then 'out_of_stock'
    when si.current_qty <= si.min_level then 'low'
    when si.current_qty <= si.min_level * 1.5 then 'watch'
    else 'good'
  end as stock_status,
  si.last_counted_at, si.updated_at
from store_items si
join stores s on s.id = si.store_id
join items i on i.id = si.item_id
left join item_categories c on c.id = i.category_id;

-- Store summary (for dashboard KPIs)
create or replace view v_store_summary as
select
  s.id as store_id, s.name as store_name, s.code, s.zone,
  count(si.id) as total_items,
  coalesce(sum(si.current_qty * si.avg_unit_cost), 0) as total_value,
  count(case when si.current_qty <= si.min_level and si.current_qty > 0 then 1 end) as low_stock_count,
  count(case when si.current_qty <= 0 then 1 end) as out_of_stock_count,
  count(case when a.status in ('open','escalated') then 1 end) as open_alerts
from stores s
left join store_items si on si.store_id = s.id
left join alerts a on a.store_id = s.id and a.status in ('open','escalated')
group by s.id, s.name, s.code, s.zone;

-- Movement log with names
create or replace view v_movements as
select
  sm.id, sm.created_at,
  s.name as store_name, s.code as store_code,
  i.name as item_name, i.code as item_code, i.unit_of_measure,
  sm.movement_type, sm.qty_in, sm.qty_out, sm.qty_before, sm.qty_after,
  sm.unit_cost, sm.reference_type, sm.reference_number, sm.notes,
  p.full_name as performed_by_name
from stock_movements sm
join stores s on s.id = sm.store_id
join items i on i.id = sm.item_id
join profiles p on p.id = sm.performed_by
order by sm.created_at desc;

-- Alert view with context
create or replace view v_alerts as
select
  a.id, a.created_at, a.updated_at,
  s.name as store_name, s.code as store_code,
  i.name as item_name, i.code as item_code,
  a.severity, a.status, a.title, a.description,
  a.variance_qty, a.variance_value, a.is_repeat, a.repeat_count,
  a.investigation_notes, a.action_taken,
  p_raised.full_name as raised_by_name,
  p_last.full_name as last_issued_by_name,
  p_resolved.full_name as resolved_by_name
from alerts a
join stores s on s.id = a.store_id
join items i on i.id = a.item_id
left join profiles p_raised on p_raised.id = a.raised_by
left join profiles p_last on p_last.id = a.last_issued_by
left join profiles p_resolved on p_resolved.id = a.resolved_by
order by
  case a.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
  a.created_at desc;

-- ============================================================
-- SEED SAMPLE DATA
-- ============================================================

-- Sample items
insert into items (name, unit_of_measure, category_id) values
  ('Basmati Rice',        'kg',      (select id from item_categories where name='Dry Goods')),
  ('Cooking Oil 5L',      'bottles', (select id from item_categories where name='Dry Goods')),
  ('Table Salt 1kg',      'packets', (select id from item_categories where name='Dry Goods')),
  ('Chicken Breast',      'kg',      (select id from item_categories where name='Fresh Produce')),
  ('JW Black Label 750ml','bottles', (select id from item_categories where name='Alcohol & Spirits')),
  ('Red Bull 250ml',      'cans',    (select id from item_categories where name='Soft Drinks & Mixers')),
  ('Coca-Cola 500ml',     'bottles', (select id from item_categories where name='Soft Drinks & Mixers')),
  ('Bath Towels Standard','pcs',     (select id from item_categories where name='Linen & Towels')),
  ('Bed Sheets Queen',    'pcs',     (select id from item_categories where name='Linen & Towels')),
  ('Washing Powder 5kg',  'bags',    (select id from item_categories where name='Laundry Supplies'));

-- Wire items to stores with min/max levels and opening stock
insert into store_items (store_id, item_id, min_level, max_level, current_qty, avg_unit_cost)
select s.id, i.id, sl.min_l, sl.max_l, sl.qty, sl.cost
from (values
  ('A1',  'Basmati Rice',         20,  200, 120, 2.80),
  ('A1',  'Cooking Oil 5L',        6,   48,  18, 8.50),
  ('A1',  'Table Salt 1kg',        5,   30,   8, 1.20),
  ('A1',  'Bath Towels Standard', 30,  150,  42,15.00),
  ('A1',  'Bed Sheets Queen',     20,  100,  32,30.00),
  ('JTI', 'JW Black Label 750ml', 12,  120,   6,36.00),
  ('JTI', 'Red Bull 250ml',       24,  240,  34, 1.80),
  ('JTI', 'Coca-Cola 500ml',      24,  300,  88, 0.75),
  ('A10', 'Chicken Breast',       10,   80,  23, 7.00),
  ('A10', 'Cooking Oil 5L',        6,   48,  14, 8.50),
  ('A10', 'Washing Powder 5kg',    4,   40,  14,12.00)
) as sl(store_code, item_name, min_l, max_l, qty, cost)
join stores s on s.code = sl.store_code
join items i on i.name = sl.item_name;
