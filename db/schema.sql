-- Cold Call Tracker schema (Neon Postgres)

create table if not exists leads (
  id              text primary key,            -- phone digits, e.g. 8686224513
  business        text not null,
  phone           text not null,
  alt_phone       text,
  website_status  text,                        -- 'No website' | 'Social/booking page only' | 'Has website'
  website         text,
  owner           text,
  role            text,
  owner_source    text,
  category        text,
  area            text,
  address         text,
  rating          numeric(2,1),
  reviews         integer not null default 0,
  priority        text not null default 'B',   -- A | B | C
  status          text not null default 'new',
  call_count      integer not null default 0,
  last_called_at  timestamptz,
  follow_up_at    timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists leads_queue_idx     on leads (priority, reviews desc);
create index if not exists leads_status_idx    on leads (status);
create index if not exists leads_area_idx      on leads (area);
create index if not exists leads_category_idx  on leads (category);
create index if not exists leads_follow_up_idx on leads (follow_up_at) where follow_up_at is not null;

create table if not exists calls (
  id            bigserial primary key,
  lead_id       text not null references leads(id) on delete cascade,
  outcome       text not null,
  notes         text,
  follow_up_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists calls_lead_idx    on calls (lead_id, created_at desc);
create index if not exists calls_created_idx on calls (created_at desc);
