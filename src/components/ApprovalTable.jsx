import StatusBadge from "./StatusBadge.jsx";

const headerLabels = [
  "Leave Type",
  "Requester",
  "From Date",
  "To Date",
  "Duration",
  "Remarks",
  "Status",
];

export default function ApprovalTable({
  notifications,
  selectedId,
  onSelect,
  formatDate,
  formatDuration,
  parseScheduleWindow,
  isLoading,
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Approval queue</h2>
          <p className="text-sm text-slate-400">Review and act on leave requests.</p>
        </div>
        <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          {notifications.length} items
        </span>
      </div>

      <div className="hidden grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.7fr_1.2fr_0.8fr] gap-4 border-b border-border bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 md:grid">
        {headerLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="divide-y divide-border">
        {isLoading && (
          <div className="px-6 py-8 text-sm text-slate-400">Loading approvals...</div>
        )}
        {!isLoading && notifications.length === 0 && (
          <div className="px-6 py-8 text-sm text-slate-400">No approvals match your filters.</div>
        )}
        {!isLoading &&
          notifications.map((notification) => {
            const schedule = parseScheduleWindow(notification.scheduledFor);
            const active = notification.id === selectedId;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => onSelect(notification.id)}
                className={`grid w-full grid-cols-1 gap-3 px-6 py-4 text-left transition hover:bg-slate-50 md:grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.7fr_1.2fr_0.8fr] md:gap-4 ${
                  active ? "bg-slate-50 ring-1 ring-brand/30" : "bg-white"
                }`}
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{notification.id}</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{notification.title}</p>
                  <p className="text-xs text-slate-400">{notification.mentor}</p>
                </div>
                <div className="text-sm font-semibold text-ink">{notification.requesterName || "Unknown"}</div>
                <div className="text-sm text-ink">{formatDate(schedule.from)}</div>
                <div className="text-sm text-ink">{formatDate(schedule.to)}</div>
                <div className="text-sm text-ink">{formatDuration(schedule.from, schedule.to)}</div>
                <div className="text-sm text-slate-500">{notification.message || "Not provided"}</div>
                <div>
                  <StatusBadge status={notification.status} />
                </div>
              </button>
            );
          })}
      </div>
    </section>
  );
}
