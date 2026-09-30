import Link from "next/link";
import { logout } from "@/app/actions";

export default function Nav({ due }: { due?: number }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-3 text-sm">
        <Link href="/" className="mr-3 whitespace-nowrap font-semibold text-slate-900">
          📞 Cold Call Tracker
        </Link>
        <Link href="/" className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">
          Leads
        </Link>
        <Link href="/follow-ups" className="whitespace-nowrap rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">
          Follow-ups
          {due ? <span className="ml-1 rounded-full bg-rose-600 px-1.5 text-xs text-white">{due}</span> : null}
        </Link>
        <Link href="/stats" className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">
          Stats
        </Link>
        <Link href="/next?priority=A" className="btn-primary ml-auto whitespace-nowrap">
          Start calling →
        </Link>
        <form action={logout}>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">Log out</button>
        </form>
      </nav>
    </header>
  );
}
