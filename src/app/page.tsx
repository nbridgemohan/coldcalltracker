import Link from "next/link";
import Nav from "@/components/Nav";
import StatusBadge, { WebsiteBadge } from "@/components/StatusBadge";
import { STATUSES, WEBSITE_FILTERS, PAGE_SIZE } from "@/lib/constants";
import { filterOptions, listLeads, parseFilters, stats, type Filters } from "@/lib/leads";
import { formatWhen } from "@/lib/format";

export default async function LeadsPage({ searchParams }: PageProps<"/">) {
  const f = parseFilters(await searchParams);
  const [{ rows, total, page }, opts, s] = await Promise.all([listLeads(f), filterOptions(), stats()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: Partial<Filters>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) if (v) p.set(k, String(v));
    return p.toString();
  };
  const queueQs = qs({ page: undefined, status: f.status === "new" ? undefined : f.status });

  return (
    <>
      <Nav due={s.totals.due} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Calls today" value={s.calls.today} />
          <Stat label="Calls this week" value={s.calls.week} />
          <Stat label="Interested / meetings" value={(s.byStatus.interested ?? 0) + (s.byStatus.meeting ?? 0)} />
          <Stat label="Won" value={s.byStatus.won ?? 0} />
        </section>

        <form className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-8" method="get">
          <input name="q" defaultValue={f.q} placeholder="Search name, phone, owner…" className="input col-span-2" />
          <select name="status" defaultValue={f.status ?? ""} className="input">
            <option value="">Any status</option>
            <option value="open">Open (not closed)</option>
            {STATUSES.map((st) => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>
          <select name="priority" defaultValue={f.priority ?? ""} className="input">
            <option value="">Any priority</option>
            <option value="A">A – no site, busy</option>
            <option value="B">B – no site</option>
            <option value="C">C – has site</option>
          </select>
          <select name="website" defaultValue={f.website ?? ""} className="input">
            <option value="">Any website</option>
            {WEBSITE_FILTERS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
          <select name="area" defaultValue={f.area ?? ""} className="input">
            <option value="">Any area</option>
            {opts.areas.map((a) => (
              <option key={a.v} value={a.v}>{a.v} ({a.n})</option>
            ))}
          </select>
          <select name="category" defaultValue={f.category ?? ""} className="input">
            <option value="">Any category</option>
            {opts.categories.map((c) => (
              <option key={c.v} value={c.v}>{c.v} ({c.n})</option>
            ))}
          </select>
          <select name="owner" defaultValue={f.owner ?? ""} className="input">
            <option value="">Owner: any</option>
            <option value="1">Has owner name</option>
            <option value="verified">Owner found online</option>
          </select>
          <select name="sort" defaultValue={f.sort ?? ""} className="input">
            <option value="">Sort: best first</option>
            <option value="reviews">Most reviews</option>
            <option value="recent">Recently called</option>
            <option value="name">Name A–Z</option>
          </select>
          <div className="col-span-2 flex gap-2 sm:col-span-4 lg:col-span-8">
            <button className="btn-primary">Filter</button>
            <Link href="/" className="btn-ghost">Reset</Link>
            <Link href={`/next?${queueQs}`} className="btn-ghost ml-auto">Call next in this list →</Link>
          </div>
        </form>

        <p className="text-sm text-slate-500">
          {total.toLocaleString()} leads · page {page} of {pages}
        </p>

        <ul className="card divide-y divide-slate-100">
          {rows.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <Link href={`/leads/${l.id}?${queueQs}`} className="font-medium text-slate-900 hover:underline">
                  {l.business}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{l.priority}</span>
                  <span>{l.category}</span>
                  <span>· {l.area}</span>
                  {l.reviews ? <span>· ★ {l.rating} ({l.reviews})</span> : null}
                  <WebsiteBadge value={l.website_status} />
                </div>
                {l.owner ? (
                  <div className="text-xs text-slate-600">
                    👤 {l.owner}
                    {l.role ? <span className="text-slate-400"> · {l.role}</span> : null}
                  </div>
                ) : null}
              </div>
              <a href={`tel:+1${l.id}`} className="font-mono text-sm text-sky-700 hover:underline">
                {l.phone}
              </a>
              <div className="flex w-40 flex-col items-end gap-1">
                <StatusBadge status={l.status} />
                {l.last_called_at ? <span className="text-xs text-slate-400">{formatWhen(l.last_called_at)}</span> : null}
              </div>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-4 py-10 text-center text-slate-500">No leads match these filters.</li> : null}
        </ul>

        <div className="flex justify-between">
          {page > 1 ? <Link className="btn-ghost" href={`/?${qs({ page: String(page - 1) })}`}>← Prev</Link> : <span />}
          {page < pages ? <Link className="btn-ghost" href={`/?${qs({ page: String(page + 1) })}`}>Next →</Link> : <span />}
        </div>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
