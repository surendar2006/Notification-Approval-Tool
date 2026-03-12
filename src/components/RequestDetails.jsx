import {
  BadgeCheck,
  CalendarDays,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  UserCircle2,
} from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";

const detailRows = [
  { key: "id", label: "Request ID", icon: BadgeCheck },
  { key: "title", label: "Leave Type", icon: FileText },
  { key: "mentor", label: "Mentor", icon: UserCircle2 },
  { key: "requesterName", label: "Requester", icon: UserCircle2 },
  { key: "requesterEmail", label: "Email", icon: Mail },
  { key: "requesterPhone", label: "Phone", icon: Phone },
  { key: "dates", label: "Dates", icon: CalendarDays },
  { key: "message", label: "Remarks", icon: MessageSquare },
];

export default function RequestDetails({
  notification,
  editDraft,
  onEditChange,
  decisionNote,
  onDecisionNoteChange,
  actionState,
  onSave,
  onApprove,
  onReject,
  onDelete,
  formatDate,
  parseScheduleWindow,
}) {
  if (!notification || !editDraft) {
    return (
      <aside className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <p className="text-sm text-slate-400">Select a request to review details.</p>
      </aside>
    );
  }

  const schedule = parseScheduleWindow(notification.scheduledFor);
  const detailValues = {
    id: notification.id,
    title: notification.title,
    mentor: notification.mentor || "Not provided",
    requesterName: notification.requesterName || "Not provided",
    requesterEmail: notification.requesterEmail || "Not provided",
    requesterPhone: notification?.recipients?.phone || "Not provided",
    dates: `${formatDate(schedule.from)} → ${formatDate(schedule.to)}`,
    message: notification.message || "Not provided",
  };

  const canModify = notification.status !== "Approved";

  return (
    <aside className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{notification.id}</p>
          <h3 className="mt-2 text-xl font-semibold text-ink">{notification.title}</h3>
        </div>
        <StatusBadge status={notification.status} />
      </div>

      <div className="mt-6 grid gap-4">
        {detailRows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.key} className="flex items-start gap-3 rounded-xl border border-border bg-slate-50 px-4 py-3">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400">{row.label}</p>
                <p className="text-sm font-medium text-ink">{detailValues[row.key]}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-border bg-white p-4">
          <h4 className="text-sm font-semibold text-ink">Edit details</h4>
          <div className="mt-3 grid gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Title</label>
            <input
              value={editDraft.title || ""}
              onChange={(event) => onEditChange({ ...editDraft, title: event.target.value })}
              className="rounded-xl border border-border bg-slate-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Message</label>
            <textarea
              value={editDraft.message || ""}
              onChange={(event) => onEditChange({ ...editDraft, message: event.target.value })}
              rows={3}
              className="rounded-xl border border-border bg-slate-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4">
          <h4 className="text-sm font-semibold text-ink">Decision notes</h4>
          <textarea
            value={decisionNote}
            onChange={(event) => onDecisionNoteChange(event.target.value)}
            placeholder="Add rationale for approval or rejection..."
            rows={3}
            className="mt-3 w-full rounded-xl border border-border bg-slate-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {actionState.status !== "idle" && (
        <div className="mt-5 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {actionState.message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {canModify && (
          <button
            type="button"
            onClick={onSave}
            disabled={actionState.status === "loading"}
            className="rounded-xl border border-border bg-slate-50 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-100 disabled:opacity-60"
          >
            Save changes
          </button>
        )}
        {canModify && (
          <button
            type="button"
            onClick={onReject}
            disabled={actionState.status === "loading"}
            className="rounded-xl border border-border bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
          >
            Reject & notify
          </button>
        )}
        {canModify && (
          <button
            type="button"
            onClick={onApprove}
            disabled={actionState.status === "loading"}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            Approve & release
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={actionState.status === "loading"}
          className="rounded-xl border border-border bg-slate-50 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-100 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </aside>
  );
}
