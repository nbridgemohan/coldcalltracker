import { statusMeta } from "@/lib/constants";

export default function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${m.color}`}>{m.label}</span>;
}

export function WebsiteBadge({ value }: { value: string | null }) {
  if (value === "No website") return <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">No website</span>;
  if (value?.startsWith("Social")) return <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Social only</span>;
  if (value === "Has website") return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">Has site</span>;
  return null;
}
