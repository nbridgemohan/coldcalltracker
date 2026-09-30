import { db } from "@/lib/db";
import { PAGE_SIZE, STATUS_VALUES, WEBSITE_FILTERS } from "@/lib/constants";

export type Lead = {
  id: string;
  business: string;
  phone: string;
  alt_phone: string | null;
  website_status: string | null;
  website: string | null;
  owner: string | null;
  role: string | null;
  owner_source: string | null;
  category: string | null;
  area: string | null;
  address: string | null;
  rating: string | null;
  reviews: number;
  priority: string;
  status: string;
  call_count: number;
  last_called_at: string | null;
  follow_up_at: string | null;
  notes: string | null;
};

export type Call = {
  id: number;
  lead_id: string;
  outcome: string;
  notes: string | null;
  follow_up_at: string | null;
  created_at: string;
};

export type Filters = {
  q?: string;
  status?: string;
  priority?: string;
  area?: string;
  category?: string;
  website?: string;
  owner?: string;
  sort?: string;
  page?: string;
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const pick = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : undefined;
  };
  return {
    q: pick("q"),
    status: pick("status"),
    priority: pick("priority"),
    area: pick("area"),
    category: pick("category"),
    website: pick("website"),
    owner: pick("owner"),
    sort: pick("sort"),
    page: pick("page"),
  };
}

function where(f: Filters) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };

  if (f.q) {
    params.push(`%${f.q}%`);
    const n = params.length;
    clauses.push(`(business ilike $${n} or phone ilike $${n} or owner ilike $${n} or address ilike $${n})`);
  }
  if (f.status === "open") clauses.push(`status not in ${CLOSED}`);
  else if (f.status && STATUS_VALUES.includes(f.status)) add("status = ?", f.status);
  if (f.priority && ["A", "B", "C"].includes(f.priority)) add("priority = ?", f.priority);
  if (f.area) add("area = ?", f.area);
  if (f.category) add("category = ?", f.category);
  const web = WEBSITE_FILTERS.find((w) => w.value === f.website);
  if (web) add("website_status = ?", web.match);
  if (f.owner === "1") clauses.push(`owner is not null and owner <> ''`);
  if (f.owner === "verified") clauses.push(`owner is not null and owner_source is not null and owner_source <> 'Business name'`);

  return { sql: clauses.length ? `where ${clauses.join(" and ")}` : "", params };
}

function orderBy(sort?: string) {
  switch (sort) {
    case "recent":
      return "order by last_called_at desc nulls last, id";
    case "reviews":
      return "order by reviews desc, id";
    case "name":
      return "order by business, id";
    default:
      return "order by priority, (owner is not null and owner_source <> 'Business name') desc, reviews desc, id";
  }
}

export async function listLeads(f: Filters) {
  const sql = db();
  const w = where(f);
  const page = Math.max(1, Number(f.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const [rows, count] = await Promise.all([
    sql.query(`select * from leads ${w.sql} ${orderBy(f.sort)} limit ${PAGE_SIZE} offset ${offset}`, w.params),
    sql.query(`select count(*)::int as n from leads ${w.sql}`, w.params),
  ]);
  return { rows: rows as Lead[], total: (count[0] as { n: number }).n, page };
}

/** Next uncalled lead in queue order, honouring the current filters. */
export async function nextLeadId(f: Filters, skipId?: string) {
  const w = where({ ...f, status: f.status ?? "new" });
  const params = [...w.params];
  let extra = "";
  if (skipId) {
    params.push(skipId);
    extra = `${w.sql ? " and" : "where"} id <> $${params.length}`;
  }
  const rows = await db().query(`select id from leads ${w.sql}${extra} ${orderBy(f.sort)} limit 1`, params);
  return (rows[0] as { id: string } | undefined)?.id ?? null;
}

export async function getLead(id: string) {
  const rows = await db()`select * from leads where id = ${id}`;
  return (rows[0] as Lead | undefined) ?? null;
}

export async function getCalls(id: string) {
  return (await db()`select * from calls where lead_id = ${id} order by created_at desc`) as Call[];
}

// Midnight tonight / this morning in Trinidad time, as timestamptz.
const TT_TOMORROW = `((date_trunc('day', now() at time zone 'America/Port_of_Spain') + interval '1 day') at time zone 'America/Port_of_Spain')`;
const TT_TODAY = `(date_trunc('day', now() at time zone 'America/Port_of_Spain') at time zone 'America/Port_of_Spain')`;
const CLOSED = `('won','not_interested','wrong_number','do_not_call')`;

export async function followUps() {
  const sql = db();
  const [due, upcoming] = await Promise.all([
    sql.query(`select * from leads where follow_up_at < ${TT_TOMORROW} and status not in ${CLOSED} order by follow_up_at limit 300`),
    sql.query(`select * from leads where follow_up_at >= ${TT_TOMORROW} and follow_up_at < ${TT_TOMORROW} + interval '7 days' and status not in ${CLOSED} order by follow_up_at limit 300`),
  ]);
  return { due: due as Lead[], upcoming: upcoming as Lead[], now: Date.now() };
}

export async function stats() {
  const sql = db();
  const [byStatus, calls, totals] = await Promise.all([
    sql`select status, count(*)::int as n from leads group by status`,
    sql.query(`select
          count(*) filter (where created_at >= ${TT_TODAY})::int as today,
          count(*) filter (where created_at >= ${TT_TODAY} - interval '6 days')::int as week,
          count(*)::int as all_time
        from calls`),
    sql.query(`select count(*)::int as leads,
          count(*) filter (where follow_up_at < ${TT_TOMORROW} and status not in ${CLOSED})::int as due
        from leads`),
  ]);
  return {
    byStatus: Object.fromEntries((byStatus as { status: string; n: number }[]).map((r) => [r.status, r.n])),
    calls: calls[0] as { today: number; week: number; all_time: number },
    totals: totals[0] as { leads: number; due: number },
  };
}

export async function filterOptions() {
  const sql = db();
  const [areas, categories] = await Promise.all([
    sql`select area as v, count(*)::int as n from leads where area is not null and area <> '' group by area order by n desc limit 80`,
    sql`select category as v, count(*)::int as n from leads where category is not null and category <> '' group by category order by n desc limit 150`,
  ]);
  return {
    areas: areas as { v: string; n: number }[],
    categories: categories as { v: string; n: number }[],
  };
}
