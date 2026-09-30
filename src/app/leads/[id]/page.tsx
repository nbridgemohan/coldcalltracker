import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import StatusBadge, { WebsiteBadge } from "@/components/StatusBadge";
import CallLogger from "./CallLogger";
import { updateLead } from "@/app/actions";
import { STATUSES, statusMeta } from "@/lib/constants";
import { getCalls, getLead, parseFilters } from "@/lib/leads";
import { formatWhen, toLocalInput } from "@/lib/format";

export default async function LeadPage({ params, searchParams }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const f = parseFilters(await searchParams);
  const [lead, calls] = await Promise.all([getLead(id), getCalls(id)]);
  if (!lead) notFound();

  const queue = new URLSearchParams(Object.entries({ ...f, page: undefined }).filter(([, v]) => v) as [string, string][]).toString();
  const website = lead.website ? (lead.website.startsWith("http") ? lead.website : `https://${lead.website}`) : null;
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${lead.business} ${lead.address ?? lead.area ?? ""}`)}`;

  return (
    <>
      <Nav />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          <div className="card space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/?${queue}`} className="text-xs text-slate-500 hover:underline">← Back to list</Link>
                <h1 className="text-xl font-semibold">{lead.business}</h1>
                <p className="text-sm text-slate-500">
                  {lead.category} · {lead.area}
                  {lead.reviews ? ` · ★ ${lead.rating} (${lead.reviews} reviews)` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={lead.status} />
                <span className="text-xs text-slate-500">Priority {lead.priority} · {lead.call_count} call{lead.call_count === 1 ? "" : "s"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href={`tel:+1${lead.id}`} className="btn-primary text-base">📞 {lead.phone}</a>
              {lead.alt_phone
                ? lead.alt_phone.split(",").map((p) => (
                    <a key={p} href={`tel:+1${p.replace(/\D/g, "").slice(-10)}`} className="btn-ghost">📞 {p.trim()}</a>
                  ))
                : null}
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-ghost">Maps</a>
              {website ? <a href={website} target="_blank" rel="noreferrer" className="btn-ghost">Website / page</a> : null}
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Owner / contact" value={lead.owner ? `${lead.owner}${lead.role ? ` (${lead.role})` : ""}` : "—"} />
              <Row label="Owner source" value={lead.owner_source ?? "—"} />
              <Row label="Website">
                <WebsiteBadge value={lead.website_status} /> <span className="break-all text-slate-600">{lead.website}</span>
              </Row>
              <Row label="Address" value={lead.address ?? "—"} />
              <Row label="Last called" value={lead.last_called_at ? formatWhen(lead.last_called_at) : "Never"} />
              <Row label="Follow up" value={lead.follow_up_at ? formatWhen(lead.follow_up_at) : "—"} />
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Call history</h2>
            {calls.length === 0 ? <p className="text-sm text-slate-500">No calls logged yet.</p> : null}
            <ol className="space-y-3">
              {calls.map((c) => (
                <li key={c.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusMeta(c.outcome).color}`}>{statusMeta(c.outcome).label}</span>
                    <span className="text-xs text-slate-500">{formatWhen(c.created_at)}</span>
                    {c.follow_up_at ? <span className="text-xs text-slate-500">→ follow up {formatWhen(c.follow_up_at)}</span> : null}
                  </div>
                  {c.notes ? <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.notes}</p> : null}
                </li>
              ))}
            </ol>
          </div>

          <details className="card p-5">
            <summary className="cursor-pointer font-semibold">Edit lead details</summary>
            <form action={updateLead} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={lead.id} />
              <Field label="Owner / contact name" name="owner" defaultValue={lead.owner} />
              <Field label="Role" name="role" defaultValue={lead.role} />
              <Field label="Alt phone" name="alt_phone" defaultValue={lead.alt_phone} />
              <Field label="Website / page" name="website" defaultValue={lead.website} />
              <label className="text-sm text-slate-600">
                Status
                <select name="status" defaultValue={lead.status} className="input mt-1">
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Follow up (Trinidad time)
                <input type="datetime-local" name="followUp" defaultValue={toLocalInput(lead.follow_up_at)} className="input mt-1" />
              </label>
              <label className="text-sm text-slate-600 sm:col-span-2">
                Notes
                <textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} className="input mt-1" />
              </label>
              <div className="sm:col-span-2">
                <button className="btn-primary">Save details</button>
              </div>
            </form>
          </details>
        </section>

        <aside className="card h-fit p-5 lg:sticky lg:top-20">
          <h2 className="mb-3 font-semibold">Log this call</h2>
          <CallLogger key={`${lead.id}-${lead.call_count}`} leadId={lead.id} queue={queue} />
          {lead.notes ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="mb-1 text-xs font-medium text-slate-500">Notes</div>
              <p className="whitespace-pre-wrap text-slate-700">{lead.notes}</p>
            </div>
          ) : null}
        </aside>
      </main>
    </>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{children ?? value}</dd>
    </div>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string | null }) {
  return (
    <label className="text-sm text-slate-600">
      {label}
      <input name={name} defaultValue={defaultValue ?? ""} className="input mt-1" />
    </label>
  );
}
