export const dynamic = "force-dynamic";

import Link from "next/link";
import Nav from "@/components/Nav";
import { STATUSES } from "@/lib/constants";
import { stats } from "@/lib/leads";

export default async function StatsPage() {
  const s = await stats();
  const worked = s.totals.leads - (s.byStatus.new ?? 0);
  const positive = (s.byStatus.interested ?? 0) + (s.byStatus.meeting ?? 0) + (s.byStatus.proposal ?? 0) + (s.byStatus.won ?? 0);
  const max = Math.max(1, ...STATUSES.map((st) => s.byStatus[st.value] ?? 0).filter((_, i) => i > 0));

  return (
    <>
      <Nav due={s.totals.due} />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Calls today" value={s.calls.today} />
          <Tile label="Calls (7 days)" value={s.calls.week} />
          <Tile label="Leads worked" value={worked} sub={`of ${s.totals.leads.toLocaleString()}`} />
          <Tile label="Positive rate" value={worked ? Math.round((positive / worked) * 100) : 0} suffix="%" sub="interested → won" />
        </div>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Pipeline</h2>
          <ul className="space-y-2">
            {STATUSES.filter((st) => st.value !== "new").map((st) => {
              const n = s.byStatus[st.value] ?? 0;
              return (
                <li key={st.value} className="grid grid-cols-[140px_1fr_60px] items-center gap-3 text-sm">
                  <Link href={`/?status=${st.value}`} className="hover:underline">{st.label}</Link>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-slate-800" style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                  <span className="text-right tabular-nums">{n.toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-slate-500">{(s.byStatus.new ?? 0).toLocaleString()} leads not called yet.</p>
        </section>
      </main>
    </>
  );
}

function Tile({ label, value, suffix, sub }: { label: string; value: number; suffix?: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}{suffix}</div>
      <div className="text-xs text-slate-500">{label}{sub ? ` · ${sub}` : ""}</div>
    </div>
  );
}
