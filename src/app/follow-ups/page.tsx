export const dynamic = "force-dynamic";

import Link from "next/link";
import Nav from "@/components/Nav";
import StatusBadge from "@/components/StatusBadge";
import { followUps, type Lead } from "@/lib/leads";
import { formatWhen } from "@/lib/format";

export default async function FollowUpsPage() {
  const { due, upcoming, now } = await followUps();
  return (
    <>
      <Nav due={due.length} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-5">
        <List title={`Due today & overdue (${due.length})`} leads={due} now={now} empty="Nothing due — go find new leads." />
        <List title={`Next 7 days (${upcoming.length})`} leads={upcoming} now={now} empty="No follow-ups scheduled." />
      </main>
    </>
  );
}

function List({ title, leads, now, empty }: { title: string; leads: Lead[]; now: number; empty: string }) {
  return (
    <section>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <ul className="card divide-y divide-slate-100">
        {leads.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link href={`/leads/${l.id}`} className="font-medium hover:underline">{l.business}</Link>
              <div className="text-xs text-slate-500">
                {l.owner ? `${l.owner} · ` : ""}{l.category} · {l.area}
              </div>
            </div>
            <a href={`tel:+1${l.id}`} className="font-mono text-sm text-sky-700">{l.phone}</a>
            <StatusBadge status={l.status} />
            <span className={`w-36 text-right text-xs ${l.follow_up_at && Date.parse(l.follow_up_at) < now ? "font-semibold text-rose-600" : "text-slate-500"}`}>
              {formatWhen(l.follow_up_at)}
            </span>
          </li>
        ))}
        {leads.length === 0 ? <li className="px-4 py-8 text-center text-sm text-slate-500">{empty}</li> : null}
      </ul>
    </section>
  );
}
