import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-semibold">📞 Cold Call Tracker</h1>
        <p className="mb-5 text-sm text-slate-500">Enter the team password to continue.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
