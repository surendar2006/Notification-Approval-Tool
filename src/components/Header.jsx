import { LayoutDashboard, UserCircle2 } from "lucide-react";

export default function Header({ user, onSignOut }) {
  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-surface px-6 py-5 shadow-soft md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin Dashboard</p>
          <h1 className="text-2xl font-semibold text-ink">Notification Approval System</h1>
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-3 rounded-full border border-border bg-white px-4 py-2">
          <UserCircle2 className="h-6 w-6 text-slate-500" />
          <div className="text-sm">
            <p className="font-semibold text-ink">{user.name}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="ml-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/20"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
